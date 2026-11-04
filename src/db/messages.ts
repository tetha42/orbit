/**
 * The portal's internal mail (the Mail app, `mail: kullan`).
 *
 * Stored in the unified communication tables:
 *   chat_rooms    — room_type = 'mail_thread', name = subject, created_by = creator user_id
 *   chat_members  — room_id, user_id, folder ('gelen' | 'gonderilen' | 'arsiv' | 'cop' | 'silindi'),
 *                   is_starred, last_read_at, joined_at
 *   chat_messages — id, room_id, sender_id, content, date
 */
import type { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from './index';
import { notificationEvents, publishEvent } from './events';
import { foldTr } from '@/lib/text';
import { previewLine, MAIL_PAGE_SIZE, type MailPerson, type MailThreadSummary, type MailFolder, type MailMessage, type MailStorage } from '@/lib/messages';

/** Called from ensurePostgresInit with its raw (lower-case) client, inside its transaction. */
export async function ensureMailSchema(_client: PoolClient): Promise<void> {
	// Mail threads, participants and messages now live in chat_rooms, chat_members and chat_messages.
}

/** A member as the mail endpoints need them: who they are, whether they are active, what role they hold. */
export interface MailMember extends MailPerson {
	status: string;
	roleId: string | null;
	email: string;
	postaEposta: number;
}

export async function getMailMembers(ids: string[]): Promise<MailMember[]> {
	if (ids.length === 0) return [];
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, first_name AS ad, last_name AS soyad, status, role_id AS "roleId", email, mail_notifications_enabled AS "postaEposta" FROM users WHERE id = ANY($1::text[])`,
		[ids]
	);
	return res.rows;
}

/** What the recipient lookups return: enough to address a message and to tell whether it would arrive. */
export type MailCandidate = MailPerson & { roleId: string | null };

/**
 * `col` lower-cased the way `foldTr` folds text (Turkish letters to ASCII, the combining dot
 * of "İ" dropped), so a search typed in either alphabet meets the stored text. The database
 * collation does not fold these on its own.
 */
const foldSql = (col: string) => `replace(translate(lower(${col}), 'çğıöşüâîû', 'cgiosuaiu'), chr(775), '')`;
const LIKE_ESC = `ESCAPE '\\'`;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, '\\$&');
/** Typed text shorter than this never matches an e-mail address or a student number: no walking the directory letter by letter. */
const MAIL_IDENTITY_MIN = 3;

/**
 * Active members other than the caller whose name or department contains, or whose e-mail
 * address or student number starts with, every word of `q` — the recipient picker's lookup.
 * Parameterised throughout; `%`, `_` and `\` in the text are literal. Only the name leaves
 * the database: e-mail address, department and student number are matched, never returned.
 */
export async function searchMailCandidates(userId: string, q: string, limit: number): Promise<MailCandidate[]> {
	await ensurePostgresInit();
	const terms = foldTr(q).split(/\s+/).filter(Boolean).slice(0, 5);
	const params: unknown[] = [userId, limit];
	const name = foldSql(`first_name || ' ' || last_name`);
	const conditions = terms.map((term) => {
		const esc = likeEscape(term);
		params.push(`%${esc}%`);
		const contains = `$${params.length}`;
		let clause = `${name} LIKE ${contains} ${LIKE_ESC} OR ${foldSql('department')} LIKE ${contains} ${LIKE_ESC}`;
		if (term.length >= MAIL_IDENTITY_MIN) {
			params.push(`${esc}%`);
			const prefix = `$${params.length}`;
			clause += ` OR ${foldSql('email')} LIKE ${prefix} ${LIKE_ESC} OR ${foldSql('handle')} LIKE ${prefix} ${LIKE_ESC}`;
		}
		return `(${clause})`;
	});
	// People whose name starts with the first word come before those matched some other way.
	let rank = '';
	if (terms.length) {
		const esc = likeEscape(terms[0]);
		params.push(`${esc}%`, `% ${esc}%`);
		rank = `CASE WHEN ${name} LIKE $${params.length - 1} ${LIKE_ESC} OR ${name} LIKE $${params.length} ${LIKE_ESC} THEN 0 ELSE 1 END, `;
	}
	const res = await getPgPool().query(
		`SELECT id, first_name AS ad, last_name AS soyad, role_id AS "roleId" FROM users
		 WHERE status = 'aktif' AND id <> $1 ${conditions.map((c) => `AND ${c}`).join(' ')}
		 ORDER BY ${rank}first_name, last_name, id
		 LIMIT $2`,
		params
	);
	return res.rows;
}

/** The active members the caller has written with most recently, newest first: the picker's suggestions before anything is typed. */
export async function getRecentMailThreads(userId: string, limit: number): Promise<MailCandidate[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT x.id, x.first_name AS ad, x.last_name AS soyad, x.role_id AS "roleId", MAX(m.date) AS son
		 FROM chat_members me
		 JOIN chat_rooms r ON r.id = me.room_id AND r.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = r.id
		 JOIN chat_members o ON o.room_id = r.id AND o.user_id <> $1
		 JOIN users x ON x.id = o.user_id AND x.status = 'aktif'
		 WHERE me.user_id = $1 AND me.folder <> 'silindi'
		 GROUP BY x.id, x.first_name, x.last_name, x.role_id
		 ORDER BY son DESC, x.id
		 LIMIT $2`,
		[userId, limit]
	);
	return res.rows;
}

