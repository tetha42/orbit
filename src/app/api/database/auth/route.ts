import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';
import { getUserById, setUserTotpStep } from '@/db';
import { verifyTotpCodeDetailed } from '@/lib/auth/totp';
import { createDatabaseSessionToken, isUserDatabaseFrozen } from '@/server/databaseAccess';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	if (!auth.user.permission.admin) {
		return NextResponse.json(
			{ error: 'Only administrators can access Database Studio.', code: 'ADMIN_REQUIRED' },
			{ status: 403 }
		);
	}

	if (isUserDatabaseFrozen(auth.user.id)) {
		return NextResponse.json(
			{
				error: 'Database access is frozen under the SoC security isolation protocol.',
				code: 'DATABASE_ACCESS_FROZEN',
			},
			{ status: 403 }
		);
	}

	const ip = clientAddress(request);
	const rateKey = `2fa:db:${auth.user.id}`;
	const gate = isRateLimited(rateKey, MAX_ATTEMPTS);
	if (!gate.allowed) {
		return NextResponse.json(
			{
				error: `Too many failed 2FA attempts. Please try again in ${Math.ceil(gate.retryAfter / 60)} minute(s).`,
				code: 'RATE_LIMITED',
			},
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}

	const user = await getUserById(auth.user.id);
	if (!user) {
		return NextResponse.json({ error: 'User not found.' }, { status: 404 });
	}

	try {
		const body = await request.json().catch(() => {
			/* Fallback to empty object when body is absent or malformed JSON */
			return {};
		});

		// A passkey session already satisfies the second-factor requirement, so it
		// receives the short-lived database token directly without a TOTP code.
		if ((auth.user.authMethod ?? 'password') === 'passkey') {
			const token = await createDatabaseSessionToken(auth.user.id);
			await logSystemEvent({
				service: 'database',
				level: 'INFO',
				message: 'Database Studio unlocked via passkey session',
				detail: { email: auth.user.email },
				userId: auth.user.id,
				ip,
			});
			return NextResponse.json({ success: true, token, expiresInMs: 30 * 60 * 1000, method: 'passkey' });
		}

		if (String(body.method || '') === 'passkey') {
			return NextResponse.json(
				{
					error: 'This session was not authenticated with a passkey. Sign in with your passkey or enter a TOTP code.',
					code: 'PASSKEY_SESSION_REQUIRED',
				},
				{ status: 403 }
			);
		}

		if (Number(user.totpEnabled) !== 1 || !user.totpSecret) {
			return NextResponse.json(
				{
					error: 'You must enable two-factor authentication (2FA) in Settings before using Database Studio.',
					code: '2FA_SETUP_REQUIRED',
				},
				{ status: 403 }
			);
		}

		const code = String(body.code || '').trim();

		if (!code) {
			return NextResponse.json(
				{ error: '2FA verification code is required.', code: '2FA_CODE_REQUIRED' },
				{ status: 400 }
			);
		}

		const verification = await verifyTotpCodeDetailed(user.totpSecret, code, user.totpLastStep);

		if (!verification.valid) {
			recordFailure(rateKey, WINDOW_MS);
			await recordSecurityStrike({
				ip,
				points: 20,
				reason: 'Invalid 2FA verification attempt in Database Studio',
				userId: user.id,
			});
			await logSystemEvent({
				service: 'database',
				level: 'WARN',
				message: 'Database access attempt with invalid 2FA code',
				detail: { email: user.email },
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Invalid or expired 2FA code.', code: 'INVALID_2FA_CODE' },
				{ status: 401 }
			);
		}

		clearRateLimit(rateKey);

		if (verification.timeStep !== null) {
			await setUserTotpStep(user.id, verification.timeStep);
		}

		const token = await createDatabaseSessionToken(user.id);

		await logSystemEvent({
			service: 'database',
			level: 'INFO',
			message: 'Database Studio 2FA session started',
			detail: { email: user.email },
			userId: user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			token,
			expiresInMs: 30 * 60 * 1000,
		});
	} catch (error) {
		console.error('API /api/database/auth error:', error);
		return NextResponse.json({ error: '2FA verification failed.' }, { status: 500 });
	}
}
