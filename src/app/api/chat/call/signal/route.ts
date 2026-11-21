import { NextResponse } from 'next/server';
import { enqueueCallSignal, pollCallSignals } from '@/domains/webrtc/signals';
import type { CallSignalKind } from '@/domains/webrtc/types';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };
const VALID_KINDS = new Set<CallSignalKind>(['offer', 'answer', 'ice']);

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const callId = (searchParams.get('callId') || '').trim();
	const since = Number(searchParams.get('since') || '0');
	if (!callId) {
		return NextResponse.json({ error: 'callId is required.' }, { status: 400, headers: NO_CACHE });
	}
	const signals = await pollCallSignals({
		callId,
		toUserId: auth.user.id,
		since: Number.isFinite(since) && since >= 0 ? since : 0,
	});
	return NextResponse.json({ ok: true, signals }, { headers: NO_CACHE });
}

// audit:exempt: webrtc-trickle-signal
export async function POST(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const rl = consumeRateLimit(`chat:call:sig:${auth.user.id}`, 120, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ error: 'Rate limit exceeded.' },
			{ status: 429, headers: { ...NO_CACHE, 'Retry-After': String(rl.retryAfter) } }
		);
	}

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const callId = String(body.callId || '').trim();
	const toUserId = String(body.toUserId || '').trim();
	const kind = String(body.kind || '') as CallSignalKind;
	if (!callId || !toUserId || !VALID_KINDS.has(kind)) {
		return NextResponse.json({ error: 'Invalid signal payload.' }, { status: 400, headers: NO_CACHE });
	}

	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
	const res = await enqueueCallSignal({
		callId,
		fromUserId: auth.user.id,
		toUserId,
		kind,
		payload: body.payload ?? {},
		isAdmin,
	});
	if (!res.ok) {
		return NextResponse.json({ error: res.code }, { status: res.status, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true, id: res.id }, { headers: NO_CACHE });
}
