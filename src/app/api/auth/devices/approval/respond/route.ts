import { NextResponse } from 'next/server';
import { respondToLoginApproval } from '@/domains/devices/approvals';
import { findActiveDeviceSessionByToken } from '@/domains/devices/sessionStore';
import { withAudit } from '@/lib/audit/withAudit';
import { readSessionToken, verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

async function handlePOST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const approvalId = String(body.approvalId || '').trim();
	const decision = body.decision === 'reject' ? 'reject' : 'approve';
	const selectedNumber =
		body.selectedNumber !== undefined ? Number(body.selectedNumber) : undefined;
	const qrToken = typeof body.qrToken === 'string' ? body.qrToken.trim() : undefined;

	if (!approvalId) {
		return NextResponse.json({ error: 'approvalId is required.' }, { status: 400 });
	}

	const currentToken = readSessionToken(request);
	const currentSession = currentToken ? await findActiveDeviceSessionByToken(currentToken) : null;

	const res = await respondToLoginApproval({
		userId: auth.user.id,
		approvalId,
		decision,
		selectedNumber,
		qrToken,
		mobileSessionId: currentSession?.id ?? null,
	});

	if (!res.ok) {
		return NextResponse.json({ error: res.error }, { status: res.status });
	}
	return NextResponse.json({ ok: true, status: res.status });
}

export const POST = withAudit(handlePOST, {
	action: 'auth.devices.approval_respond',
	target: 'auth.devices.approval',
});
