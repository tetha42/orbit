import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getPgPool } from '@/db';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { hashOtpCode, verifyOtpCode } from '@/lib/auth/otp';
import { notifyPasswordResetCode, notifyPasswordReset } from '@/lib/mail/notifications/securityAndPortalEmails';
import { passwordProblem } from '@/lib/profile';
import { clearRateLimit, consumeRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';

const MAX_OTP_ATTEMPTS = 5;
const OTP_WINDOW_MS = 15 * 60_000;
const UNIFORM_MESSAGE =
	'If this email address is registered, a 6-digit password reset code has been sent.';

export async function handleRequestResetCode(normalizedEmail: string, ip: string): Promise<NextResponse> {
	const reqEmailLimit = consumeRateLimit(`pwd_reset:req:${normalizedEmail}`, 5, 15 * 60_000);
	if (!reqEmailLimit.allowed) {
		return NextResponse.json(
			{ error: 'Too many reset codes requested for this email address. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(reqEmailLimit.retryAfter) } }
		);
	}

	const user = await getUserByEmail(normalizedEmail);
	if (!user) {
		return NextResponse.json({ success: true, message: UNIFORM_MESSAGE });
	}

	const pool = getPgPool();
	const code = String(crypto.randomInt(100000, 1000000));
	const lastValidity = Date.now() + 15 * 60 * 1000;
	const hashedCode = hashOtpCode(code);

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
		message: `Password reset code sent: ${normalizedEmail}`,
		userId: user.id,
		ip,
	});

	return NextResponse.json({ success: true, message: UNIFORM_MESSAGE });
}

export async function handleVerifyAndResetPassword(params: {
	normalizedEmail: string;
	code: unknown;
	newPassword: unknown;
	ip: string;
}): Promise<NextResponse> {
	const { normalizedEmail, code, newPassword, ip } = params;
	const pool = getPgPool();
	const verifyKey = `pwd_reset:verify:${normalizedEmail}`;
	const gate = isRateLimited(verifyKey, MAX_OTP_ATTEMPTS);
	if (!gate.allowed) {
		await pool.query(
			'DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2',
			[normalizedEmail, 'password_reset']
		);
		return NextResponse.json(
			{ error: 'Too many invalid verification attempts. The code has been invalidated; please request a new code.' },
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}

	if (!code || String(code).trim().length !== 6) {
		return NextResponse.json({ error: 'Please enter the 6-digit password reset code.' }, { status: 400 });
	}

	const cleanPass = String(newPassword || '').trim();
	const passProblem = passwordProblem(cleanPass, { email: normalizedEmail });
	if (passProblem) {
		return NextResponse.json({ error: passProblem }, { status: 400 });
	}

	const codeRes = await pool.query(
		`SELECT id, token_hash AS code, expires_at AS lastValidity, COALESCE(attempts, 0) AS attempts
		 FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2
		 ORDER BY created_at DESC LIMIT 1`,
		[normalizedEmail, 'password_reset']
	);

	const record = codeRes.rows[0];
	const dbAttempts = record ? Number(record.attempts ?? 0) : 0;
	if (record && dbAttempts >= MAX_OTP_ATTEMPTS) {
		await pool.query('DELETE FROM verification_tokens WHERE id = $1', [record.id]);
		return NextResponse.json(
			{ error: 'Too many invalid verification attempts. The code has been invalidated; please request a new code.' },
			{ status: 429 }
		);
	}

	const expectedCode = record
		? String(record.code ?? record.tokenHash ?? record.token_hash ?? '').trim()
		: '';
	const submittedCode = String(code).trim();
	if (!record || !verifyOtpCode(expectedCode, submittedCode)) {
		const memAttempts = recordFailure(verifyKey, OTP_WINDOW_MS);
		let nextDbAttempts = memAttempts;
		if (record?.id) {
			const incRes = await pool.query(
				'UPDATE verification_tokens SET attempts = COALESCE(attempts, 0) + 1 WHERE id = $1 RETURNING attempts',
				[record.id]
			);
			nextDbAttempts = Number(incRes.rows[0]?.attempts ?? dbAttempts + 1);
		}
		const totalAttempts = Math.max(memAttempts, nextDbAttempts);
		if (totalAttempts >= MAX_OTP_ATTEMPTS) {
			await pool.query(
				'DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2',
				[normalizedEmail, 'password_reset']
			);
		}
		await logSystemEvent({
			service: 'auth',
			level: 'WARN',
			message: `Invalid password reset OTP attempt: ${normalizedEmail}`,
			detail: { email: normalizedEmail, attemptCount: totalAttempts },
			ip,
		});
		return NextResponse.json({ error: 'The password reset code is invalid.' }, { status: 400 });
	}

	const lastValidity = Number(record.lastValidity ?? record.expiresAt ?? record.expires_at ?? 0);
	if (lastValidity < Date.now()) {
		return NextResponse.json({ error: 'Reset code has expired. Please request a new code.' }, { status: 400 });
	}

	const user = await getUserByEmail(normalizedEmail);
	if (!user) {
		return NextResponse.json({ error: 'User not found.' }, { status: 404 });
	}

	const hash = await bcrypt.hash(cleanPass, 12);
	await pool.query(
		'UPDATE users SET password_hash = $1, session_token = NULL, session_expires_at = NULL WHERE id = $2',
		[hash, user.id]
	);

	await pool.query(
		'DELETE FROM verification_tokens WHERE lower(target) = lower($1) AND token_type = $2',
		[normalizedEmail, 'password_reset']
	);
	clearRateLimit(verifyKey);

	void notifyPasswordReset({ name: user.name, surname: user.surname, email: user.email });

	await logSystemEvent({
		service: 'auth',
		level: 'INFO',
		message: `User password updated via email verification (previous sessions revoked): ${user.name} ${user.surname} (${user.email})`,
		userId: user.id,
		ip,
	});

	return NextResponse.json({
		success: true,
		message: 'Your password has been updated. You can now sign in with your new password.',
	});
}
