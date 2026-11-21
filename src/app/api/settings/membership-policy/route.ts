import { NextResponse } from 'next/server';
import { getMembershipPolicy, setMembershipPolicy } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'use');
	if (!auth.authorized) return auth.response;
	return NextResponse.json(
		{ ok: true, policy: await getMembershipPolicy() },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts have read-only access.' }, { status: 403 });
	}
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return NextResponse.json({ error: 'Invalid membership policy.' }, { status: 400 });
	}
	const policy = await setMembershipPolicy(body);
	void logSystemEvent({
		service: 'settings',
		level: 'INFO',
		message: `Membership policy updated (${auth.user.firstName || auth.user.name || ""} ${auth.user.lastName || auth.user.surname || ""})`,
		detail: {
			selfRegistration: policy.selfRegistration,
			adminCreate: policy.adminCreate,
			inviteEnabled: policy.inviteEnabled,
			emailVerification: policy.emailVerification,
			allowedEmailDomains: policy.allowedEmailDomains.length,
			reapplyCooldownDays: policy.reapplyCooldownDays,
			inviteExpiryDays: policy.inviteExpiryDays,
		},
		userId: auth.user.id,
	});
	return NextResponse.json({ ok: true, policy });
}
