import { ensurePostgresInit, getPgPool } from '@/db';
import type { User } from '@/db/schema';
import { cleanIp } from '@/lib/audit';
import { logSystemEvent } from '../logs.repo';
import { calculateImpossibleTravel } from './travel';
import type { ActiveSessionInfo } from './types';

export * from './sessionRevocation';

// Throttle session activity DB updates & anomaly warnings per user+session
const sessionActivityThrottle = new Map<string, { lastIp: string; updatedAt: number; anomalyLoggedAt: number }>();

function isSameSubnet(ipA: string, ipB: string): boolean {
	if (ipA === ipB) return true;
	const isLoopbackA = ipA === '127.0.0.1' || ipA === '::1' || ipA === '::ffff:127.0.0.1';
	const isLoopbackB = ipB === '127.0.0.1' || ipB === '::1' || ipB === '::ffff:127.0.0.1';
	if (isLoopbackA && isLoopbackB) return true;

	if (ipA.includes('.') && ipB.includes('.')) {
		const partsA = ipA.split('.');
		const partsB = ipB.split('.');
		if (partsA.length === 4 && partsB.length === 4) {
			return partsA[0] === partsB[0] && partsA[1] === partsB[1] && partsA[2] === partsB[2];
		}
	}
	if (ipA.includes(':') && ipB.includes(':')) {
		const pA = ipA.split(':');
		const pB = ipB.split(':');
		return pA.slice(0, 3).join(':') === pB.slice(0, 3).join(':');
	}
	return false;
}

export function recordSessionActivity(user: User, currentIp: string): { suspiciousJump: boolean } {
	const cleanedIp = cleanIp(currentIp);
	if (!cleanedIp || cleanedIp === 'unknown') return { suspiciousJump: false };

	const now = Date.now();
	const throttleKey = `${user.id}:${user.activeSessionId ?? 'legacy'}`;
	const prev = sessionActivityThrottle.get(throttleKey);

	const loginIp = user.lastLoginIp ? cleanIp(user.lastLoginIp) : (prev?.lastIp ?? null);
	if (loginIp && loginIp !== 'unknown' && loginIp !== cleanedIp) {
		if (loginIp === '127.0.0.1' || loginIp === '::1' || cleanedIp === '127.0.0.1' || cleanedIp === '::1') {
			return { suspiciousJump: false };
		}
		const isSubnetMatch = isSameSubnet(loginIp, cleanedIp);
		const lastAnomaly = prev?.anomalyLoggedAt ?? 0;
		if (now - lastAnomaly > 5 * 60_000) {
			sessionActivityThrottle.set(throttleKey, {
				lastIp: cleanedIp,
				updatedAt: now,
				anomalyLoggedAt: now,
			});
			void logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `Session IP change (suspicious jump): ${user.email} (${loginIp} -> ${cleanedIp})`,
				detail: {
					email: user.email,
					sessionId: user.activeSessionId ?? null,
					loginIp,
					newIp: cleanedIp,
					loginDevice: user.lastLoginUserAgent ?? null,
					subnetDifferent: !isSubnetMatch,
				},
				userId: user.id,
				ip: cleanedIp,
			});
			void getPgPool()
				.query(`UPDATE users SET last_active_ip = $1, last_active_at = $2 WHERE id = $3`, [
					cleanedIp,
					now,
					user.id,
				])
				.catch(() => {
					/* Best-effort user activity IP update */
				});
		}

		if (!isSubnetMatch) {
			return { suspiciousJump: true };
		}
	}

	if (!prev || prev.lastIp !== cleanedIp || now - prev.updatedAt > 60_000) {
		sessionActivityThrottle.set(throttleKey, {
			lastIp: cleanedIp,
			updatedAt: now,
			anomalyLoggedAt: prev?.anomalyLoggedAt ?? 0,
		});
		void getPgPool()
			.query(
				`UPDATE users
				 SET last_active_ip = $1,
				     last_active_at = $2,
				     last_login_ip = COALESCE(last_login_ip, $1)
				 WHERE id = $3`,
				[cleanedIp, now, user.id]
			)
			.catch(() => {
				/* Best-effort user activity timestamp update */
			});
		if (user.activeSessionId) {
			void getPgPool()
				.query(`UPDATE user_sessions SET last_active_at = $2 WHERE id = $1`, [user.activeSessionId, now])
				.catch(() => {
					/* Best-effort device session activity timestamp update */
				});
		}
	}

	return { suspiciousJump: false };
}

const strOrNull = (val: unknown): string | null => (typeof val === 'string' && val ? val : null);
const numOrNull = (val: unknown): number | null => {
	if (val === null || val === undefined || val === '') return null;
	const n = Number(val);
	return Number.isFinite(n) && n > 0 ? n : null;
};

