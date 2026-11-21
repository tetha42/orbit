import { NextResponse } from 'next/server';
import { revokeOtherDeviceSessions } from '@/domains/devices/sessionStore';
import { withAudit } from '@/lib/audit/withAudit';
import { readSessionToken, verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const currentToken = readSessionToken(request);
	const revokedCount = await revokeOtherDeviceSessions(auth.user.id, currentToken);
	return NextResponse.json({ ok: true, revokedCount });
}

export const POST = withAudit(handlePOST, {
	action: 'auth.devices.revoke_others',
	target: 'auth.devices',
});
