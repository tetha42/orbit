/**
 * Roles and their per-app permissions (see src/core/permissions).
 *
 * Tables:
 *   roles         — id, name, color, description, permissions (JSONB), is_system, require_2fa, created_at
 *   users.role_id — the member's role; NULL means "no role yet" (personal settings only)
 *
 * The admin role (rol_admin) is created on first start, manages everything and
 * cannot be edited or deleted; the last admin cannot lose the role.
 */
import type { PoolClient } from 'pg';
import { randomBytes } from 'crypto';
import { getPgPool, withTransaction, ensurePostgresInit, getSystemSetting, updateUserStatus } from './index';
import { logAuditEvent, type AuditContext } from './audit';
import { startListener, registerEventHandler, publishEvent } from './events';
import { invalidateCache } from '@/server/cache';
import { alanFarki, statusAction, roleDiff, roleSummary, memberTargetName, type RoleSummary } from '@/lib/audit';
import {
	ADMIN_ROLE_ID,
	ALUMNI_ROLE_ID,
	ALL_PERMISSIONS,
	MEMBER_ROLE_ID,
	MANAGEMENT_ROLE_ID,
	isAlumniRole,
	type Permissions,
	type Seviye,
} from '@/core/permissions';

export interface Role {
	id: string;
	ad: string;
	name?: string;
	renk: string;
	color?: string;
	aciklama: string;
	description?: string;
	sistem: boolean;
	isSystem?: boolean;
	ikiAdimZorunlu: boolean;
	require2fa?: boolean;
	izinler: Permissions;
	permissions?: Permissions;
	kullaniciSayisi: number;
	userCount?: number;
	olusturma?: number;
	createdAt?: number;
}

/** The member's role and permissions, as the session and every guard see them. */
export interface Permission {
	role: { id: string; name: string; color: string; ad?: string; renk?: string } | null;
	permissions: Permissions;
	izinler: Permissions;
	admin: boolean;
	require2fa: boolean;
	ikiAdimZorunlu: boolean;
}

const DEFAULT_ROLE_KEY = 'default_role';

const DEFAULT_MANAGEMENT_PERMISSIONS: Permissions = {
	news: 'manage',
	events: 'manage',
	teams: 'manage',
	projects: 'manage',
	certificates: 'manage',
	inventory: 'manage',
	members: 'manage',
	budget: 'manage',
	notes: 'use',
	chat: 'manage',
	mail: 'manage',
	settings: 'use',
	decisions: 'manage',
};

const DEFAULT_MEMBER_PERMISSIONS: Permissions = {
	news: 'use',
	events: 'use',
	teams: 'use',
	projects: 'use',
	certificates: 'use',
	inventory: 'use',
	members: 'use',
	notes: 'use',
	chat: 'use',
	mail: 'use',
	settings: 'use',
	decisions: 'use',
};

const DEFAULT_ALUMNI_PERMISSIONS: Permissions = {
	news: 'use',
	events: 'use',
	teams: 'use',
	projects: 'use',
	certificates: 'use',
	inventory: 'use',
	members: 'use',
	notes: 'use',
	chat: 'use',
	mail: 'use',
	settings: 'use',
	decisions: 'use',
};

function cleanPermissions(permissions: Permissions): Permissions {
	const out: Record<string, 'use' | 'manage'> = {};
	for (const [appId, lvl] of Object.entries(permissions || {})) {
		const s = String(lvl);
		if (s === 'manage' || s === 'yonet') {
			out[appId] = 'manage';
		} else if (s === 'use' || s === 'kullan') {
			out[appId] = 'use';
		}
	}
	return out as Permissions;
}

function parsePermissionsJson(raw: unknown): Permissions {
	if (!raw) return {};
	let obj: unknown = raw;
	if (typeof raw === 'string') {
		try {
			obj = JSON.parse(raw);
		} catch {
			return {};
		}
	}
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
	return cleanPermissions(obj as Permissions);
}

