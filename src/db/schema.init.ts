import type { PoolClient } from 'pg';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/registrationConfig';
import { DEFAULT_TEAM_CATEGORIES } from '@/lib/teamCategories';
import {
	DEFAULT_MEMBERSHIP_POLICY,
	MEMBERSHIP_POLICY_SETTINGS_KEY,
} from '@/lib/membershipPolicy';

export async function runSchemaMigrations(client: PoolClient): Promise<void> {
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
			status TEXT NOT NULL DEFAULT 'beklemede',
			archetype TEXT NOT NULL DEFAULT 'academic_club',
			custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
			workspace_state JSONB NOT NULL DEFAULT '{}'::jsonb,
			legal_consents JSONB NOT NULL DEFAULT '[]'::jsonb,
			application_history JSONB NOT NULL DEFAULT '[]'::jsonb,
			oauth_consents JSONB NOT NULL DEFAULT '{}'::jsonb,
			preferred_language TEXT NOT NULL DEFAULT 'tr',
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
		CREATE INDEX IF NOT EXISTS idx_users_session_token ON users (session_token);
		CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);

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
		CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials (user_id);

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
		CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens (user_id, token_type);
		CREATE INDEX IF NOT EXISTS idx_verification_tokens_target ON verification_tokens (target, token_type);
		CREATE INDEX IF NOT EXISTS idx_verification_tokens_expiry ON verification_tokens (expires_at) WHERE used_at IS NULL;

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
		CREATE INDEX IF NOT EXISTS idx_invitations_open ON invitations (expires_at) WHERE used_at IS NULL;

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
		CREATE INDEX IF NOT EXISTS idx_form_fields_collect ON form_fields (collect_at, archived_at);

		CREATE TABLE IF NOT EXISTS files (
			id TEXT PRIMARY KEY,
			uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			mime_type TEXT NOT NULL,
			size_bytes INTEGER NOT NULL,
			is_public INTEGER NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files (uploaded_by);

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
		CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

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
		CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs (timestamp DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs (service, timestamp DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level, timestamp DESC);
		CREATE INDEX IF NOT EXISTS idx_system_logs_ip ON system_logs (ip, timestamp DESC);

		CREATE TABLE IF NOT EXISTS security_blocks (
			ip TEXT PRIMARY KEY,
			status TEXT NOT NULL DEFAULT 'ban',
			reason TEXT NOT NULL,
			threat_score INTEGER NOT NULL DEFAULT 100,
			violations INTEGER NOT NULL DEFAULT 1,
			creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			expires_at BIGINT DEFAULT NULL,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_security_blocks_status ON security_blocks (status, expires_at);

		CREATE TABLE IF NOT EXISTS soc_incidents (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			severity TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'new',
			source_ip TEXT,
			service TEXT NOT NULL DEFAULT 'security',
			details JSONB,
			analyst_notes TEXT,
			assigned_to TEXT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_soc_incidents_status ON soc_incidents (status, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_soc_incidents_ip ON soc_incidents (source_ip);

		CREATE TABLE IF NOT EXISTS mail_outbox (
			id TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			recipient TEXT NOT NULL,
			subject TEXT NOT NULL,
			text_body TEXT NOT NULL DEFAULT '',
			html_body TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'pending',
			sensitivity TEXT NOT NULL DEFAULT 'normal',
			target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			last_error TEXT,
			created_at BIGINT NOT NULL,
			approved_at BIGINT,
			sent_at BIGINT
		);
		CREATE INDEX IF NOT EXISTS idx_mail_outbox_status ON mail_outbox (status, created_at DESC);

		CREATE TABLE IF NOT EXISTS teams (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			slug TEXT UNIQUE NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			category TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'working_group',
			lead_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			capacity INTEGER NOT NULL DEFAULT 6,
			quorum INTEGER NOT NULL DEFAULT 0,
			join_policy TEXT NOT NULL DEFAULT 'open',
			repo_url TEXT,
			status TEXT NOT NULL DEFAULT 'active',
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_teams_lead_id ON teams (lead_id);

		CREATE TABLE IF NOT EXISTS team_members (
			id TEXT PRIMARY KEY,
			team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role_title TEXT NOT NULL DEFAULT 'Developer',
			status TEXT NOT NULL DEFAULT 'active',
			application_note TEXT,
			voting_right INTEGER NOT NULL DEFAULT 0,
			term_start BIGINT,
			term_end BIGINT,
			decision TEXT,
			decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			decided_at BIGINT,
			joined_at BIGINT NOT NULL,
			UNIQUE (team_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id, status);

		CREATE TABLE IF NOT EXISTS team_tasks (
			id TEXT PRIMARY KEY,
			team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			description TEXT,
			status TEXT NOT NULL DEFAULT 'todo',
			priority TEXT NOT NULL DEFAULT 'medium',
			assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			due_at BIGINT,
			position DOUBLE PRECISION,
			labels TEXT,
			checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
			comments JSONB NOT NULL DEFAULT '[]'::jsonb,
			activities JSONB NOT NULL DEFAULT '[]'::jsonb,
			xp_awarded INTEGER NOT NULL DEFAULT 0,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			completed_at BIGINT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT
		);
		CREATE INDEX IF NOT EXISTS idx_team_tasks_team ON team_tasks (team_id, status);
		CREATE INDEX IF NOT EXISTS idx_team_tasks_assignee ON team_tasks (assignee_id);

		CREATE TABLE IF NOT EXISTS events (
			id TEXT PRIMARY KEY,
			slug TEXT UNIQUE NOT NULL,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			category TEXT NOT NULL,
			location TEXT NOT NULL,
			starts_at BIGINT NOT NULL,
			ends_at BIGINT NOT NULL,
			capacity INTEGER DEFAULT 60,
			status TEXT NOT NULL DEFAULT 'published',
			checkin_open INTEGER NOT NULL DEFAULT 0,
			checkin_code TEXT,
			xp_reward INTEGER NOT NULL DEFAULT 50,
			owner_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
			owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at DESC);

		CREATE TABLE IF NOT EXISTS event_participants (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			status TEXT NOT NULL DEFAULT 'registered',
			checkin_method TEXT,
			registered_at BIGINT NOT NULL,
			attended_at BIGINT,
			recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			UNIQUE (event_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants (event_id, status);
		CREATE INDEX IF NOT EXISTS idx_event_participants_user ON event_participants (user_id, status);

		CREATE TABLE IF NOT EXISTS certificates (
			id TEXT PRIMARY KEY,
			verification_code TEXT UNIQUE NOT NULL,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
			title TEXT NOT NULL,
			category TEXT DEFAULT 'achievement',
			locale TEXT DEFAULT 'tr',
			description TEXT,
			pdf_url TEXT,
			issued_at BIGINT NOT NULL,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates (user_id);

		CREATE TABLE IF NOT EXISTS budget_records (
			id TEXT PRIMARY KEY,
			date BIGINT NOT NULL,
			entry_type TEXT NOT NULL,
			category TEXT NOT NULL,
			amount_minor INTEGER NOT NULL,
			description TEXT NOT NULL,
			receipt_url TEXT,
			team_id TEXT REFERENCES teams(id) ON DELETE RESTRICT,
			transfer_pair_id TEXT,
			recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL,
			updated_at BIGINT
		);
		CREATE INDEX IF NOT EXISTS idx_budget_records_team ON budget_records (team_id, date DESC);
		CREATE INDEX IF NOT EXISTS idx_budget_records_transfer ON budget_records (transfer_pair_id) WHERE transfer_pair_id IS NOT NULL;

		CREATE TABLE IF NOT EXISTS decisions (
			id TEXT PRIMARY KEY,
			reference_no INTEGER UNIQUE,
			record_type TEXT NOT NULL DEFAULT 'resolution',
			decision_type TEXT NOT NULL DEFAULT 'resolution',
			body_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
			title TEXT NOT NULL,
			date BIGINT NOT NULL,
			agenda TEXT NOT NULL DEFAULT '',
			content TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'published',
			is_public INTEGER NOT NULL DEFAULT 1,
			is_locked INTEGER NOT NULL DEFAULT 0,
			quorum_met INTEGER NOT NULL DEFAULT 0,
			votes_for INTEGER NOT NULL DEFAULT 0,
			votes_against INTEGER NOT NULL DEFAULT 0,
			votes_abstain INTEGER NOT NULL DEFAULT 0,
			attendees TEXT NOT NULL DEFAULT '[]',
			attachments TEXT NOT NULL DEFAULT '[]',
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			published_at BIGINT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_decisions_body ON decisions (body_id, date DESC);

		CREATE TABLE IF NOT EXISTS news (
			id TEXT PRIMARY KEY,
			slug TEXT UNIQUE,
			title TEXT NOT NULL,
			summary TEXT NOT NULL,
			content TEXT NOT NULL,
			category TEXT NOT NULL DEFAULT 'general',
			is_pinned INTEGER NOT NULL DEFAULT 0,
			cover_url TEXT,
			publish_status TEXT NOT NULL DEFAULT 'published',
			published_at BIGINT,
			author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS inventory (
			id TEXT PRIMARY KEY,
			code TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			location TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'available',
			description TEXT,
			serial_number TEXT,
			holder_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			borrowed_at BIGINT,
			due_at BIGINT,
			activities JSONB NOT NULL DEFAULT '[]'::jsonb
		);
		CREATE INDEX IF NOT EXISTS idx_inventory_holder ON inventory (holder_user_id);

		CREATE TABLE IF NOT EXISTS user_notes (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			color TEXT DEFAULT 'yellow',
			is_pinned INTEGER NOT NULL DEFAULT 0,
			folder_id TEXT NOT NULL DEFAULT 'quick',
			is_trashed INTEGER NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes (user_id, updated_at DESC);

		CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			slug TEXT UNIQUE NOT NULL,
			title TEXT NOT NULL,
			summary TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			repo_url TEXT,
			live_url TEXT,
			tech_stack TEXT NOT NULL DEFAULT '[]',
			team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
			owner_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
			owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			status TEXT NOT NULL DEFAULT 'proposed',
			is_featured INTEGER NOT NULL DEFAULT 0,
			starred_by JSONB NOT NULL DEFAULT '[]'::jsonb,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status, is_featured DESC, created_at DESC);

		CREATE TABLE IF NOT EXISTS chat_rooms (
			id TEXT PRIMARY KEY,
			room_type TEXT NOT NULL DEFAULT 'general',
			team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_chat_rooms_team ON chat_rooms (team_id);

		CREATE TABLE IF NOT EXISTS chat_members (
			room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			folder TEXT NOT NULL DEFAULT 'inbox',
			is_starred INTEGER NOT NULL DEFAULT 0,
			last_read_at BIGINT NOT NULL DEFAULT 0,
			joined_at BIGINT NOT NULL DEFAULT 0,
			PRIMARY KEY (room_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members (user_id, folder);

		CREATE TABLE IF NOT EXISTS chat_messages (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			sender_name TEXT NOT NULL DEFAULT '',
			sender_avatar TEXT,
			content TEXT NOT NULL,
			attachments TEXT NOT NULL DEFAULT '[]',
			date BIGINT NOT NULL,
			deleted_at BIGINT DEFAULT NULL,
			edited_at BIGINT DEFAULT NULL,
			reply_to_id TEXT DEFAULT NULL,
			reply_snapshot TEXT DEFAULT NULL,
			is_delivered INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON chat_messages (room_id, date ASC);
		CREATE INDEX IF NOT EXISTS idx_chat_messages_room_deleted ON chat_messages (room_id, deleted_at);

		CREATE TABLE IF NOT EXISTS chat_polls (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			question TEXT NOT NULL,
			allow_multiple INTEGER NOT NULL DEFAULT 0,
			options JSONB NOT NULL DEFAULT '[]'::jsonb,
			votes JSONB NOT NULL DEFAULT '[]'::jsonb,
			ends_at BIGINT DEFAULT NULL,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_chat_polls_room ON chat_polls (room_id);
	`);

	const now = Date.now();
	await client.query(
		`INSERT INTO chat_rooms (id, room_type, team_id, name, created_by, created_at)
		 VALUES ('oda_genel', 'genel', NULL, 'Orbit General Chat', NULL, $1)
		 ON CONFLICT (id) DO NOTHING`,
		[now]
	);

	const defaults: Record<string, string> = {
		site_description_tr:
			'Tetha42 tarafından geliştirilen kendi sunucunuzda barındırılan topluluk işletim sistemi.',
		site_description_en: 'Self-hosted community operating system engineered by tetha42.',
		site_brand_version: 'default',
		registration_core_fields: JSON.stringify(DEFAULT_REGISTRATION_CORE_CONFIG),
		team_categories: JSON.stringify(DEFAULT_TEAM_CATEGORIES),
		[MEMBERSHIP_POLICY_SETTINGS_KEY]: JSON.stringify(DEFAULT_MEMBERSHIP_POLICY),
	};
	for (const [key, value] of Object.entries(defaults)) {
		await client.query(
			`INSERT INTO system_settings (key, value, updated_at)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (key) DO NOTHING`,
			[key, value, now]
		);
	}
}
