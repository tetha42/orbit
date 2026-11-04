import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit, withTransaction } from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import { getChatAudience, invalidateChatAudience } from '@/server/chat/chatAudience';
import type { ChatPollItem, ChatPollOptionItem } from '@/apps/chat/types';

export interface ChatRoom {
	id: string;
	typeValue: 'genel' | 'takim' | 'ozel';
	teamId: string | null;
	name: string;
	creation: number;
	avatar?: string | null;
	peerUserId?: string | null;
	memberCount?: number;
	lastMessage?: ChatMessageRecord | null;
	unreadCount?: number;
}

export interface QuotedMessageSnapshot {
	id: string;
	senderName: string;
	content: string;
}

export interface ChatMessageRecord {
	id: string;
	roomId: string;
	senderId: string;
	senderName: string;
	senderPhoto: string | null;
	content: string;
	attachments: Array<{ name: string; url: string; size?: number; tip?: string; pollId?: string }>;
	date: number;
	deletionDate?: number | null;
	editDate?: number | null;
	poll?: ChatPollItem | null;
	repliedMessageId?: string | null;
	repliedMessage?: QuotedMessageSnapshot | null;
	deliveredMi?: boolean;
}

export interface UnreadChatRoomSummary {
	id: string;
	topic: string;
	at: number;
	unread: number;
	messageId: string;
	sender: { name: string; surname: string };
}

/**
 * Emits a `notification` event on the global `orbit_events` SSE bus for all members
 * of `roomId` (except `excludeUserId`), so their TopBar Notification Center,
 * Dock badge, and background PWA/OS notifications update even when the Chat window is closed.
 */
async function notifyChatRoomParticipants(roomId: string, excludeUserId?: string): Promise<void> {
	const p = getPgPool();
	try {
		// The audience is cached for a few seconds, so this no longer adds a
		// room + membership query to every single message.
		const audience = await getChatAudience(roomId);
		if (!audience) return;

		if (audience.all) {
			// Broadcast to all connected members
			await publishEventQuiet(p, { k: 'notification' });
			return;
		}

		const targetIds = [...audience.memberIds].filter((id) => id !== excludeUserId);
		if (targetIds.length > 0) {
			await publishEventQuiet(p, notificationEvents(targetIds));
		}
	} catch (err) {
		console.warn('[Chat bildirim notify warning]:', err);
	}
}

