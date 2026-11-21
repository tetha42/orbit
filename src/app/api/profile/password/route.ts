import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { updateUserPassword } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { attachSessionCookie, establishSession } from '@/lib/auth/session';
import { clientAddress } from '@/lib/http';
import { clearRateLimit, isRateLimited, recordFailure } from '@/lib/rateLimit';
import { passwordProblem, PASSWORD_MAX } from '@/lib/profile';
import { closeUserTerminalSessions } from '@/server/terminalManager';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

/**
 * Changes the member's password. The current one is required (a session left
 * open on a shared machine must not be enough), wrong guesses are rate limited
 * like sign-in, and the new one is checked against the shared rules.
 */
export async function POST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	const ip = clientAddress(request);
	const key = `password-change:${auth.user.id}`;
	const gate = isRateLimited(key, MAX_ATTEMPTS);
	if (!gate.allowed) {
		return NextResponse.json(
			{ error: 'Too many invalid attempts. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(gate.retryAfter) } }
		);
	}
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const current = typeof body.current === 'string' ? body.current : '';
		const fresh = body.fresh;
		if (!current || current.length > PASSWORD_MAX || !(await bcrypt.compare(current, auth.user.passwordHash))) {
			const attempts = recordFailure(key, WINDOW_MS);
			await logSystemEvent({
				service: 'auth',
				level: 'WARN',
				message: `Invalid current password attempt during password change: ${auth.user.email}`,
				userId: auth.user.id,
				detail: { attemptCount: attempts },
				ip,
			});
			return NextResponse.json({ error: 'Current password is incorrect.', code: 'CURRENT_PASSWORD_WRONG' }, { status: 400 });
		}
		const problem = passwordProblem(fresh, { current, email: auth.user.email });
		if (problem) return NextResponse.json({ error: problem }, { status: 400 });
		await updateUserPassword(auth.user.id, await bcrypt.hash(String(fresh), 12), true);
		try {
			closeUserTerminalSessions(auth.user.id);
		} catch (termErr) {
			console.warn('[PasswordChange] Best-effort terminal session cleanup failed:', termErr);
		}
		clearRateLimit(key);
		const newSessionToken = await establishSession(auth.user, request, auth.user.authMethod ?? 'password');
		await logSystemEvent({
			service: 'auth',
			level: 'INFO',
			message: `User changed password: ${auth.user.email}`,
			userId: auth.user.id,
			ip,
		});
		const response = NextResponse.json({
			success: true,
			message: 'Your password has been changed and other active sessions were signed out.',
		});
		return attachSessionCookie(response, newSessionToken);
	} catch (error) {
		console.error('API /api/profile/password error:', error);
		return NextResponse.json({ error: 'Failed to change password.' }, { status: 500 });
	}
}
