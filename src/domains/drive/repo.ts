import { ensurePostgresInit, getPgPool } from '@/db';
import { removePhysicalAndStoredFile } from './foldersRepo';
import type {
	DriveItemRecord,
	DriveSharePermission,
	DriveViewMode,
} from './types';

export {
	createDriveFolder,
	deleteDriveFolderPermanently,
	listAllUserFolders,
	listDriveFolders,
	removePhysicalAndStoredFile,
	updateDriveFolder,
} from './foldersRepo';

function mapItem(row: Record<string, unknown>): DriveItemRecord {
	return {
		id: String(row.id ?? ''),
		ownerId: String(row.ownerId ?? row.owner_id ?? ''),
		ownerName: row.ownerName ? String(row.ownerName) : undefined,
		folderId: row.folderId || row.folder_id ? String(row.folderId ?? row.folder_id) : null,
		fileId: String(row.fileId ?? row.file_id ?? ''),
		displayName: String(row.displayName ?? row.display_name ?? 'file'),
		mimeType: String(row.mimeType ?? row.mime_type ?? 'application/octet-stream'),
		sizeBytes: Number(row.sizeBytes ?? row.size_bytes ?? 0),
		isStarred: Boolean(row.isStarred ?? row.is_starred),
		isTrashed: Boolean(row.isTrashed ?? row.is_trashed),
		trashedAt: row.trashedAt || row.trashed_at ? Number(row.trashedAt ?? row.trashed_at) : null,
		createdAt: Number(row.createdAt ?? row.created_at ?? 0),
		updatedAt: Number(row.updatedAt ?? row.updated_at ?? 0),
		sharedPermission: row.sharedPermission
			? (String(row.sharedPermission) as DriveSharePermission)
			: undefined,
	};
}

export async function listDriveItems(params: {
	userId: string;
	roleId: string;
	view: DriveViewMode;
	folderId: string | null;
	q: string;
}): Promise<DriveItemRecord[]> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const qTrim = params.q.trim();

	if (params.view === 'shared') {
		const res = await pool.query(
			`SELECT DISTINCT ON (di.id) di.*,
			        COALESCE(u.first_name || ' ' || u.last_name, u.email, 'Member') AS "ownerName",
			        ds.permission AS "sharedPermission"
			 FROM drive_items di
			 JOIN drive_shares ds ON (
			   ds.item_id = di.id OR (ds.folder_id IS NOT NULL AND ds.folder_id = di.folder_id)
			 )
			 LEFT JOIN users u ON u.id = di.owner_id
			 WHERE di.is_trashed = FALSE
			   AND di.owner_id <> $1
			   AND (ds.target_user_id = $1 OR ds.target_role_id = $2)
			   AND ($3 = '' OR di.display_name ILIKE '%' || $3 || '%')
			 ORDER BY di.id, di.updated_at DESC`,
			[params.userId, params.roleId, qTrim]
		);
		return res.rows.map((r) => mapItem(r as Record<string, unknown>));
	}

	if (params.view === 'starred' || params.view === 'recent' || params.view === 'trash') {
		const cond =
			params.view === 'starred'
				? 'is_trashed = FALSE AND is_starred = TRUE'
				: params.view === 'trash'
				? 'is_trashed = TRUE'
				: 'is_trashed = FALSE';
		const res = await pool.query(
			`SELECT * FROM drive_items
			 WHERE owner_id = $1 AND ${cond}
			   AND ($2 = '' OR display_name ILIKE '%' || $2 || '%')
			 ORDER BY updated_at DESC LIMIT 100`,
			[params.userId, qTrim]
		);
		return res.rows.map((r) => mapItem(r as Record<string, unknown>));
	}

	const res = await pool.query(
		`SELECT * FROM drive_items
		 WHERE owner_id = $1 AND is_trashed = FALSE
		   AND ($3 <> '' OR ($2::text IS NULL AND folder_id IS NULL) OR folder_id = $2)
		   AND ($3 = '' OR display_name ILIKE '%' || $3 || '%')
		 ORDER BY display_name ASC`,
		[params.userId, params.folderId, qTrim]
	);
	return res.rows.map((r) => mapItem(r as Record<string, unknown>));
}

export async function updateDriveItem(
	itemId: string,
	userId: string,
	roleId: string,
	patch: { displayName?: string; folderId?: string | null; isStarred?: boolean; isTrashed?: boolean }
): Promise<DriveItemRecord | null> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const existing = await pool.query('SELECT * FROM drive_items WHERE id = $1 LIMIT 1', [itemId]);
	if (existing.rows.length === 0) return null;
	const cur = mapItem(existing.rows[0] as Record<string, unknown>);
	if (cur.ownerId !== userId) {
		const shareRes = await pool.query(
			`SELECT 1 FROM drive_shares
			 WHERE (item_id = $1 OR (folder_id IS NOT NULL AND folder_id = $2))
			   AND (target_user_id = $3 OR target_role_id = $4)
			   AND permission = 'edit' LIMIT 1`,
			[cur.id, cur.folderId, userId, roleId]
		);
		if (shareRes.rows.length === 0) return null;
	}

	const now = Date.now();
	const nextName = patch.displayName ?? cur.displayName;
	const nextFolder = patch.folderId !== undefined ? patch.folderId : cur.folderId;
	const nextStar = patch.isStarred !== undefined ? patch.isStarred : cur.isStarred;
	const nextTrash = patch.isTrashed !== undefined ? patch.isTrashed : cur.isTrashed;
	const trashedAt = nextTrash ? cur.trashedAt || now : null;

	const res = await pool.query(
		`UPDATE drive_items
		 SET display_name = $2, folder_id = $3, is_starred = $4, is_trashed = $5,
		     trashed_at = $6, updated_at = $7
		 WHERE id = $1 RETURNING *`,
		[itemId, nextName, nextFolder, nextStar, nextTrash, trashedAt, now]
	);
	return res.rows[0] ? mapItem(res.rows[0] as Record<string, unknown>) : null;
}

export async function deleteDriveItemPermanently(itemId: string, ownerId: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query('SELECT * FROM drive_items WHERE id = $1 AND owner_id = $2 LIMIT 1', [
		itemId,
		ownerId,
	]);
	if (res.rows.length === 0) return false;
	const cur = mapItem(res.rows[0] as Record<string, unknown>);
	await pool.query('DELETE FROM drive_items WHERE id = $1 AND owner_id = $2', [itemId, ownerId]);
	await removePhysicalAndStoredFile(cur.fileId);
	return true;
}