async function ensureSeedRole(
	client: PoolClient,
	id: string,
	name: string,
	color: string,
	description: string,
	require2fa: boolean,
	now: number,
	izinler: Permissions
): Promise<string> {
	const existing = await client.query(
		'SELECT id, permissions FROM roles WHERE id = $1 OR lower(name) = lower($2) LIMIT 1',
		[id, name]
	);
	if (existing.rows[0]?.id) {
		const existingId = String(existing.rows[0].id);
		const currentPerms = parsePermissionsJson(existing.rows[0].permissions);
		const merged: Permissions = { ...cleanPermissions(izinler), ...currentPerms };
		await client.query(
			'UPDATE roles SET permissions = $2::jsonb WHERE id = $1',
			[existingId, JSON.stringify(merged)]
		);
		return existingId;
	}
	await insertRole(client, id, name, color, description, require2fa, now, izinler);
	return id;
}

/** Called from ensurePostgresInit with its raw (lower-case) client, inside its transaction. */
export async function ensureRoleSchema(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS roles (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			color TEXT NOT NULL DEFAULT '#0a84ff',
			description TEXT NOT NULL DEFAULT '',
			permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
			is_system INTEGER NOT NULL DEFAULT 0,
			require_2fa INTEGER NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL
		);
		CREATE UNIQUE INDEX IF NOT EXISTS roles_name_ci ON roles (lower(name));
	`);
	const now = Date.now();
	await ensureSeedRole(
		client,
		ADMIN_ROLE_ID,
		'Admin',
		'#ff453a',
		'Manages all applications. Cannot be changed.',
		true,
		now,
		ALL_PERMISSIONS
	);
	await client.query(
		`UPDATE roles SET is_system = 1, require_2fa = 1, permissions = $2::jsonb WHERE id = $1`,
		[ADMIN_ROLE_ID, JSON.stringify(ALL_PERMISSIONS)]
	);

	// Ensure standard community roles (Management Board, Member, Alumni) exist on every installation.
	await ensureSeedRole(
		client,
		MANAGEMENT_ROLE_ID,
		'Management Board',
		'#ff9f0a',
		'Daily operations of the community',
		true,
		now + 1,
		DEFAULT_MANAGEMENT_PERMISSIONS
	);
	const memberRoleId = await ensureSeedRole(
		client,
		MEMBER_ROLE_ID,
		'Member',
		'#0a84ff',
		'Active community member',
		false,
		now + 2,
		DEFAULT_MEMBER_PERMISSIONS
	);
	const alumniRoleId = await ensureSeedRole(
		client,
		ALUMNI_ROLE_ID,
		'Alumni',
		'#64d2ff',
		'Alumni community member (read-only access).',
		false,
		now + 3,
		DEFAULT_ALUMNI_PERMISSIONS
	);

	await client.query(
		`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
		[DEFAULT_ROLE_KEY, memberRoleId, now]
	);

	// Heal any admin account that was marked 'mezun' back to 'aktif', and ensure
	// non-admin 'mezun' members hold the Mezun role.
	await client.query(`UPDATE users SET status = 'aktif' WHERE role_id = $1 AND status = 'mezun'`, [ADMIN_ROLE_ID]);
	await client.query(`UPDATE users SET role_id = $1 WHERE status = 'mezun' AND (role_id IS NULL OR role_id <> $1)`, [alumniRoleId]);
}

async function insertRole(
	client: PoolClient,
	id: string,
	name: string,
	color: string,
	description: string,
	require2fa: boolean,
	now: number,
	izinler: Permissions
) {
	const perms = cleanPermissions(izinler);
	await client.query(
		`INSERT INTO roles (id, name, color, description, permissions, is_system, require_2fa, created_at)
		 VALUES ($1, $2, $3, $4, $5::jsonb, 0, $6, $7)
		 ON CONFLICT (id) DO NOTHING`,
		[id, name, color, description, JSON.stringify(perms), require2fa ? 1 : 0, now]
	);
}

