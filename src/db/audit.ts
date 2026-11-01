/**
 * The audit log: who changed which role, permission or member, when, from
 * where. Table `denetim_kaydi` — one row per operation:
 *
 *   zaman     — epoch ms
 *   yapanId   — the acting member (no foreign key: the log outlives the account);
 *               yapanAd keeps their name at that time
 *   islem     — see DENETIM_ISLEMLERI in src/lib/audit.ts
 *   hedefTur / hedefId / hedefAd — what was changed (a role, a member, a setting)
 *   onceki / sonraki — JSONB before and after, built from white-lists (never a raw row)
 *   ip        — the caller's address (clientAddress; a soft signal behind the proxy)
 *
 * `logAuditEvent` runs on the caller's transaction client, so a record exists
 * exactly when the operation it describes was committed. Records older than the
 * retention period (730 days, `AUDIT_RETENTION_DAYS` overrides) are deleted once
 * a day by `startAuditMaintenance`.
 */
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool } from './index';
import { clientAddress } from '@/lib/http';
import {
	startOfDay,
	recordFields,
	retentionDays,
	temizIp,
	type AuditFields,
	type AuditContext,
	type AuditTargetType,
	type AuditAction,
	type AuditRecord,
	type AuditFilter,
} from '@/lib/audit';

export type { AuditContext } from '@/lib/audit';

/** Called from ensurePostgresInit with its raw (lower-case) client, inside its transaction. */
export async function ensureAuditSchema(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS denetim_kaydi (
			id BIGSERIAL PRIMARY KEY,
			zaman BIGINT NOT NULL,
			yapanId TEXT,
			yapanAd TEXT NOT NULL DEFAULT '',
			islem TEXT NOT NULL,
			hedefTur TEXT NOT NULL,
			hedefId TEXT,
			hedefAd TEXT NOT NULL DEFAULT '',
			onceki JSONB,
			sonraki JSONB,
			ip TEXT NOT NULL DEFAULT ''
		);
		CREATE INDEX IF NOT EXISTS idx_denetim_kaydi_zaman ON denetim_kaydi (zaman DESC, id DESC);
		CREATE INDEX IF NOT EXISTS idx_denetim_kaydi_yapan ON denetim_kaydi (yapanId);
		CREATE INDEX IF NOT EXISTS idx_denetim_kaydi_hedef ON denetim_kaydi (hedefTur, hedefId);
		DROP VIEW IF EXISTS audit_logs CASCADE;
		CREATE OR REPLACE VIEW audit_logs AS SELECT * FROM denetim_kaydi;
	`);
}

/** Who is acting, for the record: the signed-in member and the request's address. */
export function auditContext(request: Request, user: { id: string; ad: string; soyad: string }): AuditContext {
	return { yapanId: user.id, yapanAd: `${user.ad} ${user.soyad}`.trim(), ip: temizIp(clientAddress(request)) };
}

export interface AuditEntry {
	islem: AuditAction;
	hedefTur: AuditTargetType;
	hedefId: string | null;
	hedefAd?: string;
	onceki: Record<string, unknown> | null;
	sonraki: Record<string, unknown> | null;
}

/**
 * Writes one record on the operation's own transaction client. Callers pass
 * white-listed snapshots; `kayitAlanlari` drops credential-looking keys again.
 */
export async function logAuditEvent(client: PoolClient, ctx: AuditContext, g: AuditEntry): Promise<void> {
	const json = (v: Record<string, unknown> | null) => {
		const alanlar = recordFields(v);
		return alanlar ? JSON.stringify(alanlar) : null;
	};
	await client.query(
		`INSERT INTO denetim_kaydi (zaman, yapanId, yapanAd, islem, hedefTur, hedefId, hedefAd, onceki, sonraki, ip)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
		[Date.now(), ctx.yapanId, ctx.yapanAd.slice(0, 200), g.islem, g.hedefTur, g.hedefId, (g.hedefAd ?? '').slice(0, 200), json(g.onceki), json(g.sonraki), ctx.ip]
	);
}

