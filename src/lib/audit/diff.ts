import type { AuditAction, AuditFields, AuditValue } from './constants.ts';
import { type RoleSummary, sanitizeValue } from './sanitize.ts';

/** One changed field, flattened for display (permissions as `permissions.<app>`). */
export interface DiffRow {
	field: string;
	before: string | number | boolean | null;
	after: string | number | boolean | null;
}

const flattenValue = (v: AuditValue | undefined): string | number | boolean | null =>
	v === undefined || v === null ? null : typeof v === 'object' ? JSON.stringify(v) : v;

/** A record's before/after as one row per changed field — what the detail view lists. */
export function diffRows(before: AuditFields | null, after: AuditFields | null): DiffRow[] {
	const rows: DiffRow[] = [];
	const o = before ?? {};
	const n = after ?? {};
	for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
		const a = o[k];
		const b = n[k];
		const nested = (v: AuditValue | undefined): v is AuditFields =>
			!!v && typeof v === 'object' && !Array.isArray(v);
		if (nested(a) || nested(b)) {
			const oa = nested(a) ? a : {};
			const nb = nested(b) ? b : {};
			for (const kk of new Set([...Object.keys(oa), ...Object.keys(nb)])) {
				rows.push({ field: `${k}.${kk}`, before: flattenValue(oa[kk]), after: flattenValue(nb[kk]) });
			}
		} else {
			rows.push({ field: k, before: flattenValue(a), after: flattenValue(b) });
		}
	}
	return rows;
}

export interface DiffResult {
	before: AuditFields;
	after: AuditFields;
}
export type Diff = DiffResult;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the fields that differ, before and after; `null` when nothing changed. */
export function fieldDiff(before: Record<string, unknown>, after: Record<string, unknown>): DiffResult | null {
	const o: AuditFields = {};
	const n: AuditFields = {};
	for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (same(before[k], after[k])) continue;
		o[k] = sanitizeValue(before[k] ?? null) ?? null;
		n[k] = sanitizeValue(after[k] ?? null) ?? null;
	}
	return Object.keys(n).length ? { before: o, after: n } : null;
}

/**
 * A role edit as a diff: changed fields, and of the permission matrix only the
 * apps whose level changed ('none' when absent on one side).
 */
export function roleDiff(before: RoleSummary, after: RoleSummary): DiffResult | null {
	const o: AuditFields = {};
	const n: AuditFields = {};
	for (const k of ['name', 'color', 'description', 'twoStepRequired'] as const) {
		if (before[k] !== after[k]) {
			o[k] = before[k];
			n[k] = after[k];
		}
	}
	const oi: Record<string, string> = {};
	const ni: Record<string, string> = {};
	for (const app of new Set([...Object.keys(before.permissions), ...Object.keys(after.permissions)])) {
		const a = before.permissions[app] ?? 'none';
		const b = after.permissions[app] ?? 'none';
		if (a !== b) {
			oi[app] = a;
			ni[app] = b;
		}
	}
	if (Object.keys(ni).length) {
		o.permissions = oi;
		n.permissions = ni;
	}
	return Object.keys(n).length ? { before: o, after: n } : null;
}

/** The key that holds the (encrypted) app password, only ever reported as changed, never its value. */
export const SMTP_PASSWORD_KEY = 'smtp_pass';
export const SMTP_FIELDS = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_from'] as const;

/**
 * The e-mail account settings (SMTP) as a diff. `before` holds the stored values (a
 * missing key reads as its default), `fresh` the keys being written. The
 * password is reported as "changed" / "deleted" and never by value.
 */
export function smtpDiff(
	before: Record<string, string | undefined>,
	fresh: Record<string, string>,
	defaultValue: Record<string, string>
): DiffResult | null {
	const o: AuditFields = {};
	const n: AuditFields = {};
	for (const k of SMTP_FIELDS) {
		if (!(k in fresh)) continue;
		const previous = before[k] ?? defaultValue[k] ?? '';
		if (previous !== fresh[k]) {
			o[k] = previous;
			n[k] = fresh[k];
		}
	}
	if (SMTP_PASSWORD_KEY in fresh) {
		const existed = !!before[SMTP_PASSWORD_KEY];
		if (fresh[SMTP_PASSWORD_KEY] === '') {
			// Clearing a password that was never set is no change.
			if (existed) {
				o.appKey = 'set';
				n.appKey = 'deleted';
			}
		} else {
			o.appKey = existed ? 'set' : 'none';
			n.appKey = 'changed';
		}
	}
	return Object.keys(n).length ? { before: o, after: n } : null;
}

/** Which log entry a membership status change is. */
export function statusAction(before: string, after: string): AuditAction | null {
	if (before === after) return null;
	if (before === 'pending' && after === 'active') return 'application.approve';
	if (before === 'pending' && after === 'rejected') return 'application.reject';
	if (after === 'alumni') return 'member.graduate';
	if (after === 'active') return 'member.activate';
	return 'member.status';
}
