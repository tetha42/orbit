import { NextResponse } from 'next/server';
import { getMembershipPolicy, setMembershipPolicy } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'kullan');
	if (!auth.authorized) return auth.response;
	return NextResponse.json(
		{ ok: true, policy: await getMembershipPolicy() },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return NextResponse.json({ error: 'Geçersiz üyelik politikası.' }, { status: 400 });
	}
	const policy = await setMembershipPolicy(body);
	void logSystemEvent({
		servis: 'settings',
		seviye: 'INFO',
		mesaj: `Üyelik politikası güncellendi (${auth.user.ad} ${auth.user.soyad})`,
		detay: {
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
