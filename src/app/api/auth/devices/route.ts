import { NextResponse } from 'next/server';
import { listActiveUserSessions } from '@/domains/devices/sessionStore';
import { readSessionToken, verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const currentToken = readSessionToken(request);
	const sessions = await listActiveUserSessions(auth.user.id, currentToken);
	return NextResponse.json(
		{
			ok: true,
			sessions,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
