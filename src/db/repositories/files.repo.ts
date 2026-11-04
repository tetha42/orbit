import { getPgPool, ensurePostgresInit } from '@/db';
import type { StoredFile } from '@/db/schema';

export async function addStoredFile(params: {
	name: string;
	uploaderId: string;
	mime: string;
	size: number;
	everyoneOpen?: boolean;
	chatRoomId?: string | null;
}): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		`INSERT INTO files (id, uploaded_by, mime_type, size_bytes, created_at, is_public)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (id) DO NOTHING`,
		[params.name, params.uploaderId, params.mime, params.size, Date.now(), params.everyoneOpen ? 1 : 0]
	);
}

export async function deleteStoredFile(name: string): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('DELETE FROM files WHERE id = $1', [name]);
}

export async function getStoredFile(name: string): Promise<StoredFile | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id AS name, uploaded_by AS "uploaderId", mime_type AS mime, size_bytes AS size,
		        is_public AS "everyoneOpen", NULL::text AS "chatRoomId", created_at AS creation
		 FROM files WHERE id = $1`,
		[name]
	);
	return (res.rows[0] as StoredFile | undefined) ?? null;
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

