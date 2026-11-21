import type { PoolClient } from 'pg';
import {
	ensureColumnDefault,
	ensureColumnExists,
	ensureUniqueColumnConstraint,
} from './schemaDriftHelpers';

/**
 * Applies idempotent drift migrations for upgraded/legacy databases across
 * community, governance, inventory, and chat tables.
 */
export async function applyCommunityAndChatDriftFixes(client: PoolClient): Promise<void> {
	await ensureColumnExists(client, 'decisions', 'status', "TEXT NOT NULL DEFAULT 'planned'");
	await ensureColumnDefault(client, 'inventory', 'status', "'available'");
	await ensureColumnDefault(client, 'projects', 'status', "'proposed'");

	await client.query(`
		DO $$
		DECLARE
			fk RECORD;
		BEGIN
			IF EXISTS (
				SELECT 1 FROM pg_attribute a
				JOIN pg_class t ON t.oid = a.attrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema()
				  AND t.relname = 'chat_members'
				  AND a.attname IN ('room_id', 'user_id')
				  AND NOT a.attisdropped
				  AND NOT a.attnotnull
			) THEN
				DELETE FROM chat_members WHERE room_id IS NULL OR user_id IS NULL;
				ALTER TABLE chat_members
					ALTER COLUMN room_id SET NOT NULL,
					ALTER COLUMN user_id SET NOT NULL;
			END IF;

			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint c
				JOIN pg_class t ON t.oid = c.conrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema()
				  AND t.relname = 'chat_members'
				  AND (
					c.contype = 'p'
					OR (c.contype = 'u' AND pg_get_constraintdef(c.oid) ~ '\\(room_id,\\s*user_id\\)')
				  )
			) THEN
				DELETE FROM chat_members WHERE room_id IS NULL OR user_id IS NULL;
				DELETE FROM chat_members
				WHERE ctid IN (
					SELECT ctid FROM (
						SELECT ctid, ROW_NUMBER() OVER (
							PARTITION BY room_id, user_id
							ORDER BY last_read_at DESC NULLS LAST, joined_at DESC NULLS LAST, ctid DESC
						) AS rn
						FROM chat_members
					) dup WHERE dup.rn > 1
				);
				ALTER TABLE chat_members ADD PRIMARY KEY (room_id, user_id);
			END IF;

			FOR fk IN (
				SELECT c.conname
				FROM pg_constraint c
				JOIN pg_class t ON t.oid = c.conrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema()
				  AND t.relname = 'chat_messages'
				  AND c.contype = 'f'
				  AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (sender_id)%'
			) LOOP
				EXECUTE format('ALTER TABLE chat_messages DROP CONSTRAINT %I', fk.conname);
			END LOOP;
		END $$;
	`);

	await ensureUniqueColumnConstraint(client, 'decisions', 'reference_no');
	await ensureUniqueColumnConstraint(client, 'inventory', 'code');
}
