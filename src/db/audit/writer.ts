import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { getPgPool } from '../core/pool';
import { ensurePostgresInit } from '../core/init';
import { clientAddress } from '@/lib/http';
import {
	recordFields,
	cleanIp,
	type AuditContext,
	type AuditTargetType,
	type AuditAction,
} from '@/lib/audit';

export type { AuditContext } from '@/lib/audit';

export interface AuditEntry {
	action: AuditAction;
	targetType: AuditTargetType;
	targetId: string | null;
	targetName?: string;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
}

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
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1 FROM information_schema.columns 
				WHERE table_name = 'audit_logs' AND column_name = 'id' AND data_type IN ('bigint', 'integer', 'smallint')
			) THEN
				ALTER TABLE audit_logs ALTER COLUMN id DROP DEFAULT;
				ALTER TABLE audit_logs ALTER COLUMN id TYPE TEXT USING id::text;
				DROP SEQUENCE IF EXISTS audit_logs_id_seq CASCADE;
			END IF;
		END $$;
		CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC, id DESC);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
		CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_type, target_id);
	`);
}

/** Who is acting, for the record: the signed-in member and the request's address. */
export function auditContext(
	request: Request,
	user: { id: string; name?: string; surname?: string; firstName?: string; lastName?: string }
): AuditContext {
	const first = user.firstName || user.name || '';
	const last = user.lastName || user.surname || '';
	return { actorId: user.id, actorName: `${first} ${last}`.trim(), ip: cleanIp(clientAddress(request)) };
}

/**
 * Writes one record on the operation's own transaction client. Callers pass
 * white-listed snapshots; `recordFields` drops credential-looking keys again.
 */
export async function logAuditEvent(client: PoolClient, ctx: AuditContext, g: AuditEntry): Promise<void> {
	const json = (v: Record<string, unknown> | null) => {
		const fields = recordFields(v);
		return fields ? JSON.stringify(fields) : null;
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
		const fields = recordFields(v);
		return fields ? JSON.stringify(fields) : null;
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
