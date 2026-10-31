import type { PoolClient } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPgPool, withTransaction, ensurePostgresInit } from './index';

export interface OAuthClient {
	id: string;
	ad: string;
	aciklama: string;
	logoUrl?: string | null;
	redirectUris: string[];
	allowedScopes: string[];
	guvenilir: boolean;
	aktif: boolean;
	olusturanId?: string | null;
	olusturanAdSoyad?: string | null;
	olusturma: number;
	guncellenme: number;
}

export const DEFAULT_ALLOWED_SCOPES = ['openid', 'profile', 'email', 'academic', 'roles'];

export async function ensureOAuthSchema(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS oauth_clients (
			id TEXT PRIMARY KEY,
			secretHash TEXT NOT NULL,
			ad TEXT NOT NULL,
			aciklama TEXT DEFAULT '',
			logoUrl TEXT,
			redirectUris TEXT NOT NULL DEFAULT '[]',
			allowedScopes TEXT NOT NULL DEFAULT '["openid","profile","email","academic","roles"]',
			guvenilir INTEGER NOT NULL DEFAULT 0,
			aktif INTEGER NOT NULL DEFAULT 1,
			olusturanId TEXT REFERENCES users(id) ON DELETE SET NULL,
			olusturma BIGINT NOT NULL,
			guncellenme BIGINT NOT NULL
		);

		ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS allowedScopes TEXT NOT NULL DEFAULT '["openid","profile","email","academic","roles"]';

		CREATE TABLE IF NOT EXISTS oauth_auth_codes (
			code TEXT PRIMARY KEY,
			clientId TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
			userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			redirectUri TEXT NOT NULL,
			scope TEXT NOT NULL DEFAULT 'openid profile email roles',
			codeChallenge TEXT,
			codeChallengeMethod TEXT,
			sonGecerlilik BIGINT NOT NULL,
			kullanildi INTEGER NOT NULL DEFAULT 0
		);

		CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_lookup 
			ON oauth_auth_codes (clientId, kullanildi, sonGecerlilik);

		CREATE TABLE IF NOT EXISTS oauth_consents (
			userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			clientId TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
			scopes TEXT NOT NULL,
			onayTarihi BIGINT NOT NULL,
			PRIMARY KEY (userId, clientId)
		);
	`);
}

function parseRedirectUris(raw: unknown): string[] {
	if (Array.isArray(raw)) return raw.map(String).map((u) => u.trim()).filter(Boolean);
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return parsed.map(String).map((u) => u.trim()).filter(Boolean);
		} catch {
			return raw.split('\n').map((u) => u.trim()).filter(Boolean);
		}
	}
	return [];
}

export function parseAllowedScopes(raw: unknown): string[] {
	if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
		} catch {
			return raw.split(' ').map((s) => s.trim()).filter(Boolean);
		}
	}
	return DEFAULT_ALLOWED_SCOPES;
}

/**
 * Validates a redirect URI against RFC 6749 Section 3.1.2 requirements:
 *  - Must be an absolute URI.
 *  - Must NOT contain URL fragments (#).
 *  - Must use HTTPS scheme (or HTTP strictly for localhost/127.0.0.1 loopbacks).
 *  - Must reject dangerous schemes (javascript:, data:, vbscript:, file:).
 */
export function validateRedirectUri(uri: string): { valid: boolean; error?: string } {
	if (!uri || typeof uri !== 'string') {
		return { valid: false, error: 'Yönlendirme adresi boş olamaz.' };
	}
	const trimmed = uri.trim();
	if (trimmed.includes('#')) {
		return { valid: false, error: 'Yönlendirme adresi fragment (#) içeremez (RFC 6749).' };
	}
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { valid: false, error: 'Geçersiz URL biçimi.' };
	}

	const protocol = parsed.protocol.toLowerCase();
	if (protocol === 'https:') {
		return { valid: true };
	}

	if (protocol === 'http:') {
		const host = parsed.hostname.toLowerCase();
		if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
			return { valid: true };
		}
		return { valid: false, error: 'Güvenlik nedeniyle HTTP yalnızca localhost ve 127.0.0.1 üzerinde kullanılabilir (RFC 6749).' };
	}

	return { valid: false, error: `Desteklenmeyen veya güvensiz URL protokolü: ${protocol}` };
}

interface RawClientRow {
	id: string;
	secretHash?: string;
	secrethash?: string;
	ad: string;
	aciklama: string;
	logoUrl?: string | null;
	logourl?: string | null;
	redirectUris?: string;
	redirecturis?: string;
	allowedScopes?: string;
	allowedscopes?: string;
	guvenilir: number;
	aktif: number;
	olusturanId?: string | null;
	olusturanid?: string | null;
	olusturanad?: string | null;
	olusturma: number;
	guncellenme: number;
}

function mapClientRow(row: RawClientRow): OAuthClient {
	return {
		id: row.id,
		ad: row.ad,
		aciklama: row.aciklama || '',
		logoUrl: row.logoUrl ?? row.logourl ?? null,
		redirectUris: parseRedirectUris(row.redirectUris ?? row.redirecturis),
		allowedScopes: parseAllowedScopes(row.allowedScopes ?? row.allowedscopes),
		guvenilir: Number(row.guvenilir) === 1,
		aktif: Number(row.aktif) === 1,
		olusturanId: row.olusturanId ?? row.olusturanid ?? null,
		olusturanAdSoyad: row.olusturanad ? row.olusturanad.trim() : null,
		olusturma: Number(row.olusturma),
		guncellenme: Number(row.guncellenme),
	};
}

export async function getOAuthClients(): Promise<OAuthClient[]> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query<RawClientRow>(
		`SELECT 
			c.id,
			c.ad,
			c.aciklama,
			c.logoUrl,
			c.redirectUris,
			c.allowedScopes,
			c.guvenilir,
			c.aktif,
			c.olusturanId,
			CONCAT(k.first_name, ' ', k.last_name) AS "olusturanad",
			c.olusturma,
			c.guncellenme
		 FROM oauth_clients c
		 LEFT JOIN users k ON k.id = c.olusturanId
		 ORDER BY c.olusturma DESC`
	);

	return res.rows.map(mapClientRow);
}

export async function getOAuthClientById(id: string): Promise<OAuthClient | null> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query<RawClientRow>(
		`SELECT 
			c.id,
			c.ad,
			c.aciklama,
			c.logoUrl,
			c.redirectUris,
			c.allowedScopes,
			c.guvenilir,
			c.aktif,
			c.olusturanId,
			CONCAT(k.first_name, ' ', k.last_name) AS "olusturanad",
			c.olusturma,
			c.guncellenme
		 FROM oauth_clients c
		 LEFT JOIN users k ON k.id = c.olusturanId
		 WHERE c.id = $1`,
		[id]
	);

	if (res.rows.length === 0) return null;
	return mapClientRow(res.rows[0]);
}

export async function createOAuthClient(
	data: {
		ad: string;
		aciklama?: string;
		logoUrl?: string;
		redirectUris: string[];
		allowedScopes?: string[];
		guvenilir?: boolean;
	},
	olusturanId: string
): Promise<{ client: OAuthClient; plainSecret: string }> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const id = `client_${crypto.randomBytes(12).toString('hex')}`;
	const plainSecret = `sec_${crypto.randomBytes(24).toString('hex')}`;
	const secretHash = await bcrypt.hash(plainSecret, 10);
	const cleanUris = data.redirectUris.map((u) => u.trim()).filter(Boolean);
	for (const uri of cleanUris) {
		const v = validateRedirectUri(uri);
		if (!v.valid) {
			throw new Error(`Geçersiz Yönlendirme URL (${uri}): ${v.error}`);
		}
	}
	const now = Date.now();
	const redirectUrisJson = JSON.stringify(cleanUris);
	const allowedScopesJson = JSON.stringify(
		Array.isArray(data.allowedScopes) && data.allowedScopes.length > 0
			? data.allowedScopes
			: DEFAULT_ALLOWED_SCOPES
	);

	await pool.query(
		`INSERT INTO oauth_clients (id, secretHash, ad, aciklama, logoUrl, redirectUris, allowedScopes, guvenilir, aktif, olusturanId, olusturma, guncellenme)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $10)`,
		[
			id,
			secretHash,
			data.ad.trim(),
			data.aciklama?.trim() || '',
			data.logoUrl?.trim() || null,
			redirectUrisJson,
			allowedScopesJson,
			data.guvenilir ? 1 : 0,
			olusturanId,
			now,
		]
	);

	const client = (await getOAuthClientById(id))!;
	return { client, plainSecret };
}

export async function updateOAuthClient(
	id: string,
	data: {
		ad?: string;
		aciklama?: string;
		logoUrl?: string | null;
		redirectUris?: string[];
		allowedScopes?: string[];
		guvenilir?: boolean;
		aktif?: boolean;
	}
): Promise<boolean> {
	await ensurePostgresInit();
	const existing = await getOAuthClientById(id);
	if (!existing) return false;

	const pool = getPgPool();
	const now = Date.now();

	const newName = data.ad !== undefined ? data.ad.trim() : existing.ad;
	const newDescription = data.aciklama !== undefined ? data.aciklama.trim() : existing.aciklama;
	const newLogo = data.logoUrl !== undefined ? data.logoUrl : existing.logoUrl;
	let newRedirect = JSON.stringify(existing.redirectUris);
	if (data.redirectUris !== undefined) {
		const cleanUris = data.redirectUris.map((u) => u.trim()).filter(Boolean);
		for (const uri of cleanUris) {
			const v = validateRedirectUri(uri);
			if (!v.valid) {
				throw new Error(`Geçersiz Yönlendirme URL (${uri}): ${v.error}`);
			}
		}
		newRedirect = JSON.stringify(cleanUris);
	}
	const newAllowedScopes = data.allowedScopes !== undefined
		? JSON.stringify(data.allowedScopes)
		: JSON.stringify(existing.allowedScopes);
	const newGuvenilir = data.guvenilir !== undefined ? (data.guvenilir ? 1 : 0) : (existing.guvenilir ? 1 : 0);
	const newActive = data.aktif !== undefined ? (data.aktif ? 1 : 0) : (existing.aktif ? 1 : 0);

	await pool.query(
		`UPDATE oauth_clients
		 SET ad = $1, aciklama = $2, logoUrl = $3, redirectUris = $4, allowedScopes = $5, guvenilir = $6, aktif = $7, guncellenme = $8
		 WHERE id = $9`,
		[newName, newDescription, newLogo, newRedirect, newAllowedScopes, newGuvenilir, newActive, now, id]
	);

	return true;
}

export async function regenerateOAuthClientSecret(id: string): Promise<{ plainSecret: string } | null> {
	await ensurePostgresInit();
	const existing = await getOAuthClientById(id);
	if (!existing) return null;

	const pool = getPgPool();
	const plainSecret = `sec_${crypto.randomBytes(24).toString('hex')}`;
	const secretHash = await bcrypt.hash(plainSecret, 10);
	const now = Date.now();

	await pool.query(
		`UPDATE oauth_clients SET secretHash = $1, guncellenme = $2 WHERE id = $3`,
		[secretHash, now, id]
	);

	return { plainSecret };
}

export async function deleteOAuthClient(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(`DELETE FROM oauth_clients WHERE id = $1`, [id]);
	return (res.rowCount ?? 0) > 0;
}

export async function verifyClientCredentials(clientId: string, clientSecret: string): Promise<OAuthClient | null> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const res = await pool.query<RawClientRow>(
		`SELECT * FROM oauth_clients WHERE id = $1 AND aktif = 1`,
		[clientId]
	);
	if (res.rows.length === 0) return null;

	const row = res.rows[0];
	const hash = row.secretHash ?? row.secrethash;
	if (!hash) return null;

	const isMatch = await bcrypt.compare(clientSecret, hash);
	if (!isMatch) return null;

	return mapClientRow(row);
}

export async function createAuthCode(params: {
	clientId: string;
	userId: string;
	redirectUri: string;
	scope?: string;
	codeChallenge?: string;
	codeChallengeMethod?: string;
}): Promise<string> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const code = `code_${crypto.randomBytes(24).toString('hex')}`;
	const sonGecerlilik = Date.now() + 5 * 60 * 1000; // 5 minutes validity
	const scope = params.scope?.trim() || 'openid profile email roles';

	await pool.query(
		`INSERT INTO oauth_auth_codes (code, clientId, userId, redirectUri, scope, codeChallenge, codeChallengeMethod, sonGecerlilik, kullanildi)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
		[
			code,
			params.clientId,
			params.userId,
			params.redirectUri,
			scope,
			params.codeChallenge || null,
			params.codeChallengeMethod || null,
			sonGecerlilik,
		]
	);

	return code;
}