/** One active member (not the caller) by id, or null. */
export async function getMailCandidate(userId: string, id: string): Promise<MailCandidate | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, first_name AS ad, last_name AS soyad, role_id AS "roleId" FROM users WHERE id = $2 AND id <> $1 AND status = 'aktif'`,
		[userId, id]
	);
	return res.rows[0] ?? null;
}

/** Every active member (not the caller) with the role they hold: what "who can I message" is worked out from. */
export async function getMailCandidateRoles(userId: string): Promise<{ id: string; roleId: string | null }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`SELECT id, role_id AS "roleId" FROM users WHERE status = 'aktif' AND id <> $1`, [userId]);
	return res.rows;
}

export async function getMailEmailSetting(userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT mail_notifications_enabled AS "postaEposta" FROM users WHERE id = $1', [userId]);
	return Number(res.rows[0]?.postaEposta) === 1;
}

export async function setMailEmailSetting(userId: string, enabled: boolean): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET mail_notifications_enabled = $2 WHERE id = $1', [userId, enabled ? 1 : 0]);
}

const person = (row: Record<string, unknown>, prefix = ''): MailPerson => ({
	id: String(row[`${prefix}id`] ?? ''),
	ad: String(row[`${prefix}ad`] ?? 'Silinmiş'),
	soyad: String(row[`${prefix}soyad`] ?? 'üye'),
});

/** The conversations in one folder of the member's, newest first. */
export async function getMailThreads(
	userId: string,
	folderName: MailFolder,
	page: number,
	pageSize = MAIL_PAGE_SIZE
): Promise<{ konular: MailThreadSummary[]; toplam: number }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const folder =
		folderName === 'gonderilen'
			? `t.yazdim AND t.klasor <> 'cop'`
			: folderName === 'gelen'
				? `t.klasor = 'gelen' AND t.aldim`
				: `t.klasor = '${folderName === 'arsiv' ? 'arsiv' : 'cop'}'`;
	const lateralFilter =
		folderName === 'gonderilen'
			? `AND mine.sender_id = $1`
			: folderName === 'gelen'
				? `AND mine.sender_id IS DISTINCT FROM $1`
				: '';
	const lastExpr =
		folderName === 'gonderilen'
			? `COALESCE(t.son_gonderilen, t.son)`
			: folderName === 'gelen'
				? `COALESCE(t.son_gelen, t.son)`
				: `t.son`;
	const countExpr = folderName === 'gonderilen' ? `t.gonderilen_adet` : `t.adet`;
	const unreadExpr = folderName === 'gonderilen' ? `0` : `t.okunmamis`;
	const base = `
		WITH mine AS (
			SELECT m.room_id, m.sender_id, m.content, m.date,
				CASE WHEN m.sender_id = $1 OR m.date <= cm.last_read_at THEN 1 ELSE 0 END AS okundu,
				cm.folder AS klasor
			FROM chat_members cm
			JOIN chat_rooms r ON r.id = cm.room_id AND r.room_type = 'mail_thread'
			JOIN chat_messages m ON m.room_id = r.id
			WHERE cm.user_id = $1 AND cm.folder <> 'silindi'
		), t AS (
			SELECT room_id,
				MAX(date) AS son,
				MAX(CASE WHEN sender_id = $1 THEN date END) AS son_gonderilen,
				MAX(CASE WHEN sender_id IS DISTINCT FROM $1 THEN date END) AS son_gelen,
				COUNT(*)::int AS adet,
				COUNT(*) FILTER (WHERE sender_id = $1)::int AS gonderilen_adet,
				SUM(CASE WHEN okundu = 0 AND sender_id IS DISTINCT FROM $1 THEN 1 ELSE 0 END)::int AS okunmamis,
				(array_agg(klasor ORDER BY date DESC))[1] AS klasor,
				bool_or(sender_id = $1) AS yazdim,
				bool_or(sender_id IS DISTINCT FROM $1) AS aldim
			FROM mine GROUP BY room_id
		)`;
	const total = await pool.query(`${base} SELECT COUNT(*)::int AS n FROM t WHERE ${folder}`, [userId]);
	const rows = await pool.query(
		`${base}
		SELECT t.room_id AS id, k.name AS konu, ${lastExpr} AS "sonMesaj", ${countExpr} AS adet, ${unreadExpr} AS okunmamis, l.content AS govde, u.id AS gid, u.first_name AS gad, u.last_name AS gsoyad
		FROM t
		JOIN chat_rooms k ON k.id = t.room_id
		JOIN LATERAL (SELECT content, sender_id FROM mine WHERE mine.room_id = t.room_id ${lateralFilter} ORDER BY date DESC LIMIT 1) l ON true
		LEFT JOIN users u ON u.id = l.sender_id
		WHERE ${folder}
		ORDER BY ${lastExpr} DESC, t.room_id
		LIMIT $2 OFFSET $3`,
		[userId, pageSize, (Math.max(1, page) - 1) * pageSize]
	);
	const attendees = await getAttendees(
		rows.rows.map((r) => String(r.id)),
		userId
	);
	return {
		toplam: Number(total.rows[0]?.n ?? 0),
		konular: rows.rows.map((r) => ({
			id: String(r.id),
			konu: String(r.konu),
			sonMesaj: Number(r.sonMesaj ?? r.sonmesaj ?? 0),
			onizleme: previewLine(String(r.govde ?? '')),
			sonGonderen: person(r, 'g'),
			attendees: attendees.get(String(r.id)) ?? [],
			mesajSayisi: Number(r.adet),
			okunmamis: Number(r.okunmamis),
		})),
	};
}

/** Everyone with a row in each conversation, apart from `excludeId`. */
async function getAttendees(threadIds: string[], excludeId: string): Promise<Map<string, MailPerson[]>> {
	const out = new Map<string, MailPerson[]>();
	if (threadIds.length === 0) return out;
	const res = await getPgPool().query(
		`SELECT DISTINCT cm.room_id AS "konuId", x.id, x.first_name AS ad, x.last_name AS soyad
		 FROM chat_members cm
		 JOIN users x ON x.id = cm.user_id
		 WHERE cm.room_id = ANY($1::text[]) AND x.id <> $2
		 ORDER BY x.first_name, x.last_name`,
		[threadIds, excludeId]
	);
	for (const r of res.rows) {
		const key = String(r.konuId ?? r.konuid ?? '');
		const list = out.get(key) ?? [];
		list.push(person(r));
		out.set(key, list);
	}
	return out;
}

/** Conversations in the inbox with something unread. */
export async function getUnreadMailCount(userId: string): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT COUNT(DISTINCT m.room_id)::int AS n
		 FROM chat_members cm
		 JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = k.id
		 WHERE cm.user_id = $1 AND cm.folder = 'gelen'
		   AND m.sender_id IS DISTINCT FROM $1
		   AND m.date > cm.last_read_at`,
		[userId]
	);
	return Number(res.rows[0]?.n ?? 0);
}

