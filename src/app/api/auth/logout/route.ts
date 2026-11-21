import { NextResponse } from 'next/server';
import { getPgPool, getUserBySessionToken } from '@/db';
import { hashSessionToken } from '@/db/repositories/members/normalize';
import { revokeDeviceSessionByToken } from '@/domains/devices/sessionStore';
import { readSessionToken } from '@/lib/auth/authGuard';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { closeUserTerminalSessions } from '@/server/terminalManager';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export async function POST(request: Request) {
	try {
		const sessionToken = readSessionToken(request);
		const ip = clientAddress(request);

		if (sessionToken) {
			const user = await getUserBySessionToken(sessionToken);
			if (user) {
				await revokeDeviceSessionByToken(user.id, sessionToken, 'logout');
				const tokenHash = hashSessionToken(sessionToken);
				await getPgPool()
					.query(
						'UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE id = $1 AND (session_token = $2 OR session_token = $3)',
						[user.id, tokenHash, sessionToken]
					)
					.catch(() => {});
				closeUserTerminalSessions(user.id);
				await logSystemEvent({
					service: 'auth',
					level: 'INFO',
					message: `User signed out cleanly: ${user.name} ${user.surname} (${user.email})`,
					userId: user.id,
					ip,
				});
			}
		}

		const response = NextResponse.json({ success: true, message: 'Signed out.' });
		response.cookies.delete(SESSION_COOKIE);
		return response;
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
