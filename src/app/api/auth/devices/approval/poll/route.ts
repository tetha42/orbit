import { NextResponse } from 'next/server';
import { getUserById } from '@/db';
import { pollOrClaimApproval } from '@/domains/devices/approvals';
import { attachSessionCookie, establishSession, sessionUserOf } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// audit:exempt: desktop-approval-poll
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const approvalId = String(body.approvalId || '').trim();
	const pollSecret = String(body.pollSecret || '').trim();

	if (!approvalId || !pollSecret) {
		return NextResponse.json({ error: 'Missing approvalId or pollSecret.' }, { status: 400 });
	}

	const polled = await pollOrClaimApproval({ approvalId, pollSecret });
	if (polled.status === 'approved' && polled.userId) {
		const user = await getUserById(polled.userId);
		if (!user || user.status !== 'active') {
			return NextResponse.json({ ok: false, status: 'rejected' }, { status: 403 });
		}
		const sessionToken = await establishSession(user, request, 'totp');
		const response = NextResponse.json({
			ok: true,
			status: 'approved',
			user: await sessionUserOf(user),
		});
		return attachSessionCookie(response, sessionToken);
	}

	return NextResponse.json(
		{
			ok: polled.ok,
			status: polled.status,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