export async function canUserAccessChatRoom(
	roomId: string,
	userId: string,
	isAdmin = false
): Promise<boolean> {
	if (!roomId || !userId) return false;
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT 1
		 FROM chat_rooms o
		 WHERE o.id = $1
		   AND o.room_type <> 'mail_thread'
		   AND (
		     o.room_type = 'genel'
		     OR ($3 = true AND o.room_type = 'takim')
		     OR (o.room_type = 'takim' AND (
		       EXISTS (SELECT 1 FROM team_members tu WHERE tu.team_id = o.team_id AND tu.user_id = $2 AND tu.status = 'aktif')
		       OR EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $2)
		     ))
		     OR (o.room_type = 'ozel' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $2))
		   )
		 LIMIT 1`,
		[roomId, userId, isAdmin]
	);
	return res.rows.length > 0;
}

export async function getChatRooms(userId: string, isAdmin = false): Promise<ChatRoom[]> {
	await ensurePostgresInit();
	const p = getPgPool();

	// Return public/general rooms + team rooms the user belongs to (or all if admin), excluding internal mail_thread rooms
	const res = await p.query(
		`SELECT o.id, o.room_type AS typeValue, o.team_id AS "teamId", o.name AS name, o.created_at AS creation,
		        (SELECT COUNT(*)::int FROM chat_members su_count WHERE su_count.room_id = o.id) as "memberCount",
		        (SELECT json_build_object(
		            'id', k.id,
		            'name', (k.first_name || ' ' || k.last_name),
		            'profilePhoto', k.avatar_url
		         )
		         FROM chat_members su2
		         JOIN users k ON k.id = su2.user_id
		         WHERE su2.room_id = o.id AND su2.user_id <> $1
		         LIMIT 1
		        ) as "counterpartUser",
		        (SELECT json_build_object(
		            'id', m.id, 'roomId', m.room_id, 'senderId', m.sender_id,
		            'senderName', m.sender_name, 'senderPhoto', m.sender_avatar,
		            'content', m.content, 'attachments', m.attachments, 'date', m.date,
		            'deletionDate', m.deleted_at, 'editDate', m.edited_at,
		            'repliedMessageId', m.reply_to_id, 'repliedMessage', m.reply_snapshot,
		            'deliveredMi', m.is_delivered
		         ) FROM chat_messages m WHERE m.room_id = o.id AND ($2 = true OR m.deleted_at IS NULL) ORDER BY m.date DESC LIMIT 1) as "lastMessage",
		        (SELECT COUNT(*)::int FROM chat_messages m2
		         WHERE m2.room_id = o.id
		           AND m2.sender_id <> $1
		           AND m2.deleted_at IS NULL
		           AND m2.date > COALESCE(
		             (SELECT u.last_read_at FROM chat_members u WHERE u.room_id = o.id AND u.user_id = $1), 0
		         )) as "unreadCount"
		 FROM chat_rooms o
		 WHERE o.room_type <> 'mail_thread'
		   AND (
		     o.room_type = 'genel'
		     OR ($2 = true AND o.room_type = 'takim')
		     OR (o.room_type = 'takim' AND EXISTS (SELECT 1 FROM team_members tu WHERE tu.team_id = o.team_id AND tu.user_id = $1 AND tu.status = 'aktif'))
		     OR (o.room_type = 'ozel' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $1))
		   )
		 ORDER BY o.room_type = 'genel' DESC, COALESCE((SELECT m3.date FROM chat_messages m3 WHERE m3.room_id = o.id AND ($2 = true OR m3.deleted_at IS NULL) ORDER BY m3.date DESC LIMIT 1), o.created_at) DESC`,
		[userId, isAdmin]
	);

	return res.rows.map((row) => {
		const memberCount = Number(row.memberCount || 0);
		let name = String(row.name || 'Sohbet');
		let avatar: string | null = null;
		let peerUserId: string | null = null;

		if (row.typeValue === 'ozel' && memberCount === 2 && row.counterpartUser) {
			const k = typeof row.counterpartUser === 'string' ? JSON.parse(row.counterpartUser) : row.counterpartUser;
			if (k && k.name) {
				name = String(k.name);
				avatar = k.profilePhoto || null;
				peerUserId = k.id || null;
			}
		}

		const rawLast = row.lastMessage
			? typeof row.lastMessage === 'string'
				? JSON.parse(row.lastMessage)
				: row.lastMessage
			: null;

		return {
			id: String(row.id),
			typeValue: row.typeValue,
			teamId: row.teamId ? String(row.teamId) : null,
			name,
			avatar,
			peerUserId,
			memberCount,
			creation: Number(row.creation),
			lastMessage: rawLast
				? {
						id: String(rawLast.id ?? ''),
						roomId: String(rawLast.roomId ?? rawLast.roomId ?? row.id),
						senderId: String(rawLast.senderId ?? rawLast.senderId ?? ''),
						senderName: String(rawLast.senderName ?? rawLast.senderName ?? 'Üye'),
						senderPhoto: rawLast.senderPhoto ?? rawLast.senderPhoto ?? null,
						content: String(rawLast.content ?? ''),
						attachments: Array.isArray(rawLast.attachments)
							? rawLast.attachments
							: typeof rawLast.attachments === 'string'
							? JSON.parse(rawLast.attachments)
							: [],
						date: Number(rawLast.date ?? 0),
						deletionDate: rawLast.deletionDate ? Number(rawLast.deletionDate) : null,
						editDate: rawLast.editDate ? Number(rawLast.editDate) : null,
						repliedMessageId: rawLast.repliedMessageId ? String(rawLast.repliedMessageId) : null,
						repliedMessage: rawLast.repliedMessage
							? typeof rawLast.repliedMessage === 'string'
								? JSON.parse(rawLast.repliedMessage)
								: rawLast.repliedMessage
							: null,
						deliveredMi: Boolean(rawLast.deliveredMi && Number(rawLast.deliveredMi) > 0),
				  }
				: null,
			unreadCount: Number(row.unreadCount || 0),
		};
	});
}

interface RawPollOption {
	id: string;
	text: string;
	sortOrder?: number;
}

interface RawPollVote {
	optionId: string;
	userId: string;
	userName?: string;
	userAvatar?: string | null;
	votedAt?: number;
}

export async function getPollDetails(pollId: string, currentUserId?: string): Promise<ChatPollItem | null> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", created_by AS "creatorId", question AS question,
		        allow_multiple AS "multipleSelection", options, votes, ends_at AS "endsAt", created_at AS creation
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) return null;
	const row = pollRes.rows[0];
	const roomId = String(row.roomId ?? '');
	const creatorId = String(row.creatorId ?? '');

	let creatorName = 'Yönetici';
	try {
		const uRes = await p.query(
			`SELECT first_name AS name, last_name AS surname FROM users WHERE id = $1`,
			[creatorId]
		);
		if (uRes.rows.length > 0) {
			creatorName = `${uRes.rows[0].name} ${uRes.rows[0].surname}`.trim();
		}
	} catch {}

	let messageId = '';
	let isAnon = true;
	try {
		const msgRes = await p.query(
			`SELECT id, attachments FROM chat_messages WHERE room_id = $1 AND attachments LIKE $2 LIMIT 1`,
			[roomId, `%${pollId}%`]
		);
		if (msgRes.rows.length > 0) {
			messageId = String(msgRes.rows[0].id ?? '');
			const rawAtt = msgRes.rows[0].attachments;
			const parsedAtt = Array.isArray(rawAtt)
				? rawAtt
				: typeof rawAtt === 'string'
				? JSON.parse(rawAtt)
				: [];
			const pollAtt = Array.isArray(parsedAtt)
				? parsedAtt.find((a: Record<string, unknown>) => a && (a.pollId === pollId || a.tip === 'anket'))
				: null;
			if (pollAtt && typeof pollAtt.anonymous === 'boolean') {
				isAnon = pollAtt.anonymous;
			}
		}
	} catch {}

	const rawOptions: RawPollOption[] = Array.isArray(row.options)
		? row.options
		: typeof row.options === 'string'
		? JSON.parse(row.options)
		: [];
	const sortedOptions = [...rawOptions].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));

	const rawVotes: RawPollVote[] = Array.isArray(row.votes)
		? row.votes
		: typeof row.votes === 'string'
		? JSON.parse(row.votes)
		: [];

	const totalVotes = rawVotes.length;
	const userVotes: string[] = [];

	const options: ChatPollOptionItem[] = sortedOptions.map((opt, idx) => {
		const optId = String(opt.id);
		const optVotes = rawVotes.filter((v) => String(v.optionId) === optId);
		const count = optVotes.length;
		const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

		const hasUserVoted = currentUserId
			? optVotes.some((v) => String(v.userId) === currentUserId)
			: false;
		if (hasUserVoted) {
			userVotes.push(optId);
		}

		return {
			id: optId,
			pollId,
			order: Number(opt.sortOrder ?? idx),
			text: String(opt.text ?? ''),
			voteCount: count,
			percent,
			voteGivers: !isAnon
				? optVotes.map((v) => ({
						id: String(v.userId),
						name: String(v.userName ?? 'Üye'),
						photo: (v.userAvatar ?? null) as string | null,
				  }))
				: undefined,
		};
	});

	const endsAt = row.endsAt !== null && row.endsAt !== undefined ? Number(row.endsAt) : null;
	const isExpired = endsAt !== null ? Date.now() >= endsAt : false;

	return {
		id: String(row.id),
		messageId,
		roomId,
		creatorId: creatorId,
		creatorName: creatorName,
		question: String(row.question ?? ''),
		multipleSelection: Boolean(row.multipleSelection),
		anonymous: isAnon,
		endsAt,
		kapali: isExpired,
		creation: Number(row.creation ?? 0),
		options: options,
		totalVote: totalVotes,
		userVotes: userVotes,
	};
}

async function enrichMessagesWithPolls(messages: ChatMessageRecord[], currentUserId?: string): Promise<ChatMessageRecord[]> {
	if (messages.length === 0) return messages;

	const pollMessageMap = new Map<string, string>(); // mesajId -> pollId
	for (const m of messages) {
		if (Array.isArray(m.attachments)) {
			const addPoll = m.attachments.find((e) => e && (e.tip === 'anket' || (e as { pollId?: string }).pollId));
			if (addPoll) {
				const aId = (addPoll as { pollId?: string }).pollId || (addPoll as { id?: string }).id;
				if (aId) pollMessageMap.set(m.id, aId);
			}
		}
	}

	if (pollMessageMap.size === 0) return messages;

	const pollDetailsMap = new Map<string, ChatPollItem>();
	await Promise.all(
		Array.from(pollMessageMap.entries()).map(async ([messageId, pollId]) => {
			const poll = await getPollDetails(pollId, currentUserId);
			if (poll) {
				pollDetailsMap.set(messageId, { ...poll, messageId: poll.messageId || messageId });
			}
		})
	);

	return messages.map((m) => {
		const poll = pollDetailsMap.get(m.id);
		return poll ? { ...m, poll: poll } : m;
	});
}

export interface ChatMessageCursor {
	date: number;
	id: string;
}

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

	// The window is the *latest* `safeLimit` messages, then re-sorted oldest →
	// newest for rendering. Ordering the outer query ascending with the limit
	// inside it (the previous shape) returned the oldest page of the room.
	// `before` walks backwards: only rows strictly older than the cursor.
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
		          COALESCE(is_delivered, 0) AS "deliveredMi"
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
				} catch {}
			} else if (typeof r.repliedMessage === 'object') {
				repliedMessage = r.repliedMessage as QuotedMessageSnapshot;
			}
		}

		return {
			id: String(r.id ?? ''),
			roomId: String(r.roomId ?? r.roomId ?? roomId),
			senderId: String(r.senderId ?? r.senderId ?? ''),
			senderName: String(r.senderName ?? r.senderName ?? 'Üye'),
			senderPhoto: (r.senderPhoto ?? r.senderPhoto ?? null) as string | null,
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
			deliveredMi: Boolean(r.deliveredMi && Number(r.deliveredMi) > 0),
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
		        COALESCE(is_delivered, 0) AS "deliveredMi"
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
			} catch {}
		} else if (typeof r.repliedMessage === 'object') {
			repliedMessage = r.repliedMessage as QuotedMessageSnapshot;
		}
	}

	return {
		id: String(r.id ?? ''),
		roomId: String(r.roomId ?? r.roomId ?? ''),
		senderId: String(r.senderId ?? r.senderId ?? ''),
		senderName: String(r.senderName ?? r.senderName ?? 'Üye'),
		senderPhoto: (r.senderPhoto ?? r.senderPhoto ?? null) as string | null,
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
		deliveredMi: Boolean(r.deliveredMi && Number(r.deliveredMi) > 0),
	};
}

export async function createChatMessage(
	roomId: string,
	sender: { id: string; name: string; surname: string; profilePhoto?: string | null },
	content: string,
	attachments: Array<{ name: string; url: string; size?: number; tip?: string }> = [],
	options?: {
		repliedMessageId?: string | null;
		repliedMessage?: QuotedMessageSnapshot | null;
		deliveredMi?: boolean;
	}
): Promise<ChatMessageRecord> {
	await ensurePostgresInit();
	const p = getPgPool();
	const id = randomUUID();
	const date = Date.now();
	const senderName = `${sender.name} ${sender.surname}`.trim() || 'Üye';
	const senderPhoto = sender.profilePhoto || null;
	const attachmentsJson = JSON.stringify(attachments);

	const repliedMessageId = options?.repliedMessageId || null;
	let repliedMessage = options?.repliedMessage || null;
	const deliveredMi = Boolean(options?.deliveredMi);

	// If yanitlananMesajId is provided but snapshot isn't, fetch snapshot
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

	await p.query(
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
			deliveredMi ? 1 : 0,
		]
	);

	// Mark sender's read pointer
	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = $3`,
		[roomId, sender.id, date]
	);

	const createdMsg: ChatMessageRecord = {
		id,
		roomId,
		senderId: sender.id,
		senderName: senderName,
		senderPhoto,
		content: content.trim(),
		attachments,
		date,
		repliedMessageId,
		repliedMessage,
		deliveredMi,
	};

	// 1. Notify real-time Chat SSE stream
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[JSON.stringify({ type: 'new_message', roomId, message: createdMsg })]
		);
	} catch (err) {
		console.warn('[Chat notify warning]:', err);
	}

	// 2. Notify global Notification Center & Dock Badge SSE stream (`orbit_events`)
	void notifyChatRoomParticipants(roomId, sender.id);

	return createdMsg;
}

