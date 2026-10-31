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
