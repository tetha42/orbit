import { randomInt, randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, getSystemSettings } from '@/db/index';
import type { Certificate } from '@/db/schema';
import { notificationEvents, publishEventQuiet } from '@/db/olaylar';

const KOD_ALFABESI = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function newVerificationCode(): string {
	const chars = Array.from({ length: 8 }, () => KOD_ALFABESI[randomInt(KOD_ALFABESI.length)]).join('');
	return `BEU-${new Date().getFullYear()}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export async function getCertificates(userId?: string): Promise<Certificate[]> {
	await ensurePostgresInit();
	let query = `
		SELECT s.*,
		       k.ad || ' ' || k.soyad as "kullaniciAdSoyad",
		       k.ogrenciNo,
		       e.baslik as "etkinlikBaslik"
		FROM sertifikalar s
		JOIN kullanicilar k ON s.userId = k.id
		LEFT JOIN etkinlikler e ON s.etkinlikId = e.id
	`;
	const params: unknown[] = [];
	if (userId) {
		query += ' WHERE s.userId = $1';
		params.push(userId);
	}
	query += ' ORDER BY s.olusturma DESC';

	const res = await getPgPool().query(query, params);
	return res.rows;
}

export async function getCertificateByCode(kod: string): Promise<Certificate | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`
		SELECT s.*,
		       k.ad || ' ' || k.soyad as "kullaniciAdSoyad",
		       k.ogrenciNo,
		       k.bolum as "kullaniciBolum",
		       e.baslik as "etkinlikBaslik"
		FROM sertifikalar s
		JOIN kullanicilar k ON s.userId = k.id
		LEFT JOIN etkinlikler e ON s.etkinlikId = e.id
		WHERE s.verificationCode = $1
	`,
		[kod]
	);
	return (res.rows[0] as Certificate | undefined) ?? null;
}

export async function createCertificate(params: {
	userId: string;
	baslik: string;
	etkinlikId?: string;
	pdfUrl?: string;
	kategori?: string;
	dil?: string;
	aciklama?: string;
}): Promise<{ id: string; verificationCode: string }> {
	await ensurePostgresInit();
	const id = randomUUID();
	const now = Date.now();
	for (let attempt = 0; ; attempt++) {
		const verificationCode = newVerificationCode();
		try {
			await getPgPool().query(
				`INSERT INTO sertifikalar (id, verificationCode, userId, etkinlikId, baslik, verilisTarihi, pdfUrl, olusturma, kategori, dil, aciklama)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $8, $9, $10)`,
				[
					id,
					verificationCode,
					params.userId,
					params.etkinlikId || null,
					params.baslik,
					now,
					params.pdfUrl || null,
					params.kategori || 'achievement',
					params.dil || 'tr',
					params.aciklama || null,
				]
			);
			await publishEventQuiet(getPgPool(), notificationEvents([params.userId]));
			return { id, verificationCode };
		} catch (err) {
			if ((err as { code?: string }).code !== '23505' || attempt >= 3) throw err;
		}
	}
}

export async function createEventCertificates(
	etkinlikId: string,
	baslik: string,
	options?: { kategori?: string; dil?: string; aciklama?: string }
): Promise<{ verilen: number; zatenVar: number }> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT y.userId AS "userId",
		        EXISTS (SELECT 1 FROM sertifikalar s WHERE s.userId = y.userId AND s.etkinlikId = $1) AS "var"
		 FROM yoklamalar y WHERE y.etkinlikId = $1`,
		[etkinlikId]
	);
	let verilen = 0;
	let zatenVar = 0;
	for (const row of res.rows) {
		if (row.var) {
			zatenVar += 1;
			continue;
		}
		await createCertificate({
			userId: row.userId,
			etkinlikId,
			baslik,
			kategori: options?.kategori,
			dil: options?.dil,
			aciklama: options?.aciklama,
		});
		verilen += 1;
	}
	return { verilen, zatenVar };
}

export interface KulupBilgileri {
	universite: string;
	kulupAdi: string;
	imzalar: { ad: string; unvan: string }[];
}

export async function getKulupBilgileri(): Promise<KulupBilgileri> {
	const ayar = await getSystemSettings();
	let lead = '';
	if (!ayar.imza1_ad) {
		const res = await getPgPool().query(
			"SELECT ad || ' ' || soyad AS ad FROM kullanicilar WHERE roleId = 'rol_admin' AND status = 'aktif' ORDER BY olusturma ASC LIMIT 1"
		);
		lead = res.rows[0]?.ad ?? '';
	}
	return {
		universite: ayar.universite,
		kulupAdi: ayar.kulup_adi,
		imzalar: [
			{ ad: ayar.imza1_ad || lead, unvan: ayar.imza1_unvan },
			{ ad: ayar.imza2_ad, unvan: ayar.imza2_unvan },
		],
	};
}

export async function deleteCertificate(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM sertifikalar WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
