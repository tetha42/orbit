import type { QueryResultRow } from 'pg';
import { ensurePostgresInit, getPgPool, isDatabaseConfigured } from '@/db/index';
import type { User } from '@/db/schema';
import { hashSessionToken, normalizeUserRow } from './normalize';
import { updateUserSession } from './mutations';

type QueryPool = { query(text: string, values?: unknown[]): Promise<{ rows: QueryResultRow[] }> };

const sessionLookupInFlight = new Map<string, Promise<User | null>>();

export async function getUsers(): Promise<User[]> {
	if (!isDatabaseConfigured()) return [];
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query('SELECT * FROM users ORDER BY created_at ASC');
		if (!res.rows?.length) return [];
		const users = await Promise.all(res.rows.map((r) => normalizeUserRow(r, { skipTotpDecryption: true })));
		return users.filter((u): u is User => u !== null);
	} catch (err) {
		console.warn('[members.repo] getUsers read warning:', err);
		return [];
	}
}

export async function getUserById(id: string): Promise<User | null> {
	if (!id || !isDatabaseConfigured()) return null;
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query('SELECT * FROM users WHERE id = $1', [id]);
		return await normalizeUserRow(res.rows[0]);
	} catch (err) {
		console.warn('[members.repo] getUserById read warning:', err);
		return null;
	}
}

export async function getUserByEmail(email: string): Promise<User | null> {
	if (!email || !isDatabaseConfigured()) return null;
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [
			email.trim(),
		]);
		return await normalizeUserRow(res.rows[0]);
	} catch (err) {
		console.warn('[members.repo] getUserByEmail read warning:', err);
		return null;
	}
}

export async function getUserByHandle(studentNo: string): Promise<User | null> {
	if (!studentNo || !isDatabaseConfigured()) return null;
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query('SELECT * FROM users WHERE handle = $1', [
			studentNo.trim(),
		]);
		return await normalizeUserRow(res.rows[0]);
	} catch (err) {
		console.warn('[members.repo] getUserByHandle read warning:', err);
		return null;
	}
}

export async function getUserBySessionToken(token: string, pool?: QueryPool): Promise<User | null> {
	if (!token) return null;
	if (!pool && !isDatabaseConfigured()) return null;

	const tokenHash = hashSessionToken(token);
	if (!pool) {
		const existing = sessionLookupInFlight.get(tokenHash);
		if (existing) return existing;
	}

	const run = (async (): Promise<User | null> => {
		try {
			if (!pool) await ensurePostgresInit();
			const p = pool ?? getPgPool();

			// 1. Multi-device session lookup (`user_sessions`)
			const deviceRes = await p
				.query(
					`SELECT *
					 FROM user_sessions
					 WHERE token_hash = $1
					 ORDER BY last_active_at DESC LIMIT 1`,
					[tokenHash]
				)
				.catch(() => {
					/* Fallback to legacy users.session_token if user_sessions is unavailable */
					return { rows: [] as QueryResultRow[] };
				});

			if (deviceRes.rows.length > 0) {
				const dev = deviceRes.rows[0];
				const revokedAt = dev.revokedAt ?? dev.revoked_at;
				const devExpiresAt = Number(dev.expiresAt ?? dev.expires_at ?? 0);
				if (revokedAt !== null && revokedAt !== undefined) {
					return null;
				}
				if (devExpiresAt <= Date.now()) {
					return null;
				}
				const userId = String(dev.userId ?? dev.user_id ?? '');
				const uRes = await p.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userId]);
				const user = await normalizeUserRow(uRes.rows[0]);
				if (!user) return null;
				user.activeSessionId = String(dev.id);
				const devIp =
					dev.lastActiveIp ??
					dev.last_active_ip ??
					dev.ipAddress ??
					dev.ip_address ??
					dev.createdIp ??
					dev.created_ip;
				const devUa = dev.userAgent ?? dev.user_agent;
				const devAuth = dev.authMethod ?? dev.auth_method;
				if (typeof devIp === 'string' && devIp) {
					user.lastLoginIp = devIp;
					user.lastActiveIp = devIp;
				}
				if (typeof devUa === 'string' && devUa) {
					user.lastLoginUserAgent = devUa;
				}
				if (devAuth === 'passkey' || devAuth === 'totp' || devAuth === 'password') {
					user.authMethod = devAuth;
				}
				const lastActive = Number(dev.lastActiveAt ?? dev.last_active_at ?? 0);
				if (Date.now() - lastActive > 60_000) {
					void p
						.query('UPDATE user_sessions SET last_active_at = $2 WHERE id = $1', [
							dev.id,
							Date.now(),
						])
						.catch(() => {
							/* Best-effort session activity timestamp update */
						});
				}
				return user;
			}

			// 2. Fallback to primary `users.session_token` column
			const res = await p.query(
				'SELECT * FROM users WHERE session_token = $1 OR session_token = $2 LIMIT 1',
				[tokenHash, token]
			);
			const user = await normalizeUserRow(res.rows[0]);
			if (!user) return null;

			// Transparent seamless upgrade: if stored token was plaintext, upgrade to sha256 hash immediately
			const rawRow = res.rows[0];
			if (rawRow && (rawRow.sessionToken ?? rawRow.session_token) === token) {
				void p.query('UPDATE users SET session_token = $1 WHERE id = $2', [tokenHash, user.id]).catch(() => {});
			}

			const expiresAt = user.sessionEnd ? Number(user.sessionEnd) : null;
			if (expiresAt === null || expiresAt <= Date.now()) {
				if (!pool) {
					await updateUserSession(user.id, null);
				} else {
					await p.query('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE id = $1', [user.id]).catch(() => {});
				}
				return null;
			}

			return user;
		} catch {
			console.warn('[Session Auth]: Database unconfigured or unreachable, returning unauthenticated state.');
			return null;
		}
	})();

	if (pool) return run;
	const promise = run.finally(() => {
		if (sessionLookupInFlight.get(tokenHash) === promise) {
			sessionLookupInFlight.delete(tokenHash);
		}
	});
	sessionLookupInFlight.set(tokenHash, promise);
	return promise;
}

export async function getPendingUsers(): Promise<User[]> {
	if (!isDatabaseConfigured()) return [];
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query(
			"SELECT * FROM users WHERE status = 'pending' ORDER BY created_at ASC"
		);
		if (!res.rows?.length) return [];
		const users = await Promise.all(res.rows.map((r) => normalizeUserRow(r, { skipTotpDecryption: true })));
		return users.filter((u): u is User => u !== null);
	} catch (err) {
		console.warn('[members.repo] getPendingUsers read warning:', err);
		return [];
	}
}