export interface UnreadMailThread {
	id: string;
	konu: string;
	at: number;
	gonderen: MailPerson;
}

/** The newest unread message of each unread inbox conversation, newest first: what the notification list shows. */
export async function getUnreadMailThreads(userId: string, limit: number): Promise<UnreadMailThread[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT * FROM (
			SELECT DISTINCT ON (m.room_id) m.room_id AS id, k.name AS konu, m.date AS zaman, u.id AS gid, u.first_name AS gad, u.last_name AS gsoyad
			FROM chat_members cm
			JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
			JOIN chat_messages m ON m.room_id = k.id
			LEFT JOIN users u ON u.id = m.sender_id
			WHERE cm.user_id = $1 AND cm.folder = 'gelen'
			  AND m.sender_id IS DISTINCT FROM $1
			  AND m.date > cm.last_read_at
			ORDER BY m.room_id, m.date DESC
		) x ORDER BY zaman DESC LIMIT $2`,
		[userId, limit]
	);
	return res.rows.map((r) => ({ id: String(r.id), konu: String(r.konu), at: Number(r.zaman), gonderen: person(r, 'g') }));
}

export interface MailThreadDetail {
	id: string;
	konu: string;
	klasor: MailStorage;
	attendees: MailPerson[];
	mesajlar: MailMessage[];
}

/** The conversation as this member sees it, or null when they have no part in it (or it does not exist). */
export async function getMailThread(userId: string, threadId: string): Promise<MailThreadDetail | null> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`SELECT m.id, m.content AS govde, m.date AS olusturma, m.sender_id AS "gonderenId",
		        CASE WHEN m.sender_id = $1 OR m.date <= cm.last_read_at THEN 1 ELSE 0 END AS okundu,
		        cm.folder AS klasor, k.name AS konu, u.first_name AS gad, u.last_name AS gsoyad
		 FROM chat_members cm
		 JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = k.id
		 LEFT JOIN users u ON u.id = m.sender_id
		 WHERE cm.user_id = $1 AND cm.folder <> 'silindi' AND cm.room_id = $2
		 ORDER BY m.date, m.id`,
		[userId, threadId]
	);
	if (res.rows.length === 0) return null;
	const last = res.rows[res.rows.length - 1];
	return {
		id: threadId,
		konu: String(last.konu),
		klasor: (['arsiv', 'cop', 'gonderilen'].includes(String(last.klasor)) ? String(last.klasor) : 'gelen') as MailStorage,
		attendees: (await getAttendees([threadId], userId)).get(threadId) ?? [],
		mesajlar: res.rows.map((r) => {
			const gId = String(r.gonderenId ?? r.gonderenid ?? '');
			return {
				id: String(r.id),
				gonderen: { id: gId, ad: String(r.gad ?? 'Silinmiş'), soyad: String(r.gsoyad ?? 'üye') },
				govde: String(r.govde),
				olusturma: Number(r.olusturma),
				okundu: Number(r.okundu) === 1,
				benimMi: gId === userId,
			};
		}),
	};
}

/** Everyone who is part of the conversation (rows of any state), for replying to all. */
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

async function insertMessage(
	client: PoolClient,
	threadId: string,
	senderId: string,
	body: string,
	recipientIds: string[],
	now: number,
	senderFolder: 'gelen' | 'gonderilen' = 'gonderilen'
): Promise<string> {
	const messageId = randomUUID();
	const senderRes = await client.query(
		`SELECT first_name, last_name, avatar_url FROM users WHERE id = $1`,
		[senderId]
	);
	const senderRow = senderRes.rows[0];
	const senderName = senderRow ? `${senderRow.first_name ?? senderRow.firstName ?? ''} ${senderRow.last_name ?? senderRow.lastName ?? ''}`.trim() : '';
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
	for (const id of recipientIds) {
		await client.query(
			`INSERT INTO chat_members (room_id, user_id, folder, is_starred, last_read_at, joined_at)
			 VALUES ($1, $2, 'gelen', 0, 0, $3)
			 ON CONFLICT (room_id, user_id) DO UPDATE SET
			   folder = CASE WHEN chat_members.folder = 'silindi' THEN 'silindi' ELSE 'gelen' END`,
			[threadId, id, now]
		);
	}
	await publishEvent(client, notificationEvents(recipientIds));
	return messageId;
}

/** Starts a conversation. The recipients have been vetted by the caller (active, role opens Mail). */
export async function createMailThread(
	senderId: string,
	subject: string,
	body: string,
	recipientIds: string[]
): Promise<{ konuId: string; mesajId: string }> {
	return withTransaction(async (client) => {
		const subjectId = randomUUID();
		const now = Date.now();
		await client.query(
			`INSERT INTO chat_rooms (id, room_type, team_id, name, created_by, created_at)
			 VALUES ($1, 'mail_thread', NULL, $2, $3, $4)`,
			[subjectId, subject, senderId, now]
		);
		const messageId = await insertMessage(client, subjectId, senderId, body, recipientIds, now, 'gonderilen');
		return { konuId: subjectId, mesajId: messageId };
	});
}

/** Adds a message to a conversation and puts it in the inbox of the recipients (and sender only if they have received messages in the thread). */
export async function addMailReply(threadId: string, senderId: string, body: string, recipientIds: string[]): Promise<string> {
	return withTransaction(async (client) => {
		if (recipientIds.length > 0) {
			await client.query(
				`UPDATE chat_members SET folder = 'gelen'
				 WHERE room_id = $1 AND user_id = ANY($2::text[]) AND folder <> 'silindi'`,
				[threadId, recipientIds]
			);
		}
		const incomingRes = await client.query(
			`SELECT 1 FROM chat_members cm
			 JOIN chat_messages m ON m.room_id = cm.room_id
			 WHERE cm.room_id = $1 AND cm.user_id = $2 AND cm.folder <> 'silindi'
			   AND m.sender_id IS DISTINCT FROM $2
			 LIMIT 1`,
			[threadId, senderId]
		);
		const senderFolder: 'gelen' | 'gonderilen' = incomingRes.rows.length > 0 ? 'gelen' : 'gonderilen';
		return insertMessage(client, threadId, senderId, body, recipientIds, Date.now(), senderFolder);
	});
}

export type MailStatusAction = 'okundu' | 'okunmadi' | 'arsivle' | 'gelene' | 'cope' | 'sil';

/** Applies a state change to the member's own rows of a conversation. Returns false when they have none. */
export async function setMailThreadStatus(userId: string, threadId: string, action: MailStatusAction): Promise<boolean> {
	await ensurePostgresInit();
	const own = `user_id = $1 AND room_id = $2 AND folder <> 'silindi'`;
	const pool = getPgPool();
	let res;
	switch (action) {
		case 'okundu':
			res = await pool.query(
				`UPDATE chat_members
				 SET last_read_at = GREATEST(last_read_at, COALESCE((SELECT MAX(date) FROM chat_messages WHERE room_id = $2), $3))
				 WHERE ${own}`,
				[userId, threadId, Date.now()]
			);
			break;
		case 'okunmadi':
			// Only the newest incoming message goes back to unread: the thread is "something to look at again".
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
		case 'arsivle':
		case 'cope':
			res = await pool.query(`UPDATE chat_members SET folder = $3 WHERE ${own}`, [userId, threadId, action === 'arsivle' ? 'arsiv' : 'cop']);
			break;
		case 'gelene':
			res = await pool.query(
				`UPDATE chat_members SET folder = CASE WHEN EXISTS (
					SELECT 1 FROM chat_messages m2
					WHERE m2.room_id = $2 AND m2.sender_id IS DISTINCT FROM $1
				 ) THEN 'gelen' ELSE 'gonderilen' END WHERE ${own}`,
				[userId, threadId]
			);
			break;
		case 'sil':
			res = await pool.query(`UPDATE chat_members SET folder = 'silindi' WHERE ${own}`, [userId, threadId]);
			break;
	}
	return (res.rowCount ?? 0) > 0;
}

export interface MailSearchThread {
	id: string;
	konu: string;
	son: number;
	kisiler: string;
	metin: string;
}

/** The member's own conversations (trash left out), with the text search matches against. */
export async function getMailSearchThreads(userId: string, limit = 200): Promise<MailSearchThread[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT m.room_id AS id, k.name AS konu, MAX(m.date) AS son,
			COALESCE(string_agg(DISTINCT u.first_name || ' ' || u.last_name, ', '), '') AS kisiler,
			string_agg(left(m.content, 300), ' ') AS metin
		 FROM chat_members cm
		 JOIN chat_rooms k ON k.id = cm.room_id AND k.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = k.id
		 LEFT JOIN users u ON u.id = m.sender_id
		 WHERE cm.user_id = $1 AND cm.folder <> 'silindi' AND cm.folder <> 'cop'
		 GROUP BY m.room_id, k.name
		 ORDER BY son DESC
		 LIMIT $2`,
		[userId, limit]
	);
	return res.rows.map((r) => ({ id: String(r.id), konu: String(r.konu), son: Number(r.son), kisiler: String(r.kisiler), metin: String(r.metin ?? '') }));
}
