import { ensurePostgresInit, getPgPool } from '@/db';
import {
	enrichMessagesWithPolls,
	type ChatMessageRecord,
	type QuotedMessageSnapshot,
} from '@/db/repositories/chat.repo';

const MESSAGE_SELECT = `
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
`;

function mapMessageRow(row: Record<string, unknown>, fallbackRoomId: string): ChatMessageRecord {
	let repliedMessage: QuotedMessageSnapshot | null = null;
	if (row.repliedMessage) {
		if (typeof row.repliedMessage === 'string') {
			try {
				repliedMessage = JSON.parse(row.repliedMessage) as QuotedMessageSnapshot;
			} catch {
				// Ignore malformed legacy reply_snapshot JSON
			}
		} else if (typeof row.repliedMessage === 'object') {
			repliedMessage = row.repliedMessage as QuotedMessageSnapshot;
		}
	}

	let attachments: ChatMessageRecord['attachments'] = [];
	if (Array.isArray(row.attachments)) {
		attachments = row.attachments;
	} else if (typeof row.attachments === 'string') {
		try {
			const parsed = JSON.parse(row.attachments);
			if (Array.isArray(parsed)) attachments = parsed;
		} catch {
			attachments = [];
		}
	}

	return {
		id: String(row.id ?? ''),
		roomId: String(row.roomId ?? fallbackRoomId),
		senderId: String(row.senderId ?? ''),
		senderName: String(row.senderName ?? 'Member'),
		senderPhoto: (row.senderPhoto ?? null) as string | null,
		content: String(row.content ?? ''),
		attachments,
		date: Number(row.date ?? 0),
		deletionDate: row.deletionDate ? Number(row.deletionDate) : null,
		editDate: row.editDate ? Number(row.editDate) : null,
		repliedMessageId: row.repliedMessageId ? String(row.repliedMessageId) : null,
		repliedMessage,
		isDelivered: Boolean(row.isDelivered && Number(row.isDelivered) > 0),
	};
}

export interface AroundMessagesResult {
	messages: ChatMessageRecord[];
	hasMore: boolean;
	hasNewer: boolean;
	targetFound: boolean;
}

export async function getChatMessagesAroundId(
	roomId: string,
	aroundId: string,
	currentUserId?: string
): Promise<AroundMessagesResult> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const targetRes = await pool.query(
		`${MESSAGE_SELECT}
		 WHERE room_id = $1 AND id = $2 AND deleted_at IS NULL
		 LIMIT 1`,
		[roomId, aroundId]
	);

	if (targetRes.rows.length === 0) {
		return { messages: [], hasMore: false, hasNewer: false, targetFound: false };
	}

	const targetRow = targetRes.rows[0] as Record<string, unknown>;
	const targetDate = Number(targetRow.date ?? 0);
	const targetId = String(targetRow.id ?? aroundId);

	const [beforeRes, afterRes] = await Promise.all([
		pool.query(
			`${MESSAGE_SELECT}
			 WHERE room_id = $1
			   AND deleted_at IS NULL
			   AND (date < $2 OR (date = $2 AND id < $3))
			 ORDER BY date DESC, id DESC
			 LIMIT 26`,
			[roomId, targetDate, targetId]
		),
		pool.query(
			`${MESSAGE_SELECT}
			 WHERE room_id = $1
			   AND deleted_at IS NULL
			   AND (date > $2 OR (date = $2 AND id > $3))
			 ORDER BY date ASC, id ASC
			 LIMIT 26`,
			[roomId, targetDate, targetId]
		),
	]);

	const hasMore = beforeRes.rows.length > 25;
	const hasNewer = afterRes.rows.length > 25;
	const beforeSlice = (hasMore ? beforeRes.rows.slice(0, 25) : beforeRes.rows).reverse();
	const afterSlice = hasNewer ? afterRes.rows.slice(0, 25) : afterRes.rows;

	const rawMessages = [
		...beforeSlice.map((r) => mapMessageRow(r as Record<string, unknown>, roomId)),
		mapMessageRow(targetRow, roomId),
		...afterSlice.map((r) => mapMessageRow(r as Record<string, unknown>, roomId)),
	];

	const messages = await enrichMessagesWithPolls(rawMessages, currentUserId);
	return { messages, hasMore, hasNewer, targetFound: true };
}
