import { getPgPool } from '../core/pool';
import { ensurePostgresInit } from '../core/init';
import {
	startOfDay,
	retentionDays,
	type AuditFields,
	type AuditRecord,
	type AuditFilter,
} from '@/lib/audit';

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function where(f: AuditFilter): { sql: string; params: unknown[] } {
	const parts: string[] = [];
	const params: unknown[] = [];
	const add = (v: unknown) => {
		params.push(v);
		return `$${params.length}`;
	};
	if (f.user) {
		const exact = add(f.user);
		const like = add(`%${likeEscape(f.user)}%`);
		parts.push(
			`(actor_id = ${exact} OR (target_type = 'member' AND target_id = ${exact}) OR ` +
				`actor_name ILIKE ${like} OR target_name ILIKE ${like} OR before_state ILIKE ${like} OR after_state ILIKE ${like})`
		);
	}
	if (f.role) {
		const r = add(f.role);
		const rLike = add(`%"${likeEscape(f.role)}"%`);
		parts.push(
			`((target_type = 'role' AND target_id = ${r}) OR before_state LIKE ${rLike} OR after_state LIKE ${rLike})`
		);
	}
	if (f.action) {
		parts.push(`action = ${add(f.action)}`);
	}
	if (f.from) parts.push(`timestamp >= ${add(startOfDay(f.from))}`);
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
	return {
		id: String(r.id),
		timestamp: Number(r.timestamp ?? 0),
		actorId: (r.actorId as string | null) ?? null,
		actorName: String(r.actorName ?? ''),
		action: String(r.action ?? ''),
		targetType: String(r.targetType ?? ''),
		targetId: (r.targetId as string | null) ?? null,
		targetName: String(r.targetName ?? ''),
		before: parseState(r.beforeState),
		after: parseState(r.afterState),
		ip: String(r.ip ?? ''),
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
		const limit =
			Number.isFinite(opts.limit) && Number(opts.limit) > 0 ? Math.floor(Number(opts.limit)) : rawPageSize;
		const offset =
			Number.isFinite(opts.offset) && Number(opts.offset) >= 0
				? Math.floor(Number(opts.offset))
				: (rawPage - 1) * rawPageSize;
		const [rows, count] = await Promise.all([
			getPgPool().query(
				'SELECT id, timestamp, actor_id AS "actorId", actor_name AS "actorName", action, ' +
					'target_type AS "targetType", target_id AS "targetId", target_name AS "targetName", ' +
					`before_state AS "beforeState", after_state AS "afterState", ip FROM audit_logs ${w.sql} ` +
					`ORDER BY timestamp DESC, audit_logs.id DESC LIMIT ${limit} OFFSET ${offset}`,
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

/** Deletes records past the retention period — one statement, safe to repeat. */
export async function clearAuditLogs(): Promise<number> {
	await ensurePostgresInit();
	const limit = Date.now() - retentionDays(process.env.AUDIT_RETENTION_DAYS) * 24 * 3600 * 1000;
	const r = await getPgPool().query('DELETE FROM audit_logs WHERE timestamp < $1', [limit]);
	return r.rowCount ?? 0;
}

/** Purges all audit log records from the database. */
export async function resetAuditLogs(): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('TRUNCATE TABLE audit_logs CASCADE');
}

const MAINTENANCE_RANGE_MS = 24 * 3600 * 1000;
const maintenance = globalThis as { __AuditMaintenance?: boolean };

export function startAuditMaintenance(): void {
	if (maintenance.__AuditMaintenance) return;
	maintenance.__AuditMaintenance = true;
	const run = () => {
		clearAuditLogs().then(
			(n) => n > 0 && console.log(`[Audit] ${n} expired audit records pruned.`),
			(err) => console.error('[Audit] Maintenance cleanup failed:', err)
		);
	};
	run();
	setInterval(run, MAINTENANCE_RANGE_MS).unref?.();
}
