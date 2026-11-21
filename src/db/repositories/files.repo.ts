import type { PoolClient } from 'pg';
import { getPgPool, ensurePostgresInit } from '@/db';
import type { StoredFile } from '@/db/schema';

export type StoredFileRecord = StoredFile & {
	sizeBytes: number;
	sourceApp: string;
	scopeId: string | null;
};

export async function addStoredFile(
	params: {
		name: string;
		uploaderId: string;
		mime: string;
		size: number;
		everyoneOpen?: boolean;
		chatRoomId?: string | null;
		sourceApp?: string;
		scopeId?: string | null;
	},
	client?: PoolClient
): Promise<void> {
	if (!client) await ensurePostgresInit();
	const db = client ?? getPgPool();
	const sourceApp = params.sourceApp?.trim() || 'general';
	const chatRoomId = params.chatRoomId?.trim() || null;
	const scopeId = params.scopeId?.trim() || null;
	await db.query(
		`INSERT INTO files (id, uploaded_by, mime_type, size_bytes, created_at, is_public, chat_room_id, source_app, scope_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (id) DO NOTHING`,
		[
			params.name,
			params.uploaderId,
			params.mime,
			params.size,
			Date.now(),
			params.everyoneOpen ? 1 : 0,
			chatRoomId,
			sourceApp,
			scopeId,
		]
	);
}

export async function deleteStoredFile(name: string): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('DELETE FROM files WHERE id = $1', [name]);
}

export async function deleteStoredFilesByScope(
	uploadedBy: string,
	sourceApp: string,
	scopeIds: string[],
	client?: PoolClient
): Promise<Array<{ id: string; storedName: string }>> {
	const cleanScopeIds = Array.from(
		new Set((scopeIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0))
	);
	const cleanSourceApp = sourceApp?.trim();
	if (!uploadedBy || !cleanSourceApp || cleanScopeIds.length === 0) return [];
	if (!client) await ensurePostgresInit();
	const db = client ?? getPgPool();
	const res = await db.query<{ id: string; storedName: string }>(
		`DELETE FROM files
		 WHERE uploaded_by = $1 AND source_app = $2 AND scope_id = ANY($3::text[])
		 RETURNING id, id AS "storedName"`,
		[uploadedBy, cleanSourceApp, cleanScopeIds]
	);
	return res.rows.map((row) => ({
		id: String(row.id),
		storedName: String(row.storedName ?? row.id),
	}));
}

export async function getStoredFile(name: string): Promise<StoredFileRecord | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id AS name,
		        uploaded_by AS "uploaderId",
		        mime_type AS mime,
		        size_bytes AS size,
		        size_bytes AS "sizeBytes",
		        is_public AS "everyoneOpen",
		        chat_room_id AS "chatRoomId",
		        source_app AS "sourceApp",
		        scope_id AS "scopeId",
		        created_at AS "createdAt"
		 FROM files WHERE id = $1`,
		[name]
	);
	const row = res.rows[0] as Record<string, unknown> | undefined;
	if (!row) return null;
	const size = Number(row.size ?? row.sizeBytes ?? 0);
	return {
		name: String(row.name),
		uploaderId: row.uploaderId !== null && row.uploaderId !== undefined ? String(row.uploaderId) : null,
		mime: String(row.mime),
		size,
		sizeBytes: Number(row.sizeBytes ?? size),
		everyoneOpen: Number(row.everyoneOpen ?? 0),
		chatRoomId: row.chatRoomId !== null && row.chatRoomId !== undefined ? String(row.chatRoomId) : null,
		sourceApp: String(row.sourceApp || 'general'),
		scopeId: row.scopeId !== null && row.scopeId !== undefined ? String(row.scopeId) : null,
		createdAt: Number(row.createdAt ?? 0),
	};
}

export async function getUserDiskUsage(userId: string): Promise<{ bytes: number; count: number }> {
	if (!userId) return { bytes: 0, count: 0 };
	await ensurePostgresInit();
	const res = await getPgPool().query<{ bytes: string; count: string }>(
		`SELECT COALESCE(SUM(size_bytes), 0)::bigint AS bytes, COUNT(*)::int AS count
		 FROM files
		 WHERE uploaded_by = $1`,
		[userId]
	);
	return {
		bytes: Number(res.rows[0]?.bytes || 0),
		count: Number(res.rows[0]?.count || 0),
	};
}

export async function getUsersDiskUsage(userIds: string[]): Promise<Map<string, { bytes: number; count: number }>> {
	const map = new Map<string, { bytes: number; count: number }>();
	if (!userIds || userIds.length === 0) return map;
	await ensurePostgresInit();
	const res = await getPgPool().query<{ userId: string; bytes: string; count: string }>(
		`SELECT uploaded_by AS "userId",
		        COALESCE(SUM(size_bytes), 0)::bigint AS bytes,
		        COUNT(*)::int AS count
		 FROM files
		 WHERE uploaded_by = ANY($1)
		 GROUP BY uploaded_by`,
		[userIds]
	);
	for (const row of res.rows) {
		map.set(String(row.userId), {
			bytes: Number(row.bytes || 0),
			count: Number(row.count || 0),
		});
	}
	return map;
}

