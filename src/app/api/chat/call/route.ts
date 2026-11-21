import { NextResponse } from 'next/server';
import {
	getActiveCallForRoom,
	startVoiceCall,
	updateVoiceCallState,
} from '@/domains/webrtc/service';
import { canUserAccessChatRoom } from '@/db/repositories/chat.repo';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const roomId = (searchParams.get('roomId') || '').trim();
	if (!roomId) {
		return NextResponse.json({ error: 'roomId is required.' }, { status: 400, headers: NO_CACHE });
	}
	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
	const hasAccess = await canUserAccessChatRoom(roomId, auth.user.id, isAdmin);
	if (!hasAccess) {
		return NextResponse.json({ error: 'Access denied.' }, { status: 403, headers: NO_CACHE });
	}

	const call = await getActiveCallForRoom(roomId);
	return NextResponse.json({ ok: true, call }, { headers: NO_CACHE });
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const action = String(body.action || 'start').trim();
	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
	const userName =
		[auth.user.firstName, auth.user.lastName].filter(Boolean).join(' ').trim() ||
		auth.user.email ||
		'Member';

	if (action === 'start') {
		const rl = consumeRateLimit(`chat:call:start:${auth.user.id}`, 6, 60_000);
		if (!rl.allowed) {
			return NextResponse.json(
				{ error: 'Too many call attempts. Please wait.' },
				{ status: 429, headers: { ...NO_CACHE, 'Retry-After': String(rl.retryAfter) } }
			);
		}
		const roomId = String(body.roomId || '').trim();
		if (!roomId) {
			return NextResponse.json({ error: 'roomId is required.' }, { status: 400, headers: NO_CACHE });
		}
		const res = await startVoiceCall({
			roomId,
			userId: auth.user.id,
			userName,
			isAdmin,
		});
		if (!res.ok) {
			return NextResponse.json({ error: res.code, code: res.code }, { status: res.status, headers: NO_CACHE });
		}
		return NextResponse.json({ ok: true, call: res.call }, { headers: NO_CACHE });
	}

	if (action === 'accept' || action === 'reject' || action === 'hangup' || action === 'mute_state') {
		const callId = String(body.callId || '').trim();
		if (!callId) {
			return NextResponse.json({ error: 'callId is required.' }, { status: 400, headers: NO_CACHE });
		}
		const res = await updateVoiceCallState({
			callId,
			userId: auth.user.id,
			userName,
			isAdmin,
			action,
			muted: Boolean(body.muted),
		});
		if (!res.ok) {
			return NextResponse.json({ error: res.code, code: res.code }, { status: res.status, headers: NO_CACHE });
		}
		return NextResponse.json({ ok: true, call: res.call }, { headers: NO_CACHE });
	}

	return NextResponse.json({ error: 'Invalid call action.' }, { status: 400, headers: NO_CACHE });
}

export const POST = withAudit(handlePOST, {
	action: 'chat.call.mutate',
	target: 'chat.call',
});
