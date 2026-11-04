/**
 * The permission model — one module shared by the server (API guards,
 * notifications, search), the client (dock, launcher, menus) and the checks in
 * scripts/check-pure.mjs. Pure: it only reads the app manifests, which are data.
 *
 * A role grants each mini app one of three levels:
 *   yok    — the app does not exist for the user: not in the dock, not in
 *            search, no notifications from it, its API refuses.
 *   kullan — use it as a member (read, take part, borrow, register…).
 *   yonet  — manage it (create, approve, edit others' records…).
 * The built-in admin role manages everything and cannot be changed.
 */
import { ALL_MANIFESTS, type PermissionApp } from '../../apps/index.ts';

export const LEVELS = ['none', 'use', 'manage'] as const;
export const SEVIYELER = LEVELS;
export type PermissionLevel = (typeof LEVELS)[number];
export type Level = PermissionLevel;
export const ORDER: Record<PermissionLevel, number> = { none: 0, use: 1, manage: 2 };

/**
 * Every app a role can be granted, in the order the role editor lists them —
 * derived from the app manifests (src/apps/<id>/manifest.ts), so a new app
 * shows up in the role editor by existing.
 */
export const PERMISSION_APPS: readonly PermissionApp[] = ALL_MANIFESTS.filter(
	(m) => !('internal' in m && m.internal)
).map((m) => m.id as PermissionApp);
export type { PermissionApp };

/** App id → level. Missing apps are 'none'. */
export type Permissions = Partial<Record<PermissionApp, PermissionLevel>>;

export const ADMIN_ROLE_ID = 'role_admin';
export const MANAGEMENT_ROLE_ID = 'role_management_board';
export const MEMBER_ROLE_ID = 'role_member';
export const ALUMNI_ROLE_ID = 'role_alumni';

/** True when a role represents the community's Alumni role. */
export function isAlumniRole(
	role: { id?: string | null; name?: string | null;} | string | null | undefined
): boolean {
	if (!role) return false;
	if (typeof role === 'string') {
		const norm = role.trim().toLowerCase();
		return norm === ALUMNI_ROLE_ID || norm === 'rol_mezun' || norm === 'mezun' || norm === 'alumni';
	}
	if (role.id === ALUMNI_ROLE_ID || role.id === 'rol_mezun') return true;
	const name = (role.name ?? role.name)?.trim().toLowerCase();
	return name === 'mezun' || name === 'alumni';
}

/**
 * Apps everyone has regardless of role. Settings is everyone's (password, 2FA,
 * theme…); its "manage" level adds the system pages — roles, the e-mail account,
 * club details.
 */
export const ALWAYS_OPEN: readonly PermissionApp[] = ALL_MANIFESTS.filter((m) => m.permission.everyoneOpen).map((m) => m.id as PermissionApp);
export const EVERY_TIME_OPEN = ALWAYS_OPEN;

/** What each level means in each app — shown in the role editor next to the switch. */
export const PERMISSION_DESCRIPTIONS = Object.fromEntries(
	ALL_MANIFESTS.map((m) => [m.id, { name: m.permission.name, kullan: m.permission.kullan, yonet: m.permission.yonet, ...('uyari' in m.permission ? { warning: m.permission.warning } : {}) }])
) as Record<PermissionApp, { name: string; kullan: string; yonet: string; warning?: string }>;

export const isPermissionLevel = (v: unknown): v is PermissionLevel => typeof v === 'string' && (LEVELS as readonly string[]).includes(v);
export const isLevel = isPermissionLevel;
export const isPermissionApp = (v: unknown): v is PermissionApp => typeof v === 'string' && (PERMISSION_APPS as readonly string[]).includes(v);

/** Normalizes legacy permission level values if encountered. */
export function canonicalLevel(v: unknown): PermissionLevel {
	if (v === 'use' || v === 'kullan') return 'use';
	if (v === 'manage' || v === 'yonet') return 'manage';
	return 'none';
}

