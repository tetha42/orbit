/**
 * Audit log helpers (Settings → Roller → Değişiklik geçmişi) — pure: no
 * imports, so scripts/check-pure.mjs can test them directly.
 *
 * What a record may contain is decided here, not by the callers: before/after
 * values are built from small white-lists (never a raw table row), and every
 * value goes through `temizle`, which drops anything that even looks like a
 * secret. A password hash, TOTP secret, recovery code or session token must
 * not reach the log by any route.
 */

/** Records older than this are deleted (see src/db/audit.ts). `AUDIT_RETENTION_DAYS` overrides it. */
export const AUDIT_RETENTION_DAYS = 730;

export const AUDIT_ACTIONS = [
	'role.create',
	'role.edit',
	'role.delete',
	'role.default',
	'member.role_grant',
	'member.role_revoke',
	'member.delete',
	'member.graduate',
	'member.activate',
	'member.status',
	'member.profile',
	'member.email',
	'member.anonymize',
	'member.password_reset',
	'application.approve',
	'application.reject',
	'setting.smtp',
	'security.2fa_disable',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = ['role', 'member', 'setting'] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/** Who is acting and from where; built once per request. */
export interface AuditContext {
	actorId: string | null;
	actorName: string;
	ip: string;
}

export type AuditValue = string | number | boolean | null | AuditValue[] | { [key: string]: AuditValue };
export type AuditFields = { [key: string]: AuditValue };

/** What the API and the panel exchange. */
export interface AuditRecord {
	id: string;
	timestamp?: number;
	actorId?: string | null;
	actorName?: string;
	action?: string;
	targetType?: string;
	targetId?: string | null;
	targetName?: string;
	before?: AuditFields | null;
	after?: AuditFields | null;
	ip: string;
}

/* ---------------- secrets never get in ---------------- */

/** Key names that carry credentials — dropped wherever they appear. */
export const FORBIDDEN_KEY =
	/pass|parola|password|şifre|sifre|hash|totp|secret|token|recovery|kurtarma|credential|cookie|oturum|api_?key|auth(?:orization)?|private_?key|bearer|access_?key/i;
export const YASAK_ANAHTAR = FORBIDDEN_KEY;

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
export const temizle = sanitizeValue;

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
export const temizIp = sanitizeIp;

/* ---------------- white-listed snapshots ---------------- */

export type RoleSummary = {
	ad: string;
	renk: string;
	aciklama: string;
	ikiAdimZorunlu: boolean;
	izinler: Record<string, string>;
};

/** A role as the log sees it: only these fields, permissions without the 'yok' rows. */
export function roleSummary(r: { ad: string; renk: string; aciklama?: string | null; ikiAdimZorunlu: boolean; izinler: Record<string, string | undefined> }): RoleSummary {
	const izinler: Record<string, string> = {};
	for (const [app, seviye] of Object.entries(r.izinler).sort(([a], [b]) => a.localeCompare(b))) {
		if (seviye && seviye !== 'yok') izinler[app] = seviye;
	}
	return { ad: r.ad, renk: r.renk, aciklama: r.aciklama ?? '', ikiAdimZorunlu: !!r.ikiAdimZorunlu, izinler };
}

/** The minimum a member record keeps about its subject — enough to tell who it was, nothing else. */
export function memberSummary(u: { ad: string; soyad: string; email: string; status?: string | null; roleId?: string | null; rolAd?: string | null }): AuditFields {
	const out: AuditFields = { ad: `${u.ad} ${u.soyad}`.trim(), email: u.email };
	if (u.status !== undefined) out.status = u.status ?? null;
	if (u.roleId !== undefined) out.roleId = u.roleId ?? null;
	if (u.rolAd !== undefined) out.roleName = u.rolAd ?? null;
	return out;
}

/** One changed field, flattened for display (permissions as `izinler.<app>`). */
export interface DiffRow {
	alan: string;
	before: string | number | boolean | null;
	after: string | number | boolean | null;
}
export type FarkSatiri = DiffRow;

const duz = (v: AuditValue | undefined): string | number | boolean | null => (v === undefined || v === null ? null : typeof v === 'object' ? JSON.stringify(v) : v);

/** A record's before/after as one row per changed field — what the detail view lists. */
export function diffRows(before: AuditFields | null, after: AuditFields | null): DiffRow[] {
	const rows: DiffRow[] = [];
	const o = before ?? {};
	const n = after ?? {};
	for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
		const a = o[k];
		const b = n[k];
		const nested = (v: AuditValue | undefined): v is AuditFields => !!v && typeof v === 'object' && !Array.isArray(v);
		if (nested(a) || nested(b)) {
			const oa = nested(a) ? a : {};
			const nb = nested(b) ? b : {};
			for (const kk of new Set([...Object.keys(oa), ...Object.keys(nb)])) rows.push({ alan: `${k}.${kk}`, before: duz(oa[kk]), after: duz(nb[kk]) });
		} else {
			rows.push({ alan: k, before: duz(a), after: duz(b) });
		}
	}
	return rows;
}

/** How a member is named in a record's target column: name and e-mail (the minimum that identifies them). */
export function memberTargetName(u: { ad?: string; soyad?: string; firstName?: string; lastName?: string; email: string }): string {
	const first = u.firstName || u.ad || '';
	const last = u.lastName || u.soyad || '';
	return `${first} ${last}`.trim() + ` (${u.email})`;
}

