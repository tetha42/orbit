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
		       s.event_id AS "eventId", s.title AS "title", s.issued_at AS "issuanceDate",
		       s.pdf_url AS "pdfUrl", s.created_at AS "creation", s.category AS "category",
		       s.locale AS "language", s.description AS "description",
		       k.first_name || ' ' || k.last_name as "userNameSurname",
		       k.handle as "studentNo",
		       e.title as "eventTitle"
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

export async function getCertificateByCode(code: string): Promise<Certificate | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`
		SELECT s.id, s.verification_code AS "verificationCode", s.user_id AS "userId",
		       s.event_id AS "eventId", s.title AS "title", s.issued_at AS "issuanceDate",
		       s.pdf_url AS "pdfUrl", s.created_at AS "creation", s.category AS "category",
		       s.locale AS "language", s.description AS "description",
		       k.first_name || ' ' || k.last_name as "userNameSurname",
		       k.handle as "studentNo",
		       k.department as "userDepartment",
		       e.title as "eventTitle"
		FROM certificates s
		JOIN users k ON s.user_id = k.id
		LEFT JOIN events e ON s.event_id = e.id
		WHERE s.verification_code = $1
	`,
		[code]
	);
	return (res.rows[0] as Certificate | undefined) ?? null;
}

export async function createCertificate(params: {
	userId: string;
	title: string;
	eventId?: string;
	pdfUrl?: string;
	category?: string;
	language?: string;
	description?: string;
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
					params.eventId || null,
					params.title,
					now,
					params.pdfUrl || null,
					params.category || 'achievement',
					params.language || 'tr',
					params.description || null,
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
	eventId: string,
	title: string,
	options?: { category?: string; language?: string; description?: string }
): Promise<{ given: number; alreadyVar: number }> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT y.user_id AS "userId",
		        EXISTS (SELECT 1 FROM certificates s WHERE s.user_id = y.user_id AND s.event_id = $1) AS "var"
		 FROM event_participants y
		 WHERE y.event_id = $1 AND y.status = 'attended'`,
		[eventId]
	);
	let given = 0;
	let alreadyVar = 0;
	for (const row of res.rows) {
		if (row.var) {
			alreadyVar += 1;
			continue;
		}
		await createCertificate({
			userId: row.userId,
			eventId,
			title,
			category: options?.category,
			language: options?.language,
			description: options?.description,
		});
		given += 1;
	}
	return { given, alreadyVar };
}

export interface CommunityProfile {
	university: string;
	clubName: string;
	signatures: { name: string; rank: string }[];
}

export async function getCommunityProfile(): Promise<CommunityProfile> {
	const setting = await getSystemSettings();
	let lead = '';
	if (!setting.signature1_Name) {
		const res = await getPgPool().query(
			"SELECT first_name || ' ' || last_name AS name FROM users WHERE role_id = 'rol_admin' AND status = 'aktif' ORDER BY created_at ASC LIMIT 1"
		);
		lead = res.rows[0]?.name ?? '';
	}
	return {
		university: setting.university,
		clubName: setting.club_Name,
		signatures: [
			{ name: setting.signature1_Name || lead, rank: setting.signature1_Rank },
			{ name: setting.signature2_Name, rank: setting.signature2_Rank },
		],
	};
}

export async function deleteCertificate(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM certificates WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
