import type { PoolClient } from 'pg';
import { ensureIndexesSafely, type SchemaIndexDef } from './safeIndexes';

const DEVICE_SESSION_INDEXES: readonly SchemaIndexDef[] = [
	{
		name: 'idx_user_sessions_user_device',
		table: 'user_sessions',
		definition: 'ON user_sessions (user_id, device_class, revoked_at)',
	},
	{
		name: 'idx_user_sessions_expires',
		table: 'user_sessions',
		definition: 'ON user_sessions (expires_at)',
	},
	{
		name: 'idx_device_login_approvals_user_status',
		table: 'device_login_approvals',
		definition: 'ON device_login_approvals (user_id, status, expires_at)',
	},
	{
		name: 'idx_push_subscriptions_user',
		table: 'push_subscriptions',
		definition: 'ON push_subscriptions (user_id)',
	},
];

export async function createDeviceSessionTables(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS user_sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT UNIQUE NOT NULL,
			device_class TEXT NOT NULL CHECK (device_class IN ('mobile', 'desktop')),
			device_name TEXT NOT NULL DEFAULT '',
			user_agent TEXT NOT NULL DEFAULT '',
			auth_method TEXT NOT NULL DEFAULT 'password',
			linked_via_session_id TEXT REFERENCES user_sessions(id) ON DELETE SET NULL,
			created_ip TEXT NOT NULL DEFAULT '',
			last_active_ip TEXT NOT NULL DEFAULT '',
			last_active_at BIGINT NOT NULL,
			expires_at BIGINT NOT NULL,
			revoked_at BIGINT,
			revoke_reason TEXT
		);

		CREATE TABLE IF NOT EXISTS device_login_approvals (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			challenge_hash TEXT UNIQUE NOT NULL,
			mode TEXT NOT NULL CHECK (mode IN ('push_approval', 'mobile_code', 'qr_link')),
			code_hash TEXT,
			number_match SMALLINT,
			attempts SMALLINT NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'consumed')),
			desktop_ip TEXT NOT NULL DEFAULT '',
			desktop_ua TEXT NOT NULL DEFAULT '',
			desktop_label TEXT NOT NULL DEFAULT '',
			approved_by_session_id TEXT REFERENCES user_sessions(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL,
			expires_at BIGINT NOT NULL,
			resolved_at BIGINT
		);

		CREATE TABLE IF NOT EXISTS push_subscriptions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			session_id TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
			endpoint TEXT UNIQUE NOT NULL,
			p256dh TEXT NOT NULL,
			auth TEXT NOT NULL,
			created_at BIGINT NOT NULL
		);
	`);

	await ensureIndexesSafely(client, DEVICE_SESSION_INDEXES);
}
