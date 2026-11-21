import { NextResponse } from 'next/server';
import { startDesktopLoginApproval } from '@/domains/devices/approvals';
import type { LoginApprovalMode } from '@/domains/devices/types';
import { withAudit } from '@/lib/audit/withAudit';
import { verifyLoginChallenge } from '@/lib/auth/authToken';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const VALID_MODES = new Set<LoginApprovalMode>(['push', 'code', 'qr']);

async function handlePOST(request: Request) {
	const ip = clientAddress(request);
	const rl = consumeRateLimit(`devices:approval:start:${ip}`, 15, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ error: 'Too many approval requests. Please wait.' },
			{ status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
		);
	}

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const challengeToken = String(body.challengeToken || '').trim();
	const modeRaw = String(body.mode || 'push').trim() as LoginApprovalMode;
	const mode: LoginApprovalMode = VALID_MODES.has(modeRaw) ? modeRaw : 'push';

	const userId = await verifyLoginChallenge(challengeToken);
	if (!userId) {
		return NextResponse.json(
			{ error: 'Your sign-in verification session has expired. Please sign in again.' },
			{ status: 401 }
		);
	}

	const started = await startDesktopLoginApproval({
		userId,
		mode,
		request,
	});

	return NextResponse.json(
		{
			ok: true,
			approvalId: started.approvalId,
			pollSecret: started.pollSecret,
			qrToken: started.qrToken,
			mode: started.mode,
			challengeNumber: started.challengeNumber,
			expiresAt: started.expiresAt,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export const POST = withAudit(handlePOST, {
	action: 'auth.devices.approval_start',
	target: 'auth.devices.approval',
});
