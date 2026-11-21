import { getPgPool, ensurePostgresInit } from '@/db';
import type { ChatMessageRecord, ChatMessageCursor, QuotedMessageSnapshot } from './types';
import { enrichMessagesWithPolls } from './pollQueries';

export async function getChatRoomMessages(
	roomId: string,
	limit = 60,
	isAdmin = false,
	currentUserId?: string,
	before?: ChatMessageCursor | null
): Promise<ChatMessageRecord[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 200)) : 60;

	const res = await p.query(
		`SELECT *
		 FROM (
		   SELECT id,
		          room_id AS "roomId",
		          sender_id AS "senderId",
		          sender_name AS "senderName",
		          sender_avatar AS "senderPhoto",
		          content AS content,
		          attachments AS attachments,
		          date,
		          deleted_at AS "deletionDate",
		          edited_at AS "editDate",
		          reply_to_id AS "repliedMessageId",
		          reply_snapshot AS "repliedMessage",
		          COALESCE(is_delivered, 0) AS "isDelivered"
		   FROM chat_messages
		   WHERE room_id = $1
		     AND ($3 = true OR deleted_at IS NULL)
		     AND ($4::bigint IS NULL OR date < $4 OR (date = $4 AND id < $5))
		   ORDER BY date DESC, id DESC
		   LIMIT $2
		 ) AS latest
		 ORDER BY date ASC, id ASC`,
		[roomId, safeLimit, isAdmin, before?.date ?? null, before?.id ?? null]
	);

	const rawMessages: ChatMessageRecord[] = res.rows.map((row) => {
		const r = row as Record<string, unknown>;
		let repliedMessage: QuotedMessageSnapshot | null = null;
		if (r.repliedMessage) {
			if (typeof r.repliedMessage === 'string') {
				try {
					repliedMessage = JSON.parse(r.repliedMessage);
				} catch {
					// Ignore malformed legacy reply_snapshot JSON rather than breaking message loads.
				}
			} else if (typeof r.repliedMessage === 'object') {
				repliedMessage = r.repliedMessage as QuotedMessageSnapshot;
			}
		}

		return {
			id: String(r.id ?? ''),
			roomId: String(r.roomId ?? roomId),
			senderId: String(r.senderId ?? ''),
			senderName: String(r.senderName ?? 'Member'),
			senderPhoto: (r.senderPhoto ?? null) as string | null,
			content: String(r.content ?? ''),
			attachments: Array.isArray(r.attachments)
				? r.attachments
				: typeof r.attachments === 'string'
				? JSON.parse(r.attachments)
				: [],
			date: Number(r.date ?? 0),
			deletionDate: r.deletionDate ? Number(r.deletionDate) : null,
			editDate: r.editDate ? Number(r.editDate) : null,
			repliedMessageId: r.repliedMessageId ? String(r.repliedMessageId) : null,
			repliedMessage,
			isDelivered: Boolean(r.isDelivered && Number(r.isDelivered) > 0),
		};
	});

	return await enrichMessagesWithPolls(rawMessages, currentUserId);
}

export async function getChatMessageById(messageId: string): Promise<ChatMessageRecord | null> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT id,
		        room_id AS "roomId",
		        sender_id AS "senderId",
		        sender_name AS "senderName",
		        sender_avatar AS "senderPhoto",
		        content AS content,
		        attachments AS attachments,
		        date,
		        deleted_at AS "deletionDate",
		        edited_at AS "editDate",
		        reply_to_id AS "repliedMessageId",
		        reply_snapshot AS "repliedMessage",
		        COALESCE(is_delivered, 0) AS "isDelivered"
		 FROM chat_messages
		 WHERE id = $1
		 LIMIT 1`,
		[messageId]
	);

	if (res.rows.length === 0) return null;
	const r = res.rows[0] as Record<string, unknown>;

	let repliedMessage: QuotedMessageSnapshot | null = null;
	if (r.repliedMessage) {
		if (typeof r.repliedMessage === 'string') {
			try {
				repliedMessage = JSON.parse(r.repliedMessage);
			} catch {
				// Ignore malformed legacy reply_snapshot JSON rather than breaking message loads.
			}
		} else if (typeof r.repliedMessage === 'object') {
			repliedMessage = r.repliedMessage as QuotedMessageSnapshot;
		}
	}

	return {
		id: String(r.id ?? ''),
		roomId: String(r.roomId ?? ''),
		senderId: String(r.senderId ?? ''),
		senderName: String(r.senderName ?? 'Member'),
		senderPhoto: (r.senderPhoto ?? null) as string | null,
		content: String(r.content ?? ''),
		attachments: Array.isArray(r.attachments)
			? r.attachments
			: typeof r.attachments === 'string'
			? JSON.parse(r.attachments)
			: [],
		date: Number(r.date ?? 0),
		deletionDate: r.deletionDate ? Number(r.deletionDate) : null,
		editDate: r.editDate ? Number(r.editDate) : null,
		repliedMessageId: r.repliedMessageId ? String(r.repliedMessageId) : null,
		repliedMessage,
		isDelivered: Boolean(r.isDelivered && Number(r.isDelivered) > 0),
	};
}
