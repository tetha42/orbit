import { NextResponse } from 'next/server';
import { createRole, deleteRole, getRolePermission, getRoles, getDefaultRoleId, setDefaultRoleId, updateRole } from '@/db/roles';
import { auditContext } from '@/db/audit';
import { authenticateEnrolled, can, requireAdmin, type AuthorizedUser } from '@/lib/auth/access';
import { ADMIN_ROLE_ID, ALUMNI_ROLE_ID, PERMISSION_DESCRIPTIONS, extraPermissions, normalizePermissions, roleProblem, canAssignRole, type Permissions } from '@/core/permissions';
import { getCached, setCached, invalidateCache } from '@/lib/server/cache';

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
	const izin = normalizePermissions(body.izinler ?? {});
	if (izin.error !== undefined) return { error: izin.error };
	const excess = extraPermissions(izin.value, user.permission.izinler);
	if (excess.length) return { error: `Kendinizde olmayan yetkileri veremezsiniz: ${excess.map((a) => PERMISSION_DESCRIPTIONS[a].ad).join(', ')}`, status: 403 };
	return {
		value: {
			ad: String(body.ad).trim(),
			renk: String(body.renk).toLowerCase(),
			aciklama: typeof body.aciklama === 'string' ? body.aciklama.trim() : '',
			izinler: izin.value as Permissions,
			ikiAdimZorunlu: body.ikiAdimZorunlu === true,
		},
	};
}

export async function GET(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	const settings = user.permission.admin;
	if (!settings && !can(user, 'members', 'yonet')) return bad('Bu işlem Yönetici yetkisi veya Üye Rehberi yönetim yetkisi gerektirir.', 403);

	let raw = getCached<{ roller: Awaited<ReturnType<typeof getRoles>>; varsayilanRolId: string | null }>('roller_raw');
	if (!raw) {
		const [roller, varsayilanRolId] = await Promise.all([getRoles(), getDefaultRoleId()]);
		raw = { roller, varsayilanRolId };
		setCached('roller_raw', raw, 60_000);
	}

	const isaretli = raw.roller.map((r) => {
		const assignable = canAssignRole(r, user.permission);
		return { ...r, assignableRoles: assignable, atanabilir: assignable };
	});
	if (!settings) {
		const rolesOnly = isaretli.map(({ id, ad, renk, sistem, assignableRoles, atanabilir }) => ({ id, ad, renk, sistem, assignableRoles, atanabilir }));
		return NextResponse.json({
			roles: rolesOnly,
			roller: rolesOnly,
			defaultRoleId: raw.varsayilanRolId,
			varsayilanRolId: raw.varsayilanRolId,
		});
	}
	return NextResponse.json({
		roles: isaretli,
		roller: isaretli,
		defaultRoleId: raw.varsayilanRolId,
		varsayilanRolId: raw.varsayilanRolId,
		myPermissions: user.permission.izinler,
		benimIzinlerim: user.permission.izinler,
	});
}

/** A role the caller may not touch answers 403 before anything is changed. */
async function isProtectedRole(id: string, user: AuthorizedUser): Promise<boolean> {
	const mevcut = await getRolePermission(id);
	return !!mevcut.role && !canAssignRole({ id, izinler: mevcut.izinler }, user.permission);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		if (body.action === 'varsayilan') {
			const rawRoleId = body.roleId ?? body.rolId;
			const roleId = typeof rawRoleId === 'string' && rawRoleId ? rawRoleId : null;
			if (roleId && extraPermissions((await getRolePermission(roleId)).izinler, auth.user.permission.izinler).length) {
				return bad('Varsayılan role sizden daha yetkili olamaz.', 403);
			}
			const r = await setDefaultRoleId(roleId, auditContext(request, auth.user));
			if (r === 'yok') return bad('Role bulunamadı.', 404);
			if (r === 'sistem') return bad('Admin cannot be the default role', 400);
			invalidateCache('roller_raw');
			return NextResponse.json({ success: true });
		}
		const parsed = readRole(body, auth.user);
		if (parsed.error !== undefined) return bad(parsed.error, parsed.status);
		const r = await createRole(parsed.value, auditContext(request, auth.user));
		if (!r.ok) return bad(r.error === 'ad-var' ? 'Bu adla bir role zaten var.' : 'Role oluşturulamadı.', 409);
		invalidateCache('roller_raw');
		return NextResponse.json({ success: true, id: r.id }, { status: 201 });
	} catch (error) {
		console.error('API /api/roller POST error:', error);
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
			if (r.error === 'yok') return bad('Role bulunamadı.', 404);
			if (r.error === 'sistem') return bad('Yerleşik role değiştirilemez.', 409);
			return bad('Bu adla bir role zaten var.', 409);
		}
		invalidateCache('roller_raw');
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/roller PATCH error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const id = typeof body.id === 'string' ? body.id : '';
		const tasi = typeof body.tasi === 'string' && body.tasi ? body.tasi : null;
		if (id === ADMIN_ROLE_ID) return bad('Admin roleü silinemez.', 409);
		if (id === ALUMNI_ROLE_ID) return bad('Mezun roleü silinemez.', 409);
		if (await isProtectedRole(id, auth.user)) return bad('Sizden daha yetkili bir roleü silemezsiniz.', 403);
		if (tasi === ADMIN_ROLE_ID) return bad('Üyeler toplu olarak Admin yapılamaz.', 400);
		if (tasi && extraPermissions((await getRolePermission(tasi)).izinler, auth.user.permission.izinler).length) {
			return bad('Üyeleri kendinizden daha yetkili bir role taşıyamazsınız.', 403);
		}
		const r = await deleteRole(id, tasi, auditContext(request, auth.user));
		if (!r.ok) return bad(r.error === 'sistem' ? 'Yerleşik role silinemez.' : 'Role bulunamadı.', r.error === 'sistem' ? 409 : 404);
		invalidateCache('roller_raw');
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/roller DELETE error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}
