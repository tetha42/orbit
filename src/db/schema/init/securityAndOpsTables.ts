import type { PoolClient } from 'pg';
import { ensureIndexesSafely, type SchemaIndexDef } from './safeIndexes';
import {
	ensureColumnDefault,
	ensureColumnExists,
	ensureUniqueColumnConstraint,
} from './schemaDriftHelpers';

const SECURITY_AND_OPS_INDEXES: readonly SchemaIndexDef[] = [
	{ name: 'idx_security_blocks_status', table: 'security_blocks', definition: 'ON security_blocks (status, expires_at)' },
	{ name: 'idx_security_rules_eval', table: 'security_rules', definition: 'ON security_rules (enabled, priority ASC)' },
	{ name: 'idx_soc_incidents_status', table: 'soc_incidents', definition: 'ON soc_incidents (status, created_at DESC)' },
	{ name: 'idx_soc_incidents_ip', table: 'soc_incidents', definition: 'ON soc_incidents (source_ip)' },
	{ name: 'idx_mail_outbox_status', table: 'mail_outbox', definition: 'ON mail_outbox (status, created_at DESC)' },
	{ name: 'idx_teams_lead_id', table: 'teams', definition: 'ON teams (lead_id)' },
	{ name: 'idx_teams_type_status', table: 'teams', definition: 'ON teams(type, status, created_at DESC)' },
	{ name: 'idx_team_members_user', table: 'team_members', definition: 'ON team_members (user_id, status)' },
	{ name: 'idx_team_members_team_status', table: 'team_members', definition: 'ON team_members(team_id, status, joined_at ASC)' },
	{ name: 'idx_team_tasks_team', table: 'team_tasks', definition: 'ON team_tasks (team_id, status)' },
	{ name: 'idx_team_tasks_assignee', table: 'team_tasks', definition: 'ON team_tasks (assignee_id)' },
	{ name: 'idx_team_tasks_assignee_due', table: 'team_tasks', definition: 'ON team_tasks(assignee_id, status, due_at ASC)' },
	{ name: 'idx_events_starts_at', table: 'events', definition: 'ON events (starts_at DESC)' },
	{ name: 'idx_events_status_starts', table: 'events', definition: 'ON events(status, starts_at ASC, ends_at ASC)' },
	{ name: 'idx_event_participants_event', table: 'event_participants', definition: 'ON event_participants (event_id, status)' },
	{ name: 'idx_event_participants_user', table: 'event_participants', definition: 'ON event_participants (user_id, status)' },
	{ name: 'idx_certificates_user', table: 'certificates', definition: 'ON certificates (user_id)' },
	{ name: 'idx_certificates_user_created', table: 'certificates', definition: 'ON certificates(user_id, created_at DESC)' },
	{ name: 'idx_certificates_event_user', table: 'certificates', definition: 'ON certificates(event_id, user_id)' },
];

export async function createSecurityAndOpsTables(client: PoolClient): Promise<void> {
	await client.query(`
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

		CREATE TABLE IF NOT EXISTS security_rules (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			enabled BOOLEAN NOT NULL DEFAULT true,
			priority INTEGER NOT NULL DEFAULT 100,
			match_mode TEXT NOT NULL DEFAULT 'all',
			conditions JSONB NOT NULL DEFAULT '[]',
			action TEXT NOT NULL,
			action_config JSONB DEFAULT '{}',
			hits_count BIGINT NOT NULL DEFAULT 0,
			last_hit_at BIGINT,
			creator_id TEXT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);

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

		CREATE TABLE IF NOT EXISTS mail_outbox (
			id TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			recipient TEXT NOT NULL,
			subject TEXT NOT NULL,
			payload TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'pending',
			target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			error TEXT,
			attempts INTEGER NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL,
			approved_at BIGINT,
			sent_at BIGINT
		);

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
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1 FROM pg_attribute a
				JOIN pg_class t ON t.oid = a.attrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema() AND t.relname = 'team_members'
				  AND a.attname IN ('team_id', 'user_id') AND NOT a.attisdropped AND NOT a.attnotnull
			) THEN
				DELETE FROM team_members WHERE team_id IS NULL OR user_id IS NULL;
				ALTER TABLE team_members ALTER COLUMN team_id SET NOT NULL, ALTER COLUMN user_id SET NOT NULL;
			END IF;
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint c
				JOIN pg_class t ON t.oid = c.conrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema() AND t.relname = 'team_members'
				  AND c.contype IN ('p', 'u') AND pg_get_constraintdef(c.oid) ~ '\\(team_id,\\s*user_id\\)'
			) AND NOT EXISTS (
				SELECT 1 FROM pg_index i
				JOIN pg_class t ON t.oid = i.indrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema() AND t.relname = 'team_members'
				  AND i.indisunique AND i.indisvalid AND i.indpred IS NULL
				  AND pg_get_indexdef(i.indexrelid) ~ '\\(team_id,\\s*user_id\\)$'
			) THEN
				DELETE FROM team_members WHERE team_id IS NULL OR user_id IS NULL;
				DELETE FROM team_members
				WHERE ctid IN (
					SELECT ctid FROM (
						SELECT ctid, ROW_NUMBER() OVER (
							PARTITION BY team_id, user_id
							ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
								joined_at DESC NULLS LAST, ctid DESC
						) AS rn
						FROM team_members
					) dup WHERE dup.rn > 1
				);
				ALTER TABLE team_members ADD UNIQUE (team_id, user_id);
			END IF;
		END $$;

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
	`);
	await ensureColumnDefault(client, 'teams', 'status', "'active'");
	await ensureColumnExists(client, 'team_members', 'application_note', 'TEXT');
	await ensureColumnDefault(client, 'team_members', 'status', "'active'");
	await ensureColumnDefault(client, 'team_tasks', 'status', "'todo'");
	await ensureColumnDefault(client, 'events', 'status', "'published'");
	await ensureUniqueColumnConstraint(client, 'certificates', 'verification_code');
	await ensureIndexesSafely(client, SECURITY_AND_OPS_INDEXES);
}
