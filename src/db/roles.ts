/**
 * Roles and their per-app permissions (see src/core/permissions).
 *
 * Tables:
 *   roller        — id, ad, renk, aciklama, sistem (built-in admin), ikiAdimZorunlu
 *   rol_izinleri  — (roleId, appId) → seviye ('kullan' | 'yonet'); 'yok' is the absence of a row
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
import { invalidateCache } from '@/lib/server/cache';
import { alanFarki, statusAction, roleDiff, roleSummary, memberTargetName, type RoleSummary } from '@/lib/audit';
import {
	ADMIN_ROLE_ID,
	ALUMNI_ROLE_ID,
	ALL_PERMISSIONS,
	MEMBER_ROLE_ID,
	PERMISSION_APPS,
	MANAGEMENT_ROLE_ID,
	isAlumniRole,
	type Permissions,
	type Seviye,
} from '@/core/permissions';

export interface Role {
	id: string;
	ad: string;
	renk: string;
	aciklama: string;
	sistem: boolean;
	ikiAdimZorunlu: boolean;
	izinler: Permissions;
	kullaniciSayisi: number;
}

/** The member's role and permissions, as the session and every guard see them. */
export interface Permission {
	role: { id: string; ad: string; renk: string } | null;
	izinler: Permissions;
	admin: boolean;
	ikiAdimZorunlu: boolean;
}

const DEFAULT_ROLE_KEY = 'varsayilan_rol';
const DONUSUM_ANAHTARI = 'roller_donusumu';

const DEFAULT_MANAGEMENT_PERMISSIONS: Permissions = {
	news: 'yonet',
	events: 'yonet',
	teams: 'yonet',
	projects: 'yonet',
	certificates: 'yonet',
	inventory: 'yonet',
	members: 'yonet',
	budget: 'yonet',
	notes: 'kullan',
	chat: 'yonet',
	mail: 'yonet',
	settings: 'kullan',
	decisions: 'yonet',
};

const DEFAULT_MEMBER_PERMISSIONS: Permissions = {
	news: 'kullan',
	events: 'kullan',
	teams: 'kullan',
	projects: 'kullan',
	certificates: 'kullan',
	inventory: 'kullan',
	members: 'kullan',
	notes: 'kullan',
	chat: 'kullan',
	mail: 'kullan',
	settings: 'kullan',
	decisions: 'kullan',
};

const DEFAULT_ALUMNI_PERMISSIONS: Permissions = {
	news: 'kullan',
	events: 'kullan',
	teams: 'kullan',
	projects: 'kullan',
	certificates: 'kullan',
	inventory: 'kullan',
	members: 'kullan',
	notes: 'kullan',
	chat: 'kullan',
	mail: 'kullan',
	settings: 'kullan',
	decisions: 'kullan',
};

async function ensureSeedRole(
	client: PoolClient,
	id: string,
	ad: string,
	renk: string,
	aciklama: string,
	ikiAdim: boolean,
	now: number,
	izinler: Permissions
): Promise<string> {
	const existing = await client.query(
		'SELECT id FROM roles WHERE id = $1 OR lower(ad) = lower($2) LIMIT 1',
		[id, ad]
	);
	if (existing.rows[0]?.id) {
		const existingId = String(existing.rows[0].id);
		if (izinler.chat) {
			await client.query(
				`INSERT INTO role_permissions (roleId, appId, seviye) VALUES ($1, 'chat', $2) ON CONFLICT (roleId, appId) DO NOTHING`,
				[existingId, izinler.chat]
			);
		}
		return existingId;
	}
	await insertRole(client, id, ad, renk, aciklama, ikiAdim, now, izinler);
	return id;
}

