import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { publishEvent, publishEventQuiet, registerEventHandler, startListener } from '@/db/events';
import { SYSTEM_SETTINGS_DEFAULTS, type WebauthnCredential } from '@/db/schema';
import { logAuditEvent, type AuditContext, type AuditEntry } from '@/db/audit';
import type { Diff } from '@/lib/audit';
import { invalidateCache } from '@/server/cache';

registerEventHandler('settings-cache', (event) => {
	if (event.k === 'settings_updated' || event.k === 'refresh') {
		invalidateCache('club_info');
		invalidateCache('roles_raw');
	}
});

const PAIRED_SETTING_KEYS: readonly [string, string][] = [
	['club_name', 'organization_name'],
	['club_domain', 'organization_domain'],
	['university', 'parent_entity'],
	['signature1_name', 'signatory_1_name'],
	['signature2_name', 'signatory_2_name'],
	['signature1_rank', 'signatory_1_title'],
	['signature2_rank', 'signatory_2_title'],
];

const SETTING_KEY_TWIN: Record<string, string> = Object.fromEntries(
	PAIRED_SETTING_KEYS.flatMap(([a, b]) => [
		[a, b],
		[b, a],
	])
);

export async function getSystemSettings(): Promise<Record<string, string>> {
	void startListener();
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT key AS key, value AS value FROM system_settings');
	const dbRows: Record<string, string> = {};
	for (const row of res.rows) {
		dbRows[row.key] = row.value;
	}
	const map: Record<string, string> = { ...SYSTEM_SETTINGS_DEFAULTS, ...dbRows };
	for (const [legacyKey, canonicalKey] of PAIRED_SETTING_KEYS) {
		const hasLegacy = Object.prototype.hasOwnProperty.call(dbRows, legacyKey);
		const hasCanonical = Object.prototype.hasOwnProperty.call(dbRows, canonicalKey);
		if (hasLegacy && !hasCanonical) map[canonicalKey] = dbRows[legacyKey];
		else if (hasCanonical && !hasLegacy) map[legacyKey] = dbRows[canonicalKey];
	}
	return map;
}

export async function getSystemSetting(key: string, defaultValue: string = ''): Promise<string> {
	void startListener();
	await ensurePostgresInit();
	const twin = SETTING_KEY_TWIN[key];
	if (twin) {
		const res = await getPgPool().query(
			'SELECT key AS key, value AS value FROM system_settings WHERE key = ANY($1)',
			[[key, twin]]
		);
		const byKey = Object.fromEntries(res.rows.map((r) => [r.key as string, r.value as string]));
		return byKey[key] ?? byKey[twin] ?? SYSTEM_SETTINGS_DEFAULTS[key] ?? defaultValue;
	}
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
	await publishEventQuiet(getPgPool(), { k: 'settings_updated', key });
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
	const entries = Object.entries(settings);
	await withTransaction(async (client) => {
		let previous: Record<string, string | undefined> = {};
		if (audit) {
			const res = await client.query('SELECT key AS key, value AS value FROM system_settings WHERE key = ANY($1) FOR UPDATE', [Object.keys(settings)]);
			previous = Object.fromEntries(res.rows.map((r) => [r.key as string, r.value as string]));
		}
		if (entries.length > 0) {
			await client.query(
				`INSERT INTO system_settings (key, value, updated_at)
				 SELECT UNNEST($1::text[]), UNNEST($2::text[]), $3
				 ON CONFLICT (key) DO UPDATE SET
				   value = EXCLUDED.value,
				   updated_at = EXCLUDED.updated_at`,
				[entries.map(([k]) => k), entries.map(([, v]) => String(v ?? '')), now]
			);
		}
		const diff = audit?.diff(previous, settings);
		if (audit && diff) await logAuditEvent(client, audit.ctx, { ...audit.registration, before: diff.before, after: diff.after });
		if (entries.length > 0) {
			await publishEvent(client, { k: 'settings_updated' });
		}
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
	type?: 'registration' | 'login';
	typeValue?: 'registration' | 'login';
}): Promise<void> {
	await ensurePostgresInit();
	await pruneWebauthnChallenges();
	const now = Date.now();
	const challengeType = data.type ?? data.typeValue ?? 'login';
	await getPgPool().query(
		`INSERT INTO verification_tokens (id, user_id, token_type, token_hash, payload, expires_at, created_at)
		 VALUES ($1, $2, $3, $1, $4::jsonb, $5, $6)`,
		[data.id, data.userId ?? null, `webauthn_${challengeType}`, JSON.stringify({ challenge: data.challenge }), now + CHALLENGE_TTL_MS, now]
	);
}

export async function consumeWebauthnChallenge(
	id: string,
	type: 'registration' | 'login'
): Promise<{ challenge: string; userId: string | null } | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`DELETE FROM verification_tokens WHERE id = $1 AND token_type = $2 AND expires_at >= $3
		 RETURNING payload->>'challenge' AS challenge, user_id AS "userId"`,
		[id, `webauthn_${type}`, Date.now()]
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
	last_used_at AS "lastUsage",
	created_at AS "createdAt"
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
	const now = Date.now();
	const row: WebauthnCredential = {
		id: data.id,
		userId: data.userId,
		publicKey: data.publicKey,
		counter: data.counter,
		transports: data.transports ?? null,
		deviceType: data.deviceType ?? null,
		backedUp: data.backedUp ? 1 : 0,
		nickname: data.nickname ?? null,
		createdAt: now,
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
			row.createdAt,
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