/**
 * Direct audit log writer using the global connection pool.
 * Used by withAudit middleware to ensure all mutations are recorded.
 */
export async function writeAuditLog(entry: {
	yapanId: string | null;
	yapanAd: string;
	islem: string;
	hedefTur: string;
	hedefId: string | null;
	hedefAd?: string;
	onceki?: Record<string, unknown> | null;
	sonraki?: Record<string, unknown> | null;
	ip: string;
}): Promise<void> {
	await ensurePostgresInit();
	const json = (v: Record<string, unknown> | null | undefined) => {
		const alanlar = recordFields(v);
		return alanlar ? JSON.stringify(alanlar) : null;
	};
	await getPgPool().query(
		`INSERT INTO denetim_kaydi (zaman, yapanId, yapanAd, islem, hedefTur, hedefId, hedefAd, onceki, sonraki, ip)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
		[
			Date.now(),
			entry.yapanId,
			entry.yapanAd.slice(0, 200),
			entry.islem,
			entry.hedefTur,
			entry.hedefId,
			(entry.hedefAd ?? '').slice(0, 200),
			json(entry.onceki),
			json(entry.sonraki),
			entry.ip,
		]
	);
}

/* ---------------- reading ---------------- */

const likeKacis = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function where(f: AuditFilter): { sql: string; params: unknown[] } {
	const parts: string[] = [];
	const params: unknown[] = [];
	const add = (v: unknown) => {
		params.push(v);
		return `$${params.length}`;
	};
	if (f.kisi) {
		const exact = add(f.kisi);
		const like = add(`%${likeKacis(f.kisi)}%`);
		parts.push(
			`(yapanId = ${exact} OR (hedefTur = 'uye' AND hedefId = ${exact}) OR yapanAd ILIKE ${like} OR hedefAd ILIKE ${like} OR onceki->>'email' ILIKE ${like} OR sonraki->>'email' ILIKE ${like} OR onceki->>'eposta' ILIKE ${like} OR sonraki->>'eposta' ILIKE ${like})`
		);
	}
	if (f.role) {
		const r = add(f.role);
		parts.push(
			`(((hedefTur = 'role' OR hedefTur = 'rol') AND hedefId = ${r}) OR onceki->>'roleId' = ${r} OR onceki->>'rolId' = ${r} OR sonraki->>'roleId' = ${r} OR sonraki->>'rolId' = ${r} OR sonraki->>'tasinanRolId' = ${r})`
		);
	}
	if (f.islem) {
		parts.push(`islem = ${add(f.islem)}`);
	}
	if (f.from) parts.push(`zaman >= ${add(startOfDay(f.from))}`);
	// The end day is inclusive: everything before the next day starts.
	if (f.to) parts.push(`zaman < ${add(startOfDay(f.to) + 24 * 3600 * 1000)}`);
	return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

function toRecord(r: Record<string, unknown>): AuditRecord {
	const id = String(r.id);
	const timestamp = Number(r.zaman ?? r.timestamp ?? 0);
	const actorId = ((r.yapanId ?? r.actorId ?? r.yapanid) as string | null) ?? null;
	const actorName = String(r.yapanAd ?? r.actorName ?? r.yapanad ?? '');
	const action = String(r.islem ?? r.action ?? '');
	const targetType = String(r.hedefTur ?? r.targetType ?? r.hedeftur ?? '');
	const targetId = ((r.hedefId ?? r.targetId ?? r.hedefid) as string | null) ?? null;
	const targetName = String(r.hedefAd ?? r.targetName ?? r.hedefad ?? '');
	const before = (r.onceki !== undefined && r.onceki !== null ? r.onceki : (r.before !== undefined && r.before !== null ? r.before : null)) as AuditFields | null;
	const after = (r.sonraki !== undefined && r.sonraki !== null ? r.sonraki : (r.after !== undefined && r.after !== null ? r.after : null)) as AuditFields | null;
	const ip = String(r.ip ?? '');

	return {
		id,
		timestamp,
		zaman: timestamp,
		actorId,
		yapanId: actorId,
		actorName,
		yapanAd: actorName,
		action,
		islem: action,
		targetType,
		hedefTur: targetType,
		targetId,
		hedefId: targetId,
		targetName,
		hedefAd: targetName,
		before: before ?? null,
		onceki: before ?? null,
		after: after ?? null,
		sonraki: after ?? null,
		ip,
	};
}

/** One page, newest first, and the total number of matching records. */
export async function listAuditLogs(
	f: Partial<AuditFilter> = {},
	opts: { limit?: number; offset?: number } = {}
): Promise<{ kayitlar: AuditRecord[]; toplam: number }> {
	try {
		await ensurePostgresInit();
		const w = where(f as AuditFilter);
		const rawBoyut = Number.isFinite(f.boyut) && Number(f.boyut) > 0 ? Number(f.boyut) : 50;
		const rawPage = Number.isFinite(f.sayfa) && Number(f.sayfa) > 0 ? Number(f.sayfa) : 1;
		const limit = Number.isFinite(opts.limit) && Number(opts.limit) > 0 ? Math.floor(Number(opts.limit)) : rawBoyut;
		const offset = Number.isFinite(opts.offset) && Number(opts.offset) >= 0 ? Math.floor(Number(opts.offset)) : (rawPage - 1) * rawBoyut;
		const [rows, count] = await Promise.all([
			getPgPool().query(
				`SELECT id::text AS id, zaman, yapanId AS "yapanId", yapanAd AS "yapanAd", islem, hedefTur AS "hedefTur", hedefId AS "hedefId", hedefAd AS "hedefAd", onceki, sonraki, ip FROM denetim_kaydi ${w.sql} ORDER BY zaman DESC, denetim_kaydi.id DESC LIMIT ${limit} OFFSET ${offset}`,
				w.params
			),
			getPgPool().query(`SELECT COUNT(*)::int AS n FROM denetim_kaydi ${w.sql}`, w.params),
		]);
		return { kayitlar: rows.rows.map(toRecord), toplam: Number(count.rows[0]?.n ?? 0) };
	} catch (error) {
		console.error('listAuditLogs error:', error);
		return { kayitlar: [], toplam: 0 };
	}
}

/* ---------------- retention ---------------- */

/** Deletes records past the retention period — one statement, safe to repeat. */
export async function clearAuditLogs(): Promise<number> {
	await ensurePostgresInit();
	const sinir = Date.now() - retentionDays(process.env.AUDIT_RETENTION_DAYS) * 24 * 3600 * 1000;
	const r = await getPgPool().query('DELETE FROM denetim_kaydi WHERE zaman < $1', [sinir]);
	return r.rowCount ?? 0;
}

/** Purges all audit log records from the database. */
export async function resetAuditLogs(): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('TRUNCATE TABLE denetim_kaydi CASCADE');
}

const BAKIM_ARALIGI_MS = 24 * 3600 * 1000;
const bakim = globalThis as { __denetimBakimi?: boolean };

/**
 * Runs the clean-up now and then once a day, from the first database use on.
 * One timer per process (a dev reload does not stack another); it never keeps
 * the process alive. Requests never trigger it.
 */
export function startAuditMaintenance(): void {
	if (bakim.__denetimBakimi) return;
	bakim.__denetimBakimi = true;
	const calistir = () => {
		clearAuditLogs().then(
			(n) => n > 0 && console.log(`[Denetim] ${n} eski kayıt silindi.`),
			(err) => console.error('[Denetim] Temizlik başarısız:', err)
		);
	};
	calistir();
	setInterval(calistir, BAKIM_ARALIGI_MS).unref?.();
}