/** Called from ensurePostgresInit with its raw (lower-case) client, inside its transaction. */
export async function ensureRoleSchema(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS roller (
			id TEXT PRIMARY KEY,
			ad TEXT NOT NULL,
			renk TEXT NOT NULL,
			aciklama TEXT NOT NULL DEFAULT '',
			sistem INTEGER NOT NULL DEFAULT 0,
			ikiAdimZorunlu INTEGER NOT NULL DEFAULT 0,
			olusturma BIGINT NOT NULL
		);
		CREATE UNIQUE INDEX IF NOT EXISTS roller_ad_ci ON roller (lower(ad));
		CREATE TABLE IF NOT EXISTS role_permissions (
			roleId TEXT NOT NULL REFERENCES roller(id) ON DELETE CASCADE,
			appId TEXT NOT NULL,
			seviye TEXT NOT NULL,
			PRIMARY KEY (roleId, appId)
		);
		ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id TEXT REFERENCES roller(id) ON DELETE SET NULL;
		DROP VIEW IF EXISTS roles CASCADE; CREATE OR REPLACE VIEW roles AS SELECT * FROM roller;
		DROP VIEW IF EXISTS rol_izinleri CASCADE; CREATE OR REPLACE VIEW rol_izinleri AS SELECT * FROM role_permissions;
	`);
	const now = Date.now();
	await client.query(
		`INSERT INTO roller (id, ad, renk, aciklama, sistem, ikiAdimZorunlu, olusturma)
		 VALUES ($1, 'Admin', '#ff453a', 'Manages all applications. Cannot be changed.', 1, 1, $2)
		 ON CONFLICT (id) DO NOTHING`,
		[ADMIN_ROLE_ID, now]
	);

	// One-time conversion of the old fixed roles (the `role` column), so an
	// existing club keeps working: lead → Admin, board → "Management Board"
	// (manages every app, as before), member → "Member" (the default for new members).
	// The column is dropped afterwards; a new installation never has it.
	const legacy = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'`);
	if (legacy.rowCount) {
		const done = await client.query(`SELECT 1 FROM system_settings WHERE key = $1`, [DONUSUM_ANAHTARI]);
		if (!done.rowCount) await convertLegacyRoles(client);
		await client.query('ALTER TABLE users DROP COLUMN IF EXISTS role');
	}

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

	await client.query(`
		INSERT INTO role_permissions (roleId, appId, seviye)
		VALUES ('rol_uye', 'mail', 'kullan'), ('rol_yonetim_kurulu', 'mail', 'yonet'), ('rol_mezun', 'mail', 'kullan')
		ON CONFLICT (roleId, appId) DO NOTHING
	`);

	// Governance is readable by every role; only the management board can edit.
	await client.query(`
		INSERT INTO role_permissions (roleId, appId, seviye)
		SELECT id, 'decisions',
		       CASE WHEN id = 'rol_yonetim_kurulu' THEN 'yonet' ELSE 'kullan' END
		FROM roles
		ON CONFLICT (roleId, appId) DO NOTHING
	`);

	// Heal any admin account that was marked 'mezun' back to 'aktif', and ensure
	// non-admin 'mezun' members hold the Mezun role.
	await client.query(`UPDATE users SET status = 'aktif' WHERE role_id = $1 AND status = 'mezun'`, [ADMIN_ROLE_ID]);
	await client.query(`UPDATE users SET role_id = $1 WHERE status = 'mezun' AND (role_id IS NULL OR role_id <> $1)`, [alumniRoleId]);
}

