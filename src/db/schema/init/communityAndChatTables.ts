import type { PoolClient } from 'pg';
import { DEFAULT_REGISTRATION_CORE_CONFIG } from '@/lib/i18n/data/registrationConfig';
import { DEFAULT_TEAM_CATEGORIES } from '@/lib/teamCategories';
import {
	DEFAULT_MEMBERSHIP_POLICY,
	MEMBERSHIP_POLICY_SETTINGS_KEY,
} from '@/lib/membershipPolicy';
import { ensureIndexesSafely, type SchemaIndexDef } from './safeIndexes';
import { applyCommunityAndChatDriftFixes } from './communityAndChatMigrations';
import { ensureOptionalChatTrgmIndex } from './chatCallTables';

const COMMUNITY_AND_CHAT_INDEXES: readonly SchemaIndexDef[] = [
	{ name: 'idx_budget_records_team', table: 'budget_records', definition: 'ON budget_records (team_id, date DESC)' },
	{ name: 'idx_budget_records_transfer', table: 'budget_records', definition: 'ON budget_records (transfer_pair_id) WHERE transfer_pair_id IS NOT NULL' },
	{ name: 'idx_decisions_body', table: 'decisions', definition: 'ON decisions (body_id, date DESC)' },
	{ name: 'idx_decisions_type_ref', table: 'decisions', definition: 'ON decisions(record_type, reference_no DESC NULLS LAST, date DESC)' },
	{ name: 'idx_news_published', table: 'news', definition: 'ON news(publish_status, is_pinned DESC, published_at DESC, created_at DESC)' },
	{ name: 'idx_inventory_holder', table: 'inventory', definition: 'ON inventory (holder_user_id)' },
	{ name: 'idx_inventory_holder_due', table: 'inventory', definition: 'ON inventory(holder_user_id, status, due_at ASC) WHERE due_at IS NOT NULL' },
	{ name: 'idx_user_notes_user', table: 'user_notes', definition: 'ON user_notes (user_id, updated_at DESC)' },
	{ name: 'idx_user_notes_user_folder', table: 'user_notes', definition: 'ON user_notes(user_id, folder_id, is_pinned DESC, updated_at DESC)' },
	{ name: 'idx_projects_status', table: 'projects', definition: 'ON projects (status, is_featured DESC, created_at DESC)' },
	{ name: 'idx_projects_created_by', table: 'projects', definition: 'ON projects(created_by, status)' },
	{ name: 'idx_chat_rooms_team', table: 'chat_rooms', definition: 'ON chat_rooms (team_id)' },
	{ name: 'idx_chat_rooms_type', table: 'chat_rooms', definition: 'ON chat_rooms(room_type, created_at DESC)' },
	{ name: 'idx_chat_members_user', table: 'chat_members', definition: 'ON chat_members (user_id, folder)' },
	{ name: 'idx_chat_messages_room_time', table: 'chat_messages', definition: 'ON chat_messages (room_id, date ASC)' },
	{ name: 'idx_chat_messages_room_deleted', table: 'chat_messages', definition: 'ON chat_messages (room_id, deleted_at)' },
	{ name: 'idx_chat_messages_room_date_desc', table: 'chat_messages', definition: 'ON chat_messages(room_id, date DESC, id DESC) WHERE deleted_at IS NULL' },
	{ name: 'idx_chat_messages_fts', table: 'chat_messages', definition: "ON chat_messages USING GIN (to_tsvector('simple', coalesce(content, ''))) WHERE deleted_at IS NULL" },
	{ name: 'idx_chat_messages_room_date', table: 'chat_messages', definition: 'ON chat_messages (room_id, date DESC) WHERE deleted_at IS NULL' },
	{ name: 'idx_chat_polls_room', table: 'chat_polls', definition: 'ON chat_polls (room_id)' },
];

export async function createCommunityAndChatTables(client: PoolClient): Promise<void> {
	await client.query(`
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
			status TEXT NOT NULL DEFAULT 'planned',
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
			updated_at BIGINT NOT NULL DEFAULT 0
		);

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

		CREATE TABLE IF NOT EXISTS chat_rooms (
			id TEXT PRIMARY KEY,
			room_type TEXT NOT NULL DEFAULT 'general',
			team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS chat_members (
			room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			folder TEXT NOT NULL DEFAULT 'inbox',
			is_starred INTEGER NOT NULL DEFAULT 0,
			last_read_at BIGINT NOT NULL DEFAULT 0,
			joined_at BIGINT NOT NULL DEFAULT 0,
			PRIMARY KEY (room_id, user_id)
		);

		CREATE TABLE IF NOT EXISTS chat_messages (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			sender_id TEXT NOT NULL,
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
	`);
	await applyCommunityAndChatDriftFixes(client);
	await ensureIndexesSafely(client, COMMUNITY_AND_CHAT_INDEXES);
	await ensureOptionalChatTrgmIndex(client);
}

export async function seedInitialDatabaseState(client: PoolClient): Promise<void> {
	const now = Date.now();
	await client.query(
		`INSERT INTO chat_rooms (id, room_type, team_id, name, created_by, created_at)
		 VALUES ('room_general', 'general', NULL, 'Orbit General Chat', NULL, $1)
		 ON CONFLICT (id) DO NOTHING`,
		[now]
	);

	const defaults: Record<string, string> = {
		site_description_tr:
			'Self-hosted community operating system engineered by tetha42.',
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
