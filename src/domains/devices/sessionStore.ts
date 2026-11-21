import crypto from 'node:crypto';
import { ensurePostgresInit, getPgPool, isDatabaseConfigured, withTransaction } from '@/db';
import { publishEvent, publishEventQuiet } from '@/db/events';
import { hashSessionToken } from '@/db/repositories/members/normalize';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import {
	detectDeviceMetadata,
	parseBrowserOs,
	type DesktopAuthPolicy,
	type DeviceClass,
	type SessionAuthMethod,
	type UserSessionRecord,
} from './types';

export const MAX_DESKTOP_SESSIONS = 4;

function mapSessionRow(row: Record<string, unknown>, currentTokenHash?: string | null): UserSessionRecord {
	const tokenHash = String(row.tokenHash ?? row.token_hash ?? '');
	const revRaw = row.revokedAt ?? row.revoked_at;
	const reasonRaw = row.revokeReason ?? row.revoke_reason ?? row.revokedReason ?? row.revoked_reason;
	const userAgent = String(row.userAgent ?? row.user_agent ?? '');
	const parsed = parseBrowserOs(userAgent);
	const lastActiveAt = Number(row.lastActiveAt ?? row.last_active_at ?? 0);
	const ip = String(row.lastActiveIp ?? row.last_active_ip ?? row.createdIp ?? row.created_ip ?? row.ipAddress ?? row.ip_address ?? '');
	return {
		id: String(row.id ?? ''),
		userId: String(row.userId ?? row.user_id ?? ''),
		deviceClass: (row.deviceClass ?? row.device_class) === 'mobile' ? 'mobile' : 'desktop',
		deviceName: String(row.deviceName ?? row.device_name ?? 'Unknown Device'),
		browser: String(row.browser ?? parsed.browser),
		os: String(row.os ?? parsed.os),
		ipAddress: ip,
		userAgent,
		authMethod: String(row.authMethod ?? row.auth_method ?? 'password'),
		createdAt: Number(row.createdAt ?? row.created_at ?? lastActiveAt),
		lastActiveAt,
		expiresAt: Number(row.expiresAt ?? row.expires_at ?? 0),
		revokedAt: revRaw !== null && revRaw !== undefined ? Number(revRaw) : null,
		revokedReason: typeof reasonRaw === 'string' ? reasonRaw : null,
		isCurrent: Boolean(currentTokenHash && tokenHash === currentTokenHash),
	};
}

export interface RoleDevicePolicy {
	allowMobileAccess: boolean;
	allowDesktopAccess: boolean;
	desktopAuthPolicy: DesktopAuthPolicy;
}

const DEFAULT_DEVICE_POLICY: RoleDevicePolicy = {
	allowMobileAccess: true,
	allowDesktopAccess: true,
	desktopAuthPolicy: 'standard',
};

export async function getRoleDevicePolicy(roleId: string | null | undefined): Promise<RoleDevicePolicy> {
	if (!roleId || roleId === ADMIN_ROLE_ID || roleId === 'admin' || !isDatabaseConfigured()) return DEFAULT_DEVICE_POLICY;
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query(
			`SELECT allow_mobile_access AS "allowMobileAccess", allow_desktop_access AS "allowDesktopAccess", desktop_auth_policy AS "desktopAuthPolicy" FROM roles WHERE id = $1 LIMIT 1`,
			[roleId]
		);
		const row = res.rows[0];
		if (!row) return DEFAULT_DEVICE_POLICY;
		const policyRaw = String(row.desktopAuthPolicy ?? row.desktop_auth_policy ?? 'standard');
		return {
			allowMobileAccess: Number(row.allowMobileAccess ?? row.allow_mobile_access ?? 1) !== 0,
			allowDesktopAccess: Number(row.allowDesktopAccess ?? row.allow_desktop_access ?? 1) !== 0,
			desktopAuthPolicy: policyRaw === 'mobile_required' || policyRaw === 'mobile_preferred' ? policyRaw : 'standard',
		};
	} catch {
		return DEFAULT_DEVICE_POLICY;
	}
}

