import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getPgPool } from '@/db';
import { notifyPasswordResetCode, notifyPasswordReset } from '@/lib/mail/notifications';
import { isValidEmail } from '@/lib/mail/address';
import { clearRateLimit, consumeRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { passwordProblem } from '@/lib/profile';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';
import { hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';

const MAX_OTP_ATTEMPTS = 5;
const OTP_WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return NextResponse.json(
			{ error: 'IP adresiniz siber güvenlik politikası nedeniyle geçici olarak karantinaya alınmıştır.' },
			{ status: 403 }
		);
	}
	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[WAF] Saldırı imzası engellendi (${waf.signature}): POST /api/auth/reset-password`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/auth/reset-password',
		});
		return NextResponse.json(
			{ error: 'Güvenlik duvarı (WAF) tarafından şüpheli istek engellendi.' },
			{ status: 403 }
		);
	}
	const lockdown = await getLockdownState();
	if (lockdown.active) {
		return NextResponse.json(
			{ error: 'Sistem şu anda yüksek güvenlik (Defcon Lockdown) modundadır. Şifre sıfırlama işlemleri geçici olarak durdurulmuştur.' },
			{ status: 503 }
		);
	}
	const limit = consumeRateLimit(`pwd_reset:${ip}`, 10, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Çok fazla istek, lütfen bir süre sonra tekrar deneyin' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const { action, email, kod, yeniSifre } = body;
		const normalizedEmail = String(email || '').trim().toLowerCase();

		if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
			return NextResponse.json({ error: 'Geçerli bir e-posta adresi giriniz.' }, { status: 400 });
		}

		const pool = getPgPool();

		// ADIM 1: Şifre sıfırlama kodu talep etme
		if (action === 'request_code') {
			const reqEmailLimit = consumeRateLimit(`pwd_reset:req:${normalizedEmail}`, 5, 15 * 60_000);
			if (!reqEmailLimit.allowed) {
				return NextResponse.json(
					{ error: 'Bu e-posta adresi için çok fazla kod talep edildi. Lütfen daha sonra tekrar deneyin.' },
					{ status: 429, headers: { 'Retry-After': String(reqEmailLimit.retryAfter) } }
				);
			}

			const UNIFORM_MESSAGE =
				'Eğer bu e-posta adresi sistemde kayıtlı ise 6 haneli şifre sıfırlama kodu gönderilmiştir.';

			const user = await getUserByEmail(normalizedEmail);
			if (!user) {
				// Prevent email enumeration by returning the exact same message as when the user exists
				return NextResponse.json({
					success: true,
					message: UNIFORM_MESSAGE,
				});
			}

			const code = String(crypto.randomInt(100000, 1000000));
			const sonGecerlilik = Date.now() + 15 * 60 * 1000; // 15 dakika
			const hashedCode = hashOtpCode(code);

			// Süresi dolmuş eski OTP kayıtlarını temizle
			await pool.query('DELETE FROM email_verifications WHERE expires_at < $1', [Date.now()]);

			await pool.query(
				`INSERT INTO email_verifications (email, code, type, expires_at, created_at)
				 VALUES ($1, $2, 'sifre_sifirlama', $3, $4)
				 ON CONFLICT (email) DO UPDATE SET code = $2, type = 'sifre_sifirlama', expires_at = $3, created_at = $4`,
				[normalizedEmail, hashedCode, sonGecerlilik, Date.now()]
			);

			clearRateLimit(`pwd_reset:verify:${normalizedEmail}`);

			void notifyPasswordResetCode(
				{ ad: user.ad, soyad: user.soyad, email: user.email },
				code
			);

			await logSystemEvent({
				servis: 'auth',
				seviye: 'INFO',
				mesaj: `Şifre sıfırlama kodu gönderildi: ${normalizedEmail}`,
				userId: user.id,
				ip,
			});

			return NextResponse.json({
				success: true,
				message: UNIFORM_MESSAGE,
			});
		}

		// ADIM 2: Kodu doğrula ve yeni şifreyi kaydet
		if (action === 'verify_and_reset') {
			const verifyKey = `pwd_reset:verify:${normalizedEmail}`;
			const gate = isRateLimited(verifyKey, MAX_OTP_ATTEMPTS);
			if (!gate.allowed) {
				await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2', [
					normalizedEmail,
					'sifre_sifirlama',
				]);
				return NextResponse.json(
					{ error: 'Çok fazla hatalı kod denemesi yapıldı. Güvenliğiniz için kod iptal edildi, lütfen yeni kod talep edin.' },
					{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
				);
			}

			if (!kod || String(kod).trim().length !== 6) {
				return NextResponse.json({ error: '6 haneli şifre sıfırlama kodunu giriniz.' }, { status: 400 });
			}

			const cleanPass = String(yeniSifre || '').trim();
			const passProblem = passwordProblem(cleanPass, { email: normalizedEmail });
			if (passProblem) {
				return NextResponse.json({ error: passProblem }, { status: 400 });
			}

			const codeRes = await pool.query(
				'SELECT code AS kod, expires_at AS songecerlilik FROM email_verifications WHERE email = $1 AND type = $2',
				[normalizedEmail, 'sifre_sifirlama']
			);

			const record = codeRes.rows[0];
			const expectedCode = record ? String(record.kod ?? record.code ?? '').trim() : '';
			const submittedCode = String(kod).trim();
			if (!record || !verifyOtpCode(expectedCode, submittedCode)) {
				const attempts = recordFailure(verifyKey, OTP_WINDOW_MS);
				if (attempts >= MAX_OTP_ATTEMPTS) {
					await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2', [
						normalizedEmail,
						'sifre_sifirlama',
					]);
				}
				await logSystemEvent({
					servis: 'auth',
					seviye: 'WARN',
					mesaj: `Şifre sıfırlama hatalı OTP denemesi: ${normalizedEmail}`,
					detay: { email: normalizedEmail, denemeSayisi: attempts },
					ip,
				});
				return NextResponse.json({ error: 'Şifre sıfırlama kodu hatalıdır.' }, { status: 400 });
			}

			const sonGecerlilik = Number(record.songecerlilik ?? record.expiresAt ?? record.expires_at ?? 0);
			if (sonGecerlilik < Date.now()) {
				return NextResponse.json({ error: 'Sıfırlama kodunun süresi dolmuş. Lütfen yeni kod talep edin.' }, { status: 400 });
			}

			const user = await getUserByEmail(normalizedEmail);
			if (!user) {
				return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 });
			}

			// Şifreyi güncelle ve tüm mevcut oturumları düşür (session_token = NULL)
			const hash = await bcrypt.hash(cleanPass, 12);
			await pool.query('UPDATE users SET password_hash = $1, session_token = NULL, session_expires_at = NULL WHERE id = $2', [
				hash,
				user.id,
			]);

			// Kodu ve sayacı temizle
			await pool.query('DELETE FROM email_verifications WHERE email = $1', [normalizedEmail]);
			clearRateLimit(verifyKey);

			void notifyPasswordReset({ ad: user.ad, soyad: user.soyad, email: user.email });

			await logSystemEvent({
				servis: 'auth',
				seviye: 'INFO',
				mesaj: `Kullanıcı şifresi e-posta doğrulamasıyla güncellendi (eski oturumlar sonlandırıldı): ${user.ad} ${user.soyad} (${user.email})`,
				userId: user.id,
				ip,
			});

			return NextResponse.json({
				success: true,
				message: 'Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz.',
			});
		}

		return NextResponse.json({ error: 'Geçersiz işlem parametresi.' }, { status: 400 });
	} catch (error) {
		console.error('[reset-password] error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
