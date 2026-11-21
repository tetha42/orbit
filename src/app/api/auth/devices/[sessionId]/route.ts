import { NextResponse } from 'next/server';
import { revokeDeviceSessionById } from '@/domains/devices/sessionStore';
import { withAudit } from '@/lib/audit/withAudit';
import { verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

async function handleDELETE(
	request: Request,
	context: { params: Promise<{ sessionId: string }> }
) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const { sessionId } = await context.params;
	if (!sessionId) {
		return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
	}

	const revoked = await revokeDeviceSessionById(auth.user.id, sessionId, 'user_revoked');
	if (!revoked) {
		return NextResponse.json({ error: 'Device session not found.' }, { status: 404 });
	}
	return NextResponse.json({ ok: true, revokedId: sessionId });
}

export const DELETE = withAudit(handleDELETE, {
	action: 'auth.devices.revoke',
	target: 'auth.devices',
});