interface RawCodeRow {
	code: string;
	clientId?: string;
	clientid?: string;
	userId?: string;
	kullaniciid?: string;
	redirectUri?: string;
	redirecturi?: string;
	scope: string;
	codeChallenge?: string;
	codechallenge?: string;
	codeChallengeMethod?: string;
	codechallengemethod?: string;
	sonGecerlilik?: number;
	songecerlilik?: number;
	kullanildi: number;
}

export async function consumeAuthCode(
	code: string,
	clientId: string,
	redirectUri: string,
	codeVerifier?: string
): Promise<{ ok: boolean; error?: string; userId?: string; scope?: string }> {
	await ensurePostgresInit();

	return withTransaction(async (client) => {
		const res = await client.query<RawCodeRow>(
			`SELECT * FROM oauth_auth_codes 
			 WHERE code = $1 AND clientId = $2 AND kullanildi = 0
			 FOR UPDATE`,
			[code, clientId]
		);

		if (res.rows.length === 0) {
			return { ok: false, error: 'Geçersiz veya daha önce kullanılmış yetkilendirme kodu.' };
		}

		const row = res.rows[0];
		const now = Date.now();
		const sonGecerlilik = Number(row.sonGecerlilik ?? row.songecerlilik);

		if (sonGecerlilik < now) {
			return { ok: false, error: 'Yetkilendirme kodunun süresi dolmuş.' };
		}

		const storedRedirect = row.redirectUri ?? row.redirecturi;
		if (storedRedirect !== redirectUri) {
			return { ok: false, error: 'Yönlendirme URL (redirect_uri) eşleşmiyor.' };
		}

		// PKCE verification if challenge was set
		const challenge = row.codeChallenge ?? row.codechallenge;
		const rawMethod = row.codeChallengeMethod ?? row.codechallengemethod;
		const challengeMethod = (rawMethod || 'plain').toUpperCase();

		if (challenge) {
			if (!codeVerifier) {
				return { ok: false, error: 'code_verifier parametresi eksik.' };
			}

			if (challengeMethod === 'S256') {
				const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
				if (computed !== challenge) {
					return { ok: false, error: 'Geçersiz PKCE code_verifier.' };
				}
			} else if (challengeMethod === 'PLAIN') {
				if (codeVerifier !== challenge) {
					return { ok: false, error: 'Geçersiz PKCE code_verifier.' };
				}
			}
		}

		// Mark as consumed
		await client.query(`UPDATE oauth_auth_codes SET kullanildi = 1 WHERE code = $1`, [code]);

		const userId = (row.userId ?? row.kullaniciid) as string;
		return { ok: true, userId, scope: row.scope };
	});
}

export async function hasUserConsent(userId: string, clientId: string, scope: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`SELECT scopes FROM oauth_consents WHERE userId = $1 AND clientId = $2`,
		[userId, clientId]
	);
	if (res.rows.length === 0) return false;

	const approvedScopes = String(res.rows[0].scopes).split(' ');
	const requestedScopes = scope.split(' ');

	// Check if all requested scopes were previously approved
	return requestedScopes.every((s) => approvedScopes.includes(s));
}

export async function recordUserConsent(userId: string, clientId: string, scope: string): Promise<void> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();

	await pool.query(
		`INSERT INTO oauth_consents (userId, clientId, scopes, onayTarihi)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (userId, clientId)
		 DO UPDATE SET scopes = EXCLUDED.scopes, onayTarihi = EXCLUDED.onayTarihi`,
		[userId, clientId, scope, now]
	);
}
