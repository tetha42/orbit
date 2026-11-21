import type { PoolClient } from 'pg';

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
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1 FROM pg_attribute a
				JOIN pg_class t ON t.oid = a.attrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema() AND t.relname = 'oauth_clients'
				  AND a.attname = 'id' AND NOT a.attisdropped AND a.attnotnull
			) THEN
				UPDATE oauth_clients SET client_id = id WHERE client_id IS NULL;
				ALTER TABLE oauth_clients DROP CONSTRAINT IF EXISTS oauth_clients_pkey;
				ALTER TABLE oauth_clients ALTER COLUMN id DROP NOT NULL;
				ALTER TABLE oauth_clients ALTER COLUMN client_id SET NOT NULL;
				ALTER TABLE oauth_clients ADD PRIMARY KEY (client_id);
			END IF;
		END $$;
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
 * Validates a redirect URI against RFC 6749 Section 3.1.2 requirements.
 */
export function validateRedirectUri(uri: string): { valid: boolean; error?: string } {
	if (!uri || typeof uri !== 'string') {
		return { valid: false, error: 'Redirect URI cannot be empty.' };
	}
	const trimmed = uri.trim();
	if (trimmed.includes('#')) {
		return { valid: false, error: 'Redirect URI must not contain a fragment (#) per RFC 6749.' };
	}
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { valid: false, error: 'Invalid URL format.' };
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
		return {
			valid: false,
			error: 'For security, HTTP is only allowed on localhost and 127.0.0.1 (RFC 6749).',
		};
	}

	return { valid: false, error: `Unsupported or insecure URL protocol: ${protocol}` };
}

export interface RawClientRow {
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

export function mapClientRow(row: RawClientRow): OAuthClient {
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
