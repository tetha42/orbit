import { NextResponse } from 'next/server';
import { findActiveDeviceSessionByToken } from '@/domains/devices/sessionStore';
import { saveUserPushSubscription } from '@/domains/devices/webPush';
import { withAudit } from '@/lib/audit/withAudit';
import { readSessionToken, verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const endpoint = String(body.endpoint || '').trim();
	const keys = body.keys && typeof body.keys === 'object' ? (body.keys as Record<string, unknown>) : {};
	const p256dh = String(keys.p256dh || '').trim();
	const authKey = String(keys.auth || '').trim();

	if (!endpoint || !p256dh || !authKey) {
		return NextResponse.json({ error: 'Invalid push subscription payload.' }, { status: 400 });
	}

	const currentToken = readSessionToken(request);
	const currentSession = currentToken ? await findActiveDeviceSessionByToken(currentToken) : null;

	const saved = await saveUserPushSubscription({
		userId: auth.user.id,
		sessionId: currentSession?.id ?? null,
		subscription: { endpoint, keys: { p256dh, auth: authKey } },
	});

	return NextResponse.json({ ok: true, id: saved.id });
}

export const POST = withAudit(handlePOST, {
	action: 'auth.devices.push_subscribe',
	target: 'auth.devices.push',
});
