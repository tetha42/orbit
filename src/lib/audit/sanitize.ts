import type { AuditFields, AuditValue } from './constants.ts';

/** Key names that carry credentials — dropped wherever they appear. */
export const FORBIDDEN_KEY =
	/pass|parola|password|\u015fifre|sifre|hash|totp|secret|token|recovery|kurtarma|credential|cookie|oturum|api_?key|auth(?:orization)?|private_?key|bearer|access_?key/i;

const MAX_DEPTH = 4;
const MAX_TEXT = 300;

/** A JSON-safe copy of `value` without credential-looking keys, with bounded depth and text length. */
export function sanitizeValue(value: unknown, depth = 0): AuditValue | undefined {
	if (value === null) return null;
	if (typeof value === 'string') return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'boolean') return value;
	if (depth >= MAX_DEPTH) return undefined;
	if (Array.isArray(value)) return value.map((x) => sanitizeValue(x, depth + 1) ?? null);
	if (typeof value === 'object') {
		const out: { [key: string]: AuditValue } = {};
		for (const [k, v] of Object.entries(value)) {
			if (FORBIDDEN_KEY.test(k)) continue;
			const c = sanitizeValue(v, depth + 1);
			if (c !== undefined) out[k] = c;
		}
		return out;
	}
	return undefined;
}
export const clear = sanitizeValue;

/** `sanitizeValue` for a record; an empty one is stored as nothing. */
export function recordFields(value: Record<string, unknown> | null | undefined): AuditFields | null {
	if (!value) return null;
	const c = sanitizeValue(value);
	return c && typeof c === 'object' && !Array.isArray(c) ? c : null;
}

/** The caller's address as stored: control characters out, bounded length. */
export function sanitizeIp(raw: string | null | undefined): string {
	return String(raw ?? '').replace(/[\u0000-\u001f\u007f\s]+/g, '').slice(0, 64) || 'unknown';
}
export const cleanIp = sanitizeIp;

export type RoleSummary = {
	name: string;
	color: string;
	description: string;
	twoStepRequired: boolean;
	permissions: Record<string, string>;
};

/** A role as the log sees it: only these fields, permissions without the 'none' rows. */
export function roleSummary(r: {
	name: string;
	color: string;
	description?: string | null;
	twoStepRequired: boolean;
	permissions: Record<string, string | undefined>;
}): RoleSummary {
	const permissions: Record<string, string> = {};
	for (const [app, level] of Object.entries(r.permissions).sort(([a], [b]) => a.localeCompare(b))) {
		if (level && level !== 'none') permissions[app] = level;
	}
	return {
		name: r.name,
		color: r.color,
		description: r.description ?? '',
		twoStepRequired: !!r.twoStepRequired,
		permissions,
	};
}

/** The minimum a member record keeps about its subject — enough to tell who it was, nothing else. */
export function memberSummary(u: {
	name: string;
	surname: string;
	email: string;
	status?: string | null;
	roleId?: string | null;
	roleName?: string | null;
}): AuditFields {
	const out: AuditFields = { name: `${u.name} ${u.surname}`.trim(), email: u.email };
	if (u.status !== undefined) out.status = u.status ?? null;
	if (u.roleId !== undefined) out.roleId = u.roleId ?? null;
	if (u.roleName !== undefined) out.roleName = u.roleName ?? null;
	return out;
}

/** How a member is named in a record's target column: name and e-mail (the minimum that identifies them). */
export function memberTargetName(u: {
	name?: string;
	surname?: string;
	firstName?: string;
	lastName?: string;
	email: string;
}): string {
	const first = u.firstName || u.name || '';
	const last = u.lastName || u.surname || '';
	return `${first} ${last}`.trim() + ` (${u.email})`;
}
