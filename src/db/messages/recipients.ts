import type { PoolClient } from 'pg';
import { getPgPool } from '../core/pool';
import { ensurePostgresInit } from '../core/init';
import { foldTr } from '@/lib/text';
import type { MailPerson } from '@/lib/messages';

export async function ensureMailSchema(_client: PoolClient): Promise<void> {
	// Mail threads, participants and messages now live in chat_rooms, chat_members and chat_messages.
}

/** A member as the mail endpoints need them: who they are, whether they are active, what role they hold. */
export interface MailMember extends MailPerson {
	status: string;
	roleId: string | null;
	email: string;
	mailEmail: number;
}

export async function getMailMembers(ids: string[]): Promise<MailMember[]> {
	if (ids.length === 0) return [];
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, first_name AS name, last_name AS surname, status, role_id AS "roleId", email, mail_notifications_enabled AS "mailEmail" FROM users WHERE id = ANY($1::text[])`,
		[ids]
	);
	return res.rows;
}

/** What the recipient lookups return: enough to address a message and to tell whether it would arrive. */
export type MailCandidate = MailPerson & { roleId: string | null };

const foldSql = (col: string) =>
	`replace(translate(lower(${col}), '\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00e2\u00ee\u00fb', 'cgiosuaiu'), chr(775), '')`;
const LIKE_ESC = `ESCAPE '\\'`;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, '\\$&');
const MAIL_IDENTITY_MIN = 3;

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
	let rank = '';
	if (terms.length) {
		const esc = likeEscape(terms[0]);
		params.push(`${esc}%`, `% ${esc}%`);
		rank = `CASE WHEN ${name} LIKE $${params.length - 1} ${LIKE_ESC} OR ${name} LIKE $${params.length} ${LIKE_ESC} THEN 0 ELSE 1 END, `;
	}
	const res = await getPgPool().query(
		`SELECT id, first_name AS name, last_name AS surname, role_id AS "roleId" FROM users
		 WHERE status = 'active' AND id <> $1 ${conditions.map((c) => `AND ${c}`).join(' ')}
		 ORDER BY ${rank}first_name, last_name, id
		 LIMIT $2`,
		params
	);
	return res.rows;
}

export async function getRecentMailThreads(userId: string, limit: number): Promise<MailCandidate[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT x.id, x.first_name AS name, x.last_name AS surname, x.role_id AS "roleId", MAX(m.date) AS last
		 FROM chat_members me
		 JOIN chat_rooms r ON r.id = me.room_id AND r.room_type = 'mail_thread'
		 JOIN chat_messages m ON m.room_id = r.id
		 JOIN chat_members o ON o.room_id = r.id AND o.user_id <> $1
		 JOIN users x ON x.id = o.user_id AND x.status = 'active'
		 WHERE me.user_id = $1 AND me.folder <> 'deleted'
		 GROUP BY x.id, x.first_name, x.last_name, x.role_id
		 ORDER BY last DESC, x.id
		 LIMIT $2`,
		[userId, limit]
	);
	return res.rows;
}

export async function getMailCandidate(userId: string, id: string): Promise<MailCandidate | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, first_name AS name, last_name AS surname, role_id AS "roleId" FROM users WHERE id = $2 AND id <> $1 AND status = 'active'`,
		[userId, id]
	);
	return res.rows[0] ?? null;
}

export async function getMailCandidateRoles(userId: string): Promise<{ id: string; roleId: string | null }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, role_id AS "roleId" FROM users WHERE status = 'active' AND id <> $1`,
		[userId]
	);
	return res.rows;
}

export async function getMailEmailSetting(userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT mail_notifications_enabled AS "mailEmail" FROM users WHERE id = $1',
		[userId]
	);
	return Number(res.rows[0]?.mailEmail) === 1;
}

export async function setMailEmailSetting(userId: string, enabled: boolean): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET mail_notifications_enabled = $2 WHERE id = $1', [
		userId,
		enabled ? 1 : 0,
	]);
}
