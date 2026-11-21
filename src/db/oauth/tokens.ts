import crypto from 'crypto';
import { getPgPool, withTransaction, ensurePostgresInit } from '../index';

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
	const expiresAt = now + 5 * 60 * 1000;
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
			return { ok: false, error: 'Invalid or already used authorization code.' };
		}

		const row = res.rows[0];
		const now = Date.now();
		const expiresAt = Number(row.expiresAt ?? row.expires_at ?? 0);

		if (expiresAt < now) {
			return { ok: false, error: 'Authorization code has expired.' };
		}

		const payload = parsePayload(row.payload);
		if (payload.redirectUri !== redirectUri) {
			return { ok: false, error: 'Redirect URI (redirect_uri) does not match.' };
		}

		const challenge = payload.codeChallenge;
		const challengeMethod = (payload.codeChallengeMethod || 'plain').toUpperCase();

		if (challenge) {
			if (!codeVerifier) {
				return { ok: false, error: 'Missing code_verifier parameter.' };
			}

			if (challengeMethod === 'S256') {
				const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
				if (computed !== challenge) {
					return { ok: false, error: 'Invalid PKCE code_verifier.' };
				}
			} else if (challengeMethod === 'PLAIN') {
				if (codeVerifier !== challenge) {
					return { ok: false, error: 'Invalid PKCE code_verifier.' };
				}
			}
		}

		await client.query(`UPDATE verification_tokens SET used_at = $2 WHERE id = $1`, [code, now]);

		const userId = String(row.userId ?? row.user_id ?? '');
		return { ok: true, userId, scope: payload.scopes || 'openid profile email roles' };
	});
}

export async function hasUserConsent(userId: string, clientId: string, scope: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(`SELECT oauth_consents AS "oauthConsents" FROM users WHERE id = $1`, [userId]);
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
