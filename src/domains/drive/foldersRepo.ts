import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePostgresInit, getPgPool } from '@/db';
import { deleteStoredFile } from '@/db/repositories/files.repo';
import { CONFIG } from '@/server/config';
import type { DriveFolderRecord } from './types';

function mapFolder(row: Record<string, unknown>): DriveFolderRecord {
	return {
		id: String(row.id ?? ''),
		ownerId: String(row.ownerId ?? row.owner_id ?? ''),
		parentId: row.parentId || row.parent_id ? String(row.parentId ?? row.parent_id) : null,
		name: String(row.name ?? 'Untitled'),
		isTrashed: Boolean(row.isTrashed ?? row.is_trashed),
		trashedAt: row.trashedAt || row.trashed_at ? Number(row.trashedAt ?? row.trashed_at) : null,
		createdAt: Number(row.createdAt ?? row.created_at ?? 0),
		updatedAt: Number(row.updatedAt ?? row.updated_at ?? 0),
	};
}

export async function removePhysicalAndStoredFile(fileId: string): Promise<void> {
	const uploadDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), CONFIG.storage.uploadDir || './data/uploads');
	const filePath = path.resolve(/*turbopackIgnore: true*/ uploadDir, path.basename(fileId));
	if (filePath.startsWith(uploadDir)) {
		await fs.promises.unlink(filePath).catch(() => {});
	}
	await deleteStoredFile(fileId);
}

export async function listDriveFolders(
	ownerId: string,
	parentId: string | null,
	includeTrashed = false
): Promise<DriveFolderRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT * FROM drive_folders
		 WHERE owner_id = $1
		   AND ($2::text IS NULL AND parent_id IS NULL OR parent_id = $2)
		   AND is_trashed = $3
		 ORDER BY name ASC`,
		[ownerId, parentId, includeTrashed]
	);
	return res.rows.map((r) => mapFolder(r as Record<string, unknown>));
}

export async function listAllUserFolders(ownerId: string): Promise<DriveFolderRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT * FROM drive_folders WHERE owner_id = $1 AND is_trashed = FALSE ORDER BY name ASC`,
		[ownerId]
	);
	return res.rows.map((r) => mapFolder(r as Record<string, unknown>));
}

export async function createDriveFolder(params: {
	ownerId: string;
	parentId: string | null;
	name: string;
}): Promise<DriveFolderRecord> {
	await ensurePostgresInit();
	const id = `df_${crypto.randomUUID()}`;
	const now = Date.now();
	const res = await getPgPool().query(
		`INSERT INTO drive_folders (id, owner_id, parent_id, name, is_trashed, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, FALSE, $5, $5) RETURNING *`,
		[id, params.ownerId, params.parentId, params.name, now]
	);
	return mapFolder(res.rows[0] as Record<string, unknown>);
}

export async function updateDriveFolder(
	folderId: string,
	ownerId: string,
	patch: { name?: string; parentId?: string | null; isTrashed?: boolean }
): Promise<DriveFolderRecord | null> {
	await ensurePostgresInit();
	const now = Date.now();
	const pool = getPgPool();
	const existing = await pool.query(
		'SELECT * FROM drive_folders WHERE id = $1 AND owner_id = $2 LIMIT 1',
		[folderId, ownerId]
	);
	if (existing.rows.length === 0) return null;
	const cur = mapFolder(existing.rows[0] as Record<string, unknown>);
	const nextName = patch.name ?? cur.name;
	const nextParent = patch.parentId !== undefined ? patch.parentId : cur.parentId;
	const nextTrash = patch.isTrashed !== undefined ? patch.isTrashed : cur.isTrashed;
	const trashedAt = nextTrash ? cur.trashedAt || now : null;
	const res = await pool.query(
		`UPDATE drive_folders
		 SET name = $3, parent_id = $4, is_trashed = $5, trashed_at = $6, updated_at = $7
		 WHERE id = $1 AND owner_id = $2 RETURNING *`,
		[folderId, ownerId, nextName, nextParent, nextTrash, trashedAt, now]
	);
	return res.rows[0] ? mapFolder(res.rows[0] as Record<string, unknown>) : null;
}

export async function deleteDriveFolderPermanently(folderId: string, ownerId: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const itemsRes = await pool.query<{ fileId?: string; file_id?: string }>(
		'SELECT file_id AS "fileId" FROM drive_items WHERE folder_id = $1 AND owner_id = $2',
		[folderId, ownerId]
	);
	for (const row of itemsRes.rows) {
		const fId = String(row.fileId ?? row.file_id ?? '');
		if (fId) await removePhysicalAndStoredFile(fId);
	}
	const del = await pool.query('DELETE FROM drive_folders WHERE id = $1 AND owner_id = $2', [
		folderId,
		ownerId,
	]);
	return (del.rowCount ?? 0) > 0;
}
