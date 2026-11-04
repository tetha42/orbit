import type { PoolClient } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPgPool, withTransaction, ensurePostgresInit } from './index';

export interface OAuthClient {
	id: string;
	name: string;
	description: string;
	logoUrl?: string | null;
	redirectUris: string[];
	allowedScopes: string[];
	trusted: boolean;
	active: boolean;
	creatorId?: string | null;
	creatorNameSurname?: string | null;
	creation: number;
	update: number;
}

export const DEFAULT_ALLOWED_SCOPES = ['openid', 'profile', 'email', 'academic', 'roles'];

export async function ensureOAuthSchema(client: PoolClient): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS oauth_clients (
			client_id TEXT PRIMARY KEY,
			secret_hash TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			logo_url TEXT,
			redirect_uris TEXT NOT NULL,
			allowed_scopes TEXT NOT NULL DEFAULT 'openid profile email',
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_oauth_clients_created_by ON oauth_clients (created_by);
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
	clientId?: string;
	client_id?: string;
	secretHash?: string;
	secret_hash?: string;
	name?: string;
	description?: string | null;
	logoUrl?: string | null;
	logo_url?: string | null;
	redirectUris?: string;
	redirect_uris?: string;
	allowedScopes?: string;
	allowed_scopes?: string;
	createdBy?: string | null;
	created_by?: string | null;
	creatorName?: string | null;
	createdAt?: number;
	created_at?: number;
}

function mapClientRow(row: RawClientRow): OAuthClient {
	const createdAt = Number(row.createdAt ?? row.created_at ?? 0);
	return {
		id: String(row.clientId ?? row.client_id ?? ''),
		name: String(row.name ?? ''),
		description: String(row.description ?? ''),
		logoUrl: row.logoUrl ?? row.logo_url ?? null,
		redirectUris: parseRedirectUris(row.redirectUris ?? row.redirect_uris),
		allowedScopes: parseAllowedScopes(row.allowedScopes ?? row.allowed_scopes),
		trusted: false,
		active: true,
		creatorId: row.createdBy ?? row.created_by ?? null,
		creatorNameSurname: row.creatorName ? row.creatorName.trim() : null,
		creation: createdAt,
		update: createdAt,
	};
}

export async function getOAuthClients(): Promise<OAuthClient[]> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query<RawClientRow>(
		`SELECT 
			c.client_id AS "clientId",
			c.name,
			c.description,
			c.logo_url AS "logoUrl",
			c.redirect_uris AS "redirectUris",
			c.allowed_scopes AS "allowedScopes",
			c.created_by AS "createdBy",
			CONCAT(k.first_name, ' ', k.last_name) AS "creatorName",
			c.created_at AS "createdAt"
		 FROM oauth_clients c
		 LEFT JOIN users k ON k.id = c.created_by
		 ORDER BY c.created_at DESC`
	);

	return res.rows.map(mapClientRow);
}

export async function getOAuthClientById(id: string): Promise<OAuthClient | null> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query<RawClientRow>(
		`SELECT 
			c.client_id AS "clientId",
			c.name,
			c.description,
			c.logo_url AS "logoUrl",
			c.redirect_uris AS "redirectUris",
			c.allowed_scopes AS "allowedScopes",
			c.created_by AS "createdBy",
			CONCAT(k.first_name, ' ', k.last_name) AS "creatorName",
			c.created_at AS "createdAt"
		 FROM oauth_clients c
		 LEFT JOIN users k ON k.id = c.created_by
		 WHERE c.client_id = $1`,
		[id]
	);

	if (res.rows.length === 0) return null;
	return mapClientRow(res.rows[0]);
}

