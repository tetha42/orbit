import { getPgPool, ensurePostgresInit } from '@/db';
import type { Dosya } from '@/db/schema';

export async function addDosya(params: {
	ad: string;
	yukleyenId: string;
	mime: string;
	boyut: number;
	herkeseAcik?: boolean;
}): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		'INSERT INTO dosyalar (ad, yukleyenId, mime, boyut, olusturma, herkeseAcik) VALUES ($1, $2, $3, $4, $5, $6)',
		[params.ad, params.yukleyenId, params.mime, params.boyut, Date.now(), params.herkeseAcik ? 1 : 0]
	);
}

export async function deleteDosya(ad: string): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('DELETE FROM dosyalar WHERE ad = $1', [ad]);
}

export async function getDosya(ad: string): Promise<Dosya | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM dosyalar WHERE ad = $1', [ad]);
	return (res.rows[0] as Dosya | undefined) ?? null;
}
