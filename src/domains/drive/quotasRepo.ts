import crypto from 'node:crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import { DEFAULT_GLOBAL_QUOTA_BYTES } from '@/server/storage/quota';
import type {
	DriveSharePermission,
	MemberStorageOverviewRow,
	StorageQuotaRecord,
	StorageQuotaScope,
} from './types';

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

export async function upsertStorageQuota(params: {
	scopeType: StorageQuotaScope;
	scopeId: string;
	quotaBytes: number;
	updatedBy: string;
}): Promise<StorageQuotaRecord> {
	await ensurePostgresInit();
	const id = `sq_${params.scopeType}_${params.scopeId || 'global'}`;
	const now = Date.now();
	const normalizedScopeId = params.scopeType === 'global' ? '' : params.scopeId.trim();
	const res = await getPgPool().query(
		`INSERT INTO storage_quotas (id, scope_type, scope_id, quota_bytes, updated_by, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (scope_type, scope_id)
		 DO UPDATE SET quota_bytes = EXCLUDED.quota_bytes,
		               updated_by = EXCLUDED.updated_by,
		               updated_at = EXCLUDED.updated_at
		 RETURNING *`,
		[id, params.scopeType, normalizedScopeId, params.quotaBytes, params.updatedBy, now]
	);
	const row = res.rows[0] as Record<string, unknown>;
	return {
		id: String(row.id ?? id),
		scopeType: (row.scopeType ?? row.scope_type ?? params.scopeType) as StorageQuotaScope,
		scopeId: String(row.scopeId ?? row.scope_id ?? normalizedScopeId),
		quotaBytes: Number(row.quotaBytes ?? row.quota_bytes ?? params.quotaBytes),
		updatedBy: row.updatedBy || row.updated_by ? String(row.updatedBy ?? row.updated_by) : null,
		updatedAt: Number(row.updatedAt ?? row.updated_at ?? now),
	};
}

export async function removeStorageQuotaOverride(
	scopeType: StorageQuotaScope,
	scopeId: string
): Promise<boolean> {
	await ensurePostgresInit();
	const normalizedScopeId = scopeType === 'global' ? '' : scopeId.trim();
	const res = await getPgPool().query(
		'DELETE FROM storage_quotas WHERE scope_type = $1 AND scope_id = $2',
		[scopeType, normalizedScopeId]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function getOrganizationStorageOverview(): Promise<{
	globalQuotaBytes: number;
	organizationUsedBytes: number;
	roleQuotas: Array<{ roleId: string; roleName: string; quotaBytes: number | null }>;
	members: MemberStorageOverviewRow[];
}> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const [quotasRes, rolesRes, usersRes, usageRes] = await Promise.all([
		pool.query('SELECT scope_type AS "scopeType", scope_id AS "scopeId", quota_bytes AS "quotaBytes" FROM storage_quotas'),
		pool.query('SELECT id, name FROM roles ORDER BY name ASC'),
		pool.query(
			`SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName",
			        u.email, COALESCE(u.role_id, 'member') AS "roleId",
			        COALESCE(r.name, u.role_id, 'Member') AS "roleName"
			 FROM users u
			 LEFT JOIN roles r ON r.id = u.role_id
			 ORDER BY u.first_name ASC, u.email ASC`
		),
		pool.query(
			`SELECT uploaded_by AS "userId",
			        COALESCE(source_app, 'general') AS "sourceApp",
			        COALESCE(SUM(size_bytes), 0)::bigint AS "totalBytes"
			 FROM files
			 GROUP BY uploaded_by, COALESCE(source_app, 'general')`
		),
	]);

	let globalQuotaBytes = DEFAULT_GLOBAL_QUOTA_BYTES;
	const roleQuotaMap = new Map<string, number>();
	const userQuotaMap = new Map<string, number>();

	for (const r of quotasRes.rows as Array<Record<string, unknown>>) {
		const st = String(r.scopeType ?? '');
		const sid = String(r.scopeId ?? '');
		const qb = Number(r.quotaBytes ?? DEFAULT_GLOBAL_QUOTA_BYTES);
		if (st === 'global') globalQuotaBytes = qb;
		else if (st === 'role') roleQuotaMap.set(sid, qb);
		else if (st === 'user') userQuotaMap.set(sid, qb);
	}

	const usageByUser = new Map<
		string,
		{ total: number; drive: number; notes: number; chat: number; other: number }
	>();
	let organizationUsedBytes = 0;

	for (const r of usageRes.rows as Array<Record<string, unknown>>) {
		const uid = String(r.userId ?? '');
		if (!uid) continue;
		const app = String(r.sourceApp ?? 'general');
		const bytes = Number(r.totalBytes ?? 0);
		organizationUsedBytes += bytes;
		const entry = usageByUser.get(uid) || { total: 0, drive: 0, notes: 0, chat: 0, other: 0 };
		entry.total += bytes;
		if (app === 'drive') entry.drive += bytes;
		else if (app === 'notes') entry.notes += bytes;
		else if (app === 'chat') entry.chat += bytes;
		else entry.other += bytes;
		usageByUser.set(uid, entry);
	}

	const roleQuotas = (rolesRes.rows as Array<Record<string, unknown>>).map((r) => {
		const roleId = String(r.id ?? '');
		return {
			roleId,
			roleName: String(r.name ?? roleId),
			quotaBytes: roleQuotaMap.has(roleId) ? roleQuotaMap.get(roleId)! : null,
		};
	});

	const members: MemberStorageOverviewRow[] = (usersRes.rows as Array<Record<string, unknown>>).map(
		(u) => {
			const userId = String(u.id ?? '');
			const roleId = String(u.roleId ?? 'member');
			const customQuota = userQuotaMap.has(userId) ? userQuotaMap.get(userId)! : null;
			const roleQuota = roleQuotaMap.has(roleId) ? roleQuotaMap.get(roleId)! : null;
			const effectiveQuotaBytes =
				customQuota !== null ? customQuota : roleQuota !== null ? roleQuota : globalQuotaBytes;
			const usage = usageByUser.get(userId) || { total: 0, drive: 0, notes: 0, chat: 0, other: 0 };
			const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
			return {
				userId,
				name: fullName || String(u.email ?? 'Member'),
				email: String(u.email ?? ''),
				roleId,
				roleName: String(u.roleName ?? roleId),
				usedBytes: usage.total,
				effectiveQuotaBytes,
				customQuotaBytes: customQuota,
				byApp: {
					drive: usage.drive,
					notes: usage.notes,
					chat: usage.chat,
					other: usage.other,
				},
			};
		}
	);

	return {
		globalQuotaBytes,
		organizationUsedBytes,
		roleQuotas,
		members,
	};
}
