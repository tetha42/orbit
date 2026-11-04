import { randomInt, randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, getSystemSettings } from '@/db/index';
import type { Certificate } from '@/db/schema';
import { notificationEvents, publishEventQuiet } from '@/db/events';

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function newVerificationCode(): string {
	const chars = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
	return `ORB-${new Date().getFullYear()}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export async function getCertificates(userId?: string): Promise<Certificate[]> {
	await ensurePostgresInit();
	let query = `
		SELECT s.id, s.verification_code AS "verificationCode", s.user_id AS "userId",
		       s.event_id AS "etkinlikId", s.title AS "baslik", s.issued_at AS "verilisTarihi",
		       s.pdf_url AS "pdfUrl", s.created_at AS "olusturma", s.category AS "kategori",
		       s.locale AS "dil", s.description AS "aciklama",
		       k.first_name || ' ' || k.last_name as "kullaniciAdSoyad",
		       k.handle as "ogrenciNo",
		       e.title as "etkinlikBaslik"
		FROM certificates s
		JOIN users k ON s.user_id = k.id
		LEFT JOIN events e ON s.event_id = e.id
	`;
	const params: unknown[] = [];
	if (userId) {
		query += ' WHERE s.user_id = $1';
		params.push(userId);
	}
	query += ' ORDER BY s.created_at DESC';

	const res = await getPgPool().query(query, params);
	return res.rows;
}

export async function getCertificateByCode(kod: string): Promise<Certificate | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`
		SELECT s.id, s.verification_code AS "verificationCode", s.user_id AS "userId",
		       s.event_id AS "etkinlikId", s.title AS "baslik", s.issued_at AS "verilisTarihi",
		       s.pdf_url AS "pdfUrl", s.created_at AS "olusturma", s.category AS "kategori",
		       s.locale AS "dil", s.description AS "aciklama",
		       k.first_name || ' ' || k.last_name as "kullaniciAdSoyad",
		       k.handle as "ogrenciNo",
		       k.department as "kullaniciBolum",
		       e.title as "etkinlikBaslik"
		FROM certificates s
		JOIN users k ON s.user_id = k.id
		LEFT JOIN events e ON s.event_id = e.id
		WHERE s.verification_code = $1
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
				`INSERT INTO certificates (id, verification_code, user_id, event_id, title, issued_at, pdf_url, created_at, category, locale, description)
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
		`SELECT y.user_id AS "userId",
		        EXISTS (SELECT 1 FROM certificates s WHERE s.user_id = y.user_id AND s.event_id = $1) AS "var"
		 FROM event_participants y
		 WHERE y.event_id = $1 AND y.status = 'attended'`,
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

export interface CommunityProfile {
	universite: string;
	kulupAdi: string;
	imzalar: { ad: string; unvan: string }[];
}

export async function getCommunityProfile(): Promise<CommunityProfile> {
	const setting = await getSystemSettings();
	let lead = '';
	if (!setting.imza1_ad) {
		const res = await getPgPool().query(
			"SELECT first_name || ' ' || last_name AS ad FROM users WHERE role_id = 'rol_admin' AND status = 'aktif' ORDER BY created_at ASC LIMIT 1"
		);
		lead = res.rows[0]?.ad ?? '';
	}
	return {
		universite: setting.universite,
		kulupAdi: setting.kulup_adi,
		imzalar: [
			{ ad: setting.imza1_ad || lead, unvan: setting.imza1_unvan },
			{ ad: setting.imza2_ad, unvan: setting.imza2_unvan },
		],
	};
}

export async function deleteCertificate(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM certificates WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
