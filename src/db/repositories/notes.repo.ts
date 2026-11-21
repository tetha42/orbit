import { unlink } from 'fs/promises';
import path from 'path';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { deleteStoredFilesByScope } from '@/db/repositories/files.repo';
import type { UserNote, UserNoteFolder } from '@/db/schema';
import { UPLOAD_NAME_RE, uploadDir } from '@/lib/uploads';

async function unlinkNoteFiles(files: Array<{ id: string; storedName: string }>): Promise<void> {
	if (files.length === 0) return;
	const rootDir = path.resolve(uploadDir());
	for (const file of files) {
		const name = file.storedName || file.id;
		if (!UPLOAD_NAME_RE.test(name)) continue;
		const resolved = path.resolve(rootDir, name);
		if (!resolved.startsWith(rootDir + path.sep)) continue;
		try {
			await unlink(resolved);
		} catch {
			// Ignore missing physical upload files when cleaning up deleted notes.
		}
	}
}

export async function getUserNotes(userId: string): Promise<UserNote[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, user_id AS "userId", title AS title, content AS content, color AS color,
		        is_pinned AS "isPinned", folder_id AS "folderId", is_trashed AS "isTrashed",
		        updated_at AS "updatedAt", created_at AS "createdAt"
		 FROM user_notes
		 WHERE user_id = $1 AND folder_id <> '__folder__'
		 ORDER BY is_pinned DESC, updated_at DESC`,
		[userId]
	);
	return res.rows.map((r) => {
		let body = (r.content as string) || '';
		let folderId = (r.folderId as string) || (r.color as string) || 'quick';
		let isDeleted = Boolean(r.isTrashed);

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
			title: (r.title as string) || 'Untitled Note',
			content: body,
			color: (r.color as string) || 'yellow',
			isPinned: Boolean(r.isPinned),
			folderId: folderId,
			isTrashed: isDeleted,
			updatedAt: Number(r.updatedAt) || Date.now(),
			createdAt: Number(r.createdAt) || Date.now(),
		};
	});
}

export async function saveUserNote(params: {
	id?: string;
	userId: string;
	title: string;
	content: string;
	color?: string;
	isPinned?: boolean;
	folderId?: string;
	isTrashed?: boolean;
}): Promise<UserNote> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const noteId = params.id || `not_${now}_${Math.random().toString(36).substring(2, 6)}`;
	const color = params.color || 'yellow';
	const isPinned = params.isPinned ? 1 : 0;
	const rawFolder = params.folderId || params.color || 'quick';
	const folderId = rawFolder === '__folder__' ? 'quick' : rawFolder;
	const isTrashed = params.isTrashed ? 1 : 0;

	// IDOR Protection: verify note ownership if existing id is provided
	if (params.id) {
		const existing = await pool.query(
			'SELECT user_id AS "userId" FROM user_notes WHERE id = $1',
			[params.id]
		);
		if (existing.rows.length > 0) {
			const owner = String(existing.rows[0].userId);
			if (owner !== params.userId) {
				throw new Error('Unauthorized: This note belongs to another user.');
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
		[noteId, params.userId, params.title, params.content, color, isPinned, folderId, isTrashed, now]
	);

	if (params.id && (res.rowCount ?? 0) === 0) {
		throw new Error('Unauthorized: This note belongs to another user.');
	}

	return {
		id: noteId,
		userId: params.userId,
		title: params.title,
		content: params.content,
		color,
		isPinned: Boolean(isPinned),
		folderId: folderId,
		isTrashed: Boolean(isTrashed),
		updatedAt: now,
		createdAt: now,
	};
}

async function deleteNotesAndFiles(userId: string, clause: string, params: unknown[]): Promise<number> {
	const { count, storedFiles } = await withTransaction(async (client) => {
		const res = await client.query<{ id: string }>(
			`DELETE FROM user_notes WHERE ${clause} RETURNING id`,
			params
		);
		const ids = res.rows.map((r) => String(r.id));
		if (ids.length === 0) return { count: 0, storedFiles: [] as Array<{ id: string; storedName: string }> };
		const stored = await deleteStoredFilesByScope(userId, 'notes', ids, client);
		return { count: ids.length, storedFiles: stored };
	});
	await unlinkNoteFiles(storedFiles);
	return count;
}

export async function deleteUserNote(id: string, userId: string): Promise<boolean> {
	return (await deleteNotesAndFiles(userId, `id = $1 AND user_id = $2 AND folder_id <> '__folder__'`, [id, userId])) > 0;
}

export async function emptyUserNotesTrash(userId: string): Promise<number> {
	return deleteNotesAndFiles(userId, `user_id = $1 AND is_trashed = 1 AND folder_id <> '__folder__'`, [userId]);
}

export async function getUserNoteFolders(userId: string): Promise<UserNoteFolder[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, user_id AS "userId", title AS name, color AS color, is_pinned AS "order", created_at AS "createdAt"
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
		createdAt: Number(r.createdAt) || Date.now(),
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
			const owner = String(existing.rows[0].userId);
			if (owner !== params.userId) {
				throw new Error('Unauthorized: This folder belongs to another user.');
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
		throw new Error('Unauthorized: This folder belongs to another user.');
	}

	return {
		id: folderId,
		userId: params.userId,
		name: params.name,
		color: color || undefined,
		order,
		createdAt: now,
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
