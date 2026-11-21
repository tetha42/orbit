import type { PoolClient } from 'pg';
import { ensureColumnExists } from '../schema/init/schemaDriftHelpers';
import {
	ADMIN_ROLE_ID,
	ALUMNI_ROLE_ID,
	ALL_PERMISSIONS,
	MEMBER_ROLE_ID,
	MANAGEMENT_ROLE_ID,
	type Permissions,
} from '@/core/permissions';
import {
	DEFAULT_ALUMNI_PERMISSIONS,
	DEFAULT_MANAGEMENT_PERMISSIONS,
	DEFAULT_MEMBER_PERMISSIONS,
	DEFAULT_ROLE_KEY,
	cleanPermissions,
	parsePermissionsJson,
} from './types';

export async function insertRole(
	client: PoolClient,
	id: string,
	name: string,
	color: string,
	description: string,
	require2fa: boolean,
	now: number,
	permissions: Permissions
): Promise<void> {
	const perms = cleanPermissions(permissions);
	await client.query(
		`INSERT INTO roles (id, name, color, description, permissions, is_system, require_2fa, created_at)
		 VALUES ($1, $2, $3, $4, $5::jsonb, 0, $6, $7)
		 ON CONFLICT (id) DO NOTHING`,
		[id, name, color, description, JSON.stringify(perms), require2fa ? 1 : 0, now]
	);
}

async function ensureSeedRole(
	client: PoolClient,
	id: string,
	name: string,
	color: string,
	description: string,
	require2fa: boolean,
	now: number,
	permissions: Permissions
): Promise<string> {
	const existing = await client.query(
		'SELECT id, permissions FROM roles WHERE id = $1 OR lower(name) = lower($2) LIMIT 1',
		[id, name]
	);
	if (existing.rows[0]?.id) {
		const existingId = String(existing.rows[0].id);
		const currentPerms = parsePermissionsJson(existing.rows[0].permissions);
		const merged: Permissions = { ...cleanPermissions(permissions), ...currentPerms };
		await client.query('UPDATE roles SET permissions = $2::jsonb WHERE id = $1', [
			existingId,
			JSON.stringify(merged),
		]);
		return existingId;
	}
	await insertRole(client, id, name, color, description, require2fa, now, permissions);
	return id;
}

/** Called from ensurePostgresInit with its raw (lower-case) client, inside its transaction. */
export async function ensureRoleSchema(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS roles (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			color TEXT NOT NULL DEFAULT '#0a84ff',
			description TEXT NOT NULL DEFAULT '',
			permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
			is_system INTEGER NOT NULL DEFAULT 0,
			require_2fa INTEGER NOT NULL DEFAULT 0,
			allow_mobile_access BOOLEAN NOT NULL DEFAULT TRUE,
			allow_desktop_access BOOLEAN NOT NULL DEFAULT TRUE,
			desktop_auth_policy TEXT NOT NULL DEFAULT 'standard'
				CHECK (desktop_auth_policy IN ('standard', 'mobile_preferred', 'mobile_required')),
			created_at BIGINT NOT NULL
		);
		CREATE UNIQUE INDEX IF NOT EXISTS roles_name_ci ON roles (lower(name));
	`);
	await ensureColumnExists(client, 'roles', 'allow_mobile_access', 'BOOLEAN NOT NULL DEFAULT TRUE');
	await ensureColumnExists(client, 'roles', 'allow_desktop_access', 'BOOLEAN NOT NULL DEFAULT TRUE');
	await ensureColumnExists(
		client,
		'roles',
		'desktop_auth_policy',
		"TEXT NOT NULL DEFAULT 'standard' CHECK (desktop_auth_policy IN ('standard', 'mobile_preferred', 'mobile_required'))"
	);
	const now = Date.now();
	await ensureSeedRole(
		client,
		ADMIN_ROLE_ID,
		'Admin',
		'#ff453a',
		'Manages all applications. Cannot be changed.',
		true,
		now,
		ALL_PERMISSIONS
	);
	await client.query(`UPDATE roles SET is_system = 1, require_2fa = 1, permissions = $2::jsonb WHERE id = $1`, [
		ADMIN_ROLE_ID,
		JSON.stringify(ALL_PERMISSIONS),
	]);

	await ensureSeedRole(
		client,
		MANAGEMENT_ROLE_ID,
		'Management Board',
		'#ff9f0a',
		'Daily operations of the community',
		true,
		now + 1,
		DEFAULT_MANAGEMENT_PERMISSIONS
	);
	const memberRoleId = await ensureSeedRole(
		client,
		MEMBER_ROLE_ID,
		'Member',
		'#0a84ff',
		'Active community member',
		false,
		now + 2,
		DEFAULT_MEMBER_PERMISSIONS
	);
	const alumniRoleId = await ensureSeedRole(
		client,
		ALUMNI_ROLE_ID,
		'Alumni',
		'#64d2ff',
		'Alumni community member (read-only access).',
		false,
		now + 3,
		DEFAULT_ALUMNI_PERMISSIONS
	);

	await client.query(
		`INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
		[DEFAULT_ROLE_KEY, memberRoleId, now]
	);

	// Heal any admin account marked 'alumni' back to 'active', and ensure non-admin 'alumni' members hold the Alumni role.
	await client.query(`UPDATE users SET status = 'active' WHERE role_id = $1 AND status = 'alumni'`, [ADMIN_ROLE_ID]);
	await client.query(
		`UPDATE users SET role_id = $1 WHERE status = 'alumni' AND (role_id IS NULL OR role_id <> $1)`,
		[alumniRoleId]
	);
}
