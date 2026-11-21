import type { PoolClient } from 'pg';
import { ensureIndexesSafely, type SchemaIndexDef } from './safeIndexes';

const DRIVE_INDEXES: readonly SchemaIndexDef[] = [
	{
		name: 'idx_drive_folders_owner_parent',
		table: 'drive_folders',
		definition: 'ON drive_folders (owner_id, parent_id, is_trashed)',
	},
	{
		name: 'idx_drive_items_owner_folder',
		table: 'drive_items',
		definition: 'ON drive_items (owner_id, folder_id, is_trashed)',
	},
	{
		name: 'idx_drive_items_file',
		table: 'drive_items',
		definition: 'ON drive_items (file_id)',
	},
	{
		name: 'idx_drive_shares_target_user',
		table: 'drive_shares',
		definition: 'ON drive_shares (target_user_id)',
	},
	{
		name: 'idx_drive_shares_target_role',
		table: 'drive_shares',
		definition: 'ON drive_shares (target_role_id)',
	},
	{
		name: 'idx_drive_shares_item',
		table: 'drive_shares',
		definition: 'ON drive_shares (item_id) WHERE item_id IS NOT NULL',
	},
	{
		name: 'idx_drive_shares_folder',
		table: 'drive_shares',
		definition: 'ON drive_shares (folder_id) WHERE folder_id IS NOT NULL',
	},
];

export async function createDriveTables(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS drive_folders (
			id TEXT PRIMARY KEY,
			owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			parent_id TEXT REFERENCES drive_folders(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
			trashed_at BIGINT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS drive_items (
			id TEXT PRIMARY KEY,
			owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			folder_id TEXT REFERENCES drive_folders(id) ON DELETE SET NULL,
			file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
			display_name TEXT NOT NULL,
			mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
			size_bytes BIGINT NOT NULL DEFAULT 0,
			is_starred BOOLEAN NOT NULL DEFAULT FALSE,
			is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
			trashed_at BIGINT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS drive_shares (
			id TEXT PRIMARY KEY,
			item_id TEXT REFERENCES drive_items(id) ON DELETE CASCADE,
			folder_id TEXT REFERENCES drive_folders(id) ON DELETE CASCADE,
			owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
			target_role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
			permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS storage_quotas (
			id TEXT PRIMARY KEY,
			scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'role', 'user')),
			scope_id TEXT NOT NULL DEFAULT '',
			quota_bytes BIGINT NOT NULL,
			updated_by TEXT,
			updated_at BIGINT NOT NULL,
			UNIQUE (scope_type, scope_id)
		);
	`);

	await ensureIndexesSafely(client, DRIVE_INDEXES);
}
