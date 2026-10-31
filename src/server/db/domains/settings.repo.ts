import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { SYSTEM_SETTINGS_DEFAULTS, type WebauthnCredential } from '@/db/schema';
import { logAuditEvent, type AuditContext, type AuditEntry } from '@/db/audit';
import type { Fark } from '@/lib/audit';

export async function getSystemSettings(): Promise<Record<string, string>> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT key AS anahtar, value AS deger FROM system_settings');
	const map: Record<string, string> = { ...SYSTEM_SETTINGS_DEFAULTS };
	for (const row of res.rows) {
		map[row.anahtar] = row.deger;
	}
	return map;
}

export async function getSystemSetting(anahtar: string, varsayilan: string = ''): Promise<string> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT value AS deger FROM system_settings WHERE key = $1', [anahtar]);
	return res.rows[0]?.deger ?? SYSTEM_SETTINGS_DEFAULTS[anahtar] ?? varsayilan;
}

export async function setSystemSetting(anahtar: string, deger: string): Promise<void> {
	await ensurePostgresInit();
	const now = Date.now();
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET 
		   value = EXCLUDED.value,
		   updated_at = EXCLUDED.updated_at`,
		[anahtar, deger, now]
	);
}

/**
 * Writes several settings at once. With `denetim`, the previous values are read
 * and a record is written (when `fark` finds a change) in the same transaction.
 */
export async function setSystemSettings(
	ayarlar: Record<string, string>,
	denetim?: {
		ctx: AuditContext;
		registration: Omit<AuditEntry, 'onceki' | 'sonraki'>;
		fark: (onceki: Record<string, string | undefined>, yeni: Record<string, string>) => Fark | null;
	}
): Promise<void> {
	const now = Date.now();
	await withTransaction(async (client) => {
		let previous: Record<string, string | undefined> = {};
		if (denetim) {
			const res = await client.query('SELECT key AS anahtar, value AS deger FROM system_settings WHERE key = ANY($1) FOR UPDATE', [Object.keys(ayarlar)]);
			previous = Object.fromEntries(res.rows.map((r) => [r.anahtar as string, r.deger as string]));
		}
		for (const [anahtar, deger] of Object.entries(ayarlar)) {
			await client.query(
				`INSERT INTO system_settings (key, value, updated_at)
				 VALUES ($1, $2, $3)
				 ON CONFLICT (key) DO UPDATE SET 
				   value = EXCLUDED.value,
				   updated_at = EXCLUDED.updated_at`,
				[anahtar, deger, now]
			);
		}
		const fark = denetim?.fark(previous, ayarlar);
		if (denetim && fark) await logAuditEvent(client, denetim.ctx, { ...denetim.registration, onceki: fark.onceki, sonraki: fark.sonraki });
	});
}

// ==================== WEBAUTHN (PASSKEYS) ====================

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

async function pruneWebauthnChallenges(): Promise<void> {
	await getPgPool().query('DELETE FROM webauthn_challenges WHERE olusturma < $1', [
		Date.now() - CHALLENGE_TTL_MS,
	]);
}

export async function createWebauthnChallenge(data: {
	id: string;
	userId?: string | null;
	challenge: string;
	tur: 'registration' | 'giris';
}): Promise<void> {
	await ensurePostgresInit();
	await pruneWebauthnChallenges();
	await getPgPool().query(
		'INSERT INTO webauthn_challenges (id, userId, challenge, tur, olusturma) VALUES ($1, $2, $3, $4, $5)',
		[data.id, data.userId ?? null, data.challenge, data.tur, Date.now()]
	);
}

export async function consumeWebauthnChallenge(
	id: string,
	tur: 'registration' | 'giris'
): Promise<{ challenge: string; userId: string | null } | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'DELETE FROM webauthn_challenges WHERE id = $1 AND tur = $2 AND olusturma >= $3 RETURNING challenge, userId',
		[id, tur, Date.now() - CHALLENGE_TTL_MS]
	);
	const row = res.rows[0];
	return row ? { challenge: row.challenge, userId: row.userId ?? null } : null;
}

export async function getWebauthnCredentials(userId: string): Promise<WebauthnCredential[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT * FROM webauthn_credentials WHERE userId = $1 ORDER BY olusturma ASC',
		[userId]
	);
	return res.rows;
}

export async function getWebauthnCredentialById(id: string): Promise<WebauthnCredential | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM webauthn_credentials WHERE id = $1', [id]);
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
		olusturma: Date.now(),
	};
	await getPgPool().query(
		`INSERT INTO webauthn_credentials
			(id, userId, publicKey, counter, transports, deviceType, backedUp, nickname, olusturma)
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
			row.olusturma,
		]
	);
	return row;
}

export async function updateWebauthnCounter(id: string, counter: number): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query(
		'UPDATE webauthn_credentials SET counter = $1, sonKullanma = $2 WHERE id = $3',
		[counter, Date.now(), id]
	);
}

export async function deleteWebauthnCredential(id: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'DELETE FROM webauthn_credentials WHERE id = $1 AND userId = $2',
		[id, userId]
	);
	return (res.rowCount ?? 0) > 0;
}
