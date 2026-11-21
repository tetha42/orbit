import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit, withTransaction } from '@/db';
import { invalidateChatAudience } from '@/server/chat/chatAudience';
import { notifyChatRoomParticipants } from './notifications';

export async function getOrCreateDmRoom(
	user1Id: string,
	user2Id: string
): Promise<{ roomId: string; isNew: boolean }> {
	await ensurePostgresInit();
	const lockKey = [user1Id, user2Id].sort().join(':');
	return withTransaction(async (client) => {
		await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
		const existing = await client.query(
			`SELECT o.id FROM chat_rooms o
			 WHERE o.room_type = 'private'
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
		const roomName = names || 'Private Chat';

		await client.query(
			`INSERT INTO chat_rooms (id, room_type, name, created_by, created_at)
			 VALUES ($1, 'private', $2, $3, $4)`,
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
		if (!groupTitle) groupTitle = 'New Group';
	}

	await p.query(
		`INSERT INTO chat_rooms (id, room_type, name, created_by, created_at)
		 VALUES ($1, 'private', $2, $3, $4)`,
		[roomId, groupTitle, creator.id, now]
	);

	if (allMemberIds.length > 0) {
		await p.query(
			`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
			 SELECT $1, k.id, u.last_read, $4
			 FROM UNNEST($2::text[], $3::bigint[]) AS u(uid, last_read)
			 JOIN users k ON k.id = u.uid
			 ON CONFLICT (room_id, user_id) DO NOTHING`,
			[roomId, allMemberIds, allMemberIds.map((uid) => (uid === creator.id ? now : now - 1)), now]
		);
	}

	const sysMsgId = randomUUID();
	const creatorName = `${creator.name} ${creator.surname}`.trim();
	const sysContent = `${creatorName} created the group.`;
	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, 'system', 'System', NULL, $3, '[]', $4)`,
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
						senderId: 'system',
						senderName: 'System',
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
		`SELECT u.id, u.first_name AS name, u.last_name AS surname
		 FROM users u
		 WHERE u.id = ANY($1)
		   AND NOT EXISTS (
		     SELECT 1 FROM chat_members cm
		     WHERE cm.room_id = $2 AND cm.user_id = u.id
		   )`,
		[newMemberIds, roomId]
	);

	if (toAddRes.rows.length === 0) return { addedCount: 0 };

	const addIds = toAddRes.rows.map((r) => String(r.id));
	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at, joined_at)
		 SELECT $1, UNNEST($2::text[]), $3, $4
		 ON CONFLICT (room_id, user_id) DO NOTHING`,
		[roomId, addIds, now - 1, now]
	);
	invalidateChatAudience(roomId);

	const addedNames = toAddRes.rows.map((r) => `${r.name} ${r.surname}`.trim()).join(', ');
	const actorName = `${actor.name} ${actor.surname}`.trim();
	const sysContent = `${actorName} added ${addedNames} to the group.`;
	const sysMsgId = randomUUID();

	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, 'system', 'System', NULL, $3, '[]', $4)`,
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
						senderId: 'system',
						senderName: 'System',
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
