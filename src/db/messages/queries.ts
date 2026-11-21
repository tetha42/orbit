import { ensurePostgresInit, getPgPool } from '../index';
import type { MailPerson, MailMessage, MailStorage } from '@/lib/messages';
import { getAttendees, person } from './threadList';

/** Conversations in the inbox with something unread. */
export async function getUnreadMailCount(userId: string): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT COUNT(DISTINCT m.room_id)::int AS n
		 FROM chat_members cm
		 JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = k.id
		 WHERE cm.user_id = $1 AND cm.folder = 'inbox'
		   AND m.sender_id IS DISTINCT FROM $1
		   AND m.date > cm.last_read_at`,
		[userId]
	);
	return Number(res.rows[0]?.n ?? 0);
}

export interface UnreadMailThread {
	id: string;
	topic: string;
	at: number;
	sender: MailPerson;
}

export async function getUnreadMailThreads(userId: string, limit: number): Promise<UnreadMailThread[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT * FROM (
			SELECT DISTINCT ON (m.room_id) m.room_id AS id, k.name AS topic, m.date AS time, u.id AS gid, u.first_name AS gname, u.last_name AS gsurname
			FROM chat_members cm
			JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
			JOIN chat_messages m ON m.room_id = k.id
			LEFT JOIN users u ON u.id = m.sender_id
			WHERE cm.user_id = $1 AND cm.folder = 'inbox'
			  AND m.sender_id IS DISTINCT FROM $1
			  AND m.date > cm.last_read_at
			ORDER BY m.room_id, m.date DESC
		) x ORDER BY time DESC LIMIT $2`,
		[userId, limit]
	);
	return res.rows.map((r) => ({
		id: String(r.id),
		topic: String(r.topic),
		at: Number(r.time),
		sender: person(r, 'g'),
	}));
}

export interface MailThreadDetail {
	id: string;
	topic: string;
	folder: MailStorage;
	attendees: MailPerson[];
	messages: MailMessage[];
}

export async function getMailThread(userId: string, threadId: string): Promise<MailThreadDetail | null> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`SELECT m.id, m.content AS body, m.date AS creation, m.sender_id AS "senderId",
		        CASE WHEN m.sender_id = $1 OR m.date <= cm.last_read_at THEN 1 ELSE 0 END AS read,
		        cm.folder AS folder, k.name AS topic, u.first_name AS "givenName", u.last_name AS "familySurname"
		 FROM chat_members cm
		 JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = k.id
		 LEFT JOIN users u ON u.id = m.sender_id
		 WHERE cm.user_id = $1 AND cm.folder <> 'deleted' AND cm.room_id = $2
		 ORDER BY m.date, m.id`,
		[userId, threadId]
	);
	if (res.rows.length === 0) return null;
	const last = res.rows[res.rows.length - 1];
	return {
		id: threadId,
		topic: String(last.topic),
		folder: (['archived', 'trash', 'sent'].includes(String(last.folder))
			? String(last.folder)
			: 'inbox') as MailStorage,
		attendees: (await getAttendees([threadId], userId)).get(threadId) ?? [],
		messages: res.rows.map((r) => {
			const gId = String(r.senderId ?? '');
			return {
				id: String(r.id),
				sender: {
					id: gId,
					name: String(r.givenName ?? 'Deleted'),
					surname: String(r.familySurname ?? 'member'),
				},
				body: String(r.body),
				creation: Number(r.creation),
				read: Number(r.read) === 1,
				isMine: gId === userId,
			};
		}),
	};
}

export async function getMailParticipantIds(threadId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT DISTINCT cm.user_id AS "userId"
		 FROM chat_members cm
		 JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
		 WHERE cm.room_id = $1`,
		[threadId]
	);
	return res.rows.map((r) => String(r.userId ?? r.userid));
}

export interface MailSearchThread {
	id: string;
	topic: string;
	last: number;
	people: string;
	text: string;
}

export async function getMailSearchThreads(userId: string, limit = 200): Promise<MailSearchThread[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT m.room_id AS id, k.name AS topic, MAX(m.date) AS last,
			COALESCE(string_agg(DISTINCT u.first_name || ' ' || u.last_name, ', '), '') AS people,
			string_agg(left(m.content, 300), ' ') AS text
		 FROM chat_members cm
		 JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = k.id
		 LEFT JOIN users u ON u.id = m.sender_id
		 WHERE cm.user_id = $1 AND cm.folder <> 'deleted' AND cm.folder <> 'trash'
		 GROUP BY m.room_id, k.name
		 ORDER BY last DESC
		 LIMIT $2`,
		[userId, limit]
	);
	return res.rows.map((r) => ({
		id: String(r.id),
		topic: String(r.topic),
		last: Number(r.last),
		people: String(r.people),
		text: String(r.text ?? ''),
	}));
}
