import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

/**
 * Re-checks the signed-in member's password without starting a new session.
 *
 * Used by the lock screen. Going through /api/auth/login would be wrong here:
 * it rotates the session token (signing out any other device) and, for members
 * with two-factor enabled, would divert to the authenticator prompt instead of
 * simply unlocking the screen.
 */
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);

	try {
		// Same message for every failure so this cannot be used as an oracle.
		const key = `unlock:${auth.user.id}`;
		const gate = isRateLimited(key, MAX_ATTEMPTS);
		if (!gate.allowed) {
			return NextResponse.json(
				{ error: `Too many failed attempts. Try again in ${Math.ceil(gate.retryAfter / 60)} minute(s).` },
				{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
			);
		}

		const body = await request.json().catch(() => ({}));
		const password = typeof body.password === 'string' ? body.password : '';
		if (!password) {
			return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
		}
		if (password.length > 128) {
			recordFailure(key, ATTEMPT_WINDOW_MS);
			return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
		}

		const user = await getUserByEmail(auth.user.email);
		if (!user) {
			return NextResponse.json({ error: 'Verification failed.' }, { status: 401 });
		}

		const isValid = user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')
			? await bcrypt.compare(password, user.passwordHash)
			: user.passwordHash === password;

		if (!isValid) {
			recordFailure(key, ATTEMPT_WINDOW_MS);
			await logSystemEvent({
				service: 'auth',
				level: 'WARN',
				message: `Lock screen unlock failed (incorrect password): ${user.email}`,
				userId: user.id,
				ip,
			});
			return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
		}

		clearRateLimit(key);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/auth/verify-password error:', error);
		return NextResponse.json({ error: 'Verification could not be completed.' }, { status: 500 });
	}
}
