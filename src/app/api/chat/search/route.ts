import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { canUserAccessChatRoom } from '@/db/repositories/chat.repo';
import { consumeRateLimit } from '@/lib/rateLimit';
import chatContract from '@/apps/chat/chat.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import { searchChatMessages } from '@/domains/chatSearch/service';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

function parseOptionalEpoch(raw: string | null): number | undefined | null {
	if (raw === null || raw.trim() === '') return undefined;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return Math.trunc(parsed);
}

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const limitCheck = consumeRateLimit(`chat:search:${auth.user.id}`, 30, 60_000);
	if (!limitCheck.allowed) {
		return NextResponse.json(
			{ error: 'Searching messages too fast. Please wait a moment.' },
			{ status: 429, headers: { ...NO_CACHE, 'Retry-After': String(limitCheck.retryAfter) } }
		);
	}

	const { searchParams } = new URL(request.url);
	const q = (searchParams.get('q') ?? '').trim();
	if (q.length < 2 || q.length > 100) {
		return NextResponse.json(
			{ error: 'Search query must be between 2 and 100 characters.' },
			{ status: 400, headers: NO_CACHE }
		);
	}

	const roomId = searchParams.get('roomId')?.trim() || undefined;
	const senderId = searchParams.get('senderId')?.trim() || undefined;
	const hasAttachment = searchParams.get('hasAttachment') === '1' || searchParams.get('hasAttachment') === 'true';

	const from = parseOptionalEpoch(searchParams.get('from'));
	const to = parseOptionalEpoch(searchParams.get('to'));
	if (from === null || to === null) {
		return NextResponse.json({ error: 'Invalid timestamp filter.' }, { status: 400, headers: NO_CACHE });
	}

	const rawLimit = Number(searchParams.get('limit') || '25');
	const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 50)) : 25;
	const rawOffset = Number(searchParams.get('offset') || '0');
	const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0;

	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
	if (roomId) {
		const hasAccess = await canUserAccessChatRoom(roomId, auth.user.id, isAdmin);
		if (!hasAccess) {
			const res = contractErrorResponse(chatContract, 'ROOM_ACCESS_DENIED');
			res.headers.set('Cache-Control', 'no-store');
			return res;
		}
	}

	try {
		const result = await searchChatMessages({
			userId: auth.user.id,
			isAdmin,
			q,
			roomId,
			senderId,
			hasAttachment,
			from,
			to,
			limit,
			offset,
		});
		return NextResponse.json({ ok: true, q, ...result }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat search GET error]:', err);
		return NextResponse.json({ error: 'Failed to search messages.' }, { status: 500, headers: NO_CACHE });
	}
}
