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
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	const [invitations, roles] = await Promise.all([listInvitations(), getRoles()]);
	return NextResponse.json(
		{
			ok: true,
			invitations,
			roles: roles.map(({ id, name, color }) => ({ id, name, color })),
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts have read-only access.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') {
		return NextResponse.json({ error: 'Invalid invitation request.' }, { status: 400 });
	}
	const email = String(body.email ?? '').trim().toLowerCase();
	if (email && !isValidEmail(email)) {
		return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
	}
	const roleId = typeof body.roleId === 'string' && body.roleId ? body.roleId : null;
	if (roleId) {
		const role = await getRolePermission(roleId);
		if (!role.role) return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
		// An invitation does not grant the actor permissions; it preassigns a future
		// member. Only the built-in Admin role stays admin-only.
		if (roleId === ADMIN_ROLE_ID && !auth.user.permission.admin) {
			return NextResponse.json({ error: 'Only an admin can invite to the Admin role.' }, { status: 403 });
		}
	}
	const policy = await getMembershipPolicy();
	if (!policy.inviteEnabled) {
		return NextResponse.json({ error: 'Invitation system is currently disabled.' }, { status: 403 });
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
		service: 'settings',
		level: 'INFO',
		message: `Membership invitation created${email ? `: ${email}` : ''} (${auth.user.firstName || auth.user.name || ""} ${auth.user.lastName || auth.user.surname || ""})`,
		detail: { invitationId: invitation.id, roleId, days },
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
	const auth = await requireApp(request, 'settings', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts have read-only access.' }, { status: 403 });
	}
	const id = new URL(request.url).searchParams.get('id') ?? '';
	if (!id) return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
	const removed = await deleteInvitation(id);
	if (!removed) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
	void logSystemEvent({
		service: 'settings',
		level: 'WARN',
		message: `Membership invitation revoked (${id})`,
		detail: { invitationId: id },
		userId: auth.user.id,
	});
	return NextResponse.json({ ok: true });
}