/* ---------------- permission cache ----------------
 * Every authenticated request needs the caller's permissions. They change only
 * when a role is edited, so they are cached per role for a few seconds and the
 * cache is dropped on every write. Other server processes hear the write over
 * PostgreSQL NOTIFY (db/events) and drop theirs at once; should that connection
 * be down they catch up within the TTL. Kept on globalThis so the one handler
 * below empties the same map whichever bundle of this module a route runs. */
const CACHE_TTL_MS = 5000;
const g = globalThis as typeof globalThis & { __beuRolOnbellegi?: Map<string, { at: number; permission: Permission }> };
const cache = (g.__beuRolOnbellegi ??= new Map());
const dropCache = () => cache.clear();
registerEventHandler('role-onbellegi', (event) => {
	if (event.k === 'permission' || event.k === 'refresh') {
		dropCache();
		invalidateCache('roller_raw');
	}
});

export function canonicalRoleId(id: string): string {
	if (id === 'rol_admin') return ADMIN_ROLE_ID;
	if (id === 'rol_yonetim_kurulu') return MANAGEMENT_ROLE_ID;
	if (id === 'rol_uye') return MEMBER_ROLE_ID;
	if (id === 'rol_mezun') return ALUMNI_ROLE_ID;
	return id;
}

export async function getRolePermission(rawRoleId: string | null | undefined): Promise<Permission> {
	const roleId = rawRoleId ? canonicalRoleId(rawRoleId) : null;
	if (!roleId) return { role: null, permissions: {}, izinler: {}, admin: false, require2fa: false, ikiAdimZorunlu: false };
	const hit = cache.get(roleId);
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.permission;
	try {
		void startListener();
		await ensurePostgresInit();
		const r = await getPgPool().query(
			'SELECT id, name, color, permissions, is_system AS "isSystem", require_2fa AS "require2fa" FROM roles WHERE id = $1',
			[roleId]
		);
		const row = r.rows[0];
		if (!row) return { role: null, permissions: {}, izinler: {}, admin: false, require2fa: false, ikiAdimZorunlu: false };
		const admin = roleId === ADMIN_ROLE_ID || roleId === 'rol_admin' || Number(row.isSystem ?? row.is_system ?? 0) === 1;
		const perms: Permissions = admin
			? { ...ALL_PERMISSIONS }
			: parsePermissionsJson(row.permissions);
		const req2fa = admin || Number(row.require2fa ?? row.require_2fa ?? 0) === 1;
		const permission: Permission = {
			role: { id: String(row.id), name: String(row.name), color: String(row.color), ad: String(row.name), renk: String(row.color) },
			permissions: perms,
			izinler: perms,
			admin,
			require2fa: req2fa,
			ikiAdimZorunlu: req2fa,
		};
		cache.set(roleId, { at: Date.now(), permission });
		return permission;
	} catch (error) {
		console.error('getRolePermission error:', error);
		if (roleId === ADMIN_ROLE_ID || roleId === 'rol_admin') {
			return {
				role: { id: ADMIN_ROLE_ID, name: 'Admin', color: '#ff453a', ad: 'Admin', renk: '#ff453a' },
				permissions: { ...ALL_PERMISSIONS },
				izinler: { ...ALL_PERMISSIONS },
				admin: true,
				require2fa: true,
				ikiAdimZorunlu: true,
			};
		}
		return { role: null, permissions: {}, izinler: {}, admin: false, require2fa: false, ikiAdimZorunlu: false };
	}
}

