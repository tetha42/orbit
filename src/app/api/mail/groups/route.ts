import { NextResponse } from 'next/server';
import { getMailRecipientGroups } from '@/db';
import { requireAdmin } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** Recipient groups for the mail composer: active members, roles, teams and committees. */
export async function GET(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	return NextResponse.json(
		{ groups: await getMailRecipientGroups() },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
