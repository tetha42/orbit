import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getUserByHandle, createUser, getPgPool, getSystemSettings } from '@/db';
import { notifyRegistrationReceived, notifyEmailVerificationCode } from '@/lib/mail/notifications';
import { isValidEmail } from '@/lib/mail/address';
import { clearRateLimit, consumeRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { sifreHatasi, SINIF_MAX, SINIF_MIN } from '@/lib/profile';
import { inspectRequestPayload } from '@/lib/waf';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { getEmergencyKillSwitches, getLockdownState, isIpBanned, recordSecurityStrike } from '@/server/db/domains/security.repo';
import { hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';

const MAX_OTP_ATTEMPTS = 5;
const OTP_WINDOW_MS = 15 * 60_000;

function hasUnsafeTextChars(value: string): boolean {
	return /[<>]|\p{Cc}/u.test(value);
}

function generateMemberHandle(): string {
	return `ORB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function POST(request: Request) {
	const ip = clientAddress(request);
	const ban = await isIpBanned(ip);
	if (ban.banned) {
		return NextResponse.json(
			{ error: 'Your IP address has been temporarily quarantined due to security policy.' },
			{ status: 403 }
		);
	}
	const waf = inspectRequestPayload(request);
	if (waf.matched) {
		void logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `[WAF] Attack signature blocked (${waf.signature}): POST /api/auth/register`,
			detay: { category: waf.category, signature: waf.signature },
			ip,
		});
		void recordSecurityStrike({
			ip,
			points: waf.points,
			reason: `WAF: ${waf.signature}`,
			path: '/api/auth/register',
		});
		return NextResponse.json(
			{ error: 'Suspicious request blocked by the Web Application Firewall (WAF).' },
			{ status: 403 }
		);
	}
	const lockdown = await getLockdownState();
	if (lockdown.active) {
		return NextResponse.json(
			{ error: 'The system is currently in high-security Defcon Lockdown mode. New member registrations are temporarily paused.' },
			{ status: 503 }
		);
	}
	const emergency = await getEmergencyKillSwitches();
	if (emergency.disableRegistrations) {
		return NextResponse.json(
			{ error: 'Registrations are currently disabled by emergency security protocol (Kill-Switch).' },
			{ status: 503 }
		);
	}
	const limit = consumeRateLimit(`register:${ip}`, 10, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many requests. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
		);
	}
	try {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== 'object') {
			return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
		}
		const { ad, soyad, email, password, ogrenciNo, memberId, bolum, sinif, verificationCode, hp_website } = body;

		// Anti-bot Honeypot Check
		if (hp_website || (body as Record<string, unknown>).trap_website) {
			void recordSecurityStrike({
				ip,
				points: 30,
				reason: 'Bot Honeypot Triggered: POST /api/auth/register',
				path: '/api/auth/register',
			});
			void logSystemEvent({
				servis: 'security',
				seviye: 'WARN',
				mesaj: `[Honeypot] Automated bot registration attempt blocked: ${ip}`,
				detay: { ip },
				ip,
			});
			return NextResponse.json({ error: 'Invalid form submission detected.', bot_detected: true }, { status: 400 });
		}

		const normalizedEposta = String(email || '').trim().toLowerCase();
		const rawHandle = String(ogrenciNo ?? memberId ?? '').trim();
		const cleanOgrenciNo = rawHandle || generateMemberHandle();
		const cleanAd = String(ad || '').trim();
		const cleanSoyad = String(soyad || '').trim();
		const cleanBolum = String(bolum || '').trim();

		if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanOgrenciNo)) {
			return NextResponse.json(
				{ error: 'Member ID / Handle must be 3–32 characters using letters, numbers, hyphens, or underscores.' },
				{ status: 400 }
			);
		}

		if (!cleanAd || !cleanSoyad || !normalizedEposta || typeof password !== 'string' || !password || !cleanBolum) {
			return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 });
		}

		if (
			cleanAd.length < 2 ||
			cleanAd.length > 60 ||
			cleanSoyad.length < 2 ||
			cleanSoyad.length > 60 ||
			cleanBolum.length < 2 ||
			cleanBolum.length > 100 ||
			hasUnsafeTextChars(cleanAd) ||
			hasUnsafeTextChars(cleanSoyad) ||
			hasUnsafeTextChars(cleanBolum)
		) {
			return NextResponse.json({ error: 'Invalid characters or length in first name, last name, or track.' }, { status: 400 });
		}

		const parsedSinif = sinif === undefined || sinif === null || sinif === '' ? 1 : Number(sinif);
		if (!Number.isInteger(parsedSinif) || parsedSinif < SINIF_MIN || parsedSinif > SINIF_MAX) {
			return NextResponse.json({ error: `Experience level must be between ${SINIF_MIN} and ${SINIF_MAX}.` }, { status: 400 });
		}

		if (body.kvkkKabul === false || body.termsAccepted === false || body.privacyAccepted === false) {
			return NextResponse.json({ error: 'You must accept the Terms of Service and Privacy & Cookie Policy.' }, { status: 400 });
		}

		if (!isValidEmail(normalizedEposta)) {
			return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
		}

		const passProblem = sifreHatasi(password, { email: normalizedEposta });
		if (passProblem) {
			return NextResponse.json({ error: passProblem }, { status: 400 });
		}

		// Email uniqueness check
		const existingUser = await getUserByEmail(normalizedEposta);
		if (existingUser) {
			return NextResponse.json({ error: 'An account or pending application with this email address already exists.' }, { status: 409 });
		}

		// Member ID / Handle uniqueness check
		const existingOgrenci = await getUserByHandle(cleanOgrenciNo);
		if (existingOgrenci) {
			return NextResponse.json({ error: 'This Member ID / Handle is already registered.' }, { status: 409 });
		}

		const pool = getPgPool();
		// Purge expired OTP records immediately
		await pool.query('DELETE FROM email_verifications WHERE expires_at < $1', [Date.now()]);

		const verifyKey = `register:verify:${normalizedEposta}`;

		// STEP 1: Generate and send verification code if not provided yet
		if (!verificationCode) {
			const sendLimit = consumeRateLimit(`register:send:${normalizedEposta}`, 3, OTP_WINDOW_MS);
			if (!sendLimit.allowed) {
				return NextResponse.json(
					{ error: 'Verification codes requested too frequently for this email address. Please try again later.' },
					{ status: 429, headers: { 'Retry-After': String(sendLimit.retryAfter) } },
				);
			}

			const kod = String(crypto.randomInt(100000, 1000000));
			const sonGecerlilik = Date.now() + OTP_WINDOW_MS;
			const hashedKod = hashOtpCode(kod);

			await pool.query(
				`INSERT INTO email_verifications (email, code, type, expires_at, created_at)
				 VALUES ($1, $2, 'registration', $3, $4)
				 ON CONFLICT (email) DO UPDATE SET code = $2, type = 'registration', expires_at = $3, created_at = $4`,
				[normalizedEposta, hashedKod, sonGecerlilik, Date.now()]
			);

			clearRateLimit(verifyKey);

			void notifyEmailVerificationCode(
				{ ad: cleanAd, soyad: cleanSoyad, email: normalizedEposta },
				kod
			);

			await logSystemEvent({
				servis: 'auth',
				seviye: 'INFO',
				mesaj: `Registration verification code sent: ${normalizedEposta}`,
				ip,
			});

			return NextResponse.json({
				success: true,
				requireVerification: true,
				memberId: cleanOgrenciNo,
				message: `A 6-digit verification code has been sent to ${normalizedEposta}. Please enter the code to complete registration.`,
			});
		}

		// STEP 2: Verify the submitted OTP code
		const gate = isRateLimited(verifyKey, MAX_OTP_ATTEMPTS);
		if (!gate.allowed) {
			await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2', [
				normalizedEposta,
				'registration',
			]);
			return NextResponse.json(
				{ error: 'Too many invalid verification attempts. Please request a new code.' },
				{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
			);
		}

		const codeRes = await pool.query(
			'SELECT code AS kod, expires_at AS songecerlilik FROM email_verifications WHERE email = $1 AND type = $2',
			[normalizedEposta, 'registration']
		);

		const record = codeRes.rows[0];
		const expectedCode = record ? String(record.kod ?? record.code ?? '').trim() : '';
		const submittedCode = String(verificationCode).trim();
		if (!record || !verifyOtpCode(expectedCode, submittedCode)) {
			const attempts = recordFailure(verifyKey, OTP_WINDOW_MS);
			if (attempts >= MAX_OTP_ATTEMPTS) {
				await pool.query('DELETE FROM email_verifications WHERE email = $1 AND type = $2', [
					normalizedEposta,
					'registration',
				]);
			}
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `Failed registration OTP attempt: ${normalizedEposta}`,
				detay: { email: normalizedEposta, denemeSayisi: attempts },
				ip,
			});
			return NextResponse.json({ error: 'The verification code you entered is invalid.' }, { status: 400 });
		}

		const sonGecerlilik = Number(record.songecerlilik ?? record.expiresAt ?? record.expires_at ?? 0);
		if (sonGecerlilik < Date.now()) {
			return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
		}

		// Valid code — delete OTP record
		await pool.query('DELETE FROM email_verifications WHERE email = $1', [normalizedEposta]);
		clearRateLimit(verifyKey);

		// Hash password with Bcrypt (cost factor 12)
		const passwordHash = await bcrypt.hash(password, 12);

		// Create pending user record
		const newUser = await createUser({
			ad: cleanAd,
			soyad: cleanSoyad,
			email: normalizedEposta,
			passwordHash,
			ogrenciNo: cleanOgrenciNo,
			bolum: cleanBolum,
			status: 'beklemede',
			sinif: parsedSinif,
		});

		const settings = await getSystemSettings();
		const welcomeTemplate = settings.mail_welcome_template || '';

		void notifyRegistrationReceived(
			{
				ad: newUser.ad,
				soyad: newUser.soyad,
				email: newUser.email,
			},
			welcomeTemplate
		);

		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `New membership application received (email verified): ${newUser.ad} ${newUser.soyad} (${newUser.email}) - ID: ${cleanOgrenciNo}`,
			userId: newUser.id,
			ip: clientAddress(request),
		});

		return NextResponse.json({
			success: true,
			message: 'Your membership application has been received and your email is verified! You can sign in once an administrator approves your account.',
			user: {
				id: newUser.id,
				ad: newUser.ad,
				soyad: newUser.soyad,
				email: newUser.email,
				status: newUser.status,
			},
		});
	} catch (error: unknown) {
		const pgError = error as { code?: string; detail?: string };
		if (pgError?.code === '23505') {
			return NextResponse.json(
				{ error: 'This email address or Member ID / Handle is already registered.' },
				{ status: 409 }
			);
		}
		console.error('API error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