export async function softDeleteChatMessage(
	messageId: string,
	userId: string,
	isAdmin = false
): Promise<{ ok: boolean; roomId?: string; messageId?: string; deletionDate?: number }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const checkRes = await p.query(
		`SELECT id, room_id AS "roomId", sender_id AS "senderId" FROM chat_messages WHERE id = $1 LIMIT 1`,
		[messageId]
	);
	const msg = checkRes.rows[0];
	if (!msg) return { ok: false };

	// Authorization check: must be admin OR original sender
	if (!isAdmin && msg.senderId !== userId) {
		return { ok: false };
	}

	const now = Date.now();
	await p.query(
		`UPDATE chat_messages SET deleted_at = $1 WHERE id = $2`,
		[now, messageId]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'message_deleted',
					roomId: msg.roomId,
					messageId: messageId,
					deletionDate: now,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify delete error]:', e);
	}

	return { ok: true, roomId: msg.roomId, messageId: messageId, deletionDate: now };
}

export async function softDeleteChatMessagesBatch(
	roomId: string,
	count = 50,
	isAdmin = false
): Promise<{ ok: boolean; count: number; deletedIds: string[]; deletionDate: number }> {
	await ensurePostgresInit();
	const p = getPgPool();

	if (!isAdmin) {
		return { ok: false, count: 0, deletedIds: [], deletionDate: 0 };
	}

	const limit = Math.max(1, Math.min(count, 200));
	const now = Date.now();

	// Select last N non-deleted messages in room
	const selectRes = await p.query(
		`SELECT id FROM chat_messages
		 WHERE room_id = $1 AND deleted_at IS NULL
		 ORDER BY date DESC
		 LIMIT $2`,
		[roomId, limit]
	);

	const deletedIds = selectRes.rows.map((r) => String(r.id));
	if (deletedIds.length === 0) {
		return { ok: true, count: 0, deletedIds: [], deletionDate: now };
	}

	await p.query(
		`UPDATE chat_messages
		 SET deleted_at = $1
		 WHERE id = ANY($2)`,
		[now, deletedIds]
	);

	// Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'messages_cleared',
					roomId,
					deletedIds,
					deletionDate: now,
					count: deletedIds.length,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify clear error]:', e);
	}

	return { ok: true, count: deletedIds.length, deletedIds, deletionDate: now };
}

