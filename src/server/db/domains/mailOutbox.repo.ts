import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import { decryptSecret, encryptSecret } from '@/lib/auth/secretBox';

export type MailOutboxKind = 'registration_verification' | 'password_reset' | 'generic';
export type MailOutboxStatus = 'pending' | 'sent' | 'failed' | 'rejected';

export interface MailOutboxItem {
	id: string;
	kind: MailOutboxKind;
	recipient: string;
	subject: string;
	status: MailOutboxStatus;
	targetUserId: string | null;
	requestedBy: string | null;
	error: string | null;
	attempts: number;
	createdAt: number;
	approvedBy: string | null;
	approvedAt: number | null;
	sentAt: number | null;
}

const COLUMNS = `id, kind, recipient, subject, status, target_user_id AS "targetUserId",
	requested_by AS "requestedBy", error, attempts, created_at AS "createdAt",
	approved_by AS "approvedBy", approved_at AS "approvedAt", sent_at AS "sentAt"`;

function map(row: Record<string, unknown>): MailOutboxItem {
	return {
		id: String(row.id),
		kind: String(row.kind) as MailOutboxKind,
		recipient: String(row.recipient),
		subject: String(row.subject),
		status: String(row.status) as MailOutboxStatus,
		targetUserId: row.targetUserId ? String(row.targetUserId) : null,
		requestedBy: row.requestedBy ? String(row.requestedBy) : null,
		error: row.error ? String(row.error) : null,
		attempts: Number(row.attempts) || 0,
		createdAt: Number(row.createdAt) || 0,
		approvedBy: row.approvedBy ? String(row.approvedBy) : null,
		approvedAt: row.approvedAt ? Number(row.approvedAt) : null,
		sentAt: row.sentAt ? Number(row.sentAt) : null,
	};
}

export async function enqueueMail(input: {
	kind: MailOutboxKind;
	recipient: string;
	subject: string;
	payload?: Record<string, unknown>;
	targetUserId?: string | null;
	requestedBy?: string | null;
}): Promise<MailOutboxItem> {
	await ensurePostgresInit();
	const id = `mail_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const payload = input.payload ? await encryptSecret(JSON.stringify(input.payload)) : '';
	const res = await getPgPool().query(
		`INSERT INTO mail_outbox
			(id, kind, recipient, subject, payload, status, target_user_id, requested_by, created_at)
		 VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
		 RETURNING ${COLUMNS}`,
		[
			id,
			input.kind,
			input.recipient,
			input.subject.slice(0, 250),
			payload,
			input.targetUserId ?? null,
			input.requestedBy ?? null,
			Date.now(),
		]
	);
	return map(res.rows[0]);
}

/** Pending/failed rows for the Mail app approval panel; payload is never listed. */
export async function listMailOutbox(): Promise<MailOutboxItem[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${COLUMNS} FROM mail_outbox
		 WHERE status IN ('pending', 'failed')
		 ORDER BY created_at ASC`
	);
	return res.rows.map(map);
}

export async function getMailOutbox(id: string): Promise<MailOutboxItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`SELECT ${COLUMNS} FROM mail_outbox WHERE id = $1`, [id]);
	return res.rows[0] ? map(res.rows[0]) : null;
}

export async function getMailOutboxPayload(id: string): Promise<Record<string, unknown> | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT payload FROM mail_outbox WHERE id = $1', [id]);
	const raw = res.rows[0]?.payload;
	if (!raw) return null;
	const plain = await decryptSecret(String(raw));
	if (!plain) return null;
	try {
		const parsed = JSON.parse(plain);
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export async function markMailOutbox(
	id: string,
	status: MailOutboxStatus,
	meta: { error?: string | null; approvedBy?: string | null } = {}
): Promise<void> {
	await ensurePostgresInit();
	const now = Date.now();
	await getPgPool().query(
		`UPDATE mail_outbox SET status = $2, error = $3,
			attempts = attempts + CASE WHEN $2 IN ('sent','failed') THEN 1 ELSE 0 END,
			approved_by = COALESCE($4, approved_by),
			approved_at = CASE WHEN $4 IS NULL THEN approved_at ELSE $5 END,
			sent_at = CASE WHEN $2 = 'sent' THEN $5 ELSE sent_at END,
			payload = CASE WHEN $2 IN ('sent','rejected') THEN '' ELSE payload END
		 WHERE id = $1`,
		[id, status, meta.error ?? null, meta.approvedBy ?? null, now]
	);
}
