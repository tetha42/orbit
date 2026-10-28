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
	gunBaslangici,
	kayitAlanlari,
	saklamaGunu,
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
		CREATE TABLE IF NOT EXISTS audit_logs (
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
		CREATE INDEX IF NOT EXISTS idx_audit_logs_zaman ON audit_logs (zaman DESC, id DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_yapan ON audit_logs (yapanId);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_hedef ON audit_logs (hedefTur, hedefId);
		DROP VIEW IF EXISTS denetim_kaydi CASCADE; CREATE VIEW denetim_kaydi AS SELECT * FROM audit_logs;
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
		const alanlar = kayitAlanlari(v);
		return alanlar ? JSON.stringify(alanlar) : null;
	};
	await client.query(
		`INSERT INTO audit_logs (zaman, yapanId, yapanAd, islem, hedefTur, hedefId, hedefAd, onceki, sonraki, ip)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
		[Date.now(), ctx.yapanId, ctx.yapanAd.slice(0, 200), g.islem, g.hedefTur, g.hedefId, (g.hedefAd ?? '').slice(0, 200), json(g.onceki), json(g.sonraki), ctx.ip]
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
			`(yapanId = ${exact} OR (hedefTur = 'uye' AND hedefId = ${exact}) OR yapanAd ILIKE ${like} OR hedefAd ILIKE ${like} OR onceki->>'email' ILIKE ${like} OR sonraki->>'email' ILIKE ${like})`
		);
	}
	if (f.role) {
		const r = add(f.role);
		parts.push(`((hedefTur = 'role' AND hedefId = ${r}) OR onceki->>'roleId' = ${r} OR sonraki->>'roleId' = ${r} OR sonraki->>'tasinanRolId' = ${r})`);
	}
	if (f.islem) parts.push(`islem = ${add(f.islem)}`);
	if (f.from) parts.push(`zaman >= ${add(gunBaslangici(f.from))}`);
	// The end day is inclusive: everything before the next day starts.
	if (f.to) parts.push(`zaman < ${add(gunBaslangici(f.to) + 24 * 3600 * 1000)}`);
	return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

function toRecord(r: Record<string, unknown>): AuditRecord {
	return {
		id: String(r.id),
		zaman: Number(r.zaman ?? 0),
		yapanId: ((r.yapanId ?? r.yapanid) as string | null) ?? null,
		yapanAd: String(r.yapanAd ?? r.yapanad ?? ''),
		islem: String(r.islem ?? ''),
		hedefTur: String(r.hedefTur ?? r.hedeftur ?? ''),
		hedefId: ((r.hedefId ?? r.hedefid) as string | null) ?? null,
		hedefAd: String(r.hedefAd ?? r.hedefad ?? ''),
		onceki: (r.onceki as AuditFields | null) ?? null,
		sonraki: (r.sonraki as AuditFields | null) ?? null,
		ip: String(r.ip ?? ''),
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
		const rawSayfa = Number.isFinite(f.sayfa) && Number(f.sayfa) > 0 ? Number(f.sayfa) : 1;
		const limit = Number.isFinite(opts.limit) && Number(opts.limit) > 0 ? Math.floor(Number(opts.limit)) : rawBoyut;
		const offset = Number.isFinite(opts.offset) && Number(opts.offset) >= 0 ? Math.floor(Number(opts.offset)) : (rawSayfa - 1) * rawBoyut;
		const [rows, count] = await Promise.all([
			getPgPool().query(
				`SELECT id::text AS id, zaman, yapanId AS "yapanId", yapanAd AS "yapanAd", islem, hedefTur AS "hedefTur", hedefId AS "hedefId", hedefAd AS "hedefAd", onceki, sonraki, ip FROM audit_logs ${w.sql} ORDER BY zaman DESC, audit_logs.id DESC LIMIT ${limit} OFFSET ${offset}`,
				w.params
			),
			getPgPool().query(`SELECT COUNT(*)::int AS n FROM audit_logs ${w.sql}`, w.params),
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
	const sinir = Date.now() - saklamaGunu(process.env.AUDIT_RETENTION_DAYS) * 24 * 3600 * 1000;
	const r = await getPgPool().query('DELETE FROM audit_logs WHERE zaman < $1', [sinir]);
	return r.rowCount ?? 0;
}

/** Purges all audit log records from the database. */
export async function resetAuditLogs(): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('TRUNCATE TABLE audit_logs');
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