/** The level a set of permissions grants in an app. Apps everyone has are at least 'use'. */
export function levelOf(permissions: Permissions | null | undefined, appId: string): PermissionLevel {
	const raw = isPermissionApp(appId) ? permissions?.[appId] : 'none';
	const s = canonicalLevel(raw);
	if (s === 'none' && (ALWAYS_OPEN as readonly string[]).includes(appId)) return 'use';
	return s;
}

export const isSufficientLevel = (held: PermissionLevel, required: PermissionLevel) => ORDER[canonicalLevel(held)] >= ORDER[canonicalLevel(required)];
export const sufficientMi = isSufficientLevel;
export const canUse = (permissions: Permissions | null | undefined, appId: string) => isSufficientLevel(levelOf(permissions, appId), 'use');
export const canManage = (permissions: Permissions | null | undefined, appId: string) => isSufficientLevel(levelOf(permissions, appId), 'manage');

/** The admin role's permissions: everything, managed. */
export const ALL_PERMISSIONS: Permissions = Object.fromEntries(PERMISSION_APPS.map((a) => [a, 'manage'])) as Permissions;

/** Reads a permission map from a request body; unknown apps and values are an error, not silently dropped. */
export function normalizePermissions(input: unknown): { value: Permissions; error?: undefined } | { error: string; value?: undefined } {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Permissions must be an object.' };
	const out: Permissions = {};
	for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
		if (!isPermissionApp(k)) return { error: `Unknown app: ${k}` };
		const norm = canonicalLevel(v);
		if (!isPermissionLevel(v) && v !== 'yok' && v !== 'kullan' && v !== 'yonet') {
			return { error: `Invalid permission level (${k}): ${String(v)}` };
		}
		if (norm !== 'none') out[k] = norm;
	}
	return { value: out };
}

/**
 * Apps where `requested` grants more than `held` — used to stop privilege
 * escalation: nobody may create, edit or assign a role stronger than their own.
 */
export function extraPermissions(requested: Permissions, held: Permissions): PermissionApp[] {
	return PERMISSION_APPS.filter((a) => ORDER[levelOf(requested, a)] > ORDER[levelOf(held, a)]);
}

/**
 * Whether a member holding `held` may give out, edit or delete role `role`:
 * never one stronger than their own, and the admin role only as an admin.
 */
export function canAssignRole(role: { id: string; permissions?: Permissions;}, held: { admin: boolean; permissions?: Permissions;}): boolean {
	const rolePerms = role.permissions ?? role.permissions ?? {};
	const heldPerms = held.permissions ?? held.permissions ?? {};
	if (role.id === ADMIN_ROLE_ID || role.id === 'rol_admin') return held.admin;
	return extraPermissions(rolePerms, heldPerms).length === 0;
}

/** True when the permissions manage anything that matters (notes are personal) — such roles default to required 2FA. */
export const hasManagementPermission = (permissions: Permissions) => PERMISSION_APPS.some((a) => a !== 'notes' && levelOf(permissions, a) === 'manage');

/** Colour swatches offered in the role editor (any #rrggbb is accepted). */
export const ROLE_COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#5e5ce6', '#64d2ff', '#ff375f', '#ac8e68', '#8e8e93'] as const;

/** Validates a role's name, colour and description. */
export function roleProblem(r: { name?: unknown; color?: unknown; description?: unknown }): string | null {
	const name = typeof r.name === 'string' ? r.name.trim() : '';
	if (name.length < 2 || name.length > 40) return 'Role adı 2-40 karakter olmalıdır.';
	if (typeof r.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(r.color)) return 'Renk #rrggbb biçiminde olmalıdır.';
	if (r.description !== undefined && (typeof r.description !== 'string' || r.description.length > 200)) return 'Açıklama en fazla 200 karakter olabilir.';
	return null;
}
