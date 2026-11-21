import type { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '../index';
import { notificationEvents, publishEvent } from '../events';

async function insertMessage(
	client: PoolClient,
	threadId: string,
	senderId: string,
	body: string,
	recipientIds: string[],
	now: number,
	senderFolder: 'inbox' | 'sent' = 'sent'
): Promise<string> {
	const messageId = randomUUID();
	const senderRes = await client.query(`SELECT first_name, last_name, avatar_url FROM users WHERE id = $1`, [senderId]);
	const senderRow = senderRes.rows[0];
	const senderName = senderRow
		? `${senderRow.first_name ?? senderRow.firstName ?? ''} ${senderRow.last_name ?? senderRow.lastName ?? ''}`.trim()
		: '';
	const senderAvatar = senderRow ? (senderRow.avatar_url ?? senderRow.avatarUrl ?? null) : null;

	await client.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date, is_delivered)
		 VALUES ($1, $2, $3, $4, $5, $6, '[]', $7, 1)`,
		[messageId, threadId, senderId, senderName, senderAvatar, body, now]
	);
	await client.query(
		`INSERT INTO chat_members (room_id, user_id, folder, is_starred, last_read_at, joined_at)
		 VALUES ($1, $2, $3, 0, $4, $4)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET
		   folder = EXCLUDED.folder,
		   last_read_at = GREATEST(chat_members.last_read_at, EXCLUDED.last_read_at)`,
		[threadId, senderId, senderFolder, now]
	);
	const uniqueRecipients = Array.from(new Set(recipientIds));
	if (uniqueRecipients.length > 0) {
		await client.query(
			`INSERT INTO chat_members (room_id, user_id, folder, is_starred, last_read_at, joined_at)
			 SELECT $1, UNNEST($2::text[]), 'inbox', 0, 0, $3
			 ON CONFLICT (room_id, user_id) DO UPDATE SET
			   folder = CASE WHEN chat_members.folder = 'deleted' THEN 'deleted' ELSE 'inbox' END`,
			[threadId, uniqueRecipients, now]
		);
	}
	await publishEvent(client, notificationEvents(uniqueRecipients));
	return messageId;
}

/** Starts a conversation. The recipients have been vetted by the caller (active, role opens Mail). */
export async function createMailThread(
	senderId: string,
	subject: string,
	body: string,
	recipientIds: string[]
): Promise<{ topicId: string; messageId: string }> {
	return withTransaction(async (client) => {
		const subjectId = randomUUID();
		const now = Date.now();
		await client.query(
			`INSERT INTO chat_rooms (id, room_type, team_id, name, created_by, created_at)
			 VALUES ($1, 'mail_thread', NULL, $2, $3, $4)`,
			[subjectId, subject, senderId, now]
		);
		const messageId = await insertMessage(client, subjectId, senderId, body, recipientIds, now, 'sent');
		return { topicId: subjectId, messageId };
	});
}

/** Adds a message to a conversation and puts it in the inbox of the recipients. */
export async function addMailReply(
	threadId: string,
	senderId: string,
	body: string,
	recipientIds: string[]
): Promise<string> {
	return withTransaction(async (client) => {
		if (recipientIds.length > 0) {
			await client.query(
				`UPDATE chat_members SET folder = 'inbox'
				 WHERE room_id = $1 AND user_id = ANY($2::text[]) AND folder <> 'deleted'`,
				[threadId, recipientIds]
			);
		}
		const incomingRes = await client.query(
			`SELECT 1 FROM chat_members cm
			 JOIN chat_messages m ON m.room_id = cm.room_id
			 WHERE cm.room_id = $1 AND cm.user_id = $2 AND cm.folder <> 'deleted'
			   AND m.sender_id IS DISTINCT FROM $2
			 LIMIT 1`,
			[threadId, senderId]
		);
		const senderFolder: 'inbox' | 'sent' = incomingRes.rows.length > 0 ? 'inbox' : 'sent';
		return insertMessage(client, threadId, senderId, body, recipientIds, Date.now(), senderFolder);
	});
}

export type MailStatusAction = 'read' | 'unread' | 'archive' | 'restore' | 'trash' | 'delete';

/** Applies a state change to the member's own rows of a conversation. Returns false when they have none. */
export async function setMailThreadStatus(
	userId: string,
	threadId: string,
	action: MailStatusAction
): Promise<boolean> {
	await ensurePostgresInit();
	const own = `user_id = $1 AND room_id = $2 AND folder <> 'deleted'`;
	const pool = getPgPool();
	let res;
	switch (action) {
		case 'read':
			res = await pool.query(
				`UPDATE chat_members
				 SET last_read_at = GREATEST(last_read_at, COALESCE((SELECT MAX(date) FROM chat_messages WHERE room_id = $2), $3))
				 WHERE ${own}`,
				[userId, threadId, Date.now()]
			);
			break;
		case 'unread':
			res = await pool.query(
				`UPDATE chat_members
				 SET last_read_at = COALESCE((
					SELECT m.date - 1 FROM chat_messages m
					WHERE m.room_id = $2 AND m.sender_id IS DISTINCT FROM $1
					ORDER BY m.date DESC, m.id DESC LIMIT 1
				 ), 0)
				 WHERE ${own}`,
				[userId, threadId]
			);
			break;
		case 'archive':
		case 'trash':
			res = await pool.query(`UPDATE chat_members SET folder = $3 WHERE ${own}`, [
				userId,
				threadId,
				action === 'archive' ? 'archived' : 'trash',
			]);
			break;
		case 'restore':
			res = await pool.query(
				`UPDATE chat_members SET folder = CASE WHEN EXISTS (
					SELECT 1 FROM chat_messages m2
					WHERE m2.room_id = $2 AND m2.sender_id IS DISTINCT FROM $1
				 ) THEN 'inbox' ELSE 'sent' END WHERE ${own}`,
				[userId, threadId]
			);
			break;
		case 'delete':
			res = await pool.query(`UPDATE chat_members SET folder = 'deleted' WHERE ${own}`, [userId, threadId]);
			break;
	}
	return (res.rowCount ?? 0) > 0;
}
