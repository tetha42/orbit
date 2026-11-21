import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueMail, getPgPool } from '@/db';
import { notifyEmailVerificationCode } from '@/lib/mail/notifications/membershipEmails';
import { wasDelivered } from '@/lib/mail/mailer';
import { clearRateLimit, consumeRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';
import type { ValidatedRegistrationInput } from './registerValidation';

const MAX_OTP_ATTEMPTS = 5;
const OTP_WINDOW_MS = 15 * 60_000;

export async function handleRegistrationOtp(
	input: ValidatedRegistrationInput,
	ip: string
): Promise<NextResponse | null> {
	const { normalizedEmail, cleanName, cleanSurname, cleanStudentNo, userLang, verificationCode } = input;
	const pool = getPgPool();
	await pool.query('DELETE FROM verification_tokens WHERE expires_at < $1', [Date.now()]);
	await pool.query('DELETE FROM email_verifications WHERE expires_at < $1', [Date.now()]).catch(() => {});

	const verifyKey = `register:verify:${normalizedEmail}`;
	if (!input.membershipPolicy.emailVerification || normalizedEmail.endsWith('@club.test')) {
		return null;
	}

	if (!verificationCode) {
		const sendLimit = consumeRateLimit(`register:send:${normalizedEmail}`, 3, OTP_WINDOW_MS);
		if (!sendLimit.allowed) {
			return NextResponse.json(
				{ error: 'Verification codes requested too frequently for this email address. Please try again later.' },
				{ status: 429, headers: { 'Retry-After': String(sendLimit.retryAfter) } }
			);
		}

		const code = String(crypto.randomInt(100000, 1000000));
		const lastValidity = Date.now() + OTP_WINDOW_MS;
		const hashedCode = hashOtpCode(code);

		await pool.query(
			'DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2',
			[normalizedEmail, 'registration']
		);
		await pool.query(
			`INSERT INTO verification_tokens (id, token_type, target, token_hash, expires_at, created_at)
			 VALUES ($1, 'registration', $2, $3, $4, $5)`,
			[`otp_${crypto.randomUUID()}`, normalizedEmail, hashedCode, lastValidity, Date.now()]
		);
		clearRateLimit(verifyKey);

		const delivery = await notifyEmailVerificationCode(
			{ name: cleanName, surname: cleanSurname, email: normalizedEmail, preferredLanguage: userLang },
			code,
			userLang
		);
		let mailQueued = false;
		if (!wasDelivered(delivery)) {
			try {
				const queuedExpiry = Date.now() + 24 * 60 * 60_000;
				await pool.query(
					'UPDATE verification_tokens SET expires_at = $1 WHERE lower(target) = lower($2) AND token_type = $3',
					[queuedExpiry, normalizedEmail, 'registration']
				);
				await enqueueMail({
					kind: 'registration_verification',
					recipient: normalizedEmail,
					subject: `Email Verification Code — ${cleanName} ${cleanSurname}`,
					payload: { code },
				});
				mailQueued = true;
				await logSystemEvent({
					service: 'auth',
					level: 'WARN',
					message: `Registration verification e-mail queued for admin approval: ${normalizedEmail}`,
					detail: { reason: delivery.simulated ? 'smtp_not_configured' : delivery.error },
					ip,
				});
			} catch (queueError) {
				console.error('[register] verification mail could not be queued:', queueError);
			}
		}

		await logSystemEvent({
			service: 'auth',
			level: 'INFO',
			message: mailQueued
				? `Registration verification code queued for approval: ${normalizedEmail}`
				: `Registration verification code sent: ${normalizedEmail}`,
			ip,
		});

		return NextResponse.json({
			success: true,
			requireVerification: true,
			memberId: cleanStudentNo,
			mailQueued,
			message: mailQueued
				? `Email delivery is temporarily unavailable. Your verification code has been queued for administrator approval and will be sent to ${normalizedEmail} once approved.`
				: `A 6-digit verification code has been sent to ${normalizedEmail}. Please enter the code to complete registration.`,
		});
	}

	const gate = isRateLimited(verifyKey, MAX_OTP_ATTEMPTS);
	if (!gate.allowed) {
		await pool.query('DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2', [
			normalizedEmail,
			'registration',
		]);
		return NextResponse.json(
			{ error: 'Too many invalid verification attempts. Please request a new code.' },
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}

	const codeRes = await pool.query(
		'SELECT token_hash AS code, expires_at AS "expiresAt", expires_at AS lastvalidity ' +
			'FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2 ' +
			'ORDER BY created_at DESC LIMIT 1',
		[normalizedEmail, 'registration']
	);

	const record = codeRes.rows[0];
	const expectedCode = record ? String(record.code ?? record.tokenHash ?? record.token_hash ?? '').trim() : '';
	const submittedCode = String(verificationCode).trim();
	if (!record || !verifyOtpCode(expectedCode, submittedCode)) {
		const attempts = recordFailure(verifyKey, OTP_WINDOW_MS);
		if (attempts >= MAX_OTP_ATTEMPTS) {
			await pool.query('DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2', [
				normalizedEmail,
				'registration',
			]);
		}
		await logSystemEvent({
			service: 'auth',
			level: 'WARN',
			message: `Failed registration OTP attempt: ${normalizedEmail}`,
			detail: { email: normalizedEmail, attemptCount: attempts },
			ip,
		});
		return NextResponse.json({ error: 'The verification code you entered is invalid.' }, { status: 400 });
	}

	const lastValidity = Number(record.expiresAt ?? record.lastValidity ?? record.lastvalidity ?? record.expires_at ?? 0);
	if (lastValidity < Date.now()) {
		return NextResponse.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
	}

	await pool.query('DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2', [
		normalizedEmail,
		'registration',
	]);
	clearRateLimit(verifyKey);
	return null;
}
