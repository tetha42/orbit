import type { PoolClient } from 'pg';
import { ensureIndexesSafely, type SchemaIndexDef } from './safeIndexes';

const CHAT_CALL_INDEXES: readonly SchemaIndexDef[] = [
	{
		name: 'idx_chat_calls_room_status',
		table: 'chat_calls',
		definition: 'ON chat_calls (room_id, status, started_at DESC)',
	},
	{
		name: 'idx_chat_call_signals_target',
		table: 'chat_call_signals',
		definition: 'ON chat_call_signals (call_id, to_user_id, created_at ASC)',
	},
];

export async function createChatCallTables(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS chat_calls (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			initiator_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'ringing'
				CHECK (status IN ('ringing', 'active', 'ended', 'missed')),
			participants JSONB NOT NULL DEFAULT '[]'::jsonb,
			started_at BIGINT NOT NULL,
			answered_at BIGINT,
			ended_at BIGINT
		);

		CREATE TABLE IF NOT EXISTS chat_call_signals (
			id TEXT PRIMARY KEY,
			call_id TEXT NOT NULL REFERENCES chat_calls(id) ON DELETE CASCADE,
			from_user_id TEXT NOT NULL,
			to_user_id TEXT NOT NULL,
			kind TEXT NOT NULL CHECK (kind IN ('offer', 'answer', 'ice')),
			payload JSONB NOT NULL,
			created_at BIGINT NOT NULL
		);
	`);

	await ensureIndexesSafely(client, CHAT_CALL_INDEXES);
}

export async function ensureOptionalChatTrgmIndex(client: PoolClient): Promise<void> {
	try {
		const extRes = await client.query<{ installed?: boolean }>(
			"SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS installed"
		);
		const row = extRes.rows[0] as { installed?: boolean } | undefined;
		if (!row?.installed) {
			await client.query('SAVEPOINT orbit_pg_trgm_ext').catch((spErr) => {
				if ((spErr as { code?: string }).code !== '25P01') throw spErr;
			});
			try {
				await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
				await client.query('RELEASE SAVEPOINT orbit_pg_trgm_ext').catch((spErr) => {
					if ((spErr as { code?: string }).code !== '25P01') throw spErr;
				});
			} catch (extErr) {
				await client.query('ROLLBACK TO SAVEPOINT orbit_pg_trgm_ext').catch((spErr) => {
					if ((spErr as { code?: string }).code !== '25P01') throw spErr;
				});
				throw extErr;
			}
		}
		await ensureIndexesSafely(client, [
			{
				name: 'idx_chat_messages_trgm',
				table: 'chat_messages',
				definition: 'ON chat_messages USING GIN (content gin_trgm_ops) WHERE deleted_at IS NULL',
			},
		]);
	} catch (err) {
		console.warn(
			'[Schema] Optional pg_trgm chat search index skipped:',
			err instanceof Error ? err.message : String(err)
		);
	}
}