/* ---------------- diffs ---------------- */

export interface DiffResult {
	before: AuditFields;
	after: AuditFields;
}
export type Fark = DiffResult;

const ayni = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Only the fields that differ, before and after; `null` when nothing changed. */
export function fieldDiff(before: Record<string, unknown>, after: Record<string, unknown>): DiffResult | null {
	const o: AuditFields = {};
	const n: AuditFields = {};
	for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (ayni(before[k], after[k])) continue;
		o[k] = sanitizeValue(before[k] ?? null) ?? null;
		n[k] = sanitizeValue(after[k] ?? null) ?? null;
	}
	return Object.keys(n).length ? { before: o, after: n } : null;
}
export const alanFarki = fieldDiff;

/**
 * A role edit as a diff: changed fields, and of the permission matrix only the
 * apps whose level changed ('yok' when absent on one side).
 */
export function roleDiff(before: RoleSummary, after: RoleSummary): DiffResult | null {
	const o: AuditFields = {};
	const n: AuditFields = {};
	for (const k of ['ad', 'renk', 'aciklama', 'ikiAdimZorunlu'] as const) {
		if (before[k] !== after[k]) {
			o[k] = before[k];
			n[k] = after[k];
		}
	}
	const oi: Record<string, string> = {};
	const ni: Record<string, string> = {};
	for (const app of new Set([...Object.keys(before.izinler), ...Object.keys(after.izinler)])) {
		const a = before.izinler[app] ?? 'yok';
		const b = after.izinler[app] ?? 'yok';
		if (a !== b) {
			oi[app] = a;
			ni[app] = b;
		}
	}
	if (Object.keys(ni).length) {
		o.izinler = oi;
		n.izinler = ni;
	}
	return Object.keys(n).length ? { before: o, after: n } : null;
}

/** The key that holds the (encrypted) app password, only ever reported as changed, never its value. */
export const SMTP_PASSWORD_KEY = 'smtp_pass';
export const SMTP_FIELDS = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_from'] as const;
export const SMTP_PAROLA_ANAHTARI = SMTP_PASSWORD_KEY;
export const SMTP_ALANLARI = SMTP_FIELDS;

/**
 * The e-mail account settings (SMTP) as a diff. `before` holds the stored values (a
 * missing key reads as its default), `yeni` the keys being written. The
 * password is reported as "değişti" / "silindi" and never by value.
 */
export function smtpDiff(before: Record<string, string | undefined>, yeni: Record<string, string>, varsayilan: Record<string, string>): DiffResult | null {
	const o: AuditFields = {};
	const n: AuditFields = {};
	for (const k of SMTP_FIELDS) {
		if (!(k in yeni)) continue;
		const previous = before[k] ?? varsayilan[k] ?? '';
		if (previous !== yeni[k]) {
			o[k] = previous;
			n[k] = yeni[k];
		}
	}
	if (SMTP_PASSWORD_KEY in yeni) {
		const vardi = !!before[SMTP_PASSWORD_KEY];
		if (yeni[SMTP_PASSWORD_KEY] === '') {
			// Clearing a password that was never set is no change.
			if (vardi) {
				o.uygulamaAnahtari = 'var';
				n.uygulamaAnahtari = 'silindi';
			}
		} else {
			o.uygulamaAnahtari = vardi ? 'var' : 'yok';
			n.uygulamaAnahtari = 'degisti';
		}
	}
	return Object.keys(n).length ? { before: o, after: n } : null;
}
export const smtpFarki = smtpDiff;

/** Which log entry a membership status change is. */
export function statusAction(before: string, after: string): AuditAction | null {
	if (before === after) return null;
	if (before === 'beklemede' && after === 'aktif') return 'application.approve';
	if (before === 'beklemede' && after === 'reddedildi') return 'application.reject';
	if (after === 'mezun') return 'member.graduate';
	if (after === 'aktif') return 'member.activate';
	return 'member.status';
}

/* ---------------- listing ---------------- */

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
const sayi = (v: string | null, varsayilan: number, en: number, fazla: number) => {
	const n = Math.floor(Number(v));
	return Number.isFinite(n) && n >= en ? Math.min(n, fazla) : varsayilan;
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
		page: sayi(q.get('page'), 1, 1, 1_000_000),
		pageSize: sayi(q.get('limit') ?? q.get('pageSize'), AUDIT_PAGE_SIZE, 1, AUDIT_MAX_PAGE_SIZE),
	};
}

/** `YYYY-MM-DD` (local) → the first millisecond of that day. */
export function startOfDay(gun: string): number {
	return new Date(`${gun}T00:00:00`).getTime();
}

export const AUDIT_CSV_HEADERS = ['Zaman', 'Yapan', 'Yapan No', 'İşlem', 'Hedef türü', 'Hedef No', 'Hedef', 'Önceki', 'Sonraki', 'IP'];

/** The log as CSV rows (header in DENETIM_CSV_BASLIKLARI); before/after as compact JSON. */
export function auditCsvRows(kayitlar: AuditRecord[]): string[][] {
	return kayitlar.map((k) => [
		new Date(k.timestamp).toISOString(),
		k.actorName,
		k.actorId ?? '',
		k.action,
		k.targetType,
		k.targetId ?? '',
		k.targetName,
		k.before ? JSON.stringify(k.before) : '',
		k.after ? JSON.stringify(k.after) : '',
		k.ip,
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

