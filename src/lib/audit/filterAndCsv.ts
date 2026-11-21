import { AUDIT_ACTIONS, AUDIT_RETENTION_DAYS, type AuditRecord } from './constants.ts';

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_MAX_PAGE_SIZE = 200;
/** One CSV download holds at most this many rows (the `all=1` list). */
export const AUDIT_CSV_LIMIT = 10000;

export interface AuditFilter {
	/** Part of a name or e-mail, or an exact member id — the actor or the person acted on. */
	user: string;
	/** A role id — role changes and role assignments involving it. */
	role: string;
	action: string;
	/** Inclusive day bounds, `YYYY-MM-DD`, in the server's local time. */
	from: string;
	to: string;
	page: number;
	pageSize: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clampInt = (v: string | null, defaultValue: number, min: number, max: number) => {
	const n = Math.floor(Number(v));
	return Number.isFinite(n) && n >= min ? Math.min(n, max) : defaultValue;
};

/** Reads and bounds the list query; unknown or malformed values fall back to "no filter". */
export function parseAuditFilter(q: URLSearchParams): AuditFilter {
	const day = (k: string) => {
		const v = q.get(k) ?? '';
		return DAY.test(v) && !Number.isNaN(new Date(`${v}T00:00:00`).getTime()) ? v : '';
	};
	const rawAction = q.get('action') ?? '';
	return {
		user: (q.get('user') ?? '').trim().slice(0, 80),
		role: (q.get('role') ?? '').trim().slice(0, 80),
		action: (AUDIT_ACTIONS as readonly string[]).includes(rawAction) ? rawAction : '',
		from: day('from'),
		to: day('to'),
		page: clampInt(q.get('page'), 1, 1, 1_000_000),
		pageSize: clampInt(q.get('limit') ?? q.get('pageSize'), AUDIT_PAGE_SIZE, 1, AUDIT_MAX_PAGE_SIZE),
	};
}

/** `YYYY-MM-DD` (local) → the first millisecond of that day. */
export function startOfDay(day: string): number {
	return new Date(`${day}T00:00:00`).getTime();
}

export const AUDIT_CSV_HEADERS = [
	'Timestamp',
	'Actor',
	'Actor ID',
	'Action',
	'Target Type',
	'Target ID',
	'Target',
	'Before',
	'After',
	'IP',
];

/** The log as CSV rows (header in AUDIT_CSV_HEADERS); before/after as compact JSON. */
export function auditCsvRows(records: AuditRecord[]): string[][] {
	return records.map((k) => [
		k.timestamp ? new Date(k.timestamp).toISOString() : '',
		k.actorName ?? '',
		k.actorId ?? '',
		k.action ?? '',
		k.targetType ?? '',
		k.targetId ?? '',
		k.targetName ?? '',
		k.before ? JSON.stringify(k.before) : '',
		k.after ? JSON.stringify(k.after) : '',
		k.ip ?? '',
	]);
}

/** Retention in days from `AUDIT_RETENTION_DAYS` (a positive integer), else the default. */
export function retentionDays(env: string | undefined): number {
	const n = Number(env);
	return Number.isInteger(n) && n >= 30 ? n : AUDIT_RETENTION_DAYS;
}

/** Humanizes and translates audit action operation keys. */
export function formatAuditAction(action: string, t?: (key: string, fallback?: string) => string): string {
	if (!action) return '—';
	const opKey = `auditOp_${action.replace(/[.-]/g, '_')}`;
	if (t) {
		const translated = t(opKey, '');
		if (translated && !translated.startsWith('auditOp_')) {
			return translated;
		}
	}
	return action
		.split(/[._-]/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(' ');
}