export async function editChatMessage(
	messageId: string,
	newContent: string,
	userId: string
): Promise<{ ok: boolean; message?: ChatMessageRecord }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const checkRes = await p.query(
		`SELECT id, room_id AS "roomId", sender_id AS "senderId", sender_name AS "senderName", sender_avatar AS "senderPhoto", attachments AS attachments, date, deleted_at AS "deletionDate"
		 FROM chat_messages WHERE id = $1 LIMIT 1`,
		[messageId]
	);
	const existing = checkRes.rows[0];
	if (!existing) return { ok: false };

	// Only original sender can edit, and cannot edit if already soft-deleted
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

export async function markRoomAsRead(roomId: string, userId: string): Promise<void> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = $3`,
		[roomId, userId, now]
	);
	// Refresh the reader's Notification Center & Dock badge
	void publishEventQuiet(p, { k: 'notification', userId });
}

export async function ensureTeamChatRoom(teamId: string, teamName: string): Promise<string> {
	await ensurePostgresInit();
	const p = getPgPool();
	const roomId = `oda_takim_${teamId}`;
	await p.query(
		`INSERT INTO chat_rooms (id, room_type, team_id, name, created_at)
		 VALUES ($1, 'takim', $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET name = $3`,
		[roomId, teamId, `${teamName} Takım Sohbeti`, Date.now()]
	);
	return roomId;
}

export interface ChatContactItem {
	id: string;
	name: string;
	surname: string;
	profilePhoto: string | null;
	roleName: string | null;
	department: string;
}

export interface ChatRoomMemberItem {
	id: string;
	firstName?: string;
	lastName?: string;
	avatarUrl?: string | null;
	roleName?: string | null;
	department?: string;
	name: string;
	surname: string;
	profilePhoto: string | null;
}

/**
 * Returns existing 1-on-1 DM room between two users if one exists,
 * or creates a new one.
 */
export async function getOrCreateDmRoom(
	user1Id: string,
	user2Id: string
): Promise<{ roomId: string; isNew: boolean }> {
	await ensurePostgresInit();
	// Serialize the check-then-create sequence for the same pair. Without this,
	// two quick clicks can both observe "no room" and create duplicate DMs.
	const lockKey = [user1Id, user2Id].sort().join(':');
	return withTransaction(async (client) => {
		await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
		const existing = await client.query(
			`SELECT o.id FROM chat_rooms o
			 WHERE o.room_type = 'ozel'
			   AND (SELECT COUNT(*) FROM chat_members WHERE room_id = o.id) = 2
			   AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = o.id AND user_id = $1)
			   AND EXISTS (SELECT 1 FROM chat_members WHERE room_id = o.id AND user_id = $2)
			 LIMIT 1`,
			[user1Id, user2Id]
		);
		if (existing.rows.length > 0) {
			return { roomId: String(existing.rows[0].id), isNew: false };
		}

		const roomId = `dm_${randomUUID()}`;
		const now = Date.now();
		const usersRes = await client.query(
			`SELECT id, first_name AS name, last_name AS surname FROM users WHERE id IN ($1, $2)`,
			[user1Id, user2Id]
		);
		const names = usersRes.rows.map((u) => `${u.name} ${u.surname}`.trim()).join(' & ');
		const roomName = names || 'Özel Sohbet';

		await client.query(
			`INSERT INTO chat_rooms (id, room_type, name, created_by, created_at)
			 VALUES ($1, 'ozel', $2, $3, $4)`,
			[roomId, roomName, user1Id, now]
		);
		await client.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
			 VALUES ($1, $2, $3, $3), ($1, $4, $3, $3)
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, user1Id, now, user2Id]
		);
		return { roomId, isNew: true };
	});
}

/**
 * Creates a Group DM with multiple members and optional subject title.
 * If title is empty, auto-names with first few participant names like WhatsApp.
 */
export async function createGroupDm(
	creator: { id: string; name: string; surname: string },
	memberIds: string[],
	title?: string
): Promise<{ roomId: string; name: string }> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();
	const roomId = `grp_${randomUUID()}`;

	const allMemberIds = Array.from(new Set([creator.id, ...memberIds]));

	let groupTitle = (title || '').trim();
	if (!groupTitle) {
		const namesRes = await p.query(
			`SELECT first_name AS name FROM users WHERE id = ANY($1) ORDER BY created_at ASC LIMIT 4`,
			[allMemberIds]
		);
		const names = namesRes.rows.map((r) => r.name);
		groupTitle = names.join(', ') + (allMemberIds.length > 4 ? ` (+${allMemberIds.length - 4})` : '');
		if (!groupTitle) groupTitle = 'Yeni Grup';
	}

	await p.query(
		`INSERT INTO chat_rooms (id, room_type, name, created_by, created_at)
		 VALUES ($1, 'ozel', $2, $3, $4)`,
		[roomId, groupTitle, creator.id, now]
	);

	for (const uid of allMemberIds) {
		// Creator has read up to `now`; invited members get `now - 1` so the creation message is unread for them
		const initialRead = uid === creator.id ? now : now - 1;
		await p.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, uid, initialRead, now]
		);
	}

	// Insert system message about group creation
	const sysMsgId = randomUUID();
	const creatorName = `${creator.name} ${creator.surname}`.trim();
	const sysContent = `${creatorName} grubu oluşturdu.`;
	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, 'sistem', 'Sistem', NULL, $3, '[]', $4)`,
		[sysMsgId, roomId, sysContent, now]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'new_message',
					roomId,
					message: {
						id: sysMsgId,
						roomId,
						senderId: 'sistem',
						senderName: 'Sistem',
						senderPhoto: null,
						content: sysContent,
						attachments: [],
						date: now,
					},
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify warning]:', e);
	}

	void notifyChatRoomParticipants(roomId, creator.id);

	return { roomId, name: groupTitle };
}

