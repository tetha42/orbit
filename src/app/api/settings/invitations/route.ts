import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import {
	createInvitation,
	deleteInvitation,
	getMembershipPolicy,
	listInvitations,
} from '@/db';
import { getRolePermission, getRoles } from '@/db/roles';
import { requireApp } from '@/lib/auth/access';
import { isValidEmail } from '@/lib/mail/address';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	const [invitations, roles] = await Promise.all([listInvitations(), getRoles()]);
	return NextResponse.json(
		{
			ok: true,
			invitations,
			roles: roles.map(({ id, ad, renk }) => ({ id, ad, renk })),
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') {
		return NextResponse.json({ error: 'Geçersiz davet isteği.' }, { status: 400 });
	}
	const email = String(body.email ?? '').trim().toLowerCase();
	if (email && !isValidEmail(email)) {
		return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 });
	}
	const roleId = typeof body.roleId === 'string' && body.roleId ? body.roleId : null;
	if (roleId) {
		const role = await getRolePermission(roleId);
		if (!role.role) return NextResponse.json({ error: 'Rol bulunamadı.' }, { status: 404 });
		// An invitation does not grant the actor permissions; it preassigns a future
		// member. Only the built-in Admin role stays admin-only.
		if (roleId === ADMIN_ROLE_ID && !auth.user.permission.admin) {
			return NextResponse.json({ error: 'Admin rolü yalnızca bir admin tarafından davet edilebilir.' }, { status: 403 });
		}
	}
	const policy = await getMembershipPolicy();
	if (!policy.inviteEnabled) {
		return NextResponse.json({ error: 'Davet sistemi şu anda kapalı.' }, { status: 403 });
	}
	const requestedDays = Number(body.expiresInDays);
	const days = Number.isFinite(requestedDays)
		? Math.min(90, Math.max(1, Math.trunc(requestedDays)))
		: policy.inviteExpiryDays;

	const token = randomBytes(24).toString('base64url');
	const tokenHash = createHash('sha256').update(token).digest('hex');
	const invitation = await createInvitation({
		tokenHash,
		email: email || null,
		roleId,
		teamId: typeof body.teamId === 'string' && body.teamId ? body.teamId : null,
		note: typeof body.note === 'string' ? body.note : null,
		createdBy: auth.user.id,
		expiresAt: Date.now() + days * 86_400_000,
	});
	void logSystemEvent({
		servis: 'settings',
		seviye: 'INFO',
		mesaj: `Üyelik daveti oluşturuldu${email ? `: ${email}` : ''} (${auth.user.ad} ${auth.user.soyad})`,
		detay: { invitationId: invitation.id, roleId, days },
		userId: auth.user.id,
	});

	return NextResponse.json({
		ok: true,
		invitation,
		token,
		path: `/?invite=${encodeURIComponent(token)}`,
	});
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'settings', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}
	const id = new URL(request.url).searchParams.get('id') ?? '';
	if (!id) return NextResponse.json({ error: 'Davet kimliği gerekli.' }, { status: 400 });
	const removed = await deleteInvitation(id);
	if (!removed) return NextResponse.json({ error: 'Davet bulunamadı.' }, { status: 404 });
	return NextResponse.json({ ok: true });
}
