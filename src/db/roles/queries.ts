import type { PoolClient, QueryResultRow } from 'pg';
import { getPgPool, ensurePostgresInit, getSystemSetting } from '../index';
import { startListener, registerEventHandler } from '../events';
import { invalidateCache } from '@/server/cache';
import { roleSummary, type RoleSummary } from '@/lib/audit';
import {
	ADMIN_ROLE_ID,
	ALL_PERMISSIONS,
	type Permissions,
	type Level,
} from '@/core/permissions';
import {
	DEFAULT_ROLE_KEY,
	canonicalRoleId,
	normalizeDesktopAuthPolicy,
	parsePermissionsJson,
	type DesktopAuthPolicy,
	type Permission,
	type Role,
} from './types';

export type RoleSummaryWithPolicy = RoleSummary & {
	allowMobileAccess: boolean;
	allowDesktopAccess: boolean;
	desktopAuthPolicy: DesktopAuthPolicy;
};

type QueryPool = { query(text: string, values?: unknown[]): Promise<{ rows: QueryResultRow[] }> };

const CACHE_TTL_MS = 5000;
const g = globalThis as typeof globalThis & {
	__beuRoleCache?: Map<string, { at: number; permission: Permission }>;
	__beuRoleInFlight?: Map<string, Promise<Permission>>;
};
const cache = (g.__beuRoleCache ??= new Map());
const roleInFlight = () => (g.__beuRoleInFlight ??= new Map());
export const dropRoleCache = () => {
	cache.clear();
	roleInFlight().clear();
	invalidateCache('roles_raw');
};
export const invalidateRoleCache = dropRoleCache;

registerEventHandler('role-cache', (event) => {
	if (event.k === 'permission' || event.k === 'settings_updated' || event.k === 'refresh') {
		dropRoleCache();
	}
});

export async function readRoleSummary(client: PoolClient, id: string): Promise<RoleSummaryWithPolicy | null> {
	const r = await client.query(
		'SELECT name, color, description, permissions, require_2fa AS "require2fa", ' +
			'allow_mobile_access AS "allowMobileAccess", allow_desktop_access AS "allowDesktopAccess", ' +
			'desktop_auth_policy AS "desktopAuthPolicy" FROM roles WHERE id = $1',
		[id]
	);
	if (!r.rows[0]) return null;
	const row = r.rows[0];
	const perms = parsePermissionsJson(row.permissions);
	return {
		...roleSummary({
			name: String(row.name ?? ''),
			color: String(row.color ?? ''),
			description: String(row.description ?? ''),
			twoStepRequired: Number(row.require2fa ?? row.require_2fa ?? 0) === 1,
			permissions: perms as Record<string, string>,
		}),
		allowMobileAccess: Boolean(row.allowMobileAccess ?? row.allow_mobile_access ?? true),
		allowDesktopAccess: Boolean(row.allowDesktopAccess ?? row.allow_desktop_access ?? true),
		desktopAuthPolicy: normalizeDesktopAuthPolicy(row.desktopAuthPolicy ?? row.desktop_auth_policy),
	};
}

export async function roleName(client: PoolClient, id: string | null): Promise<string | null> {
	if (!id) return null;
	const r = await client.query('SELECT name FROM roles WHERE id = $1', [id]);
	return r.rows[0]?.name ? String(r.rows[0].name) : null;
}

export async function getRolePermission(
	rawRoleId: string | null | undefined,
	pool?: QueryPool
): Promise<Permission> {
	const roleId = rawRoleId ? canonicalRoleId(rawRoleId) : null;
	if (!roleId) return { role: null, permissions: {}, admin: false, require2fa: false, twoStepRequired: false };
	const inFlight = roleInFlight();
	if (!pool) {
		const hit = cache.get(roleId);
		if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.permission;
		const existing = inFlight.get(roleId);
		if (existing) return existing;
	}
	const ref: { promise?: Promise<Permission> } = {};
	const run = (async (): Promise<Permission> => {
		try {
			if (!pool) {
				void startListener();
				await ensurePostgresInit();
			}
			const r = await (pool ?? getPgPool()).query(
				'SELECT id, name, color, permissions, is_system AS "isSystem", require_2fa AS "require2fa" FROM roles WHERE id = $1',
				[roleId]
			);
			const row = r.rows[0];
			if (!row) return { role: null, permissions: {}, admin: false, require2fa: false, twoStepRequired: false };
			const admin =
				roleId === ADMIN_ROLE_ID ||
				roleId === 'role_admin' ||
				Number(row.isSystem ?? row.is_system ?? 0) === 1;
			const perms: Permissions = admin ? { ...ALL_PERMISSIONS } : parsePermissionsJson(row.permissions);
			const req2fa = admin || Number(row.require2fa ?? row.require_2fa ?? 0) === 1;
			const permission: Permission = {
				role: { id: String(row.id), name: String(row.name), color: String(row.color) },
				permissions: perms,
				admin,
				require2fa: req2fa,
				twoStepRequired: req2fa,
			};
			if (!pool && inFlight.get(roleId) === ref.promise) {
				cache.set(roleId, { at: Date.now(), permission });
			}
			return permission;
		} catch (error) {
			console.error('getRolePermission error:', error);
			if (roleId === ADMIN_ROLE_ID || roleId === 'role_admin') {
				return {
					role: { id: ADMIN_ROLE_ID, name: 'Admin', color: '#ff453a' },
					permissions: { ...ALL_PERMISSIONS },
					admin: true,
					require2fa: true,
					twoStepRequired: true,
				};
			}
			return { role: null, permissions: {}, admin: false, require2fa: false, twoStepRequired: false };
		}
	})();
	if (pool) return run;
	ref.promise = run.finally(() => {
		if (inFlight.get(roleId) === ref.promise) inFlight.delete(roleId);
	});
	inFlight.set(roleId, ref.promise);
	return ref.promise;
}

