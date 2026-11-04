import { ensurePostgresInit, getPgPool } from '@/db/index';
import type { UserNote, UserNoteFolder } from '@/db/schema';

export async function getUserNotes(userId: string): Promise<UserNote[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, user_id AS "userId", title AS title, content AS content, color AS color,
		        is_pinned AS "pinnedMi", folder_id AS "folderId", is_trashed AS "trashedMi",
		        updated_at AS update, created_at AS creation
		 FROM user_notes
		 WHERE user_id = $1 AND folder_id <> '__folder__'
		 ORDER BY is_pinned DESC, updated_at DESC`,
		[userId]
	);
	return res.rows.map((r) => {
		let body = (r.content as string) || '';
		let folderId = (r.folderId as string) || (r.color as string) || 'quick';
		let isDeleted = Boolean(r.trashedMi);

		if (typeof r.content === 'string' && r.content.startsWith('{') && r.content.includes('"body"')) {
			try {
				const obj = JSON.parse(r.content);
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
			title: (r.title as string) || 'Başlıksız Not',
			content: body,
			color: (r.color as string) || 'sari',
			pinnedMi: Boolean(r.pinnedMi),
			folderId: folderId,
			trashedMi: isDeleted,
			update: Number(r.update) || Date.now(),
			creation: Number(r.creation) || Date.now(),
		};
	});
}

export async function saveUserNote(params: {
	id?: string;
	userId: string;
	title: string;
	content: string;
	color?: string;
	pinnedMi?: boolean;
	folderId?: string;
	trashedMi?: boolean;
}): Promise<UserNote> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const noteId = params.id || `not_${now}_${Math.random().toString(36).substring(2, 6)}`;
	const color = params.color || 'sari';
	const pinnedMi = params.pinnedMi ? 1 : 0;
	const rawFolder = params.folderId || params.color || 'quick';
	const folderId = rawFolder === '__folder__' ? 'quick' : rawFolder;
	const trashedMi = params.trashedMi ? 1 : 0;

	// IDOR Protection: verify note ownership if existing id is provided
	if (params.id) {
		const existing = await pool.query(
			'SELECT user_id AS "userId" FROM user_notes WHERE id = $1',
			[params.id]
		);
		if (existing.rows.length > 0) {
			const owner = String(existing.rows[0].userId ?? existing.rows[0].userid ?? existing.rows[0].userId);
			if (owner !== params.userId) {
				throw new Error('Yetkisiz işlem: Bu not başka bir kullanıcıya aittir.');
			}
		}
	}

	const res = await pool.query(
		`INSERT INTO user_notes (id, user_id, title, content, color, is_pinned, folder_id, is_trashed, updated_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		 ON CONFLICT (id) DO UPDATE SET 
		   title = EXCLUDED.title,
		   content = EXCLUDED.content,
		   color = EXCLUDED.color,
		   is_pinned = EXCLUDED.is_pinned,
		   folder_id = EXCLUDED.folder_id,
		   is_trashed = EXCLUDED.is_trashed,
		   updated_at = EXCLUDED.updated_at
		 WHERE user_notes.user_id = EXCLUDED.user_id
		 RETURNING id`,
		[noteId, params.userId, params.title, params.content, color, pinnedMi, folderId, trashedMi, now]
	);

	if (params.id && (res.rowCount ?? 0) === 0) {
		throw new Error('Yetkisiz işlem: Bu not başka bir kullanıcıya aittir.');
	}

	return {
		id: noteId,
		userId: params.userId,
		title: params.title,
		content: params.content,
		color,
		pinnedMi: Boolean(pinnedMi),
		folderId: folderId,
		trashedMi: Boolean(trashedMi),
		update: now,
		creation: now,
	};
}

export async function deleteUserNote(id: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`DELETE FROM user_notes WHERE id = $1 AND user_id = $2 AND folder_id <> '__folder__'`,
		[id, userId]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function emptyUserNotesTrash(userId: string): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`DELETE FROM user_notes WHERE user_id = $1 AND is_trashed = 1 AND folder_id <> '__folder__'`,
		[userId]
	);
	return res.rowCount ?? 0;
}

export async function getUserNoteFolders(userId: string): Promise<UserNoteFolder[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, user_id AS "userId", title AS name, color AS color, is_pinned AS "order", created_at AS creation
		 FROM user_notes
		 WHERE user_id = $1 AND folder_id = '__folder__'
		 ORDER BY is_pinned ASC, created_at ASC`,
		[userId]
	);
	return res.rows.map((r) => ({
		id: r.id as string,
		userId: r.userId as string,
		name: r.name as string,
		color: (r.color as string) || undefined,
		order: Number(r.order) || 0,
		creation: Number(r.creation) || Date.now(),
	}));
}

export async function saveUserNoteFolder(params: {
	id?: string;
	userId: string;
	name: string;
	color?: string;
	order?: number;
}): Promise<UserNoteFolder> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const folderId = params.id || `fld_${now}_${Math.random().toString(36).substring(2, 6)}`;
	const order = params.order ?? 0;
	const color = params.color || null;

	// IDOR Protection: verify folder ownership if existing id is provided
	if (params.id) {
		const existing = await pool.query(
			`SELECT user_id AS "userId" FROM user_notes WHERE id = $1`,
			[params.id]
		);
		if (existing.rows.length > 0) {
			const owner = String(existing.rows[0].userId ?? existing.rows[0].userid ?? existing.rows[0].userId);
			if (owner !== params.userId) {
				throw new Error('Yetkisiz işlem: Bu klasör başka bir kullanıcıya aittir.');
			}
		}
	}

	const res = await pool.query(
		`INSERT INTO user_notes (id, user_id, title, content, color, is_pinned, folder_id, is_trashed, updated_at, created_at)
		 VALUES ($1, $2, $3, '', $4, $5, '__folder__', 0, $6, $6)
		 ON CONFLICT (id) DO UPDATE SET
		   title = EXCLUDED.title,
		   color = EXCLUDED.color,
		   is_pinned = EXCLUDED.is_pinned,
		   updated_at = EXCLUDED.updated_at
		 WHERE user_notes.user_id = EXCLUDED.user_id AND user_notes.folder_id = '__folder__'
		 RETURNING id`,
		[folderId, params.userId, params.name, color, order, now]
	);

	if (params.id && (res.rowCount ?? 0) === 0) {
		throw new Error('Yetkisiz işlem: Bu klasör başka bir kullanıcıya aittir.');
	}

	return {
		id: folderId,
		userId: params.userId,
		name: params.name,
		color: color || undefined,
		order,
		creation: now,
	};
}

export async function deleteUserNoteFolder(id: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	// Move any notes in this folder to 'quick'
	await getPgPool().query(
		`UPDATE user_notes SET folder_id = 'quick' WHERE user_id = $1 AND folder_id = $2`,
		[userId, id]
	);
	const res = await getPgPool().query(
		`DELETE FROM user_notes WHERE id = $1 AND user_id = $2 AND folder_id = '__folder__'`,
		[id, userId]
	);
	return (res.rowCount ?? 0) > 0;
}
