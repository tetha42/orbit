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

export const SEVIYELER = ['yok', 'kullan', 'yonet'] as const;
export type Seviye = (typeof SEVIYELER)[number];
const SIRA: Record<Seviye, number> = { yok: 0, kullan: 1, yonet: 2 };

/**
 * Every app a role can be granted, in the order the role editor lists them —
 * derived from the app manifests (src/apps/<id>/manifest.ts), so a new app
 * shows up in the role editor by existing.
 */
export const PERMISSION_APPS: readonly PermissionApp[] = ALL_MANIFESTS.filter(
	(m) => !('internal' in m && m.internal)
).map((m) => m.id as PermissionApp);
export type { PermissionApp };

/** App id → level. Missing apps are 'yok'. */
export type Permissions = Partial<Record<PermissionApp, Seviye>>;

export const ADMIN_ROLE_ID = 'rol_admin';
export const MANAGEMENT_ROLE_ID = 'rol_yonetim_kurulu';
export const MEMBER_ROLE_ID = 'rol_uye';
export const ALUMNI_ROLE_ID = 'rol_mezun';

/** True when a role represents the club's Alumni / Graduate (Mezun) role. */
export function isAlumniRole(
	role: { id?: string | null; ad?: string | null } | string | null | undefined
): boolean {
	if (!role) return false;
	if (typeof role === 'string') {
		const norm = role.trim().toLowerCase();
		return norm === ALUMNI_ROLE_ID || norm === 'mezun' || norm === 'alumni';
	}
	if (role.id === ALUMNI_ROLE_ID) return true;
	const ad = role.ad?.trim().toLowerCase();
	return ad === 'mezun' || ad === 'alumni';
}

/**
 * Apps everyone has regardless of role. Settings is everyone's (password, 2FA,
 * theme…); its "manage" level adds the system pages — roles, the e-mail account,
 * club details.
 */
export const HER_ZAMAN_ACIK: readonly PermissionApp[] = ALL_MANIFESTS.filter((m) => m.permission.herkeseAcik).map((m) => m.id as PermissionApp);

/** What each level means in each app — shown in the role editor next to the switch. */
export const PERMISSION_DESCRIPTIONS = Object.fromEntries(
	ALL_MANIFESTS.map((m) => [m.id, { ad: m.permission.ad, kullan: m.permission.kullan, yonet: m.permission.yonet, ...('uyari' in m.permission ? { uyari: m.permission.uyari } : {}) }])
) as Record<PermissionApp, { ad: string; kullan: string; yonet: string; uyari?: string }>;

export const isSeviye = (v: unknown): v is Seviye => typeof v === 'string' && (SEVIYELER as readonly string[]).includes(v);
export const isPermissionApp = (v: unknown): v is PermissionApp => typeof v === 'string' && (PERMISSION_APPS as readonly string[]).includes(v);

/** The level a set of permissions grants in an app. Apps everyone has are at least 'kullan'. */
export function seviyeOf(izinler: Permissions | null | undefined, appId: string): Seviye {
	const s = isPermissionApp(appId) ? (izinler?.[appId] ?? 'yok') : 'yok';
	if (s === 'yok' && (HER_ZAMAN_ACIK as readonly string[]).includes(appId)) return 'kullan';
	return s;
}

export const yeterliMi = (sahip: Seviye, gereken: Seviye) => SIRA[sahip] >= SIRA[gereken];
export const canUse = (izinler: Permissions | null | undefined, appId: string) => yeterliMi(seviyeOf(izinler, appId), 'kullan');
export const canManage = (izinler: Permissions | null | undefined, appId: string) => yeterliMi(seviyeOf(izinler, appId), 'yonet');

/** The admin role's permissions: everything, managed. */
export const ALL_PERMISSIONS: Permissions = Object.fromEntries(PERMISSION_APPS.map((a) => [a, 'yonet'])) as Permissions;

/** Reads a permission map from a request body; unknown apps and values are an error, not silently dropped. */
export function normalizePermissions(input: unknown): { value: Permissions; error?: undefined } | { error: string; value?: undefined } {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'İzinler bir nesne olmalıdır.' };
	const out: Permissions = {};
	for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
		if (!isPermissionApp(k)) return { error: `Bilinmeyen uygulama: ${k}` };
		if (!isSeviye(v)) return { error: `Geçersiz permission seviyesi (${k}): ${String(v)}` };
		if (v !== 'yok') out[k] = v;
	}
	return { value: out };
}

/**
 * Apps where `istenen` grants more than `sahip` — used to stop privilege
 * escalation: nobody may create, edit or assign a role stronger than their own.
 */
export function extraPermissions(istenen: Permissions, sahip: Permissions): PermissionApp[] {
	return PERMISSION_APPS.filter((a) => SIRA[seviyeOf(istenen, a)] > SIRA[seviyeOf(sahip, a)]);
}

/**
 * Whether a member holding `sahip` may give out, edit or delete role `role`:
 * never one stronger than their own, and the admin role only as an admin.
 */
export function canAssignRole(role: { id: string; izinler: Permissions }, sahip: { admin: boolean; izinler: Permissions }): boolean {
	if (role.id === ADMIN_ROLE_ID) return sahip.admin;
	return extraPermissions(role.izinler, sahip.izinler).length === 0;
}

/** True when the permissions manage anything that matters (notes are personal) — such roles default to required 2FA. */
export const hasManagementPermission = (izinler: Permissions) => PERMISSION_APPS.some((a) => a !== 'notes' && seviyeOf(izinler, a) === 'yonet');

/** Colour swatches offered in the role editor (any #rrggbb is accepted). */
export const ROLE_COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#5e5ce6', '#64d2ff', '#ff375f', '#ac8e68', '#8e8e93'] as const;

/** Validates a role's name, colour and description. */
export function roleProblem(r: { ad?: unknown; renk?: unknown; aciklama?: unknown }): string | null {
	const ad = typeof r.ad === 'string' ? r.ad.trim() : '';
	if (ad.length < 2 || ad.length > 40) return 'Role adı 2-40 karakter olmalıdır.';
	if (typeof r.renk !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(r.renk)) return 'Renk #rrggbb biçiminde olmalıdır.';
	if (r.aciklama !== undefined && (typeof r.aciklama !== 'string' || r.aciklama.length > 200)) return 'Açıklama en fazla 200 karakter olabilir.';
	return null;
}
