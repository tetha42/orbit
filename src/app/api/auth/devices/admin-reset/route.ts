import { NextResponse } from 'next/server';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { adminResetUserDeviceSessions } from '@/domains/devices/sessionStore';
import { withAudit } from '@/lib/audit/withAudit';
import { verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	if (auth.user.roleId !== ADMIN_ROLE_ID && auth.user.roleId !== 'admin') {
		return NextResponse.json({ error: 'Administrator privileges required.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const userId = String(body.userId || '').trim();
	if (!userId) {
		return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
	}

	const revokedCount = await adminResetUserDeviceSessions(userId);
	return NextResponse.json({ ok: true, revokedCount });
}

export const POST = withAudit(handlePOST, {
	action: 'auth.devices.admin_reset',
	target: 'auth.devices',
});
