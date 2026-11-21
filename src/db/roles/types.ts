import {
	ADMIN_ROLE_ID,
	ALUMNI_ROLE_ID,
	MEMBER_ROLE_ID,
	MANAGEMENT_ROLE_ID,
	type Permissions,
} from '@/core/permissions';

export type DesktopAuthPolicy = 'standard' | 'mobile_preferred' | 'mobile_required';

export function normalizeDesktopAuthPolicy(raw: unknown): DesktopAuthPolicy {
	if (raw === 'mobile_required' || raw === 'mobile_preferred') return raw;
	return 'standard';
}

export interface Role {
	id: string;
	name: string;
	color: string;
	description: string;
	system: boolean;
	isSystem?: boolean;
	twoStepRequired: boolean;
	require2fa?: boolean;
	allowMobileAccess?: boolean;
	allowDesktopAccess?: boolean;
	desktopAuthPolicy?: DesktopAuthPolicy;
	permissions: Permissions;
	userCount: number;
	creation?: number;
	createdAt?: number;
}

/** The member's role and permissions, as the session and every guard see them. */
export interface Permission {
	role: { id: string; name: string; color: string } | null;
	permissions: Permissions;
	admin: boolean;
	require2fa: boolean;
	twoStepRequired: boolean;
}

export type RoleResult =
	| { ok: true; id: string; error?: undefined }
	| { ok: false; error: 'none' | 'system' | 'name_taken'; id?: undefined };

export const DEFAULT_ROLE_KEY = 'default_role';

export const DEFAULT_MANAGEMENT_PERMISSIONS: Permissions = {
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

export const DEFAULT_MEMBER_PERMISSIONS: Permissions = {
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

export const DEFAULT_ALUMNI_PERMISSIONS: Permissions = {
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

export function cleanPermissions(permissions: Permissions): Permissions {
	const out: Record<string, 'use' | 'manage'> = {};
	for (const [appId, lvl] of Object.entries(permissions || {})) {
		const s = String(lvl);
		if (s === 'manage') {
			out[appId] = 'manage';
		} else if (s === 'use') {
			out[appId] = 'use';
		}
	}
	return out as Permissions;
}

export function parsePermissionsJson(raw: unknown): Permissions {
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

export function canonicalRoleId(id: string): string {
	if (id === 'role_admin') return ADMIN_ROLE_ID;
	if (id === 'role_management_board') return MANAGEMENT_ROLE_ID;
	if (id === 'role_member') return MEMBER_ROLE_ID;
	if (id === 'role_alumni') return ALUMNI_ROLE_ID;
	return id;
}
