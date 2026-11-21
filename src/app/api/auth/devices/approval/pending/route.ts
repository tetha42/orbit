import { NextResponse } from 'next/server';
import { listPendingApprovalsForMobile } from '@/domains/devices/approvals';
import { verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const approvals = await listPendingApprovalsForMobile(auth.user.id);
	return NextResponse.json(
		{
			ok: true,
			approvals,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
