import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/authGuard';
import { enableUserTotp, getUserByEmail } from '@/db';
import { generateRecoveryCodes, verifyTotpCode } from '@/lib/auth/totp';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

/**
 * Confirms enrollment: checks the submitted code against the pending secret and,
 * on success, switches two-factor on and returns the recovery codes.
 *
 * The plaintext recovery codes are returned exactly once — only their bcrypt
 * hashes are stored, so they cannot be shown again.
 */
export async function POST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const rateKey = `2fa:enable:${auth.user.id}`;
	const gate = isRateLimited(rateKey, MAX_ATTEMPTS);
	if (!gate.allowed) {
		return NextResponse.json(
			{ error: `Too many failed attempts. Please try again in ${Math.ceil(gate.retryAfter / 60)} minutes.`, code: 'RATE_LIMITED' },
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}

	try {
		const user = (await getUserByEmail(auth.user.email)) ?? auth.user;
		if (!user.totpSecret) {
			return NextResponse.json(
				{ error: 'Setup must be initiated first.', code: 'SETUP_REQUIRED' },
				{ status: 409 }
			);
		}

		const body = await request.json().catch(() => ({}));
		if (!(await verifyTotpCode(user.totpSecret, body.code))) {
			recordFailure(rateKey, WINDOW_MS);
			await logSystemEvent({
				servis: 'auth',
				seviye: 'WARN',
				mesaj: `2FA enable failed (invalid code): ${user.email}`,
				userId: user.id,
				ip,
			});
			return NextResponse.json(
				{ error: 'Verification code is invalid. Please enter the current code from your authenticator app.', code: 'INVALID_2FA_CODE' },
				{ status: 400 }
			);
		}

		clearRateLimit(rateKey);
		const { plain, hashes } = await generateRecoveryCodes();
		await enableUserTotp(user.id, hashes);

		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `Kullanıcı iki adımlı doğrulamayı (2FA) etkinleştirdi: ${user.email}`,
			userId: user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			message: 'İki adımlı doğrulama etkinleştirildi.',
			recoveryCodes: plain,
		});
	} catch (error) {
		console.error('API /api/auth/2fa/enable error:', error);
		return NextResponse.json({ error: 'İki adımlı doğrulama etkinleştirilemedi.' }, { status: 500 });
	}
}
