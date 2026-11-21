import { ensurePostgresInit, getPgPool } from '../index';
import {
	previewLine,
	MAIL_PAGE_SIZE,
	type MailPerson,
	type MailThreadSummary,
	type MailFolder,
} from '@/lib/messages';

export const person = (row: Record<string, unknown>, prefix = ''): MailPerson => ({
	id: String(row[`${prefix}id`] ?? ''),
	name: String(row[`${prefix}name`] ?? 'Deleted'),
	surname: String(row[`${prefix}surname`] ?? 'member'),
});

/** Everyone with a row in each conversation, apart from `excludeId`. */
export async function getAttendees(threadIds: string[], excludeId: string): Promise<Map<string, MailPerson[]>> {
	const out = new Map<string, MailPerson[]>();
	if (threadIds.length === 0) return out;
	const res = await getPgPool().query(
		`SELECT DISTINCT cm.room_id AS "topicId", x.id, x.first_name AS name, x.last_name AS surname
		 FROM chat_members cm
		 JOIN users x ON x.id = cm.user_id
		 WHERE cm.room_id = ANY($1::text[]) AND x.id <> $2
		 ORDER BY x.first_name, x.last_name`,
		[threadIds, excludeId]
	);
	for (const r of res.rows) {
		const key = String(r.topicId ?? '');
		const list = out.get(key) ?? [];
		list.push(person(r));
		out.set(key, list);
	}
	return out;
}

/** The conversations in one folder of the member's, newest first. */
export async function getMailThreads(
	userId: string,
	folderName: MailFolder,
	page: number,
	pageSize = MAIL_PAGE_SIZE
): Promise<{ topics: MailThreadSummary[]; total: number }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const folder =
		folderName === 'sent'
			? `t.wrote AND t.folder <> 'trash'`
			: folderName === 'inbox'
				? `t.folder = 'inbox' AND t.received`
				: `t.folder = '${folderName === 'archived' ? 'archived' : 'trash'}'`;
	const lateralFilter =
		folderName === 'sent'
			? `AND mine.sender_id = $1`
			: folderName === 'inbox'
				? `AND mine.sender_id IS DISTINCT FROM $1`
				: '';
	const lastExpr =
		folderName === 'sent'
			? `COALESCE(t.last_sent, t.last)`
			: folderName === 'inbox'
				? `COALESCE(t.last_incoming, t.last)`
				: `t.last`;
	const countExpr = folderName === 'sent' ? `t.sent_count` : `t.count`;
	const unreadExpr = folderName === 'sent' ? `0` : `t.unread`;
	const base = `
		WITH mine AS (
			SELECT m.room_id, m.sender_id, m.content, m.date,
				CASE WHEN m.sender_id = $1 OR m.date <= cm.last_read_at THEN 1 ELSE 0 END AS read,
				cm.folder AS folder
			FROM chat_members cm
			JOIN chat_rooms r ON r.id = cm.room_id AND r.room_type = 'mail_thread'
			JOIN chat_messages m ON m.room_id = r.id
			WHERE cm.user_id = $1 AND cm.folder <> 'deleted'
		), t AS (
			SELECT room_id,
				MAX(date) AS last,
				MAX(CASE WHEN sender_id = $1 THEN date END) AS last_sent,
				MAX(CASE WHEN sender_id IS DISTINCT FROM $1 THEN date END) AS last_incoming,
				COUNT(*)::int AS count,
				COUNT(*) FILTER (WHERE sender_id = $1)::int AS sent_count,
				SUM(CASE WHEN read = 0 AND sender_id IS DISTINCT FROM $1 THEN 1 ELSE 0 END)::int AS unread,
				(array_agg(folder ORDER BY date DESC))[1] AS folder,
				bool_or(sender_id = $1) AS wrote,
				bool_or(sender_id IS DISTINCT FROM $1) AS received
			FROM mine GROUP BY room_id
		)`;
	const [total, rows] = await Promise.all([
		pool.query(`${base} SELECT COUNT(*)::int AS n FROM t WHERE ${folder}`, [userId]),
		pool.query(
			`${base}
			SELECT t.room_id AS id, k.name AS topic, ${lastExpr} AS "lastMessage",
				${countExpr} AS count, ${unreadExpr} AS unread, l.content AS body,
				u.id AS gid, u.first_name AS gname, u.last_name AS gsurname
			FROM t
			JOIN chat_rooms k ON k.id = t.room_id
			JOIN LATERAL (
				SELECT content, sender_id FROM mine
				WHERE mine.room_id = t.room_id ${lateralFilter}
				ORDER BY date DESC LIMIT 1
			) l ON true
			LEFT JOIN users u ON u.id = l.sender_id
			WHERE ${folder}
			ORDER BY ${lastExpr} DESC, t.room_id
			LIMIT $2 OFFSET $3`,
			[userId, pageSize, (Math.max(1, page) - 1) * pageSize]
		),
	]);
	const attendees = await getAttendees(
		rows.rows.map((r) => String(r.id)),
		userId
	);
	return {
		total: Number(total.rows[0]?.n ?? 0),
		topics: rows.rows.map((r) => ({
			id: String(r.id),
			topic: String(r.topic),
			lastMessage: Number(r.lastMessage ?? 0),
			preview: previewLine(String(r.body ?? '')),
			lastSender: person(r, 'g'),
			attendees: attendees.get(String(r.id)) ?? [],
			messageCount: Number(r.count),
			unread: Number(r.unread),
		})),
	};
}
