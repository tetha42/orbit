import { NextResponse } from 'next/server';
import { buildWebRtcIceServers } from '@/domains/webrtc/ice';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const iceServers = buildWebRtcIceServers(auth.user.id);
	return NextResponse.json(
		{ ok: true, iceServers },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
