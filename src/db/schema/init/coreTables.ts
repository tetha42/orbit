import type { PoolClient } from 'pg';
import { ensureIndexesSafely, type SchemaIndexDef } from './safeIndexes';
import { ensureColumnDefault, ensureColumnExists } from './schemaDriftHelpers';

const CORE_INDEXES: readonly SchemaIndexDef[] = [
	{ name: 'idx_users_session_token', table: 'users', definition: 'ON users (session_token)' },
	{ name: 'idx_users_role_id', table: 'users', definition: 'ON users (role_id)' },
	{ name: 'idx_users_active_sessions', table: 'users', definition: 'ON users(session_expires_at) WHERE session_token IS NOT NULL' },
	{ name: 'idx_users_email_lower', table: 'users', definition: 'ON users(LOWER(email))' },
	{ name: 'idx_users_status_created', table: 'users', definition: 'ON users(status, created_at ASC)' },
	{ name: 'idx_webauthn_credentials_user', table: 'webauthn_credentials', definition: 'ON webauthn_credentials (user_id)' },
	{ name: 'idx_verification_tokens_user', table: 'verification_tokens', definition: 'ON verification_tokens (user_id, token_type)' },
	{ name: 'idx_verification_tokens_target', table: 'verification_tokens', definition: 'ON verification_tokens (target, token_type)' },
	{ name: 'idx_verification_tokens_expiry', table: 'verification_tokens', definition: 'ON verification_tokens (expires_at) WHERE used_at IS NULL' },
	{ name: 'idx_invitations_open', table: 'invitations', definition: 'ON invitations (expires_at) WHERE used_at IS NULL' },
	{ name: 'idx_form_fields_collect', table: 'form_fields', definition: 'ON form_fields (collect_at, archived_at)' },
	{ name: 'idx_files_uploaded_by', table: 'files', definition: 'ON files (uploaded_by)' },
	{ name: 'idx_files_user_source', table: 'files', definition: 'ON files (uploaded_by, source_app, scope_id)' },
	{ name: 'idx_files_chat_room', table: 'files', definition: 'ON files (chat_room_id) WHERE chat_room_id IS NOT NULL' },
	{ name: 'idx_notifications_user', table: 'notifications', definition: 'ON notifications (user_id, is_read, created_at DESC)' },
	{ name: 'idx_system_logs_timestamp', table: 'system_logs', definition: 'ON system_logs (timestamp DESC)' },
	{ name: 'idx_system_logs_service', table: 'system_logs', definition: 'ON system_logs (service, timestamp DESC)' },
	{ name: 'idx_system_logs_level', table: 'system_logs', definition: 'ON system_logs (level, timestamp DESC)' },
	{ name: 'idx_system_logs_ip', table: 'system_logs', definition: 'ON system_logs (ip, timestamp DESC)' },
	{ name: 'idx_system_logs_user_ts', table: 'system_logs', definition: 'ON system_logs(user_id, timestamp DESC) WHERE user_id IS NOT NULL' },
	{ name: 'idx_audit_logs_timestamp', table: 'audit_logs', definition: 'ON audit_logs (timestamp DESC, id DESC)' },
	{ name: 'idx_audit_logs_actor', table: 'audit_logs', definition: 'ON audit_logs (actor_id)' },
	{ name: 'idx_audit_logs_target', table: 'audit_logs', definition: 'ON audit_logs (target_type, target_id)' },
	{ name: 'idx_audit_logs_action_ts', table: 'audit_logs', definition: 'ON audit_logs(action, timestamp DESC)' },
];

