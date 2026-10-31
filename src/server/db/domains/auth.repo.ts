import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit, withTransaction } from '@/db';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { publishEventQuiet } from '@/db/olaylar';
import { memberTargetName, memberSummary } from '@/lib/audit';
import { encryptSecret, isEncrypted } from '@/lib/auth/secretBox';
import type { User } from '@/db/schema';

export async function updateUserPassword(
	userId: string,
	passwordHash: string,
	invalidateSession = false
): Promise<void> {
	await ensurePostgresInit();
	if (invalidateSession) {
		await getPgPool().query(
			'UPDATE users SET password_hash = $1, session_token = NULL, session_expires_at = NULL WHERE id = $2',
			[passwordHash, userId]
		);
		await publishEventQuiet(getPgPool(), { k: 'oturum', userId });
		return;
	}
	await getPgPool().query('UPDATE users SET password_hash = $1 WHERE id = $2', [
		passwordHash,
		userId,
	]);
}

export async function setUserTotpSecret(userId: string, secret: string): Promise<void> {
	await ensurePostgresInit();
	const encryptedSecret = isEncrypted(secret) ? secret : await encryptSecret(secret);
	await getPgPool().query(
		'UPDATE users SET totp_secret = $1, totp_enabled = 0, totp_confirmed_at = NULL, totp_last_step = NULL WHERE id = $2',
		[encryptedSecret, userId]
	);
}

export async function enableUserTotp(
	userId: string,
	recoveryCodeHashes: string[]
): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		'UPDATE users SET totp_enabled = 1, totp_recovery_codes = $1, totp_confirmed_at = $2, totp_last_step = NULL WHERE id = $3',
		[JSON.stringify(recoveryCodeHashes), Date.now(), userId]
	);
}

export async function disableUserTotp(userId: string, denetim: AuditContext): Promise<void> {
	await withTransaction(async (client) => {
		const res = await client.query(
			'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_codes = NULL, totp_confirmed_at = NULL, totp_last_step = NULL WHERE id = $1 RETURNING first_name AS ad, last_name AS soyad, email AS email',
			[userId]
		);
		const u = res.rows[0];
		if (!u) return;
		await logAuditEvent(client, denetim, {
			islem: 'guvenlik.2fa_kapat',
			hedefTur: 'uye',
			hedefId: userId,
			hedefAd: memberTargetName(u),
			onceki: { ...memberSummary(u), ikiAdim: 'acik' },
			sonraki: { ...memberSummary(u), ikiAdim: 'kapali' },
		});
	});
}

export async function setUserTotpStep(userId: string, timeStep: number): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET totp_last_step = $1 WHERE id = $2', [
		timeStep,
		userId,
	]);
}

export async function setUserRecoveryCodes(
	userId: string,
	recoveryCodeHashes: string[]
): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET totp_recovery_codes = $1 WHERE id = $2', [
		JSON.stringify(recoveryCodeHashes),
		userId,
	]);
}

export interface EmailChangeRequestRow {
	id: string;
	userId: string;
	newEmail: string;
	codeHash: string;
	attempts: number;
	expiresAt: number;
	createdAt: number;
	requestedIp: string | null;
	userAgent: string | null;
}

/** Replaces any open request: one pending e-mail change per member. */
export async function replaceEmailChangeRequest(input: {
	userId: string;
	newEmail: string;
	codeHash: string;
	expiresAt: number;
	ip?: string | null;
	userAgent?: string | null;
}): Promise<void> {
	await ensurePostgresInit();
	await withTransaction(async (client) => {
		await client.query(
			'DELETE FROM email_change_requests WHERE user_id = $1 AND used_at IS NULL',
			[input.userId]
		);
		await client.query(
			`INSERT INTO email_change_requests
				(id, user_id, new_email, code_hash, attempts, expires_at, created_at, requested_ip, user_agent)
			 VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8)`,
			[
				`ecr_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
				input.userId,
				input.newEmail,
				input.codeHash,
				input.expiresAt,
				Date.now(),
				input.ip ?? null,
				input.userAgent ?? null,
			]
		);
	});
}

export async function getOpenEmailChangeRequest(
	userId: string
): Promise<EmailChangeRequestRow | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, user_id AS "userId", new_email AS "newEmail", code_hash AS "codeHash",
		        attempts, expires_at AS "expiresAt", created_at AS "createdAt",
		        requested_ip AS "requestedIp", user_agent AS "userAgent"
		 FROM email_change_requests
		 WHERE user_id = $1 AND used_at IS NULL
		 ORDER BY created_at DESC LIMIT 1`,
		[userId]
	);
	const row = res.rows[0];
	return row
		? {
				id: String(row.id),
				userId: String(row.userId),
				newEmail: String(row.newEmail),
				codeHash: String(row.codeHash),
				attempts: Number(row.attempts) || 0,
				expiresAt: Number(row.expiresAt) || 0,
				createdAt: Number(row.createdAt) || 0,
				requestedIp: row.requestedIp ? String(row.requestedIp) : null,
				userAgent: row.userAgent ? String(row.userAgent) : null,
			}
		: null;
}

export async function incrementEmailChangeAttempts(id: string): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE email_change_requests SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
		[id]
	);
	return Number(res.rows[0]?.attempts) || 0;
}

export async function deleteEmailChangeRequest(id: string): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('DELETE FROM email_change_requests WHERE id = $1', [id]);
}

export function parseRecoveryCodes(user: User | null): string[] {
	if (!user?.totpRecoveryCodes) return [];
	try {
		const parsed = JSON.parse(user.totpRecoveryCodes);
		return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
	} catch {
		return [];
	}
}