export async function createDeviceSession(params: {
	userId: string;
	token: string;
	expiresAt: number;
	request?: Request;
	authMethod?: SessionAuthMethod;
	deviceClassOverride?: DeviceClass;
}): Promise<{ sessionId: string; evictedMobileSessionIds: string[] }> {
	if (!isDatabaseConfigured()) return { sessionId: 'ephemeral', evictedMobileSessionIds: [] };
	await ensurePostgresInit();
	const meta = detectDeviceMetadata(params.request);
	const deviceClass = params.deviceClassOverride ?? meta.deviceClass;
	const tokenHash = hashSessionToken(params.token);
	const now = Date.now();
	const sessionId = `ses_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
	const authMethod = params.authMethod ?? 'password';
	const evictedMobileSessionIds: string[] = [];

	await withTransaction(async (client) => {
		await client.query("SELECT pg_advisory_xact_lock(hashtext('devices:' || $1))", [params.userId]);

		if (deviceClass === 'mobile') {
			const oldMobileRes = await client.query<{ id: string }>(
				`UPDATE user_sessions SET revoked_at = $2, revoke_reason = 'new_mobile_login'
				 WHERE user_id = $1 AND device_class = 'mobile' AND revoked_at IS NULL AND expires_at > $2
				 RETURNING id`,
				[params.userId, now]
			);
			for (const r of oldMobileRes.rows) {
				evictedMobileSessionIds.push(String(r.id));
				await publishEvent(client, {
					k: 'session_revoked',
					userId: params.userId,
					sessionIds: [String(r.id)],
					reason: 'new_mobile_login',
				});
			}
		} else {
			const desktopRes = await client.query<{ id: string }>(
				`SELECT id FROM user_sessions
				 WHERE user_id = $1 AND device_class = 'desktop' AND revoked_at IS NULL AND expires_at > $2
				 ORDER BY last_active_at DESC`,
				[params.userId, now]
			);
			if (desktopRes.rows.length >= MAX_DESKTOP_SESSIONS) {
				for (const r of desktopRes.rows.slice(MAX_DESKTOP_SESSIONS - 1)) {
					await client.query(`UPDATE user_sessions SET revoked_at = $2, revoke_reason = 'max_desktop_limit' WHERE id = $1`, [r.id, now]);
					await publishEvent(client, {
						k: 'session_revoked',
						userId: params.userId,
						sessionIds: [String(r.id)],
						reason: 'max_desktop_limit',
					});
				}
			}
		}

		await client.query(
			`INSERT INTO user_sessions (
				id, user_id, token_hash, device_class, device_name, user_agent, auth_method,
				created_ip, last_active_ip, last_active_at, expires_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)`,
			[sessionId, params.userId, tokenHash, deviceClass, meta.deviceName, meta.userAgent, authMethod, meta.ip, now, params.expiresAt]
		);
	});

	return { sessionId, evictedMobileSessionIds };
}

export async function findActiveDeviceSessionByToken(token: string): Promise<UserSessionRecord | null> {
	if (!token || !isDatabaseConfigured()) return null;
	try {
		await ensurePostgresInit();
		const tokenHash = hashSessionToken(token);
		const now = Date.now();
		const res = await getPgPool().query(
			`SELECT * FROM user_sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2 LIMIT 1`,
			[tokenHash, now]
		);
		if (!res.rows[0]) return null;
		const record = mapSessionRow(res.rows[0] as Record<string, unknown>, tokenHash);
		if (now - record.lastActiveAt > 60_000) {
			void getPgPool().query('UPDATE user_sessions SET last_active_at = $2 WHERE id = $1', [record.id, now]).catch(() => {});
		}
		return record;
	} catch {
		return null;
	}
}

export async function listActiveUserSessions(userId: string, currentToken?: string | null): Promise<UserSessionRecord[]> {
	if (!userId || !isDatabaseConfigured()) return [];
	await ensurePostgresInit();
	const currentHash = currentToken ? hashSessionToken(currentToken) : null;
	const res = await getPgPool().query(
		`SELECT * FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > $2 ORDER BY device_class ASC, last_active_at DESC`,
		[userId, Date.now()]
	);
	return res.rows.map((r) => mapSessionRow(r as Record<string, unknown>, currentHash));
}

export async function revokeDeviceSessionById(userId: string, sessionId: string, reason = 'user_revoked'): Promise<boolean> {
	if (!userId || !sessionId || !isDatabaseConfigured()) return false;
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE user_sessions SET revoked_at = $3, revoke_reason = $4
		 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
		 RETURNING id, token_hash AS "tokenHash"`,
		[sessionId, userId, Date.now(), reason]
	);
	if (res.rows.length === 0) return false;
	const tokenHash = String(res.rows[0].tokenHash ?? '');
	if (tokenHash) {
		await getPgPool().query('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE id = $1 AND session_token = $2', [userId, tokenHash]).catch(() => {});
	}
	await publishEventQuiet(getPgPool(), [{ k: 'session_revoked', userId, sessionIds: [sessionId], reason }, { k: 'session', userId }]);
	return true;
}