export async function getRoles(): Promise<Role[]> {
	try {
		await ensurePostgresInit();
		const [roles, counts] = await Promise.all([
			getPgPool().query(
				'SELECT id, name, color, description, permissions, is_system AS "isSystem", require_2fa AS "require2fa", created_at AS "createdAt" FROM roles ORDER BY is_system DESC, created_at ASC'
			),
			getPgPool().query(
				`SELECT role_id AS "roleId", COUNT(*)::int AS n FROM users WHERE role_id IS NOT NULL AND status <> 'reddedildi' GROUP BY role_id`
			),
		]);
		const n = new Map(counts.rows.map((c) => [(c.roleId ?? c.roleid) as string, Number(c.n)]));
		return roles.rows.map((r) => {
			const isSystem = Number(r.isSystem ?? r.is_system ?? 0) === 1;
			const require2fa = Number(r.require2fa ?? r.require_2fa ?? 0) === 1;
			const createdAt = Number(r.createdAt ?? r.created_at ?? 0);
			const perms = r.id === ADMIN_ROLE_ID || isSystem ? { ...ALL_PERMISSIONS } : parsePermissionsJson(r.permissions);
			const userCount = n.get(String(r.id)) ?? 0;
			return {
				id: String(r.id),
				ad: String(r.name ?? ''),
				name: String(r.name ?? ''),
				renk: String(r.color ?? '#0a84ff'),
				color: String(r.color ?? '#0a84ff'),
				aciklama: String(r.description ?? ''),
				description: String(r.description ?? ''),
				sistem: isSystem,
				isSystem,
				ikiAdimZorunlu: require2fa,
				require2fa,
				izinler: perms,
				permissions: perms,
				kullaniciSayisi: userCount,
				userCount,
				olusturma: createdAt,
				createdAt,
			};
		});
	} catch (error) {
		console.error('getRoles error:', error);
		return [];
	}
}

export type RoleResult = { ok: true; id: string; error?: undefined } | { ok: false; error: 'yok' | 'sistem' | 'ad-var'; id?: undefined };

/** A role as the audit log records it, read inside the operation's transaction. */
async function readRoleSummary(client: PoolClient, id: string): Promise<RoleSummary | null> {
	const r = await client.query(
		'SELECT name, color, description, permissions, require_2fa AS "require2fa" FROM roles WHERE id = $1',
		[id]
	);
	if (!r.rows[0]) return null;
	const row = r.rows[0];
	const perms = parsePermissionsJson(row.permissions);
	return roleSummary({
		ad: String(row.name ?? ''),
		renk: String(row.color ?? ''),
		aciklama: String(row.description ?? ''),
		ikiAdimZorunlu: Number(row.require2fa ?? row.require_2fa ?? 0) === 1,
		izinler: perms as Record<string, string>,
	});
}

async function roleName(client: PoolClient, id: string | null): Promise<string | null> {
	if (!id) return null;
	const r = await client.query('SELECT name FROM roles WHERE id = $1', [id]);
	return r.rows[0]?.name ? String(r.rows[0].name) : null;
}

// Every change below writes its audit record (src/db/audit.ts) on the same
// transaction client: the record exists exactly when the change was committed.

