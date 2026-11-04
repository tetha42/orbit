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
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { getLockdownState, isIpBanned, recordSecurityStrike } from '@/db/repositories/security.repo';
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
			service: 'security',
			level: 'ERROR',
			message: `[WAF] Saldırı imzası engellendi (${waf.signature}): POST /api/auth/reset-password`,
			detail: { category: waf.category, signature: waf.signature },
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
		const { action, email, code, newPassword } = body;
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
			const lastValidity = Date.now() + 15 * 60 * 1000; // 15 dakika
			const hashedCode = hashOtpCode(code);

			// Süresi dolmuş eski OTP kayıtlarını temizle
			await pool.query('DELETE FROM verification_tokens WHERE expires_at < $1', [Date.now()]);

			await pool.query(
				'DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2',
				[normalizedEmail, 'password_reset']
			);
			await pool.query(
				`INSERT INTO verification_tokens (id, user_id, token_type, target, token_hash, expires_at, created_at)
				 VALUES ($1, $2, 'password_reset', $3, $4, $5, $6)`,
				[`otp_${crypto.randomUUID()}`, user.id, normalizedEmail, hashedCode, lastValidity, Date.now()]
			);

			clearRateLimit(`pwd_reset:verify:${normalizedEmail}`);

			void notifyPasswordResetCode(
				{
					name: user.name,
					surname: user.surname,
					email: user.email,
					preferredLanguage: user.preferredLanguage,
				},
				code,
				user.preferredLanguage
			);

			await logSystemEvent({
				service: 'auth',
				level: 'INFO',
				message: `Şifre sıfırlama kodu gönderildi: ${normalizedEmail}`,
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
				await pool.query('DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2', [
					normalizedEmail,
					'password_reset',
				]);
				return NextResponse.json(
					{ error: 'Çok fazla hatalı kod denemesi yapıldı. Güvenliğiniz için kod iptal edildi, lütfen yeni kod talep edin.' },
					{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
				);
			}

			if (!code || String(code).trim().length !== 6) {
				return NextResponse.json({ error: '6 haneli şifre sıfırlama kodunu giriniz.' }, { status: 400 });
			}

			const cleanPass = String(newPassword || '').trim();
			const passProblem = passwordProblem(cleanPass, { email: normalizedEmail });
			if (passProblem) {
				return NextResponse.json({ error: passProblem }, { status: 400 });
			}

			const codeRes = await pool.query(
				'SELECT token_hash AS code, expires_at AS lastValidity FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2 ORDER BY created_at DESC LIMIT 1',
				[normalizedEmail, 'password_reset']
			);

			const record = codeRes.rows[0];
			const expectedCode = record ? String(record.code ?? record.tokenHash ?? record.token_hash ?? '').trim() : '';
			const submittedCode = String(code).trim();
			if (!record || !verifyOtpCode(expectedCode, submittedCode)) {
				const attempts = recordFailure(verifyKey, OTP_WINDOW_MS);
				if (attempts >= MAX_OTP_ATTEMPTS) {
					await pool.query('DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2', [
						normalizedEmail,
						'password_reset',
					]);
				}
				await logSystemEvent({
					service: 'auth',
					level: 'WARN',
					message: `Şifre sıfırlama hatalı OTP denemesi: ${normalizedEmail}`,
					detail: { email: normalizedEmail, attemptCount: attempts },
					ip,
				});
				return NextResponse.json({ error: 'Şifre sıfırlama kodu hatalıdır.' }, { status: 400 });
			}

			const lastValidity = Number(record.lastValidity ?? record.expiresAt ?? record.expires_at ?? 0);
			if (lastValidity < Date.now()) {
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
			await pool.query('DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2', [
				normalizedEmail,
				'password_reset',
			]);
			clearRateLimit(verifyKey);

			void notifyPasswordReset({ name: user.name, surname: user.surname, email: user.email });

			await logSystemEvent({
				service: 'auth',
				level: 'INFO',
				message: `Kullanıcı şifresi e-posta doğrulamasıyla güncellendi (eski oturumlar sonlandırıldı): ${user.name} ${user.surname} (${user.email})`,
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
