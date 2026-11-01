/**
 * The portal's internal mail (the Mail app, `mail: kullan`).
 *
 * Tables:
 *   mail_threads     — one row per conversation: subject, who started it, when the newest message came
 *   mail_messages    — the messages of a conversation
 *   mail_recipients  — one row per message and member who can see it: the recipients and the
 *                      sender (whose own copy starts read). It carries the member's own state:
 *                      okundu (read), klasor (gelen | arsiv | cop) and silindi (removed from
 *                      their view for good — nobody else's).
 *
 * A member belongs to a conversation exactly when they have a row in it, so "somebody
 * else's conversation" is simply "no row of mine": the API answers 404 for both that and
 * a conversation that does not exist. A conversation sits in one folder per member; a new
 * message in it puts it back in the inbox of everyone it concerns.
 */
import type { PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from './index';
import { notificationEvents, publishEvent } from './events';
import { foldTr } from '@/lib/text';
import { previewLine, MAIL_PAGE_SIZE, type MailPerson, type MailThreadSummary, type MailFolder, type MailMessage, type MailStorage } from '@/lib/messages';

/** Called from ensurePostgresInit with its raw (lower-case) client, inside its transaction. */
export async function ensureMailSchema(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS mail_threads (
			id TEXT PRIMARY KEY,
			konu TEXT NOT NULL,
			olusturanId TEXT REFERENCES users(id) ON DELETE SET NULL,
			olusturma BIGINT NOT NULL,
			sonMesaj BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_mail_threads_olusturanid ON mail_threads (olusturanId);
		CREATE TABLE IF NOT EXISTS mail_messages (
			id TEXT PRIMARY KEY,
			konuId TEXT NOT NULL REFERENCES mail_threads(id) ON DELETE CASCADE,
			gonderenId TEXT REFERENCES users(id) ON DELETE SET NULL,
			govde TEXT NOT NULL,
			olusturma BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_mail_messages_konu ON mail_messages (konuId, olusturma);
		CREATE INDEX IF NOT EXISTS idx_mail_messages_gonderenid ON mail_messages (gonderenId);
		CREATE TABLE IF NOT EXISTS mail_recipients (
			mesajId TEXT NOT NULL REFERENCES mail_messages(id) ON DELETE CASCADE,
			userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			okundu INTEGER NOT NULL DEFAULT 0,
			klasor TEXT NOT NULL DEFAULT 'gelen',
			silindi INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY (mesajId, userId)
		);
		CREATE INDEX IF NOT EXISTS idx_mail_recipients_kullanici ON mail_recipients (userId, klasor, silindi);
		-- A member's choice: also tell me by e-mail when a message arrives (off by default).
		ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_notifications_enabled INTEGER NOT NULL DEFAULT 0;

		-- Heal sent-only conversations that were previously filed under 'gelen' for the sender.
		UPDATE mail_recipients ma
		SET klasor = 'gonderilen'
		FROM mail_messages m
		WHERE ma.mesajId = m.id
		  AND ma.klasor = 'gelen'
		  AND m.gonderenId = ma.userId
		  AND NOT EXISTS (
			SELECT 1
			FROM mail_messages m2
			JOIN mail_recipients ma2 ON ma2.mesajId = m2.id
			WHERE m2.konuId = m.konuId
			  AND ma2.userId = ma.userId
			  AND ma2.silindi = 0
			  AND m2.gonderenId IS DISTINCT FROM ma.userId
		  );
	`);
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
		`SELECT x.id, x.first_name AS ad, x.last_name AS soyad, x.role_id AS "roleId", MAX(m.olusturma) AS son
		 FROM mail_recipients me
		 JOIN mail_messages m ON m.id = me.mesajId
		 JOIN mail_recipients o ON o.mesajId = m.id AND o.userId <> $1
		 JOIN users x ON x.id = o.userId AND x.status = 'aktif'
		 WHERE me.userId = $1 AND me.silindi = 0
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
	const res = await getPgPool().query(`SELECT id, first_name AS ad, last_name AS soyad, role_id AS "roleId" FROM users WHERE id = $2 AND id <> $1 AND status = 'aktif'`, [userId, id]);
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
			? `AND mine.gonderenId = $1`
			: folderName === 'gelen'
				? `AND mine.gonderenId IS DISTINCT FROM $1`
				: '';
	const lastExpr =
		folderName === 'gonderilen'
			? `COALESCE(t.sonGonderilen, t.son)`
			: folderName === 'gelen'
				? `COALESCE(t.sonGelen, t.son)`
				: `t.son`;
	const countExpr = folderName === 'gonderilen' ? `t.gonderilenAdet` : `t.adet`;
	const unreadExpr = folderName === 'gonderilen' ? `0` : `t.okunmamis`;
	const base = `
		WITH mine AS (
			SELECT m.konuId, m.gonderenId, m.govde, m.olusturma, ma.okundu, ma.klasor
			FROM mail_recipients ma JOIN mail_messages m ON m.id = ma.mesajId
			WHERE ma.userId = $1 AND ma.silindi = 0
		), t AS (
			SELECT konuId,
				MAX(olusturma) AS son,
				MAX(CASE WHEN gonderenId = $1 THEN olusturma END) AS sonGonderilen,
				MAX(CASE WHEN gonderenId IS DISTINCT FROM $1 THEN olusturma END) AS sonGelen,
				COUNT(*)::int AS adet,
				COUNT(*) FILTER (WHERE gonderenId = $1)::int AS gonderilenAdet,
				SUM(CASE WHEN okundu = 0 AND gonderenId IS DISTINCT FROM $1 THEN 1 ELSE 0 END)::int AS okunmamis,
				(array_agg(klasor ORDER BY olusturma DESC))[1] AS klasor,
				bool_or(gonderenId = $1) AS yazdim,
				bool_or(gonderenId IS DISTINCT FROM $1) AS aldim
			FROM mine GROUP BY konuId
		)`;
	const total = await pool.query(`${base} SELECT COUNT(*)::int AS n FROM t WHERE ${folder}`, [userId]);
	const rows = await pool.query(
		`${base}
		SELECT t.konuId AS id, k.konu, ${lastExpr} AS sonMesaj, ${countExpr} AS adet, ${unreadExpr} AS okunmamis, l.govde, u.id AS gid, u.first_name AS gad, u.last_name AS gsoyad
		FROM t
		JOIN mail_threads k ON k.id = t.konuId
		JOIN LATERAL (SELECT govde, gonderenId FROM mine WHERE mine.konuId = t.konuId ${lateralFilter} ORDER BY olusturma DESC LIMIT 1) l ON true
		LEFT JOIN users u ON u.id = l.gonderenId
		WHERE ${folder}
		ORDER BY ${lastExpr} DESC, t.konuId
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
			sonMesaj: Number(r.sonMesaj),
			onizleme: previewLine(String(r.govde)),
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
		`SELECT DISTINCT m.konuId, x.id, x.first_name AS ad, x.last_name AS soyad
		 FROM mail_messages m JOIN mail_recipients ma ON ma.mesajId = m.id JOIN users x ON x.id = ma.userId
		 WHERE m.konuId = ANY($1::text[]) AND x.id <> $2
		 ORDER BY x.first_name, x.last_name`,
		[threadIds, excludeId]
	);
	for (const r of res.rows) {
		const list = out.get(String(r.konuId)) ?? [];
		list.push(person(r));
		out.set(String(r.konuId), list);
	}
	return out;
}

/** Conversations in the inbox with something unread. */
export async function getUnreadMailCount(userId: string): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT COUNT(DISTINCT m.konuId)::int AS n
		 FROM mail_recipients ma JOIN mail_messages m ON m.id = ma.mesajId
		 WHERE ma.userId = $1 AND ma.silindi = 0 AND ma.okundu = 0 AND ma.klasor = 'gelen'
		   AND m.gonderenId IS DISTINCT FROM $1`,
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
			SELECT DISTINCT ON (m.konuId) m.konuId AS id, k.konu, m.olusturma AS zaman, u.id AS gid, u.first_name AS gad, u.last_name AS gsoyad
			FROM mail_recipients ma
			JOIN mail_messages m ON m.id = ma.mesajId
			JOIN mail_threads k ON k.id = m.konuId
			LEFT JOIN users u ON u.id = m.gonderenId
			WHERE ma.userId = $1 AND ma.silindi = 0 AND ma.okundu = 0 AND ma.klasor = 'gelen'
			  AND m.gonderenId IS DISTINCT FROM $1
			ORDER BY m.konuId, m.olusturma DESC
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
		`SELECT m.id, m.govde, m.olusturma, m.gonderenId, ma.okundu, ma.klasor, k.konu, u.first_name AS gad, u.last_name AS gsoyad
		 FROM mail_recipients ma
		 JOIN mail_messages m ON m.id = ma.mesajId
		 JOIN mail_threads k ON k.id = m.konuId
		 LEFT JOIN users u ON u.id = m.gonderenId
		 WHERE ma.userId = $1 AND ma.silindi = 0 AND m.konuId = $2
		 ORDER BY m.olusturma, m.id`,
		[userId, threadId]
	);
	if (res.rows.length === 0) return null;
	const last = res.rows[res.rows.length - 1];
	return {
		id: threadId,
		konu: String(last.konu),
		klasor: (['arsiv', 'cop', 'gonderilen'].includes(String(last.klasor)) ? String(last.klasor) : 'gelen') as MailStorage,
		attendees: (await getAttendees([threadId], userId)).get(threadId) ?? [],
		mesajlar: res.rows.map((r) => ({
			id: String(r.id),
			gonderen: { id: String(r.gonderenId ?? ''), ad: String(r.gad ?? 'Silinmiş'), soyad: String(r.gsoyad ?? 'üye') },
			govde: String(r.govde),
			olusturma: Number(r.olusturma),
			okundu: Number(r.okundu) === 1,
			benimMi: r.gonderenId === userId,
		})),
	};
}

/** Everyone who is part of the conversation (rows of any state), for replying to all. */
export async function getMailParticipantIds(threadId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT DISTINCT ma.userId FROM mail_messages m JOIN mail_recipients ma ON ma.mesajId = m.id WHERE m.konuId = $1`,
		[threadId]
	);
	return res.rows.map((r) => String(r.userId));
}

async function insertMessage(client: PoolClient, threadId: string, senderId: string, body: string, recipientIds: string[], now: number, senderFolder: 'gelen' | 'gonderilen' = 'gonderilen'): Promise<string> {
	const messageId = randomUUID();
	await client.query(`INSERT INTO mail_messages (id, konuId, gonderenId, govde, olusturma) VALUES ($1, $2, $3, $4, $5)`, [messageId, threadId, senderId, body, now]);
	await client.query(`INSERT INTO mail_recipients (mesajId, userId, okundu, klasor, silindi) VALUES ($1, $2, 1, $3, 0)`, [messageId, senderId, senderFolder]);
	for (const id of recipientIds) {
		await client.query(`INSERT INTO mail_recipients (mesajId, userId, okundu, klasor, silindi) VALUES ($1, $2, 0, 'gelen', 0)`, [messageId, id]);
	}
	await client.query(`UPDATE mail_threads SET sonMesaj = $2 WHERE id = $1`, [threadId, now]);
	await publishEvent(client, notificationEvents(recipientIds));
	return messageId;
}

/** Starts a conversation. The recipients have been vetted by the caller (active, role opens Mail). */
export async function createMailThread(senderId: string, subject: string, body: string, recipientIds: string[]): Promise<{ konuId: string; mesajId: string }> {
	return withTransaction(async (client) => {
		const subjectId = randomUUID();
		const now = Date.now();
		await client.query(`INSERT INTO mail_threads (id, konu, olusturanId, olusturma, sonMesaj) VALUES ($1, $2, $3, $4, $4)`, [subjectId, subject, senderId, now]);
		const messageId = await insertMessage(client, subjectId, senderId, body, recipientIds, now, 'gonderilen');
		return { konuId: subjectId, mesajId: messageId };
	});
}

/** Adds a message to a conversation and puts it in the inbox of the recipients (and sender only if they have received messages in the thread). */
export async function addMailReply(threadId: string, senderId: string, body: string, recipientIds: string[]): Promise<string> {
	return withTransaction(async (client) => {
		if (recipientIds.length > 0) {
			await client.query(
				`UPDATE mail_recipients SET klasor = 'gelen'
				 WHERE userId = ANY($2::text[]) AND silindi = 0 AND mesajId IN (SELECT id FROM mail_messages WHERE konuId = $1)`,
				[threadId, recipientIds]
			);
		}
		const incomingRes = await client.query(
			`SELECT 1 FROM mail_recipients ma JOIN mail_messages m ON m.id = ma.mesajId
			 WHERE ma.userId = $2 AND ma.silindi = 0 AND m.konuId = $1 AND m.gonderenId IS DISTINCT FROM $2 LIMIT 1`,
			[threadId, senderId]
		);
		const senderFolder: 'gelen' | 'gonderilen' = incomingRes.rows.length > 0 ? 'gelen' : 'gonderilen';
		await client.query(
			`UPDATE mail_recipients SET klasor = $3 WHERE userId = $2 AND silindi = 0 AND mesajId IN (SELECT id FROM mail_messages WHERE konuId = $1)`,
			[threadId, senderId, senderFolder]
		);
		return insertMessage(client, threadId, senderId, body, recipientIds, Date.now(), senderFolder);
	});
}

export type MailStatusAction = 'okundu' | 'okunmadi' | 'arsivle' | 'gelene' | 'cope' | 'sil';

/** Applies a state change to the member's own rows of a conversation. Returns false when they have none. */
export async function setMailThreadStatus(userId: string, threadId: string, action: MailStatusAction): Promise<boolean> {
	await ensurePostgresInit();
	const own = `userId = $1 AND silindi = 0 AND mesajId IN (SELECT id FROM mail_messages WHERE konuId = $2)`;
	const pool = getPgPool();
	let res;
	switch (action) {
		case 'okundu':
			res = await pool.query(`UPDATE mail_recipients SET okundu = 1 WHERE ${own}`, [userId, threadId]);
			break;
		case 'okunmadi':
			// Only the newest incoming message goes back to unread: the thread is "something to look at again".
			res = await pool.query(
				`UPDATE mail_recipients SET okundu = 0
				 WHERE ${own} AND mesajId = (
					SELECT m.id FROM mail_messages m JOIN mail_recipients x ON x.mesajId = m.id AND x.userId = $1 AND x.silindi = 0
					WHERE m.konuId = $2 AND m.gonderenId IS DISTINCT FROM $1 ORDER BY m.olusturma DESC, m.id DESC LIMIT 1)`,
				[userId, threadId]
			);
			break;
		case 'arsivle':
		case 'cope':
			res = await pool.query(`UPDATE mail_recipients SET klasor = $3 WHERE ${own}`, [userId, threadId, action === 'arsivle' ? 'arsiv' : 'cop']);
			break;
		case 'gelene':
			res = await pool.query(
				`UPDATE mail_recipients SET klasor = CASE WHEN EXISTS (
					SELECT 1 FROM mail_recipients ma2 JOIN mail_messages m2 ON m2.id = ma2.mesajId
					WHERE ma2.userId = $1 AND ma2.silindi = 0 AND m2.konuId = $2 AND m2.gonderenId IS DISTINCT FROM $1
				 ) THEN 'gelen' ELSE 'gonderilen' END WHERE ${own}`,
				[userId, threadId]
			);
			break;
		case 'sil':
			res = await pool.query(`UPDATE mail_recipients SET silindi = 1 WHERE ${own}`, [userId, threadId]);
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
		`SELECT m.konuId AS id, k.konu, MAX(m.olusturma) AS son,
			COALESCE(string_agg(DISTINCT u.first_name || ' ' || u.last_name, ', '), '') AS kisiler,
			string_agg(left(m.govde, 300), ' ') AS metin
		 FROM mail_recipients ma
		 JOIN mail_messages m ON m.id = ma.mesajId
		 JOIN mail_threads k ON k.id = m.konuId
		 LEFT JOIN users u ON u.id = m.gonderenId
		 WHERE ma.userId = $1 AND ma.silindi = 0 AND ma.klasor <> 'cop'
		 GROUP BY m.konuId, k.konu
		 ORDER BY son DESC
		 LIMIT $2`,
		[userId, limit]
	);
	return res.rows.map((r) => ({ id: String(r.id), konu: String(r.konu), son: Number(r.son), kisiler: String(r.kisiler), metin: String(r.metin ?? '') }));
}
