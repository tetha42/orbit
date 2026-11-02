import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { verifyAuth } from '@/lib/auth/authGuard';
import {
	getUserByEmail,
	parseRecoveryCodes,
	setUserRecoveryCodes,
	setUserTotpSecret,
	setUserTotpStep,
} from '@/db';
import {
	buildOtpauthUri,
	consumeRecoveryCode,
	generateTotpSecret,
	verifyTotpCodeDetailed,
} from '@/lib/auth/totp';
import { clearRateLimit, consumeRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

const MAX_REAUTH_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Starts (or restarts) two-factor enrollment for the caller.
 *
 * Replacing an *active* second factor requires proof of possession — a current
 * TOTP code or an unused recovery code. Without that guard a stolen session could
 * silently clear `totpEnabled` and enroll the attacker's own device, which would
 * defeat the protection `/api/auth/2fa/disable` deliberately enforces.
 *
 * The secret is persisted immediately but `totpEnabled` stays 0 until
 * /api/auth/2fa/enable confirms a code from the app.
 */
export async function POST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const { user } = auth;
	const reqLimit = consumeRateLimit(`2fa:setup:req:${user.id}`, 10, WINDOW_MS);
	if (!reqLimit.allowed) {
		return NextResponse.json(
			{ error: 'Too many 2FA setup requests. Please try again later.', code: 'RATE_LIMITED' },
			{ status: 429, headers: { 'Retry-After': String(reqLimit.retryAfter) } }
		);
	}

	const failKey = `2fa:setup:reauth:${user.id}`;
	const gate = isRateLimited(failKey, MAX_REAUTH_ATTEMPTS);
	if (!gate.allowed) {
		return NextResponse.json(
			{ error: `Too many failed attempts. Please try again in ${Math.ceil(gate.retryAfter / 60)} minutes.`, code: 'RATE_LIMITED' },
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}

	try {
		const body = await request.json().catch(() => ({}));
		const submitted = String(body.code ?? '').trim();

		if (Number(user.totpEnabled) === 1) {
			// Re-read so the check runs against the stored secret and code set.
			const fresh = await getUserByEmail(user.email);
			if (!fresh) {
				return NextResponse.json({ error: 'User not found.', code: 'USER_NOT_FOUND' }, { status: 404 });
			}

			if (!submitted) {
				return NextResponse.json(
					{
						error:
							'Two-factor authentication is already enabled. Enter your current authenticator code or recovery code to reconfigure.',
						code: 'TOTP_REAUTH_REQUIRED',
					},
					{ status: 403 }
				);
			}

			// Replay-protected: a code spent here cannot be reused to sign in.
			const verification = fresh.totpSecret
				? await verifyTotpCodeDetailed(fresh.totpSecret, submitted, fresh.totpSonAdim)
				: { valid: false, timeStep: null };
			const validTotp = verification.valid;
			if (validTotp && verification.timeStep !== null) {
				await setUserTotpStep(fresh.id, verification.timeStep);
			}

			const remaining = validTotp
				? null
				: await consumeRecoveryCode(parseRecoveryCodes(fresh), submitted);

			if (!validTotp && !remaining) {
				recordFailure(failKey, WINDOW_MS);
				await logSystemEvent({
					servis: 'auth',
					seviye: 'WARN',
					mesaj: `2FA setup verification failed: ${user.email}`,
					userId: user.id,
					ip,
				});
				return NextResponse.json(
					{ error: 'Invalid verification code or recovery code.', code: 'INVALID_2FA_CODE' },
					{ status: 400 }
				);
			}

			if (remaining) {
				await setUserRecoveryCodes(fresh.id, remaining);
			}
			clearRateLimit(failKey);
		}

		const secret = generateTotpSecret();
		await setUserTotpSecret(user.id, secret);

		const otpauthUri = buildOtpauthUri(user.email, secret);
		const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 240 });

		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `2FA kurulum anahtarı oluşturuldu: ${user.email}`,
			userId: user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			// Rendered as a scannable QR; the secret is also shown for manual entry.
			secret,
			otpauthUri,
			qrDataUrl,
		});
	} catch (error) {
		console.error('API /api/auth/2fa/setup error:', error);
		return NextResponse.json(
			{ error: 'İki adımlı doğrulama kurulumu başlatılamadı.' },
			{ status: 500 }
		);
	}
}
