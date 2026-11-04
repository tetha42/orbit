/**
 * The audit log: who changed which role, permission or member, when, from
 * where. Table `audit_logs` — one row per operation:
 *
 *   id           — unique audit log identifier
 *   timestamp    — epoch ms
 *   actor_id     — the acting member (no foreign key: the log outlives the account)
 *   actor_name   — keeps their name at that time
 *   action       — see DENETIM_ISLEMLERI in src/lib/audit.ts
 *   target_type / target_id / target_name — what was changed (a role, a member, a setting)
 *   before_state / after_state — JSON text before and after, built from white-lists
 *   ip           — the caller's address
 */
import { randomUUID } from 'crypto';
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
		CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			timestamp BIGINT NOT NULL,
			actor_id TEXT,
			actor_name TEXT,
			action TEXT NOT NULL,
			target_type TEXT NOT NULL,
			target_id TEXT,
			target_name TEXT,
			before_state TEXT,
			after_state TEXT,
			ip TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC, id DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id);
	`);
}

/** Who is acting, for the record: the signed-in member and the request's address. */
export function auditContext(request: Request, user: { id: string; ad?: string; soyad?: string; firstName?: string; lastName?: string }): AuditContext {
	const first = user.firstName || user.ad || '';
	const last = user.lastName || user.soyad || '';
	return { actorId: user.id, actorName: `${first} ${last}`.trim(), ip: temizIp(clientAddress(request)) };
}

export interface AuditEntry {
	action: AuditAction;
	targetType: AuditTargetType;
	targetId: string | null;
	targetName?: string;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
}

/**
 * Writes one record on the operation's own transaction client. Callers pass
 * white-listed snapshots; `recordFields` drops credential-looking keys again.
 */
export async function logAuditEvent(client: PoolClient, ctx: AuditContext, g: AuditEntry): Promise<void> {
	const json = (v: Record<string, unknown> | null) => {
		const alanlar = recordFields(v);
		return alanlar ? JSON.stringify(alanlar) : null;
	};
	const id = `aud_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	await client.query(
		`INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, action, target_type, target_id, target_name, before_state, after_state, ip)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		[
			id,
			Date.now(),
			ctx.actorId,
			ctx.actorName.slice(0, 200),
			g.action,
			g.targetType,
			g.targetId,
			(g.targetName ?? '').slice(0, 200),
			json(g.before),
			json(g.after),
			ctx.ip,
		]
	);
}

/**
 * Direct audit log writer using the global connection pool.
 * Used by withAudit middleware to ensure all mutations are recorded.
 */
export async function writeAuditLog(entry: {
	actorId: string | null;
	actorName: string;
	action: string;
	targetType: string;
	targetId: string | null;
	targetName?: string;
	before?: Record<string, unknown> | null;
	after?: Record<string, unknown> | null;
	ip: string;
}): Promise<void> {
	await ensurePostgresInit();
	const json = (v: Record<string, unknown> | null | undefined) => {
		const alanlar = recordFields(v);
		return alanlar ? JSON.stringify(alanlar) : null;
	};
	const id = `aud_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	await getPgPool().query(
		`INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, action, target_type, target_id, target_name, before_state, after_state, ip)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		[
			id,
			Date.now(),
			entry.actorId,
			entry.actorName.slice(0, 200),
			entry.action,
			entry.targetType,
			entry.targetId,
			(entry.targetName ?? '').slice(0, 200),
			json(entry.before),
			json(entry.after),
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
	if (f.user) {
		const exact = add(f.user);
		const like = add(`%${likeKacis(f.user)}%`);
		parts.push(
			`(actor_id = ${exact} OR (target_type = 'member' AND target_id = ${exact}) OR actor_name ILIKE ${like} OR target_name ILIKE ${like} OR before_state ILIKE ${like} OR after_state ILIKE ${like})`
		);
	}
	if (f.role) {
		const r = add(f.role);
		const rLike = add(`%"${likeKacis(f.role)}"%`);
		parts.push(
			`((target_type = 'role' AND target_id = ${r}) OR before_state LIKE ${rLike} OR after_state LIKE ${rLike})`
		);
	}
	if (f.action) {
		parts.push(`action = ${add(f.action)}`);
	}
	if (f.from) parts.push(`timestamp >= ${add(startOfDay(f.from))}`);
	// The end day is inclusive: everything before the next day starts.
	if (f.to) parts.push(`timestamp < ${add(startOfDay(f.to) + 24 * 3600 * 1000)}`);
	return { sql: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

function parseState(raw: unknown): AuditFields | null {
	if (raw === undefined || raw === null) return null;
	if (typeof raw === 'string') {
		if (!raw.trim()) return null;
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? (parsed as AuditFields) : null;
		} catch {
			return null;
		}
	}
	if (typeof raw === 'object') return raw as AuditFields;
	return null;
}

function toRecord(r: Record<string, unknown>): AuditRecord {
	const id = String(r.id);
	const timestamp = Number(r.timestamp ?? 0);
	const actorId = (r.actorId as string | null) ?? null;
	const actorName = String(r.actorName ?? '');
	const action = String(r.action ?? '');
	const targetType = String(r.targetType ?? '');
	const targetId = (r.targetId as string | null) ?? null;
	const targetName = String(r.targetName ?? '');
	const before = parseState(r.beforeState);
	const after = parseState(r.afterState);
	const ip = String(r.ip ?? '');

	return {
		id,
		timestamp,
		actorId,
		actorName,
		action,
		targetType,
		targetId,
		targetName,
		before,
		after,
		ip,
	};
}

/** One page, newest first, and the total number of matching records. */
export async function listAuditLogs(
	f: Partial<AuditFilter> = {},
	opts: { limit?: number; offset?: number } = {}
): Promise<{ records: AuditRecord[]; total: number }> {
	try {
		await ensurePostgresInit();
		const w = where(f as AuditFilter);
		const rawPageSize = Number.isFinite(f.pageSize) && Number(f.pageSize) > 0 ? Number(f.pageSize) : 50;
		const rawPage = Number.isFinite(f.page) && Number(f.page) > 0 ? Number(f.page) : 1;
		const limit = Number.isFinite(opts.limit) && Number(opts.limit) > 0 ? Math.floor(Number(opts.limit)) : rawPageSize;
		const offset = Number.isFinite(opts.offset) && Number(opts.offset) >= 0 ? Math.floor(Number(opts.offset)) : (rawPage - 1) * rawPageSize;
		const [rows, count] = await Promise.all([
			getPgPool().query(
				`SELECT id, timestamp, actor_id AS "actorId", actor_name AS "actorName", action, target_type AS "targetType", target_id AS "targetId", target_name AS "targetName", before_state AS "beforeState", after_state AS "afterState", ip FROM audit_logs ${w.sql} ORDER BY timestamp DESC, audit_logs.id DESC LIMIT ${limit} OFFSET ${offset}`,
				w.params
			),
			getPgPool().query(`SELECT COUNT(*)::int AS n FROM audit_logs ${w.sql}`, w.params),
		]);
		return { records: rows.rows.map(toRecord), total: Number(count.rows[0]?.n ?? 0) };
	} catch (error) {
		console.error('listAuditLogs error:', error);
		return { records: [], total: 0 };
	}
}

/* ---------------- retention ---------------- */

/** Deletes records past the retention period — one statement, safe to repeat. */
export async function clearAuditLogs(): Promise<number> {
	await ensurePostgresInit();
	const sinir = Date.now() - retentionDays(process.env.AUDIT_RETENTION_DAYS) * 24 * 3600 * 1000;
	const r = await getPgPool().query('DELETE FROM audit_logs WHERE timestamp < $1', [sinir]);
	return r.rowCount ?? 0;
}

/** Purges all audit log records from the database. */
export async function resetAuditLogs(): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('TRUNCATE TABLE audit_logs CASCADE');
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