/**
 * Adds new members to an existing room and publishes a system notification.
 */
export async function addMembersToRoom(
	roomId: string,
	actor: { id: string; name: string; surname: string },
	newMemberIds: string[]
): Promise<{ addedCount: number }> {
	await ensurePostgresInit();
	const p = getPgPool();
	const now = Date.now();

	if (newMemberIds.length === 0) return { addedCount: 0 };

	const toAddRes = await p.query(
		`SELECT id, first_name AS name, last_name AS surname FROM users
		 WHERE id = ANY($1)
		   AND id NOT IN (SELECT user_id FROM chat_members WHERE room_id = $2)`,
		[newMemberIds, roomId]
	);

	if (toAddRes.rows.length === 0) return { addedCount: 0 };

	for (const row of toAddRes.rows) {
		await p.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, row.id, now - 1, now]
		);
	}
	invalidateChatAudience(roomId);

	const addedNames = toAddRes.rows.map((r) => `${r.name} ${r.surname}`.trim()).join(', ');
	const actorName = `${actor.name} ${actor.surname}`.trim();
	const sysContent = `${actorName}, ${addedNames} üyesini gruba ekledi.`;
	const sysMsgId = randomUUID();

	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, 'sistem', 'Sistem', NULL, $3, '[]', $4)`,
		[sysMsgId, roomId, sysContent, now]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'new_message',
					roomId,
					message: {
						id: sysMsgId,
						roomId,
						senderId: 'sistem',
						senderName: 'Sistem',
						senderPhoto: null,
						content: sysContent,
						attachments: [],
						date: now,
					},
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify warning]:', e);
	}

	void notifyChatRoomParticipants(roomId, actor.id);

	return { addedCount: toAddRes.rows.length };
}

/**
 * Retrieves members of a specific chat room.
 */
export async function getRoomMembers(roomId: string): Promise<ChatRoomMemberItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS name, k.last_name AS surname, k.avatar_url as "profilePhoto", k.department AS department, r.name as "roleName"
		 FROM chat_members su
		 JOIN users k ON k.id = su.user_id
		 LEFT JOIN roles r ON r.id = k.role_id
		 WHERE su.room_id = $1
		 ORDER BY k.first_name ASC, k.last_name ASC`,
		[roomId]
	);

	return res.rows.map((r) => {
		const firstName = String(r.name ?? '');
		const lastName = String(r.surname ?? '');
		const avatarUrl = r.profilePhoto ? String(r.profilePhoto) : null;
		const roleName = r.roleName ? String(r.roleName) : null;
		const department = r.department ? String(r.department) : '';
		return {
			id: String(r.id),
			firstName,
			lastName,
			avatarUrl,
			roleName,
			department,
			name: firstName,
			surname: lastName,
			profilePhoto: avatarUrl,
		};
	});
}

