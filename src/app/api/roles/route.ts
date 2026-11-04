import { NextResponse } from 'next/server';
import { createRole, deleteRole, getRolePermission, getRoles, getDefaultRoleId, setDefaultRoleId, updateRole } from '@/db/roles';
import { auditContext } from '@/db/audit';
import { authenticateEnrolled, can, requireAdmin, type AuthorizedUser } from '@/lib/auth/access';
import { ADMIN_ROLE_ID, ALUMNI_ROLE_ID, PERMISSION_DESCRIPTIONS, extraPermissions, normalizePermissions, roleProblem, canAssignRole, type Permissions } from '@/core/permissions';
import { getCached, setCached, invalidateCache } from '@/server/cache';

/**
 * Roles — Settings → Roller. Managing roles is strictly restricted to system admins.
 * Nobody can create, edit, delete or hand out a role stronger than their own
 * (escalation); the admin role is fixed. Those who manage members read the
 * list too, to assign roles, but only names and colours.
 */
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function readRole(body: Record<string, unknown>, user: AuthorizedUser) {
	const err = roleProblem(body);
	if (err) return { error: err };
	const permission = normalizePermissions(body.permissions ?? {});
	if (permission.error !== undefined) return { error: permission.error };
	const excess = extraPermissions(permission.value, user.permission.permissions);
	if (excess.length) return { error: `Kendinizde olmayan yetkileri veremezsiniz: ${excess.map((a) => PERMISSION_DESCRIPTIONS[a].name).join(', ')}`, status: 403 };
	return {
		value: {
			name: String(body.name).trim(),
			color: String(body.color).toLowerCase(),
			description: typeof body.description === 'string' ? body.description.trim() : '',
			permissions: permission.value as Permissions,
			twoStepRequired: body.twoStepRequired === true,
		},
	};
}

export async function GET(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	const settings = user.permission.admin;
	if (!settings && !can(user, 'members', 'manage')) return bad('Bu işlem Yönetici yetkisi veya Üye Rehberi yönetim yetkisi gerektirir.', 403);

	let raw = getCached<{ roles: Awaited<ReturnType<typeof getRoles>>; defaultRoleId: string | null }>('roles_raw');
	if (!raw) {
		const [roles, defaultRoleId] = await Promise.all([getRoles(), getDefaultRoleId()]);
		raw = { roles, defaultRoleId };
		setCached('roles_raw', raw, 60_000);
	}

	const marked = raw.roles.map((r) => {
		const assignable = canAssignRole(r, user.permission);
		return { ...r, assignable };
	});
	if (!settings) {
		const rolesOnly = marked.map(({ id, name, color, system, assignable }) => ({ id, name, color, system, assignable }));
		return NextResponse.json({
			roles: rolesOnly,
			defaultRoleId: raw.defaultRoleId,
		});
	}
	return NextResponse.json({
		roles: marked,
		defaultRoleId: raw.defaultRoleId,
		myPermissions: user.permission.permissions,
	});
}

/** A role the caller may not touch answers 403 before anything is changed. */
async function isProtectedRole(id: string, user: AuthorizedUser): Promise<boolean> {
	const current = await getRolePermission(id);
	return !!current.role && !canAssignRole({ id, permissions: current.permissions }, user.permission);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (body.action === 'setDefault') {
			const rawRoleId = body.roleId;
			const roleId = typeof rawRoleId === 'string' && rawRoleId ? rawRoleId : null;
			if (roleId && extraPermissions((await getRolePermission(roleId)).permissions, auth.user.permission.permissions).length) {
				return bad('Varsayılan role sizden daha yetkili olamaz.', 403);
			}
			const r = await setDefaultRoleId(roleId, auditContext(request, auth.user));
			if (r === 'none') return bad('Role bulunamadı.', 404);
			if (r === 'system') return bad('Admin cannot be the default role', 400);
			invalidateCache('roles_raw');
			return NextResponse.json({ success: true });
		}
		const parsed = readRole(body, auth.user);
		if (parsed.error !== undefined) return bad(parsed.error, parsed.status);
		const r = await createRole(parsed.value, auditContext(request, auth.user));
		if (!r.ok) return bad(r.error === 'name_taken' ? 'Bu adla bir role zaten var.' : 'Role oluşturulamadı.', 409);
		invalidateCache('roles_raw');
		return NextResponse.json({ success: true, id: r.id }, { status: 201 });
	} catch (error) {
		console.error('API /api/roles POST error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export async function PATCH(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = typeof body.id === 'string' ? body.id : '';
		if (id === ADMIN_ROLE_ID) return bad('Admin roleü değiştirilemez.', 409);
		if (await isProtectedRole(id, auth.user)) return bad('Sizden daha yetkili bir roleü değiştiremezsiniz.', 403);
		// Editing your own role into something stronger is the same escalation.
		const parsed = readRole(body, auth.user);
		if (parsed.error !== undefined) return bad(parsed.error, parsed.status);
		const r = await updateRole(id, parsed.value, auditContext(request, auth.user));
		if (!r.ok) {
			if (r.error === 'none') return bad('Role bulunamadı.', 404);
			if (r.error === 'system') return bad('Yerleşik role değiştirilemez.', 409);
			return bad('Bu adla bir role zaten var.', 409);
		}
		invalidateCache('roles_raw');
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/roles PATCH error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const id = typeof body.id === 'string' ? body.id : '';
		const move = typeof body.move === 'string' && body.move ? body.move : null;
		if (id === ADMIN_ROLE_ID) return bad('Admin roleü silinemez.', 409);
		if (id === ALUMNI_ROLE_ID) return bad('Mezun roleü silinemez.', 409);
		if (await isProtectedRole(id, auth.user)) return bad('Sizden daha yetkili bir roleü silemezsiniz.', 403);
		if (move === ADMIN_ROLE_ID) return bad('Üyeler toplu olarak Admin yapılamaz.', 400);
		if (move && extraPermissions((await getRolePermission(move)).permissions, auth.user.permission.permissions).length) {
			return bad('Üyeleri kendinizden daha yetkili bir role taşıyamazsınız.', 403);
		}
		const r = await deleteRole(id, move, auditContext(request, auth.user));
		if (!r.ok) return bad(r.error === 'system' ? 'Yerleşik role silinemez.' : 'Role bulunamadı.', r.error === 'system' ? 409 : 404);
		invalidateCache('roles_raw');
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/roles DELETE error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}