export async function createCoreTables(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			email_verified_at BIGINT,
			password_hash TEXT NOT NULL,
			password_changed_at BIGINT,
			must_change_password INTEGER NOT NULL DEFAULT 0,
			handle TEXT UNIQUE,
			department TEXT NOT NULL DEFAULT '',
			grade INTEGER NOT NULL DEFAULT 1,
			avatar_url TEXT,
			bio TEXT,
			xp INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'pending',
			archetype TEXT NOT NULL DEFAULT 'academic_club',
			custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
			workspace_state JSONB NOT NULL DEFAULT '{}'::jsonb,
			legal_consents JSONB NOT NULL DEFAULT '[]'::jsonb,
			application_history JSONB NOT NULL DEFAULT '[]'::jsonb,
			oauth_consents JSONB NOT NULL DEFAULT '{}'::jsonb,
			preferred_language TEXT NOT NULL DEFAULT 'en',
			session_token TEXT,
			session_expires_at BIGINT,
			auth_method TEXT NOT NULL DEFAULT 'password',
			last_login_at BIGINT,
			last_login_ip TEXT,
			last_login_user_agent TEXT,
			last_active_ip TEXT,
			last_active_at BIGINT,
			totp_secret TEXT,
			totp_enabled INTEGER NOT NULL DEFAULT 0,
			totp_recovery_codes TEXT,
			totp_confirmed_at BIGINT,
			totp_last_step BIGINT,
			mail_notifications_enabled INTEGER NOT NULL DEFAULT 0,
			role_id TEXT,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS webauthn_credentials (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			public_key TEXT NOT NULL,
			counter BIGINT NOT NULL DEFAULT 0,
			transports TEXT,
			device_type TEXT,
			backed_up INTEGER NOT NULL DEFAULT 0,
			nickname TEXT,
			created_at BIGINT NOT NULL,
			last_used_at BIGINT
		);

		CREATE TABLE IF NOT EXISTS verification_tokens (
			id TEXT PRIMARY KEY,
			user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
			token_type TEXT NOT NULL,
			target TEXT,
			token_hash TEXT NOT NULL,
			payload JSONB NOT NULL DEFAULT '{}'::jsonb,
			attempts INTEGER NOT NULL DEFAULT 0,
			expires_at BIGINT NOT NULL,
			used_at BIGINT,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS invitations (
			id TEXT PRIMARY KEY,
			email TEXT,
			role_id TEXT,
			team_id TEXT,
			note TEXT,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			expires_at BIGINT NOT NULL,
			used_at BIGINT,
			used_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS system_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL DEFAULT '',
			translations JSONB NOT NULL DEFAULT '{}'::jsonb,
			updated_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS legal_documents (
			id TEXT PRIMARY KEY,
			doc_type TEXT UNIQUE NOT NULL,
			scope TEXT NOT NULL DEFAULT 'registration',
			translations JSONB NOT NULL DEFAULT '{}'::jsonb,
			versions JSONB NOT NULL DEFAULT '[]'::jsonb,
			required INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			sort_order INTEGER NOT NULL DEFAULT 0,
			version INTEGER NOT NULL DEFAULT 1,
			updated_at BIGINT NOT NULL,
			updated_by TEXT
		);

		CREATE TABLE IF NOT EXISTS form_fields (
			id TEXT PRIMARY KEY,
			field_key TEXT NOT NULL,
			translations JSONB NOT NULL DEFAULT '{}'::jsonb,
			type TEXT NOT NULL DEFAULT 'text',
			required INTEGER NOT NULL DEFAULT 0,
			scope TEXT NOT NULL DEFAULT 'registration',
			collect_at TEXT NOT NULL DEFAULT 'registration',
			required_at TEXT NOT NULL DEFAULT 'none',
			directory_visibility TEXT NOT NULL DEFAULT 'hidden',
			self_editable INTEGER NOT NULL DEFAULT 0,
			admin_editable INTEGER NOT NULL DEFAULT 1,
			options TEXT NOT NULL DEFAULT '[]',
			sort_order INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			archived_at BIGINT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL,
			UNIQUE (scope, field_key)
		);

		CREATE TABLE IF NOT EXISTS files (
			id TEXT PRIMARY KEY,
			uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			mime_type TEXT NOT NULL,
			size_bytes BIGINT NOT NULL,
			is_public INTEGER NOT NULL DEFAULT 0,
			chat_room_id TEXT,
			source_app TEXT NOT NULL DEFAULT 'general',
			scope_id TEXT,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS notifications (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			message TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'info',
			is_read INTEGER NOT NULL DEFAULT 0,
			link TEXT,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS system_logs (
			id BIGSERIAL PRIMARY KEY,
			timestamp BIGINT NOT NULL,
			level TEXT NOT NULL DEFAULT 'INFO',
			service TEXT NOT NULL,
			message TEXT NOT NULL,
			details JSONB,
			user_id TEXT,
			ip TEXT NOT NULL DEFAULT ''
		);

		CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			timestamp BIGINT NOT NULL,
			actor_id TEXT,
			actor_name TEXT,
			action TEXT NOT NULL,
			target_type TEXT NOT NULL,
			target_id TEXT,
			target_name TEXT,
			before_state TEXT,
			after_state TEXT,
			ip TEXT
		);
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = current_schema()
				  AND table_name = 'audit_logs'
				  AND column_name = 'id'
				  AND data_type IN ('bigint', 'integer', 'smallint')
			) THEN
				ALTER TABLE audit_logs ALTER COLUMN id DROP DEFAULT;
				ALTER TABLE audit_logs ALTER COLUMN id TYPE TEXT USING id::text;
				DROP SEQUENCE IF EXISTS audit_logs_id_seq CASCADE;
			END IF;
		END $$;
	`);
	await ensureColumnDefault(client, 'users', 'status', "'pending'");
	await ensureColumnDefault(client, 'users', 'preferred_language', "'en'");
	await ensureColumnExists(client, 'verification_tokens', 'attempts', 'INTEGER NOT NULL DEFAULT 0');
	await ensureColumnExists(client, 'files', 'id', 'TEXT');
	await ensureColumnExists(client, 'files', 'chat_room_id', 'TEXT');
	await ensureColumnExists(client, 'files', 'source_app', "TEXT NOT NULL DEFAULT 'general'");
	await ensureColumnExists(client, 'files', 'scope_id', 'TEXT');
	await client.query(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint c
				JOIN pg_class t ON t.oid = c.conrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema() AND t.relname = 'files' AND c.contype = 'p'
			) THEN
				ALTER TABLE files ADD PRIMARY KEY (id);
			END IF;
			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = current_schema()
				  AND table_name = 'files' AND column_name = 'size_bytes'
				  AND data_type IN ('integer', 'smallint')
			) THEN
				ALTER TABLE files ALTER COLUMN size_bytes TYPE BIGINT;
			END IF;
		END $$;
	`);
	await ensureIndexesSafely(client, CORE_INDEXES);
}