/**
 * Returns all active club members for the "New Chat" member picker.
 */
export async function getChatContacts(excludeUserId: string): Promise<ChatContactItem[]> {
	await ensurePostgresInit();
	const p = getPgPool();
	const res = await p.query(
		`SELECT k.id, k.first_name AS name, k.last_name AS surname, k.avatar_url as "profilePhoto", k.department AS department, r.name as "roleName"
		 FROM users k
		 LEFT JOIN roles r ON r.id = k.role_id
		 WHERE k.status = 'aktif' AND k.id <> $1
		 ORDER BY k.first_name ASC, k.last_name ASC`,
		[excludeUserId]
	);

	return res.rows.map((r) => ({
		id: String(r.id),
		name: String(r.name),
		surname: String(r.surname),
		profilePhoto: r.profilePhoto ? String(r.profilePhoto) : null,
		roleName: r.roleName ? String(r.roleName) : null,
		department: r.department ? String(r.department) : '',
	}));
}

/**
 * Returns rooms with unread messages for the Notification Center feed.
 */
export async function getUnreadChatRooms(
	userId: string,
	isAdmin = false,
	limit = 5
): Promise<UnreadChatRoomSummary[]> {
	const rooms = await getChatRooms(userId, isAdmin);
	return rooms
		.filter((r) => (r.unreadCount || 0) > 0 && r.lastMessage)
		.sort((a, b) => (b.lastMessage?.date || 0) - (a.lastMessage?.date || 0))
		.slice(0, limit)
		.map((r) => {
			const last = r.lastMessage!;
			const preview = last.content.length > 72 ? `${last.content.slice(0, 72)}…` : last.content;
			const isDirect = r.typeValue === 'ozel' && (r.memberCount || 0) === 2;
			return {
				id: r.id,
				topic: isDirect ? preview : `${r.name}: ${preview}`,
				at: last.date,
				unread: r.unreadCount || 1,
				messageId: String(last.id),
				sender: {
					name: last.senderName || r.name,
					surname: '',
				},
			};
		});
}