export async function createOAuthClient(
	data: {
		name: string;
		description?: string;
		logoUrl?: string;
		redirectUris: string[];
		allowedScopes?: string[];
		trusted?: boolean;
	},
	creatorId: string
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
		`INSERT INTO oauth_clients (id, client_id, secret_hash, name, description, logo_url, redirect_uris, allowed_scopes, created_by, created_at)
		 VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		[
			id,
			secretHash,
			data.name.trim(),
			data.description?.trim() || '',
			data.logoUrl?.trim() || null,
			redirectUrisJson,
			allowedScopesJson,
			creatorId,
			now,
		]
	);

	const client = (await getOAuthClientById(id))!;
	return { client, plainSecret };
}

export async function updateOAuthClient(
	id: string,
	data: {
		name?: string;
		description?: string;
		logoUrl?: string | null;
		redirectUris?: string[];
		allowedScopes?: string[];
		trusted?: boolean;
		active?: boolean;
	}
): Promise<boolean> {
	await ensurePostgresInit();
	const existing = await getOAuthClientById(id);
	if (!existing) return false;

	const pool = getPgPool();

	const newName = data.name !== undefined ? data.name.trim() : existing.name;
	const newDescription = data.description !== undefined ? data.description.trim() : existing.description;
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

	await pool.query(
		`UPDATE oauth_clients
		 SET name = $1, description = $2, logo_url = $3, redirect_uris = $4, allowed_scopes = $5
		 WHERE client_id = $6`,
		[newName, newDescription, newLogo, newRedirect, newAllowedScopes, id]
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

	await pool.query(
		`UPDATE oauth_clients SET secret_hash = $1 WHERE client_id = $2`,
		[secretHash, id]
	);

	return { plainSecret };
}

export async function deleteOAuthClient(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(`DELETE FROM oauth_clients WHERE client_id = $1`, [id]);
	return (res.rowCount ?? 0) > 0;
}

export async function verifyClientCredentials(clientId: string, clientSecret: string): Promise<OAuthClient | null> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const res = await pool.query<RawClientRow>(
		`SELECT * FROM oauth_clients WHERE client_id = $1`,
		[clientId]
	);
	if (res.rows.length === 0) return null;

	const row = res.rows[0];
	const hash = row.secretHash ?? row.secret_hash;
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
	nonce?: string;
	authTime?: number;
}): Promise<string> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const code = `code_${crypto.randomBytes(24).toString('hex')}`;
	const now = Date.now();
	const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity
	const scopes = params.scope?.trim() || 'openid profile email roles';
	const payload = JSON.stringify({
		redirectUri: params.redirectUri,
		scopes,
		codeChallenge: params.codeChallenge || null,
		codeChallengeMethod: params.codeChallengeMethod || null,
		nonce: params.nonce || null,
		authTime: params.authTime ?? now,
	});

	await pool.query(
		`INSERT INTO verification_tokens (id, user_id, token_type, target, token_hash, payload, attempts, expires_at, used_at, created_at)
		 VALUES ($1, $2, 'oauth_auth_code', $3, $4, $5::jsonb, 0, $6, NULL, $7)`,
		[code, params.userId, params.clientId, code, payload, expiresAt, now]
	);

	return code;
}

interface AuthCodePayload {
	redirectUri?: string;
	scopes?: string;
	codeChallenge?: string | null;
	codeChallengeMethod?: string | null;
	nonce?: string | null;
	authTime?: number;
}

function parsePayload(raw: unknown): AuthCodePayload {
	if (!raw) return {};
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw) as AuthCodePayload;
		} catch {
			return {};
		}
	}
	if (typeof raw === 'object') return raw as AuthCodePayload;
	return {};
}

export async function consumeAuthCode(
	code: string,
	clientId: string,
	redirectUri: string,
	codeVerifier?: string
): Promise<{ ok: boolean; error?: string; userId?: string; scope?: string }> {
	await ensurePostgresInit();

	return withTransaction(async (client) => {
		const res = await client.query<{
			id: string;
			userId?: string;
			user_id?: string;
			target?: string;
			payload?: unknown;
			expiresAt?: number;
			expires_at?: number;
		}>(
			`SELECT id, user_id AS "userId", target, payload, expires_at AS "expiresAt"
			 FROM verification_tokens
			 WHERE id = $1 AND token_type = 'oauth_auth_code' AND target = $2 AND used_at IS NULL
			 FOR UPDATE`,
			[code, clientId]
		);

		if (res.rows.length === 0) {
			return { ok: false, error: 'Geçersiz veya daha önce kullanılmış yetkilendirme kodu.' };
		}

		const row = res.rows[0];
		const now = Date.now();
		const expiresAt = Number(row.expiresAt ?? row.expires_at ?? 0);

		if (expiresAt < now) {
			return { ok: false, error: 'Yetkilendirme kodunun süresi dolmuş.' };
		}

		const payload = parsePayload(row.payload);
		if (payload.redirectUri !== redirectUri) {
			return { ok: false, error: 'Yönlendirme URL (redirect_uri) eşleşmiyor.' };
		}

		// PKCE verification if challenge was set
		const challenge = payload.codeChallenge;
		const challengeMethod = (payload.codeChallengeMethod || 'plain').toUpperCase();

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
		await client.query(`UPDATE verification_tokens SET used_at = $2 WHERE id = $1`, [code, now]);

		const userId = String(row.userId ?? row.user_id ?? '');
		return { ok: true, userId, scope: payload.scopes || 'openid profile email roles' };
	});
}

export async function hasUserConsent(userId: string, clientId: string, scope: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(
		`SELECT oauth_consents AS "oauthConsents" FROM users WHERE id = $1`,
		[userId]
	);
	if (res.rows.length === 0) return false;

	const raw = res.rows[0].oauthConsents ?? res.rows[0].oauth_consents;
	let consents: Record<string, { scopes?: string; grantedAt?: number }> = {};
	if (typeof raw === 'string') {
		try {
			consents = JSON.parse(raw);
		} catch {
			return false;
		}
	} else if (raw && typeof raw === 'object') {
		consents = raw as Record<string, { scopes?: string; grantedAt?: number }>;
	}

	const entry = consents[clientId];
	if (!entry || !entry.scopes) return false;

	const approvedScopes = String(entry.scopes).split(' ');
	const requestedScopes = scope.split(' ');

	// Check if all requested scopes were previously approved
	return requestedScopes.every((s) => approvedScopes.includes(s));
}

export async function recordUserConsent(userId: string, clientId: string, scope: string): Promise<void> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();

	await pool.query(
		`UPDATE users
		 SET oauth_consents = COALESCE(oauth_consents, '{}'::jsonb) || jsonb_build_object($2::text, jsonb_build_object('scopes', $3::text, 'grantedAt', $4::bigint))
		 WHERE id = $1`,
		[userId, clientId, scope, now]
	);
}
