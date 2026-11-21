import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/auth/access';
import { buildNotificationsResponse } from './notificationBuilders';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * What the member should know about right now, as facts: the client writes the
 * words (in the member's language) and decides what is "new" by comparing `at`
 * with when they last looked.
 */
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;

	try {
		const body = await buildNotificationsResponse(auth.user, Date.now());
		return NextResponse.json(body, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/notifications error:', error);
		return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500, headers: NO_STORE });
	}
}