/**
 * Returns total unread chat messages across all rooms the user belongs to (for the Chat Dock badge).
 */
export async function getUnreadChatCount(userId: string, isAdmin = false): Promise<number> {
	const rooms = await getChatRooms(userId, isAdmin);
	return rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
}

export async function createPollInRoom(
	roomId: string,
	creator: { id: string; name: string; surname: string; profilePhoto?: string | null },
	data: {
		question: string;
		options: string[];
		multipleSelection?: boolean;
		anonymous?: boolean;
		sureSeconds?: number | null;
		endsAt?: number | null;
	}
): Promise<{ ok: boolean; message?: ChatMessageRecord; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const question = (data.question || '').trim();
	const cleanOptions = (data.options || []).map((s) => s.trim()).filter(Boolean);

	if (!question) {
		return { ok: false, error: 'Lütfen anket sorusunu yazın.' };
	}
	if (cleanOptions.length < 2) {
		return { ok: false, error: 'En az 2 seçenek girmelisiniz.' };
	}

	const messageId = randomUUID();
	const pollId = `anket_${randomUUID()}`;
	const now = Date.now();
	const endsAt = typeof data.endsAt === 'number'
		? data.endsAt
		: data.sureSeconds
		? now + Number(data.sureSeconds) * 1000
		: null;
	const senderName = `${creator.name} ${creator.surname}`.trim() || 'Yönetici';
	const senderPhoto = creator.profilePhoto || null;
	const isAnon = data.anonymous !== false;
	const attachmentsJson = JSON.stringify([{ tip: 'anket', pollId, question, anonymous: isAnon }]);

	// 1. Insert chat message
	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		[messageId, roomId, creator.id, senderName, senderPhoto, question, attachmentsJson, now]
	);

	// 2. Build options JSONB and insert poll
	const optionsList: RawPollOption[] = cleanOptions.map((text, idx) => ({
		id: `opt_${randomUUID()}`,
		text,
		sortOrder: idx,
	}));

	await p.query(
		`INSERT INTO chat_polls (id, room_id, created_by, question, allow_multiple, options, votes, ends_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, '[]'::jsonb, $7, $8)`,
		[
			pollId,
			roomId,
			creator.id,
			question,
			Boolean(data.multipleSelection),
			JSON.stringify(optionsList),
			endsAt,
			now,
		]
	);

	// 3. Mark sender read pointer
	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
		[roomId, creator.id, now]
	);

	// 4. Fetch complete poll details
	const pollDetails = await getPollDetails(pollId, creator.id);

	const createdMsg: ChatMessageRecord = {
		id: messageId,
		roomId,
		senderId: creator.id,
		senderName: senderName,
		senderPhoto,
		content: question,
		attachments: [{ tip: 'anket', pollId, name: 'Anket', url: '' }],
		date: now,
		poll: pollDetails ? { ...pollDetails, messageId: messageId } : null,
	};

	// 5. Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[JSON.stringify({ type: 'new_message', roomId, message: createdMsg })]
		);
	} catch (e) {
		console.warn('[Chat notify poll create error]:', e);
	}

	return { ok: true, message: createdMsg };
}

