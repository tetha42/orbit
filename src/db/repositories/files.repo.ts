import { getPgPool, ensurePostgresInit } from '@/db';
import type { StoredFile } from '@/db/schema';

export async function addStoredFile(params: {
	ad: string;
	yukleyenId: string;
	mime: string;
	boyut: number;
	herkeseAcik?: boolean;
	sohbetOdaId?: string | null;
}): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		`INSERT INTO files (ad, yukleyenId, mime, boyut, olusturma, herkeseAcik)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (ad) DO NOTHING`,
		[params.ad, params.yukleyenId, params.mime, params.boyut, Date.now(), params.herkeseAcik ? 1 : 0]
	);
	if (params.sohbetOdaId) {
		// The column is added by a migration; keep receipt uploads working on an
		// install that has not yet restarted.
		await getPgPool()
			.query('UPDATE files SET sohbetodaid = $1 WHERE ad = $2', [params.sohbetOdaId, params.ad])
			.catch(() => {});
	}
}

export async function deleteStoredFile(ad: string): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('DELETE FROM files WHERE ad = $1', [ad]);
}

export async function getStoredFile(ad: string): Promise<StoredFile | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM files WHERE ad = $1', [ad]);
	return (res.rows[0] as StoredFile | undefined) ?? null;
}

export async function getUserDiskUsage(userId: string): Promise<{ bytes: number; count: number }> {
	if (!userId) return { bytes: 0, count: 0 };
	await ensurePostgresInit();
	const res = await getPgPool().query<{ bytes: string; count: string }>(
		`SELECT COALESCE(SUM(boyut), 0)::bigint AS bytes, COUNT(*)::int AS count
		 FROM files
		 WHERE yukleyenId = $1`,
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
		`SELECT yukleyenId AS "userId",
		        COALESCE(SUM(boyut), 0)::bigint AS bytes,
		        COUNT(*)::int AS count
		 FROM files
		 WHERE yukleyenId = ANY($1)
		 GROUP BY yukleyenId`,
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

