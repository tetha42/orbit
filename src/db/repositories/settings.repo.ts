import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { SYSTEM_SETTINGS_DEFAULTS, type WebauthnCredential } from '@/db/schema';
import { logAuditEvent, type AuditContext, type AuditEntry } from '@/db/audit';
import type { Diff } from '@/lib/audit';

export async function getSystemSettings(): Promise<Record<string, string>> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT key AS key, value AS value FROM system_settings');
	const map: Record<string, string> = { ...SYSTEM_SETTINGS_DEFAULTS };
	for (const row of res.rows) {
		map[row.key] = row.value;
	}
	return map;
}

export async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT value AS value FROM system_settings WHERE key = $1', [key]);
	return res.rows[0]?.value ?? SYSTEM_SETTINGS_DEFAULTS[key] ?? defaultValue;
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
	await ensurePostgresInit();
	const now = Date.now();
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET 
		   value = EXCLUDED.value,
		   updated_at = EXCLUDED.updated_at`,
		[key, value, now]
	);
}

/**
 * Writes several settings at once. With `denetim`, the previous values are read
 * and a record is written (when `fark` finds a change) in the same transaction.
 */
export async function setSystemSettings(
	settings: Record<string, string>,
	audit?: {
		ctx: AuditContext;
		registration: Omit<AuditEntry, 'before' | 'after'>;
		diff: (before: Record<string, string | undefined>, fresh: Record<string, string>) => Diff | null;
	}
): Promise<void> {
	const now = Date.now();
	await withTransaction(async (client) => {
		let previous: Record<string, string | undefined> = {};
		if (audit) {
			const res = await client.query('SELECT key AS key, value AS value FROM system_settings WHERE key = ANY($1) FOR UPDATE', [Object.keys(settings)]);
			previous = Object.fromEntries(res.rows.map((r) => [r.key as string, r.value as string]));
		}
		for (const [key, value] of Object.entries(settings)) {
			await client.query(
				`INSERT INTO system_settings (key, value, updated_at)
				 VALUES ($1, $2, $3)
				 ON CONFLICT (key) DO UPDATE SET 
				   value = EXCLUDED.value,
				   updated_at = EXCLUDED.updated_at`,
				[key, value, now]
			);
		}
		const diff = audit?.diff(previous, settings);
		if (audit && diff) await logAuditEvent(client, audit.ctx, { ...audit.registration, before: diff.before, after: diff.after });
	});
}

// ==================== WEBAUTHN (PASSKEYS) ====================

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

async function pruneWebauthnChallenges(): Promise<void> {
	await getPgPool().query(`DELETE FROM verification_tokens WHERE token_type LIKE 'webauthn_%' AND expires_at < $1`, [Date.now()]);
}

export async function createWebauthnChallenge(data: {
	id: string;
	userId?: string | null;
	challenge: string;
	typeValue: 'registration' | 'login';
}): Promise<void> {
	await ensurePostgresInit();
	await pruneWebauthnChallenges();
	const now = Date.now();
	await getPgPool().query(
		`INSERT INTO verification_tokens (id, user_id, token_type, token_hash, payload, expires_at, created_at)
		 VALUES ($1, $2, $3, $1, $4::jsonb, $5, $6)`,
		[data.id, data.userId ?? null, `webauthn_${data.typeValue}`, JSON.stringify({ challenge: data.challenge }), now + CHALLENGE_TTL_MS, now]
	);
}

export async function consumeWebauthnChallenge(
	id: string,
	typeValue: 'registration' | 'login'
): Promise<{ challenge: string; userId: string | null } | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`DELETE FROM verification_tokens WHERE id = $1 AND token_type = $2 AND expires_at >= $3
		 RETURNING payload->>'challenge' AS challenge, user_id AS "userId"`,
		[id, `webauthn_${typeValue}`, Date.now()]
	);
	const row = res.rows[0];
	return row ? { challenge: row.challenge, userId: row.userId ?? null } : null;
}

const WEBAUTHN_CREDENTIAL_COLUMNS = `
	id,
	user_id AS "userId",
	public_key AS "publicKey",
	counter,
	transports,
	device_type AS "deviceType",
	backed_up AS "backedUp",
	nickname,
	last_used_at AS "lastUsed",
	created_at AS creation
`;

export async function getWebauthnCredentials(userId: string): Promise<WebauthnCredential[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${WEBAUTHN_CREDENTIAL_COLUMNS} FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at ASC`,
		[userId]
	);
	return res.rows;
}

export async function getWebauthnCredentialById(id: string): Promise<WebauthnCredential | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${WEBAUTHN_CREDENTIAL_COLUMNS} FROM webauthn_credentials WHERE id = $1`,
		[id]
	);
	return res.rows[0] ?? null;
}

export async function saveWebauthnCredential(data: {
	id: string;
	userId: string;
	publicKey: string;
	counter: number;
	transports?: string | null;
	deviceType?: string | null;
	backedUp?: boolean;
	nickname?: string | null;
}): Promise<WebauthnCredential> {
	await ensurePostgresInit();
	const row: WebauthnCredential = {
		id: data.id,
		userId: data.userId,
		publicKey: data.publicKey,
		counter: data.counter,
		transports: data.transports ?? null,
		deviceType: data.deviceType ?? null,
		backedUp: data.backedUp ? 1 : 0,
		nickname: data.nickname ?? null,
		creation: Date.now(),
	};
	await getPgPool().query(
		`INSERT INTO webauthn_credentials
			(id, user_id, public_key, counter, transports, device_type, backed_up, nickname, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		[
			row.id,
			row.userId,
			row.publicKey,
			row.counter,
			row.transports,
			row.deviceType,
			row.backedUp,
			row.nickname,
			row.creation,
		]
	);
	return row;
}

export async function updateWebauthnCounter(id: string, counter: number): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		'UPDATE webauthn_credentials SET counter = $1, last_used_at = $2 WHERE id = $3',
		[counter, Date.now(), id]
	);
}

export async function deleteWebauthnCredential(id: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2',
		[id, userId]
	);
	return (res.rowCount ?? 0) > 0;
}