export async function castPollVote(
	pollId: string,
	optionId: string,
	user: { id: string; name: string; surname: string; profilePhoto?: string | null },
	isAdmin = false
): Promise<{ ok: boolean; poll?: ChatPollItem; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	// 1. Fetch poll
	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", allow_multiple AS "multipleSelection", options, votes, ends_at AS "endsAt"
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Anket bulunamadı.' };
	}

	const pollRow = pollRes.rows[0];
	const pollRoomId = String(pollRow.roomId ?? '');
	const hasAccess = await canUserAccessChatRoom(pollRoomId, user.id, isAdmin);
	if (!hasAccess) {
		return { ok: false, error: 'Bu odadaki ankete erişim yetkiniz yok.' };
	}

	const endsAt = pollRow.endsAt;
	if (endsAt !== null && endsAt !== undefined && Date.now() >= Number(endsAt)) {
		return { ok: false, error: 'Bu anket oylamaya kapatılmıştır.' };
	}

	const rawOptions: RawPollOption[] = Array.isArray(pollRow.options)
		? pollRow.options
		: typeof pollRow.options === 'string'
		? JSON.parse(pollRow.options)
		: [];
	if (!rawOptions.some((o) => String(o.id) === optionId)) {
		return { ok: false, error: 'Geçersiz anket seçeneği.' };
	}

	const isMulti = Boolean(pollRow.multipleSelection);
	const userFirstName = `${user.name} ${user.surname}`.trim() || 'Üye';
	const userAvatar = user.profilePhoto || null;

	const rawVotes: RawPollVote[] = Array.isArray(pollRow.votes)
		? pollRow.votes
		: typeof pollRow.votes === 'string'
		? JSON.parse(pollRow.votes)
		: [];

	const alreadyVoted = rawVotes.some(
		(v) => String(v.optionId) === optionId && String(v.userId) === user.id
	);

	let nextVotes: RawPollVote[];
	if (alreadyVoted) {
		nextVotes = rawVotes.filter(
			(v) => !(String(v.optionId) === optionId && String(v.userId) === user.id)
		);
	} else {
		const baseVotes = isMulti
			? rawVotes
			: rawVotes.filter((v) => String(v.userId) !== user.id);
		nextVotes = [
			...baseVotes,
			{
				optionId: optionId,
				userId: user.id,
				userName: userFirstName,
				userAvatar,
				votedAt: Date.now(),
			},
		];
	}

	await p.query(
		`UPDATE chat_polls SET votes = $2::jsonb WHERE id = $1`,
		[pollId, JSON.stringify(nextVotes)]
	);

	// 3. Get updated poll details
	const updatedPoll = await getPollDetails(pollId, user.id);
	if (!updatedPoll) {
		return { ok: false, error: 'Anket bilgileri alınamadı.' };
	}

	// 4. Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'poll_updated',
					roomId: pollRoomId,
					pollId,
					poll: updatedPoll,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify poll vote error]:', e);
	}

	return { ok: true, poll: updatedPoll };
}

export async function closePoll(
	pollId: string,
	userId: string,
	isAdmin = false
): Promise<{ ok: boolean; poll?: ChatPollItem; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", created_by AS "creatorId" FROM chat_polls WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Anket bulunamadı.' };
	}

	const pollRow = pollRes.rows[0];
	const creatorId = String(pollRow.creatorId ?? '');

	if (!isAdmin && creatorId !== userId) {
		return { ok: false, error: 'Bu anketi kapatma yetkiniz yok.' };
	}

	await p.query(`UPDATE chat_polls SET ends_at = $2 WHERE id = $1`, [pollId, Date.now() - 1]);

	const updatedPoll = await getPollDetails(pollId, userId);
	if (!updatedPoll) {
		return { ok: false, error: 'Anket güncellenemedi.' };
	}

	// Real-time broadcast
	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'poll_updated',
					roomId: pollRow.roomId,
					pollId,
					poll: updatedPoll,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify poll close error]:', e);
	}

	return { ok: true, poll: updatedPoll };
}

