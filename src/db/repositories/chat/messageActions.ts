import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit } from '@/db';
import type { ChatMessageRecord, QuotedMessageSnapshot } from './types';
import { notifyChatRoomParticipants } from './notifications';
import { getChatMessageById } from './messageQueries';

export async function createChatMessage(
	roomId: string,
	sender: { id: string; name: string; surname: string; profilePhoto?: string | null },
	content: string,
	attachments: Array<{ name: string; url: string; size?: number; type?: string }> = [],
	options?: {
		repliedMessageId?: string | null;
		repliedMessage?: QuotedMessageSnapshot | null;
		isDelivered?: boolean;
	}
): Promise<ChatMessageRecord> {
	await ensurePostgresInit();
	const p = getPgPool();
	const id = randomUUID();
	const date = Date.now();
	const senderName = `${sender.name} ${sender.surname}`.trim() || 'Member';
	const senderPhoto = sender.profilePhoto || null;
	const attachmentsJson = JSON.stringify(attachments);

	const repliedMessageId = options?.repliedMessageId || null;
	let repliedMessage = options?.repliedMessage || null;
	const isDelivered = Boolean(options?.isDelivered);

	if (repliedMessageId && !repliedMessage) {
		const targetMsg = await getChatMessageById(repliedMessageId);
		if (targetMsg) {
			repliedMessage = {
				id: targetMsg.id,
				senderName: targetMsg.senderName,
				content: targetMsg.content.slice(0, 200),
			};
		}
	}

	const repliedMessageJson = repliedMessage ? JSON.stringify(repliedMessage) : null;

	await Promise.all([
		p.query(
			`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date, reply_to_id, reply_snapshot, is_delivered)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			[
				id,
				roomId,
				sender.id,
				senderName,
				senderPhoto,
				content.trim(),
				attachmentsJson,
				date,
				repliedMessageId,
				repliedMessageJson,
				isDelivered ? 1 : 0,
			]
		),
		p.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = $3`,
			[roomId, sender.id, date]
		),
	]);

	const createdMsg: ChatMessageRecord = {
		id,
		roomId,
		senderId: sender.id,
		senderName,
		senderPhoto,
		content: content.trim(),
		attachments,
		date,
		repliedMessageId,
		repliedMessage,
		isDelivered,
	};

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[JSON.stringify({ type: 'new_message', roomId, message: createdMsg })]
		);
	} catch (err) {
		console.warn('[Chat notify warning]:', err);
	}

	void notifyChatRoomParticipants(roomId, sender.id);

	return createdMsg;
}

export async function editChatMessage(
	messageId: string,
	newContent: string,
	userId: string
): Promise<{ ok: boolean; message?: ChatMessageRecord }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const checkRes = await p.query(
		`SELECT id, room_id AS "roomId", sender_id AS "senderId", sender_name AS "senderName",
			sender_avatar AS "senderPhoto", attachments AS attachments, date, deleted_at AS "deletionDate"
		 FROM chat_messages WHERE id = $1 LIMIT 1`,
		[messageId]
	);
	const existing = checkRes.rows[0];
	if (!existing) return { ok: false };

	if (existing.senderId !== userId || existing.deletionDate) {
		return { ok: false };
	}

	const trimmed = newContent.trim();
	if (!trimmed) return { ok: false };

	const now = Date.now();
	await p.query(
		`UPDATE chat_messages SET content = $1, edited_at = $2 WHERE id = $3`,
		[trimmed, now, messageId]
	);

	const updatedMsg: ChatMessageRecord = {
		id: String(existing.id),
		roomId: String(existing.roomId),
		senderId: String(existing.senderId),
		senderName: String(existing.senderName),
		senderPhoto: existing.senderPhoto || null,
		content: trimmed,
		attachments: Array.isArray(existing.attachments)
			? existing.attachments
			: typeof existing.attachments === 'string'
			? JSON.parse(existing.attachments)
			: [],
		date: Number(existing.date),
		deletionDate: null,
		editDate: now,
	};

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'message_edited',
					roomId: updatedMsg.roomId,
					message: updatedMsg,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify edit error]:', e);
	}

	return { ok: true, message: updatedMsg };
}
