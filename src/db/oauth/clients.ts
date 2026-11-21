import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getPgPool, ensurePostgresInit } from '../index';
import {
	DEFAULT_ALLOWED_SCOPES,
	mapClientRow,
	validateRedirectUri,
	type OAuthClient,
	type RawClientRow,
} from './types';

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
			throw new Error(`Invalid redirect URI (${uri}): ${v.error}`);
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
		`INSERT INTO oauth_clients (client_id, secret_hash, name, description, logo_url, redirect_uris, allowed_scopes, created_by, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
				throw new Error(`Invalid redirect URI (${uri}): ${v.error}`);
			}
		}
		newRedirect = JSON.stringify(cleanUris);
	}
	const newAllowedScopes =
		data.allowedScopes !== undefined ? JSON.stringify(data.allowedScopes) : JSON.stringify(existing.allowedScopes);

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

	await pool.query(`UPDATE oauth_clients SET secret_hash = $1 WHERE client_id = $2`, [secretHash, id]);

	return { plainSecret };
}

export async function deleteOAuthClient(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query(`DELETE FROM oauth_clients WHERE client_id = $1`, [id]);
	return (res.rowCount ?? 0) > 0;
}

export async function verifyClientCredentials(
	clientId: string,
	clientSecret: string
): Promise<OAuthClient | null> {
	await ensurePostgresInit();
	const pool = getPgPool();

	const res = await pool.query<RawClientRow>(`SELECT * FROM oauth_clients WHERE client_id = $1`, [clientId]);
	if (res.rows.length === 0) return null;

	const row = res.rows[0];
	const hash = row.secretHash ?? row.secret_hash;
	if (!hash) return null;

	const isMatch = await bcrypt.compare(clientSecret, hash);
	if (!isMatch) return null;

	return mapClientRow(row);
}
