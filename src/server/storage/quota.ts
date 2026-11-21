import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool } from '@/db';

export const DEFAULT_GLOBAL_QUOTA_BYTES = 512 * 1024 * 1024;

export interface QuotaReservationResult {
	allowed: boolean;
	usedBytes: number;
	quotaBytes: number;
	remainingBytes: number;
}

export interface UserStorageBreakdown {
	usedBytes: number;
	quotaBytes: number;
	isUnlimited: boolean;
	byApp: {
		drive: number;
		notes: number;
		chat: number;
		other: number;
	};
}

type QueryExecutor = Pick<PoolClient, 'query'>;

async function resolveExecutor(client?: PoolClient): Promise<QueryExecutor> {
	if (client) return client;
	await ensurePostgresInit();
	return getPgPool();
}

export async function resolveEffectiveQuotaBytes(
	userId: string,
	client?: PoolClient
): Promise<number> {
	const db = await resolveExecutor(client);
	const cleanUserId = (userId ?? '').trim();
	const res = await db.query<{ quotaBytes?: number | string | null; quota_bytes?: number | string | null }>(
		`SELECT sq.quota_bytes AS "quotaBytes"
		 FROM storage_quotas sq
		 LEFT JOIN users u ON u.id = $1
		 WHERE ($1 <> '' AND sq.scope_type = 'user' AND sq.scope_id = $1)
		    OR ($1 <> '' AND sq.scope_type = 'role' AND u.role_id IS NOT NULL AND sq.scope_id = u.role_id)
		    OR (sq.scope_type = 'global' AND sq.scope_id = '')
		 ORDER BY CASE sq.scope_type
		            WHEN 'user' THEN 1
		            WHEN 'role' THEN 2
		            ELSE 3
		          END ASC
		 LIMIT 1`,
		[cleanUserId]
	);

	const row = res.rows[0];
	if (!row) return DEFAULT_GLOBAL_QUOTA_BYTES;
	const raw = row.quotaBytes ?? row.quota_bytes;
	if (raw === null || raw === undefined) return DEFAULT_GLOBAL_QUOTA_BYTES;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < -1) {
		return DEFAULT_GLOBAL_QUOTA_BYTES;
	}
	return Math.trunc(parsed);
}

/**
 * Atomically checks and reserves storage quota for `userId` inside an active
 * transaction (`withTransaction`) using a per-user `pg_advisory_xact_lock`.
 */
export async function reserveUserStorageQuota(
	client: PoolClient,
	userId: string,
	incomingBytes: number
): Promise<QuotaReservationResult> {
	const cleanUserId = typeof userId === 'string' ? userId.trim() : '';
	if (!cleanUserId) {
		throw new Error('userId is required to reserve storage quota');
	}
	if (!Number.isFinite(incomingBytes) || incomingBytes < 0) {
		throw new Error('incomingBytes must be a non-negative finite number');
	}
	const bytesToAdd = Math.ceil(incomingBytes);

	await client.query("SELECT pg_advisory_xact_lock(hashtext('storage_quota:' || $1))", [cleanUserId]);

	const usageRes = await client.query<{ usedBytes?: number | string; used_bytes?: number | string }>(
		`SELECT COALESCE(SUM(size_bytes), 0)::bigint AS "usedBytes"
		 FROM files
		 WHERE uploaded_by = $1`,
		[cleanUserId]
	);
	const usedBytes = Math.max(
		0,
		Number(usageRes.rows[0]?.usedBytes ?? usageRes.rows[0]?.used_bytes ?? 0)
	);
	const quotaBytes = await resolveEffectiveQuotaBytes(cleanUserId, client);

	if (quotaBytes !== -1 && usedBytes + bytesToAdd > quotaBytes) {
		return {
			allowed: false,
			usedBytes,
			quotaBytes,
			remainingBytes: Math.max(0, quotaBytes - usedBytes),
		};
	}

	return {
		allowed: true,
		usedBytes,
		quotaBytes,
		remainingBytes:
			quotaBytes === -1 ? Number.MAX_SAFE_INTEGER : quotaBytes - (usedBytes + bytesToAdd),
	};
}

export async function getUserStorageBreakdown(userId: string): Promise<UserStorageBreakdown> {
	const cleanUserId = (userId ?? '').trim();
	const byApp = { drive: 0, notes: 0, chat: 0, other: 0 };

	if (!cleanUserId) {
		const quotaBytes = await resolveEffectiveQuotaBytes('');
		return {
			usedBytes: 0,
			quotaBytes,
			isUnlimited: quotaBytes === -1,
			byApp,
		};
	}

	await ensurePostgresInit();
	const res = await getPgPool().query<{
		sourceApp?: string;
		source_app?: string;
		totalBytes?: number | string;
		total_bytes?: number | string;
	}>(
		`SELECT source_app AS "sourceApp",
		        COALESCE(SUM(size_bytes), 0)::bigint AS "totalBytes"
		 FROM files
		 WHERE uploaded_by = $1
		 GROUP BY source_app`,
		[cleanUserId]
	);

	for (const row of res.rows) {
		const app = String(row.sourceApp ?? row.source_app ?? 'general').trim().toLowerCase();
		const bytes = Math.max(0, Number(row.totalBytes ?? row.total_bytes ?? 0));
		if (app === 'drive') {
			byApp.drive += bytes;
		} else if (app === 'notes') {
			byApp.notes += bytes;
		} else if (app === 'chat') {
			byApp.chat += bytes;
		} else {
			byApp.other += bytes;
		}
	}

	const usedBytes = byApp.drive + byApp.notes + byApp.chat + byApp.other;
	const quotaBytes = await resolveEffectiveQuotaBytes(cleanUserId);

	return {
		usedBytes,
		quotaBytes,
		isUnlimited: quotaBytes === -1,
		byApp,
	};
}
