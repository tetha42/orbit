import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit, withTransaction } from '@/db';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { publishEventQuiet } from '@/db/events';
import { memberTargetName, memberSummary } from '@/lib/audit';
import { encryptSecret, isEncrypted } from '@/lib/auth/secretBox';
import type { User, WebauthnCredential } from '@/db/schema';

export async function updateUserPassword(
	userId: string,
	passwordHash: string,
	invalidateSession = false
): Promise<void> {
	await ensurePostgresInit();
	const now = Date.now();
	if (invalidateSession) {
		await getPgPool().query(
			'UPDATE users SET password_hash = $1, password_changed_at = $2, must_change_password = 0, session_token = NULL, session_expires_at = NULL WHERE id = $3',
			[passwordHash, now, userId]
		);
		await publishEventQuiet(getPgPool(), { k: 'session', userId });
		return;
	}
	await getPgPool().query(
		'UPDATE users SET password_hash = $1, password_changed_at = $2, must_change_password = 0 WHERE id = $3',
		[passwordHash, now, userId]
	);
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

export async function disableUserTotp(userId: string, audit: AuditContext): Promise<void> {
	await withTransaction(async (client) => {
		const res = await client.query(
			'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_recovery_codes = NULL, ' +
				'totp_confirmed_at = NULL, totp_last_step = NULL WHERE id = $1 ' +
				'RETURNING first_name AS name, last_name AS surname, email AS email',
			[userId]
		);
		const u = res.rows[0];
		if (!u) return;
		await logAuditEvent(client, audit, {
			action: 'security.2fa_disable',
			targetType: 'member',
			targetId: userId,
			targetName: memberTargetName(u),
			before: { ...memberSummary(u), twoFactor: 'on' },
			after: { ...memberSummary(u), twoFactor: 'off' },
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

function parseTokenPayload(raw: unknown): Record<string, unknown> {
	if (!raw) return {};
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}
	if (typeof raw === 'object') return raw as Record<string, unknown>;
	return {};
}

/** Replaces any open request: one pending e-mail change per member in verification_tokens. */
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
			"DELETE FROM verification_tokens WHERE user_id = $1 AND token_type = 'email_change' AND used_at IS NULL",
			[input.userId]
		);
		const payload = JSON.stringify({
			requestedIp: input.ip ?? null,
			userAgent: input.userAgent ?? null,
		});
		await client.query(
			`INSERT INTO verification_tokens
				(id, user_id, token_type, target, token_hash, payload, attempts, expires_at, used_at, created_at)
			 VALUES ($1, $2, 'email_change', $3, $4, $5::jsonb, 0, $6, NULL, $7)`,
			[
				`ecr_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
				input.userId,
				input.newEmail,
				input.codeHash,
				payload,
				input.expiresAt,
				Date.now(),
			]
		);
	});
}

export async function getOpenEmailChangeRequest(
	userId: string
): Promise<EmailChangeRequestRow | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, user_id AS "userId", target AS "newEmail", token_hash AS "codeHash",
		        attempts, expires_at AS "expiresAt", created_at AS "createdAt", payload
		 FROM verification_tokens
		 WHERE user_id = $1 AND token_type = 'email_change' AND used_at IS NULL
		 ORDER BY created_at DESC LIMIT 1`,
		[userId]
	);
	const row = res.rows[0];
	if (!row) return null;
	const payload = parseTokenPayload(row.payload);
	return {
		id: String(row.id),
		userId: String(row.userId ?? row.user_id),
		newEmail: String(row.newEmail ?? row.target ?? ''),
		codeHash: String(row.codeHash ?? row.token_hash ?? ''),
		attempts: Number(row.attempts) || 0,
		expiresAt: Number(row.expiresAt ?? row.expires_at) || 0,
		createdAt: Number(row.createdAt ?? row.created_at) || 0,
		requestedIp: payload.requestedIp ? String(payload.requestedIp) : null,
		userAgent: payload.userAgent ? String(payload.userAgent) : null,
	};
}

export async function incrementEmailChangeAttempts(id: string): Promise<number> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE verification_tokens SET attempts = attempts + 1 WHERE id = $1 AND token_type = 'email_change' RETURNING attempts`,
		[id]
	);
	return Number(res.rows[0]?.attempts) || 0;
}

export async function deleteEmailChangeRequest(id: string): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		`DELETE FROM verification_tokens WHERE id = $1 AND token_type = 'email_change'`,
		[id]
	);
}

export async function listUserWebauthnCredentials(userId: string): Promise<WebauthnCredential[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, user_id AS "userId", public_key AS "publicKey", counter, transports,
		        device_type AS "deviceType", backed_up AS "backedUp", nickname,
		        created_at AS "createdAt", last_used_at AS "lastUsage"
		 FROM webauthn_credentials
		 WHERE user_id = $1
		 ORDER BY created_at ASC`,
		[userId]
	);
	return res.rows;
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