async function convertLegacyRoles(client: PoolClient) {
	// If legacy column 'role' exists on users
	try {
		const legacy = await client.query(`SELECT role, COUNT(*)::int AS n FROM users WHERE role_id IS NULL GROUP BY role`);
		const has = new Set(legacy.rows.filter((r) => Number(r.n) > 0).map((r) => String(r.role)));
		const now = Date.now();
		if (has.has('lead')) await client.query(`UPDATE users SET role_id = $1 WHERE role = 'lead' AND role_id IS NULL`, [ADMIN_ROLE_ID]);
		if (has.has('yonetim')) {
			const id = MANAGEMENT_ROLE_ID;
			await insertRole(client, id, 'Management Board', '#ff9f0a', 'Converted from the legacy "board" role: manages all applications.', true, now, ALL_PERMISSIONS);
			await client.query(`UPDATE users SET role_id = $1 WHERE role = 'yonetim' AND role_id IS NULL`, [id]);
		}
		if (has.has('uye')) {
			const id = MEMBER_ROLE_ID;
			const izinler: Permissions = Object.fromEntries(
				PERMISSION_APPS.filter((a) => a !== 'budget' && a !== 'terminal' && a !== 'database').map((a) => [a, 'kullan'])
			) as Permissions;
			await insertRole(client, id, 'Member', '#0a84ff', 'Converted from the legacy "member" role.', false, now, izinler);
			await client.query(`UPDATE users SET role_id = $1 WHERE role = 'uye' AND role_id IS NULL`, [id]);
			await client.query(
				`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
				[DEFAULT_ROLE_KEY, id, now]
			);
		}
		await client.query(`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, '1', $2) ON CONFLICT (key) DO NOTHING`, [DONUSUM_ANAHTARI, now]);
	} catch {
		// Ignore if column role does not exist on fresh install
	}
}

async function insertRole(client: PoolClient, id: string, ad: string, renk: string, aciklama: string, ikiAdim: boolean, now: number, izinler: Permissions) {
	await client.query(
		`INSERT INTO roles (id, ad, renk, aciklama, sistem, ikiAdimZorunlu, olusturma) VALUES ($1, $2, $3, $4, 0, $5, $6) ON CONFLICT (id) DO NOTHING`,
		[id, ad, renk, aciklama, ikiAdim ? 1 : 0, now]
	);
	await writeIzinler(client, id, izinler);
}

async function writeIzinler(client: PoolClient, roleId: string, izinler: Permissions) {
	await client.query('DELETE FROM role_permissions WHERE roleId = $1', [roleId]);
	for (const [appId, seviye] of Object.entries(izinler)) {
		if (seviye && seviye !== 'yok') {
			await client.query('INSERT INTO role_permissions (roleId, appId, seviye) VALUES ($1, $2, $3)', [roleId, appId, seviye]);
		}
	}
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
registerEventHandler('role-onbellegi', (olay) => {
	if (olay.k === 'permission' || olay.k === 'yenile' || olay.k === 'refresh') {
		dropCache();
		invalidateCache('roller_raw');
	}
});

export async function getRolePermission(roleId: string | null | undefined): Promise<Permission> {
	if (!roleId) return { role: null, izinler: {}, admin: false, ikiAdimZorunlu: false };
	const hit = cache.get(roleId);
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.permission;
	try {
		void startListener();
		await ensurePostgresInit();
		const [r, p] = await Promise.all([
			getPgPool().query('SELECT id, ad, renk, sistem, ikiAdimZorunlu AS "ikiAdimZorunlu" FROM roles WHERE id = $1', [roleId]),
			getPgPool().query('SELECT appId AS "appId", seviye FROM role_permissions WHERE roleId = $1', [roleId]),
		]);
		const row = r.rows[0];
		if (!row) return { role: null, izinler: {}, admin: false, ikiAdimZorunlu: false };
		const admin = roleId === ADMIN_ROLE_ID;
		const izinler: Permissions = admin
			? { ...ALL_PERMISSIONS }
			: Object.fromEntries(p.rows.map((x) => [(x.appId ?? x.appid) as string, x.seviye as Seviye]));
		const permission: Permission = {
			role: { id: row.id, ad: row.ad, renk: row.renk },
			izinler,
			admin,
			ikiAdimZorunlu: admin || Number(row.ikiAdimZorunlu ?? row.ikiadimzorunlu ?? 0) === 1,
		};
		cache.set(roleId, { at: Date.now(), permission });
		return permission;
	} catch (error) {
		console.error('getRolePermission error:', error);
		if (roleId === ADMIN_ROLE_ID) {
			return {
				role: { id: ADMIN_ROLE_ID, ad: 'Admin', renk: '#ff453a' },
				izinler: { ...ALL_PERMISSIONS },
				admin: true,
				ikiAdimZorunlu: true,
			};
		}
		return { role: null, izinler: {}, admin: false, ikiAdimZorunlu: false };
	}
}

export async function getRoles(): Promise<Role[]> {
	try {
		await ensurePostgresInit();
		const [roles, perms, counts] = await Promise.all([
			getPgPool().query('SELECT id, ad, renk, aciklama, sistem, ikiAdimZorunlu AS "ikiAdimZorunlu", olusturma FROM roles ORDER BY sistem DESC, olusturma ASC'),
			getPgPool().query('SELECT roleId AS "roleId", appId AS "appId", seviye FROM role_permissions'),
			getPgPool().query(`SELECT role_id AS "roleId", COUNT(*)::int AS n FROM users WHERE role_id IS NOT NULL AND status <> 'reddedildi' GROUP BY role_id`),
		]);
		const byRole = new Map<string, Permissions>();
		for (const p of perms.rows) {
			const rid = (p.roleId ?? p.roleid) as string;
			const aid = (p.appId ?? p.appid) as string;
			const m = byRole.get(rid) ?? {};
			(m as Record<string, Seviye>)[aid] = p.seviye as Seviye;
			byRole.set(rid, m);
		}
		const n = new Map(counts.rows.map((c) => [(c.roleId ?? c.roleid) as string, Number(c.n)]));
		return roles.rows.map((r) => ({
			id: r.id,
			ad: r.ad,
			renk: r.renk,
			aciklama: r.aciklama ?? '',
			sistem: Number(r.sistem) === 1,
			ikiAdimZorunlu: Number(r.ikiAdimZorunlu ?? r.ikiadimzorunlu ?? 0) === 1,
			izinler: r.id === ADMIN_ROLE_ID ? { ...ALL_PERMISSIONS } : (byRole.get(r.id) ?? {}),
			kullaniciSayisi: n.get(r.id) ?? 0,
		}));
	} catch (error) {
		console.error('getRoles error:', error);
		return [];
	}
}

export type RoleResult = { ok: true; id: string; error?: undefined } | { ok: false; error: 'yok' | 'sistem' | 'ad-var'; id?: undefined };

/** A role as the audit log records it, read inside the operation's transaction. */
async function readRoleSummary(client: PoolClient, id: string): Promise<RoleSummary | null> {
	const r = await client.query('SELECT ad, renk, aciklama, ikiAdimZorunlu AS "ikiAdimZorunlu" FROM roles WHERE id = $1', [id]);
	if (!r.rows[0]) return null;
	const p = await client.query('SELECT appId AS "appId", seviye FROM role_permissions WHERE roleId = $1', [id]);
	return roleSummary({
		ad: r.rows[0].ad,
		renk: r.rows[0].renk,
		aciklama: r.rows[0].aciklama,
		ikiAdimZorunlu: Number(r.rows[0].ikiAdimZorunlu ?? r.rows[0].ikiadimzorunlu ?? 0) === 1,
		izinler: Object.fromEntries(p.rows.map((x) => [(x.appId ?? x.appid) as string, x.seviye as string])),
	});
}

async function roleName(client: PoolClient, id: string | null): Promise<string | null> {
	if (!id) return null;
	const r = await client.query('SELECT ad FROM roles WHERE id = $1', [id]);
	return r.rows[0]?.ad ?? null;
}

// Every change below writes its audit record (src/db/audit.ts) on the same
// transaction client: the record exists exactly when the change was committed.

export async function createRole(r: { ad: string; renk: string; aciklama: string; izinler: Permissions; ikiAdimZorunlu: boolean }, ctx: AuditContext): Promise<RoleResult> {
	const id = `rol_${randomBytes(6).toString('hex')}`;
	try {
		await withTransaction(async (client) => {
			await insertRole(client, id, r.ad, r.renk, r.aciklama, r.ikiAdimZorunlu, Date.now(), r.izinler);
			await logAuditEvent(client, ctx, { islem: 'rol.olustur', hedefTur: 'rol', hedefId: id, hedefAd: r.ad, onceki: null, sonraki: await readRoleSummary(client, id) });
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return { ok: false, error: 'ad-var' };
		throw err;
	}
	dropCache();
	return { ok: true, id };
}

export async function updateRole(id: string, r: { ad: string; renk: string; aciklama: string; izinler: Permissions; ikiAdimZorunlu: boolean }, ctx: AuditContext): Promise<RoleResult> {
	try {
		const out = await withTransaction(async (client): Promise<RoleResult> => {
			const found = await client.query('SELECT sistem FROM roles WHERE id = $1 FOR UPDATE', [id]);
			if (!found.rows[0]) return { ok: false, error: 'yok' };
			if (Number(found.rows[0].sistem) === 1) return { ok: false, error: 'sistem' };
			const previous = await readRoleSummary(client, id);
			await client.query('UPDATE roles SET ad = $2, renk = $3, aciklama = $4, ikiAdimZorunlu = $5 WHERE id = $1', [id, r.ad, r.renk, r.aciklama, r.ikiAdimZorunlu ? 1 : 0]);
			await writeIzinler(client, id, r.izinler);
			const sonraki = await readRoleSummary(client, id);
			// Saving without a change leaves nothing to record.
			const fark = previous && sonraki ? roleDiff(previous, sonraki) : null;
			if (fark) {
				await logAuditEvent(client, ctx, { islem: 'rol.duzenle', hedefTur: 'rol', hedefId: id, hedefAd: sonraki?.ad ?? r.ad, onceki: fark.onceki, sonraki: fark.sonraki });
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
		const found = await client.query('SELECT sistem FROM roles WHERE id = $1 FOR UPDATE', [id]);
		if (!found.rows[0]) return { ok: false, error: 'yok' };
		if (Number(found.rows[0].sistem) === 1 || id === ALUMNI_ROLE_ID) return { ok: false, error: 'sistem' };
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
			islem: 'rol.sil',
			hedefTur: 'rol',
			hedefId: id,
			hedefAd: previous?.ad ?? '',
			onceki: previous,
			sonraki: { tasinanUyeSayisi: moved.rowCount ?? 0, tasinanRolId: tasi, tasinanRolAd: tasiAd, varsayilanRolKaldirildi: varsayilandi },
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
		await client.query("SELECT pg_advisory_xact_lock(hashtext('roller.admin'))");
		const u = await client.query('SELECT first_name AS ad, last_name AS soyad, email, role_id AS "roleId", status FROM users WHERE id = $1 FOR UPDATE', [userId]);
		if (!u.rows[0]) return 'yok';
		let targetRole: { id: string; ad: string } | null = null;
		if (roleId) {
			const r = await client.query('SELECT id, ad FROM roles WHERE id = $1', [roleId]);
			if (!r.rowCount) return 'role-yok';
			targetRole = { id: String(r.rows[0].id), ad: String(r.rows[0].ad) };
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
				islem: roleId ? 'uye.rol_ata' : 'uye.rol_kaldir',
				hedefTur: 'uye',
				hedefId: userId,
				hedefAd: memberTargetName(u.rows[0]),
				onceki: {
					roleId: previous,
					rolId: previous,
					rolAd: await roleName(client, previous),
					...(newStatus !== previousStatus ? { status: previousStatus, durum: previousStatus } : {}),
				},
				sonraki: {
					roleId,
					rolId: roleId,
					rolAd: await roleName(client, roleId),
					...(newStatus !== previousStatus ? { status: newStatus, durum: newStatus } : {}),
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
				`SELECT id FROM roles WHERE id = $1 OR lower(ad) IN ('mezun', 'alumni') ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1`,
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
				 SELECT id FROM roles WHERE id = $2 OR lower(ad) = 'üye'
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
			{ durum: row.status, rolId: oldRole, rolAd: currentRoleName },
			{ durum: status, rolId: roleId, rolAd: await roleName(client, roleId) }
		);
		if (fark) await logAuditEvent(client, ctx, { islem: action, hedefTur: 'uye', hedefId: userId, hedefAd: memberTargetName(row), onceki: fark.onceki, sonraki: fark.sonraki });
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
			const r = await client.query('SELECT id, ad, sistem FROM roles WHERE id = $1', [roleId]);
			if (!r.rows[0]) return 'yok';
			// New members never become admins or graduates by default.
			if (Number(r.rows[0].sistem) === 1 || isAlumniRole(r.rows[0])) return 'sistem';
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
				islem: 'rol.varsayilan',
				hedefTur: 'ayar',
				hedefId: DEFAULT_ROLE_KEY,
				hedefAd: 'Varsayılan role',
				onceki: { roleId: previous, rolId: previous, rolAd: await roleName(client, previous) },
				sonraki: { roleId, rolId: roleId, rolAd: await roleName(client, roleId) },
			});
		}
		return 'ok';
	});
}

/** Members holding any of these roles — for "notify everyone who manages X". */
export async function getRoleIdsWith(appId: string, seviye: Seviye): Promise<string[]> {
	try {
		await ensurePostgresInit();
		const levels = seviye === 'yonet' ? ['yonet'] : ['kullan', 'yonet'];
		const r = await getPgPool().query('SELECT DISTINCT roleId AS "roleId" FROM role_permissions WHERE appId = $1 AND seviye = ANY($2)', [appId, levels]);
		return [ADMIN_ROLE_ID, ...r.rows.map((x) => (x.roleId ?? x.roleid) as string)];
	} catch (error) {
		console.error('getRoleIdsWith error:', error);
		return [ADMIN_ROLE_ID];
	}
}