export async function revokeDeviceSessionByToken(userId: string, token: string, reason = 'logout'): Promise<void> {
	if (!userId || !token || !isDatabaseConfigured()) return;
	await ensurePostgresInit();
	const res = await getPgPool().query<{ id: string }>(
		`UPDATE user_sessions SET revoked_at = $3, revoke_reason = $4
		 WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL RETURNING id`,
		[userId, hashSessionToken(token), Date.now(), reason]
	);
	for (const r of res.rows) {
		await publishEventQuiet(getPgPool(), { k: 'session_revoked', userId, sessionIds: [String(r.id)], reason });
	}
}

export async function revokeOtherDeviceSessions(userId: string, currentToken: string | null): Promise<number> {
	if (!userId || !isDatabaseConfigured()) return 0;
	await ensurePostgresInit();
	const currentHash = currentToken ? hashSessionToken(currentToken) : '';
	const res = await getPgPool().query<{ id: string }>(
		`UPDATE user_sessions SET revoked_at = $3, revoke_reason = 'revoke_others'
		 WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL RETURNING id`,
		[userId, currentHash, Date.now()]
	);
	for (const r of res.rows) {
		await publishEventQuiet(getPgPool(), { k: 'session_revoked', userId, sessionIds: [String(r.id)], reason: 'revoke_others' });
	}
	await publishEventQuiet(getPgPool(), { k: 'session', userId });
	return res.rows.length;
}

export async function adminResetUserDeviceSessions(targetUserId: string): Promise<number> {
	if (!targetUserId || !isDatabaseConfigured()) return 0;
	await ensurePostgresInit();
	const res = await getPgPool().query<{ id: string }>(
		`UPDATE user_sessions SET revoked_at = $2, revoke_reason = 'admin_reset' WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
		[targetUserId, Date.now()]
	);
	await getPgPool().query('UPDATE users SET session_token = NULL, session_expires_at = NULL WHERE id = $1', [targetUserId]);
	for (const r of res.rows) {
		await publishEventQuiet(getPgPool(), { k: 'session_revoked', userId: targetUserId, sessionIds: [String(r.id)], reason: 'admin_reset' });
	}
	await publishEventQuiet(getPgPool(), { k: 'session', userId: targetUserId });
	return res.rows.length;
}

export async function hasActiveMobileSession(userId: string): Promise<boolean> {
	if (!userId || !isDatabaseConfigured()) return false;
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT 1 FROM user_sessions WHERE user_id = $1 AND device_class = 'mobile' AND revoked_at IS NULL AND expires_at > $2 LIMIT 1`,
		[userId, Date.now()]
	);
	return res.rows.length > 0;
}
