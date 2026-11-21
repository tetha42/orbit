import { NextResponse } from 'next/server';
import { getUserById } from '@/db';
import { verifyDesktopCodeApproval } from '@/domains/devices/approvals';
import { withAudit } from '@/lib/audit/withAudit';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const approvalId = String(body.approvalId || '').trim();
	const pollSecret = String(body.pollSecret || '').trim();
	const code = String(body.code || '').trim();

	if (!approvalId || !pollSecret || !code) {
		return NextResponse.json({ error: 'Missing approval parameters.' }, { status: 400 });
	}

	const verified = await verifyDesktopCodeApproval({ approvalId, pollSecret, code });
	if (!verified.ok) {
		return NextResponse.json({ error: verified.error }, { status: verified.status });
	}

	const user = await getUserById(verified.userId);
	if (!user || user.status !== 'active') {
		return NextResponse.json({ error: 'Account is not active.' }, { status: 403 });
	}

	const sessionToken = await establishSession(user, request, 'totp');
	const response = NextResponse.json({
		ok: true,
		success: true,
		user: await sessionUserOf(user),
	});
	return attachSessionCookie(response, sessionToken);
}

export const POST = withAudit(handlePOST, {
	action: 'auth.devices.approval_verify_code',
	target: 'auth.devices.approval',
});
