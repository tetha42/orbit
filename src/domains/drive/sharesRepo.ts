import crypto from 'node:crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import type { DriveSharePermission, DriveShareRecord } from './types';

export async function canUserReadDriveFile(
	fileId: string,
	userId: string,
	roleId: string
): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT 1
		 FROM drive_items di
		 LEFT JOIN drive_shares ds
		   ON (ds.item_id = di.id OR (ds.folder_id IS NOT NULL AND ds.folder_id = di.folder_id))
		 WHERE di.file_id = $1
		   AND di.is_trashed = FALSE
		   AND (di.owner_id = $2 OR ds.target_user_id = $2 OR ds.target_role_id = $3)
		 LIMIT 1`,
		[fileId, userId, roleId]
	);
	return res.rows.length > 0;
}

export async function listDriveShares(
	ownerId: string,
	itemId?: string | null,
	folderId?: string | null
): Promise<DriveShareRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ds.*,
		        COALESCE(u.first_name || ' ' || u.last_name, u.email) AS "targetUserName",
		        r.name AS "targetRoleName"
		 FROM drive_shares ds
		 LEFT JOIN users u ON u.id = ds.target_user_id
		 LEFT JOIN roles r ON r.id = ds.target_role_id
		 WHERE ds.owner_id = $1
		   AND ($2::text IS NULL OR ds.item_id = $2)
		   AND ($3::text IS NULL OR ds.folder_id = $3)
		 ORDER BY ds.created_at DESC`,
		[ownerId, itemId || null, folderId || null]
	);
	return res.rows.map((r) => {
		const row = r as Record<string, unknown>;
		return {
			id: String(row.id ?? ''),
			itemId: row.itemId || row.item_id ? String(row.itemId ?? row.item_id) : null,
			folderId: row.folderId || row.folder_id ? String(row.folderId ?? row.folder_id) : null,
			ownerId: String(row.ownerId ?? row.owner_id ?? ''),
			targetUserId:
				row.targetUserId || row.target_user_id ? String(row.targetUserId ?? row.target_user_id) : null,
			targetUserName: row.targetUserName ? String(row.targetUserName) : null,
			targetRoleId:
				row.targetRoleId || row.target_role_id ? String(row.targetRoleId ?? row.target_role_id) : null,
			targetRoleName: row.targetRoleName ? String(row.targetRoleName) : null,
			permission: (row.permission as DriveSharePermission) || 'view',
			createdAt: Number(row.createdAt ?? row.created_at ?? 0),
		};
	});
}

export async function addDriveShare(params: {
	ownerId: string;
	itemId: string | null;
	folderId: string | null;
	targetUserId: string | null;
	targetRoleId: string | null;
	permission: DriveSharePermission;
}): Promise<string> {
	await ensurePostgresInit();
	const id = `dsh_${crypto.randomUUID()}`;
	const now = Date.now();
	await getPgPool().query(
		`INSERT INTO drive_shares (id, item_id, folder_id, owner_id, target_user_id, target_role_id, permission, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		[
			id,
			params.itemId,
			params.folderId,
			params.ownerId,
			params.targetUserId,
			params.targetRoleId,
			params.permission,
			now,
		]
	);
	return id;
}

export async function deleteDriveShare(shareId: string, ownerId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'DELETE FROM drive_shares WHERE id = $1 AND owner_id = $2',
		[shareId, ownerId]
	);
	return (res.rowCount ?? 0) > 0;
}