export async function createRole(r: { name?: string; ad?: string; color?: string; renk?: string; description?: string; aciklama?: string; permissions?: Permissions; izinler?: Permissions; require2fa?: boolean; ikiAdimZorunlu?: boolean }, ctx: AuditContext): Promise<RoleResult> {
	const id = `rol_${randomBytes(6).toString('hex')}`;
	const name = (r.name ?? r.ad ?? '').trim();
	const color = r.color ?? r.renk ?? '#0a84ff';
	const description = r.description ?? r.aciklama ?? '';
	const require2fa = Boolean(r.require2fa ?? r.ikiAdimZorunlu);
	const permissions = r.permissions ?? r.izinler ?? {};
	try {
		await withTransaction(async (client) => {
			await insertRole(client, id, name, color, description, require2fa, Date.now(), permissions);
			await logAuditEvent(client, ctx, { action: 'role.create', targetType: 'role', targetId: id, targetName: name, before: null, after: await readRoleSummary(client, id) });
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return { ok: false, error: 'ad-var' };
		throw err;
	}
	dropCache();
	return { ok: true, id };
}

export async function updateRole(id: string, r: { name?: string; ad?: string; color?: string; renk?: string; description?: string; aciklama?: string; permissions?: Permissions; izinler?: Permissions; require2fa?: boolean; ikiAdimZorunlu?: boolean }, ctx: AuditContext): Promise<RoleResult> {
	const name = (r.name ?? r.ad ?? '').trim();
	const color = r.color ?? r.renk ?? '#0a84ff';
	const description = r.description ?? r.aciklama ?? '';
	const require2fa = Boolean(r.require2fa ?? r.ikiAdimZorunlu);
	const permissions = r.permissions ?? r.izinler ?? {};
	try {
		const out = await withTransaction(async (client): Promise<RoleResult> => {
			const found = await client.query('SELECT is_system AS "isSystem" FROM roles WHERE id = $1 FOR UPDATE', [id]);
			if (!found.rows[0]) return { ok: false, error: 'yok' };
			if (Number(found.rows[0].isSystem ?? found.rows[0].is_system ?? 0) === 1) return { ok: false, error: 'sistem' };
			const previous = await readRoleSummary(client, id);
			const perms = cleanPermissions(permissions);
			await client.query(
				'UPDATE roles SET name = $2, color = $3, description = $4, permissions = $5::jsonb, require_2fa = $6 WHERE id = $1',
				[id, name, color, description, JSON.stringify(perms), require2fa ? 1 : 0]
			);
			const after = await readRoleSummary(client, id);
			// Saving without a change leaves nothing to record.
			const fark = previous && after ? roleDiff(previous, after) : null;
			if (fark) {
				await logAuditEvent(client, ctx, { action: 'role.edit', targetType: 'role', targetId: id, targetName: after?.ad ?? name, before: fark.before, after: fark.after });
				await publishEvent(client, { k: 'permission', roleId: id });
			}
			return { ok: true, id };
		});
		dropCache();
		return out;
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return { ok: false, error: 'ad-var' };
		throw err;
	}
}

/** Deletes a role; its members move to `tasi` (another role) or to no role. */
export async function deleteRole(id: string, tasi: string | null, ctx: AuditContext): Promise<RoleResult> {
	const out = await withTransaction(async (client): Promise<RoleResult> => {
		const found = await client.query('SELECT is_system AS "isSystem" FROM roles WHERE id = $1 FOR UPDATE', [id]);
		if (!found.rows[0]) return { ok: false, error: 'yok' };
		if (Number(found.rows[0].isSystem ?? found.rows[0].is_system ?? 0) === 1 || id === ALUMNI_ROLE_ID) return { ok: false, error: 'sistem' };
		if (tasi) {
			const target = await client.query('SELECT 1 FROM roles WHERE id = $1 AND id <> $2', [tasi, id]);
			if (!target.rowCount) return { ok: false, error: 'yok' };
		}
		const previous = await readRoleSummary(client, id);
		const tasiAd = await roleName(client, tasi);
		const moved = await client.query('UPDATE users SET role_id = $2 WHERE role_id = $1', [id, tasi]);
		await client.query('DELETE FROM roles WHERE id = $1', [id]);
		const def = await client.query(`SELECT value AS deger FROM system_settings WHERE key = $1`, [DEFAULT_ROLE_KEY]);
		const varsayilandi = def.rows[0]?.deger === id;
		if (varsayilandi) await client.query(`DELETE FROM system_settings WHERE key = $1`, [DEFAULT_ROLE_KEY]);
		await logAuditEvent(client, ctx, {
			action: 'role.delete',
			targetType: 'role',
			targetId: id,
			targetName: previous?.ad ?? '',
			before: previous,
			after: { movedCount: moved.rowCount ?? 0, movedToRoleId: tasi, movedToRoleName: tasiAd, defaultRoleCleared: varsayilandi },
		});
		await publishEvent(client, { k: 'permission', roleId: id });
		return { ok: true, id };
	});
	dropCache();
	return out;
}

/**
 * Gives a member a role (or none). Locks the admins while checking, so two
 * admins demoting each other at the same moment cannot leave the club without one.
 * Assigning the Mezun role automatically sets `status = 'mezun'`; assigning any
 * other role to a graduate automatically restores `status = 'aktif'`.
 */
export async function setUserRole(userId: string, roleId: string | null, ctx: AuditContext): Promise<'ok' | 'yok' | 'role-yok' | 'son-admin'> {
	return withTransaction(async (client) => {
		await client.query("SELECT pg_advisory_xact_lock(hashtext('roles.admin'))");
		const u = await client.query('SELECT first_name AS ad, last_name AS soyad, email, role_id AS "roleId", status FROM users WHERE id = $1 FOR UPDATE', [userId]);
		if (!u.rows[0]) return 'yok';
		let targetRole: { id: string; ad: string } | null = null;
		if (roleId) {
			const r = await client.query('SELECT id, name FROM roles WHERE id = $1', [roleId]);
			if (!r.rowCount) return 'role-yok';
			targetRole = { id: String(r.rows[0].id), ad: String(r.rows[0].name) };
		}
		if (u.rows[0].roleId === ADMIN_ROLE_ID && roleId !== ADMIN_ROLE_ID) {
			const admins = await client.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1 AND status = 'aktif'`, [ADMIN_ROLE_ID]);
			if (Number(admins.rows[0].n) <= 1) return 'son-admin';
		}

		const previous: string | null = u.rows[0].roleId ?? null;
		const previousStatus = (u.rows[0].status as 'aktif' | 'beklemede' | 'reddedildi' | 'mezun') || 'aktif';
		const targetAlumni = isAlumniRole(targetRole);
		const newStatus: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun' = targetAlumni
			? 'mezun'
			: previousStatus === 'mezun'
			? 'aktif'
			: previousStatus;

		await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [userId, roleId]);
		if (newStatus !== previousStatus) {
			await updateUserStatus(userId, newStatus, client);
		}

		if (previous !== roleId || newStatus !== previousStatus) {
			await logAuditEvent(client, ctx, {
				action: roleId ? 'member.role_grant' : 'member.role_revoke',
				targetType: 'member',
				targetId: userId,
				targetName: memberTargetName(u.rows[0]),
				before: {
					roleId: previous,
					roleName: await roleName(client, previous),
					...(newStatus !== previousStatus ? { status: previousStatus } : {}),
				},
				after: {
					roleId,
					roleName: await roleName(client, roleId),
					...(newStatus !== previousStatus ? { status: newStatus } : {}),
				},
			});
			await publishEvent(client, { k: 'permission', userId });
		}
		return 'ok';
	});
}

/**
 * Changes a member's status (approve / reject an application, graduate,
 * reactivate). Approving an applicant who has no role gives them the club's
 * default role in the same step; graduating a member assigns the Mezun role,
 * and reactivating a graduate restores the club's default role.
 */
export async function setMemberStatus(userId: string, status: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun', ctx: AuditContext): Promise<'ok' | 'yok'> {
	return withTransaction(async (client) => {
		const u = await client.query('SELECT first_name AS ad, last_name AS soyad, email, status, role_id AS "roleId" FROM users WHERE id = $1 FOR UPDATE', [userId]);
		const row = u.rows[0];
		if (!row) return 'yok';
		let roleId: string | null = row.roleId ?? null;
		const currentRoleName = await roleName(client, roleId);

		if (status === 'mezun') {
			const alumniRole = await client.query(
				`SELECT id FROM roles WHERE id = $1 OR lower(name) IN ('mezun', 'alumni') ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1`,
				[ALUMNI_ROLE_ID]
			);
			if (alumniRole.rows[0]?.id) {
				roleId = String(alumniRole.rows[0].id);
				await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [userId, roleId]);
			}
		} else if (
			status === 'aktif' &&
			((row.status === 'beklemede' && !roleId) ||
				(row.status === 'mezun' && (!roleId || isAlumniRole({ id: roleId, ad: currentRoleName }))))
		) {
			const def = await client.query(
				`SELECT r.id FROM system_settings s JOIN roles r ON r.id = s.value WHERE s.key = $1
				 UNION ALL
				 SELECT id FROM roles WHERE id = $2 OR lower(name) IN ('üye', 'member')
				 LIMIT 1`,
				[DEFAULT_ROLE_KEY, MEMBER_ROLE_ID]
			);
			if (def.rows[0]) {
				roleId = def.rows[0].id as string;
				await client.query('UPDATE users SET role_id = $2 WHERE id = $1', [userId, roleId]);
			} else if (isAlumniRole({ id: roleId, ad: currentRoleName })) {
				roleId = null;
				await client.query('UPDATE users SET role_id = NULL WHERE id = $1', [userId]);
			}
		}

		// updateUserStatus pays the welcome XP itself, once, on approval.
		await updateUserStatus(userId, status, client);
		if (roleId !== (row.roleId ?? null)) await publishEvent(client, { k: 'permission', userId });
		const action = statusAction(row.status, status);
		if (!action) return 'ok';
		const oldRole: string | null = row.roleId ?? null;
		const fark = alanFarki(
			{ status: row.status, roleId: oldRole, roleName: currentRoleName },
			{ status, roleId, roleName: await roleName(client, roleId) }
		);
		if (fark) await logAuditEvent(client, ctx, { action: action, targetType: 'member', targetId: userId, targetName: memberTargetName(row), before: fark.before, after: fark.after });
		return 'ok';
	});
}

/** Active admins — the last one cannot be deleted, deactivated or demoted. */
export async function countActiveAdmins(): Promise<number> {
	await ensurePostgresInit();
	const r = await getPgPool().query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1 AND status = 'aktif'`, [ADMIN_ROLE_ID]);
	return Number(r.rows[0]?.n ?? 0);
}

export async function getDefaultRoleId(): Promise<string | null> {
	const v = await getSystemSetting(DEFAULT_ROLE_KEY, '');
	return v || null;
}

export async function setDefaultRoleId(roleId: string | null, ctx: AuditContext): Promise<'ok' | 'yok' | 'sistem'> {
	return withTransaction(async (client) => {
		if (roleId) {
			const r = await client.query('SELECT id, name, is_system AS "isSystem" FROM roles WHERE id = $1', [roleId]);
			if (!r.rows[0]) return 'yok';
			// New members never become admins or graduates by default.
			const row = r.rows[0];
			if (Number(row.isSystem ?? row.is_system ?? 0) === 1 || isAlumniRole({ id: String(row.id), ad: String(row.name ?? '') })) return 'sistem';
		}
		const cur = await client.query('SELECT value AS deger FROM system_settings WHERE key = $1 FOR UPDATE', [DEFAULT_ROLE_KEY]);
		const previous: string | null = cur.rows[0]?.deger || null;
		await client.query(
			`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
			[DEFAULT_ROLE_KEY, roleId ?? '', Date.now()]
		);
		if (previous !== roleId) {
			await logAuditEvent(client, ctx, {
				action: 'role.default',
				targetType: 'setting',
				targetId: DEFAULT_ROLE_KEY,
				targetName: 'Varsayılan role',
				before: { roleId: previous, roleName: await roleName(client, previous) },
				after: { roleId, roleName: await roleName(client, roleId) },
			});
		}
		return 'ok';
	});
}

/** Members holding any of these roles — for "notify everyone who manages X". */
export async function getRoleIdsWith(appId: string, seviye: Seviye): Promise<string[]> {
	try {
		await ensurePostgresInit();
		const isManage = seviye === 'manage' || (seviye as string) === 'yonet';
		const levels = isManage ? ['manage', 'yonet'] : ['use', 'kullan', 'manage', 'yonet'];
		const r = await getPgPool().query(
			'SELECT id FROM roles WHERE (permissions ->> $1) = ANY($2)',
			[appId, levels]
		);
		return Array.from(new Set([ADMIN_ROLE_ID, ...r.rows.map((x) => String(x.id))]));
	} catch (error) {
		console.error('getRoleIdsWith error:', error);
		return [ADMIN_ROLE_ID];
	}
}
