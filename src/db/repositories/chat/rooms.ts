import { getPgPool, ensurePostgresInit } from '@/db';
import { publishEventQuiet } from '@/db/events';
import type { ChatRoom, UnreadChatRoomSummary } from './types';

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
		     o.room_type = 'general'
		     OR ($3 = true AND o.room_type = 'team')
		     OR (o.room_type = 'team' AND (
		       EXISTS (SELECT 1 FROM team_members tu WHERE tu.team_id = o.team_id AND tu.user_id = $2 AND tu.status = 'active')
		       OR EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $2)
		     ))
		     OR (o.room_type = 'private' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $2))
		   )
		 LIMIT 1`,
		[roomId, userId, isAdmin]
	);
	return res.rows.length > 0;
}

export async function getChatRooms(userId: string, isAdmin = false): Promise<ChatRoom[]> {
	await ensurePostgresInit();
	const p = getPgPool();

	const res = await p.query(
		`SELECT o.id, o.room_type AS typeValue, o.team_id AS "teamId", o.name AS name, o.created_at AS creation,
		        (SELECT COUNT(*)::int FROM chat_members su_count WHERE su_count.room_id = o.id) AS "memberCount",
		        (SELECT json_build_object(
		            'id', k.id,
		            'name', (k.first_name || ' ' || k.last_name),
		            'profilePhoto', k.avatar_url
		         )
		         FROM chat_members su2
		         JOIN users k ON k.id = su2.user_id
		         WHERE su2.room_id = o.id AND su2.user_id <> $1
		         LIMIT 1
		        ) AS "counterpartUser",
		        (SELECT json_build_object(
		            'id', m.id, 'roomId', m.room_id, 'senderId', m.sender_id,
		            'senderName', m.sender_name, 'senderPhoto', m.sender_avatar,
		            'content', m.content, 'attachments', m.attachments, 'date', m.date,
		            'deletionDate', m.deleted_at, 'editDate', m.edited_at,
		            'repliedMessageId', m.reply_to_id, 'repliedMessage', m.reply_snapshot,
		            'isDelivered', m.is_delivered
		         ) FROM chat_messages m WHERE m.room_id = o.id AND ($2 = true OR m.deleted_at IS NULL) ORDER BY m.date DESC LIMIT 1) AS "lastMessage",
		        (SELECT COUNT(*)::int FROM chat_messages m2
		         WHERE m2.room_id = o.id
		           AND m2.sender_id <> $1
		           AND m2.deleted_at IS NULL
		           AND m2.date > COALESCE(
		             (SELECT u.last_read_at FROM chat_members u WHERE u.room_id = o.id AND u.user_id = $1), 0
		         )) AS "unreadCount"
		 FROM chat_rooms o
		 WHERE o.room_type <> 'mail_thread'
		   AND (
		     o.room_type = 'general'
		     OR ($2 = true AND o.room_type = 'team')
		     OR (o.room_type = 'team' AND EXISTS (SELECT 1 FROM team_members tu WHERE tu.team_id = o.team_id AND tu.user_id = $1 AND tu.status = 'active'))
		     OR (o.room_type = 'private' AND EXISTS (SELECT 1 FROM chat_members su WHERE su.room_id = o.id AND su.user_id = $1))
		   )
		 ORDER BY o.room_type = 'general' DESC,
		   COALESCE(
		     (SELECT m3.date FROM chat_messages m3
		      WHERE m3.room_id = o.id AND ($2 = true OR m3.deleted_at IS NULL)
		      ORDER BY m3.date DESC LIMIT 1),
		     o.created_at
		   ) DESC`,
		[userId, isAdmin]
	);

	return res.rows.map((row) => {
		const memberCount = Number(row.memberCount || 0);
		let name = String(row.name || 'Chat');
		let avatar: string | null = null;
		let peerUserId: string | null = null;

		if (row.typeValue === 'private' && memberCount === 2 && row.counterpartUser) {
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
						roomId: String(rawLast.roomId ?? row.id),
						senderId: String(rawLast.senderId ?? ''),
						senderName: String(rawLast.senderName ?? 'Member'),
						senderPhoto: rawLast.senderPhoto ?? null,
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
						isDelivered: Boolean(rawLast.isDelivered && Number(rawLast.isDelivered) > 0),
				  }
				: null,
			unreadCount: Number(row.unreadCount || 0),
		};
	});
}

export async function ensureTeamChatRoom(teamId: string, teamName: string): Promise<string> {
	await ensurePostgresInit();
	const p = getPgPool();
	const roomId = `room_team_${teamId}`;
	await p.query(
		`INSERT INTO chat_rooms (id, room_type, team_id, name, created_at)
		 VALUES ($1, 'team', $2, $3, $4)
		 ON CONFLICT (id) DO UPDATE SET name = $3`,
		[roomId, teamId, `${teamName} Team Chat`, Date.now()]
	);
	return roomId;
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
	void publishEventQuiet(p, { k: 'notification', userId });
}

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
			const isDirect = r.typeValue === 'private' && (r.memberCount || 0) === 2;
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

export async function getUnreadChatCount(userId: string, isAdmin = false): Promise<number> {
	const rooms = await getChatRooms(userId, isAdmin);
	return rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
}