function mapActiveSessionRow(r: Record<string, unknown>, now: number): ActiveSessionInfo {
	const sJson = (r.sessionJson && typeof r.sessionJson === 'object' ? r.sessionJson : {}) as Record<string, unknown>;
	const loginIp = strOrNull(sJson.created_ip) ?? strOrNull(sJson.ip_address) ?? strOrNull(r.lastLoginIp);
	const activeIp =
		strOrNull(sJson.last_active_ip) ??
		strOrNull(sJson.ip_address) ??
		strOrNull(r.lastActiveIp) ??
		loginIp;
	const roleId = strOrNull(r.roleId);
	const ipChanged = Boolean(loginIp && activeIp && loginIp !== activeIp);
	const lastLoginAt = numOrNull(sJson.created_at) ?? numOrNull(r.lastLoginDate) ?? numOrNull(r.lastActiveDate);
	const lastActiveAt = numOrNull(r.lastActiveDate);
	const sessionExpiresAt = numOrNull(r.sessionEnd);

	let impossibleTravel: ActiveSessionInfo['impossibleTravel'] = undefined;
	if (ipChanged && loginIp && activeIp) {
		impossibleTravel = calculateImpossibleTravel(loginIp, activeIp, lastLoginAt ?? now, lastActiveAt ?? now);
	}

	const firstName = String(r.name ?? '');
	const lastName = String(r.surname ?? '');
	const uid = String(r.id);
	const sid = strOrNull(r.sessionId) ?? undefined;
	return {
		id: uid,
		userId: uid,
		sessionId: sid,
		firstName,
		lastName,
		roleName: r.roleName ? String(r.roleName) : 'Member',
		lastLoginAt,
		sessionExpiresAt,
		lastLoginIp: loginIp,
		lastActiveIp: activeIp,
		lastActiveAt,
		lastLoginUserAgent: strOrNull(r.sessionUa) ?? strOrNull(r.deviceName) ?? strOrNull(r.lastLoginUserAgent),
		name: firstName,
		surname: lastName,
		email: String(r.email ?? ''),
		roleId,
		admin: roleId === 'role_admin' || Number(r.isSystem ?? 0) === 1,
		status: String(r.status || 'active'),
		totpEnabled: Number(r.totpEnabled ?? 0) === 1,
		lastLoginDate: lastLoginAt,
		sessionEnd: sessionExpiresAt,
		lastActiveDate: lastActiveAt,
		ipChanged,
		impossibleTravel,
	};
}

export async function getActiveSessions(): Promise<ActiveSessionInfo[]> {
	await ensurePostgresInit();
	const now = Date.now();
	const pool = getPgPool();
	const [deviceRes, legacyRes] = await Promise.all([
		pool.query(
			`SELECT s.id AS "sessionId",
			        u.id AS id,
			        to_jsonb(s) - 'token_hash' AS "sessionJson",
			        u.first_name AS name,
			        u.last_name AS surname,
			        u.email AS email,
			        u.role_id AS "roleId",
			        u.status AS status,
			        u.totp_enabled AS "totpEnabled",
			        u.last_login_at AS "lastLoginDate",
			        u.last_login_ip AS "lastLoginIp",
			        u.last_active_ip AS "lastActiveIp",
			        s.last_active_at AS "lastActiveDate",
			        s.expires_at AS "sessionEnd",
			        s.user_agent AS "sessionUa",
			        s.device_name AS "deviceName",
			        u.last_login_user_agent AS "lastLoginUserAgent",
			        r.name AS "roleName",
			        r.is_system AS "isSystem"
			 FROM user_sessions s
			 JOIN users u ON u.id = s.user_id
			 LEFT JOIN roles r ON r.id = u.role_id
			 WHERE s.revoked_at IS NULL AND s.expires_at > $1
			 ORDER BY s.last_active_at DESC`,
			[now]
		),
		pool.query(
			`SELECT u.id, u.first_name AS name, u.last_name AS surname, u.email AS email,
			        u.role_id AS "roleId", u.status AS status, u.totp_enabled AS "totpEnabled",
			        u.last_login_at AS "lastLoginDate", u.session_expires_at AS "sessionEnd",
			        u.last_login_ip AS "lastLoginIp", u.last_active_ip AS "lastActiveIp",
			        u.last_active_at AS "lastActiveDate", u.last_login_user_agent AS "lastLoginUserAgent",
			        r.name AS "roleName", r.is_system AS "isSystem"
			 FROM users u
			 LEFT JOIN roles r ON r.id = u.role_id
			 WHERE u.session_token IS NOT NULL
			   AND (u.session_expires_at IS NULL OR u.session_expires_at > $1)
			   AND NOT EXISTS (
			     SELECT 1 FROM user_sessions s
			     WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > $1
			   )
			 ORDER BY COALESCE(u.last_active_at, u.last_login_at, 0) DESC`,
			[now]
		),
	]);

	const rows = [
		...deviceRes.rows.map((r) => mapActiveSessionRow(r, now)),
		...legacyRes.rows.map((r) => mapActiveSessionRow(r, now)),
	];
	return rows.sort((a, b) => (b.lastActiveAt ?? b.lastLoginAt ?? 0) - (a.lastActiveAt ?? a.lastLoginAt ?? 0));
}
