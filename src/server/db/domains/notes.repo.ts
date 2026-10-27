import { ensurePostgresInit, getPgPool } from '@/db/index';
import type { UserNote, UserNoteFolder } from '@/db/schema';

export async function getUserNotes(userId: string): Promise<UserNote[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT * FROM kullanici_notlari 
		 WHERE userId = $1 
		 ORDER BY sabitliMi DESC, guncellenme DESC`,
		[userId]
	);
	return res.rows.map((r) => {
		let body = (r.icerik as string) || '';
		let folderId = (r.klasorId as string) || (r.renk as string) || 'quick';
		let isDeleted = Boolean(r.copteMi);

		if (typeof r.icerik === 'string' && r.icerik.startsWith('{') && r.icerik.includes('"body"')) {
			try {
				const obj = JSON.parse(r.icerik);
				if (obj.body !== undefined) {
					body = obj.body;
					if (obj.folderId) folderId = obj.folderId;
					if (obj.isDeleted !== undefined) isDeleted = Boolean(obj.isDeleted);
				}
			} catch {
				// Keep raw text
			}
		}

		return {
			id: r.id as string,
			userId: r.userId as string,
			baslik: (r.baslik as string) || 'Başlıksız Not',
			icerik: body,
			renk: (r.renk as string) || 'sari',
			sabitliMi: Boolean(r.sabitliMi),
			klasorId: folderId,
			copteMi: isDeleted,
			guncellenme: Number(r.guncellenme) || Date.now(),
			olusturma: Number(r.olusturma) || Date.now(),
		};
	});
}

export async function saveUserNote(params: {
	id?: string;
	userId: string;
	baslik: string;
	icerik: string;
	renk?: string;
	sabitliMi?: boolean;
	klasorId?: string;
	copteMi?: boolean;
}): Promise<UserNote> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const noteId = params.id || `not_${now}_${Math.random().toString(36).substring(2, 6)}`;
	const renk = params.renk || 'sari';
	const sabitliMi = params.sabitliMi ? 1 : 0;
	const klasorId = params.klasorId || params.renk || 'quick';
	const copteMi = params.copteMi ? 1 : 0;

	// IDOR Protection: verify note ownership if existing id is provided
	if (params.id) {
		const existing = await pool.query(
			'SELECT userId FROM kullanici_notlari WHERE id = $1',
			[params.id]
		);
		if (existing.rows.length > 0) {
			const owner = String(existing.rows[0].kullaniciid ?? existing.rows[0].userId);
			if (owner !== params.userId) {
				throw new Error('Yetkisiz işlem: Bu not başka bir kullanıcıya aittir.');
			}
		}
	}

	const res = await pool.query(
		`INSERT INTO user_notes (id, userId, baslik, icerik, renk, sabitliMi, klasorId, copteMi, guncellenme, olusturma)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		 ON CONFLICT (id) DO UPDATE SET 
		   baslik = EXCLUDED.baslik,
		   icerik = EXCLUDED.icerik,
		   renk = EXCLUDED.renk,
		   sabitliMi = EXCLUDED.sabitliMi,
		   klasorId = EXCLUDED.klasorId,
		   copteMi = EXCLUDED.copteMi,
		   guncellenme = EXCLUDED.guncellenme
		 WHERE user_notes.userId = EXCLUDED.userId
		 RETURNING id`,
		[noteId, params.userId, params.baslik, params.icerik, renk, sabitliMi, klasorId, copteMi, now]
	);

	if (params.id && (res.rowCount ?? 0) === 0) {
		throw new Error('Yetkisiz işlem: Bu not başka bir kullanıcıya aittir.');
	}

	return {
		id: noteId,
		userId: params.userId,
		baslik: params.baslik,
		icerik: params.icerik,
		renk,
		sabitliMi: Boolean(sabitliMi),
		klasorId,
		copteMi: Boolean(copteMi),
		guncellenme: now,
		olusturma: now,
	};
}

export async function deleteUserNote(id: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'DELETE FROM kullanici_notlari WHERE id = $1 AND userId = $2',
		[id, userId]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function emptyUserNotesTrash(userId: string): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'DELETE FROM kullanici_notlari WHERE userId = $1 AND copteMi = 1',
		[userId]
	);
	return res.rowCount ?? 0;
}

export async function getUserNoteFolders(userId: string): Promise<UserNoteFolder[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT * FROM kullanici_not_klasorleri WHERE userId = $1 ORDER BY sira ASC, olusturma ASC',
		[userId]
	);
	return res.rows.map((r) => ({
		id: r.id as string,
		userId: r.userId as string,
		ad: r.ad as string,
		renk: (r.renk as string) || undefined,
		sira: Number(r.sira) || 0,
		olusturma: Number(r.olusturma) || Date.now(),
	}));
}

export async function saveUserNoteFolder(params: {
	id?: string;
	userId: string;
	ad: string;
	renk?: string;
	sira?: number;
}): Promise<UserNoteFolder> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const folderId = params.id || `fld_${now}_${Math.random().toString(36).substring(2, 6)}`;
	const sira = params.sira ?? 0;
	const renk = params.renk || null;

	// IDOR Protection: verify folder ownership if existing id is provided
	if (params.id) {
		const existing = await pool.query(
			'SELECT userId FROM kullanici_not_klasorleri WHERE id = $1',
			[params.id]
		);
		if (existing.rows.length > 0) {
			const owner = String(existing.rows[0].kullaniciid ?? existing.rows[0].userId);
			if (owner !== params.userId) {
				throw new Error('Yetkisiz işlem: Bu klasör başka bir kullanıcıya aittir.');
			}
		}
	}

	const res = await pool.query(
		`INSERT INTO user_note_folders (id, userId, ad, renk, sira, olusturma)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (id) DO UPDATE SET
		   ad = EXCLUDED.ad,
		   renk = EXCLUDED.renk,
		   sira = EXCLUDED.sira
		 WHERE user_note_folders.userId = EXCLUDED.userId
		 RETURNING id`,
		[folderId, params.userId, params.ad, renk, sira, now]
	);

	if (params.id && (res.rowCount ?? 0) === 0) {
		throw new Error('Yetkisiz işlem: Bu klasör başka bir kullanıcıya aittir.');
	}

	return {
		id: folderId,
		userId: params.userId,
		ad: params.ad,
		renk: renk || undefined,
		sira,
		olusturma: now,
	};
}

export async function deleteUserNoteFolder(id: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	// Move any notes in this folder to 'quick'
	await getPgPool().query(
		`UPDATE kullanici_notlari SET klasorId = 'quick' WHERE userId = $1 AND klasorId = $2`,
		[userId, id]
	);
	const res = await getPgPool().query(
		'DELETE FROM kullanici_not_klasorleri WHERE id = $1 AND userId = $2',
		[id, userId]
	);
	return (res.rowCount ?? 0) > 0;
}