export async function getRoles(): Promise<Role[]> {
	try {
		void startListener();
		await ensurePostgresInit();
		const [roles, counts] = await Promise.all([
			getPgPool().query(
				'SELECT id, name, color, description, permissions, ' +
					'is_system AS "isSystem", require_2fa AS "require2fa", ' +
					'allow_mobile_access AS "allowMobileAccess", allow_desktop_access AS "allowDesktopAccess", ' +
					'desktop_auth_policy AS "desktopAuthPolicy", created_at AS "createdAt" ' +
					'FROM roles ORDER BY is_system DESC, created_at ASC'
			),
			getPgPool().query(
				`SELECT role_id AS "roleId", COUNT(*)::int AS n FROM users WHERE role_id IS NOT NULL AND status <> 'rejected' GROUP BY role_id`
			),
		]);
		const n = new Map(counts.rows.map((c) => [(c.roleId ?? c.roleid) as string, Number(c.n)]));
		return roles.rows.map((r) => {
			const isSystem = Number(r.isSystem ?? r.is_system ?? 0) === 1;
			const require2fa = Number(r.require2fa ?? r.require_2fa ?? 0) === 1;
			const createdAt = Number(r.createdAt ?? r.created_at ?? 0);
			const perms =
				r.id === ADMIN_ROLE_ID || isSystem ? { ...ALL_PERMISSIONS } : parsePermissionsJson(r.permissions);
			const userCount = n.get(String(r.id)) ?? 0;
			return {
				id: String(r.id),
				name: String(r.name ?? ''),
				color: String(r.color ?? '#0a84ff'),
				description: String(r.description ?? ''),
				system: isSystem,
				isSystem,
				twoStepRequired: require2fa,
				require2fa,
				allowMobileAccess: Boolean(r.allowMobileAccess ?? r.allow_mobile_access ?? true),
				allowDesktopAccess: Boolean(r.allowDesktopAccess ?? r.allow_desktop_access ?? true),
				desktopAuthPolicy: normalizeDesktopAuthPolicy(r.desktopAuthPolicy ?? r.desktop_auth_policy),
				permissions: perms,
				userCount,
				creation: createdAt,
				createdAt,
			};
		});
	} catch (error) {
		console.error('getRoles error:', error);
		return [];
	}
}

export async function countActiveAdmins(): Promise<number> {
	await ensurePostgresInit();
	const r = await getPgPool().query(
		`SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1 AND status = 'active'`,
		[ADMIN_ROLE_ID]
	);
	return Number(r.rows[0]?.n ?? 0);
}

export async function getDefaultRoleId(): Promise<string | null> {
	const v = await getSystemSetting(DEFAULT_ROLE_KEY, '');
	return v || null;
}

export async function getRoleIdsWith(appId: string, level: Level): Promise<string[]> {
	try {
		void startListener();
		await ensurePostgresInit();
		const isManage = level === 'manage' || (level as string) === 'manage';
		const levels = isManage ? ['manage'] : ['use', 'manage'];
		const r = await getPgPool().query('SELECT id FROM roles WHERE (permissions ->> $1) = ANY($2)', [
			appId,
			levels,
		]);
		return Array.from(new Set([ADMIN_ROLE_ID, ...r.rows.map((x) => String(x.id))]));
	} catch (error) {
		console.error('getRoleIdsWith error:', error);
		return [ADMIN_ROLE_ID];
	}
}
