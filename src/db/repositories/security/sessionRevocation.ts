import { ensurePostgresInit, getPgPool } from '@/db';
import { publishEventQuiet } from '@/db/events';
import { closeUserTerminalSessions } from '@/server/terminalManager';
import { logSystemEvent } from '../logs.repo';

export async function revokeUserSession(params: {
	targetUserId: string;
	actorId: string;
	ip: string;
}): Promise<boolean> {
	if (params.targetUserId === params.actorId) return false;
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const res = await pool.query(
		`UPDATE users
		 SET session_token = NULL, session_expires_at = NULL
		 WHERE id = $1
		 RETURNING email AS email, first_name AS name, last_name AS surname`,
		[params.targetUserId]
	);
	if ((res.rowCount ?? 0) === 0) return false;
	const devRes = await pool
		.query<{ id: string }>(
			`UPDATE user_sessions SET revoked_at = $2, revoke_reason = 'soc_revoked'
			 WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
			[params.targetUserId, now]
		)
		.catch(() => ({ rows: [] as Array<{ id: string }> }));
	const u = res.rows[0];
	closeUserTerminalSessions(params.targetUserId);
	const sessionIds = devRes.rows.map((r) => String(r.id));
	await publishEventQuiet(
		pool,
		sessionIds.length > 0
			? [
					{ k: 'session', userId: params.targetUserId },
					{ k: 'session_revoked', userId: params.targetUserId, sessionIds, reason: 'soc_revoked' },
				]
			: { k: 'session', userId: params.targetUserId }
	);
	await logSystemEvent({
		service: 'security',
		level: 'WARN',
		message: `User session terminated by SOC: ${u.email}`,
		detail: { targetUserId: params.targetUserId, email: u.email },
		userId: params.actorId,
		ip: params.ip,
	});
	return true;
}

export async function revokeAllNonAdminSessions(params: {
	actorId: string;
	ip: string;
}): Promise<number> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();
	const res = await pool.query(
		`UPDATE users
		 SET session_token = NULL, session_expires_at = NULL
		 WHERE session_token IS NOT NULL AND id <> $1
		 RETURNING id`,
		[params.actorId]
	);
	const devRes = await pool
		.query<{ id: string; userId: string }>(
			`UPDATE user_sessions SET revoked_at = $2, revoke_reason = 'soc_kill_all'
			 WHERE user_id <> $1 AND revoked_at IS NULL
			 RETURNING id, user_id AS "userId"`,
			[params.actorId, now]
		)
		.catch(() => ({ rows: [] as Array<{ id: string; userId: string }> }));
	const touchedUsers = new Set(res.rows.map((r) => String(r.id)));
	const sidsByUser = new Map<string, string[]>();
	for (const r of devRes.rows) {
		touchedUsers.add(String(r.userId));
		const list = sidsByUser.get(String(r.userId)) ?? [];
		list.push(String(r.id));
		sidsByUser.set(String(r.userId), list);
	}
	for (const uid of touchedUsers) {
		closeUserTerminalSessions(uid);
		const sids = sidsByUser.get(uid) ?? [];
		await publishEventQuiet(
			pool,
			sids.length > 0
				? [{ k: 'session', userId: uid }, { k: 'session_revoked', userId: uid, sessionIds: sids, reason: 'soc_kill_all' }]
				: { k: 'session', userId: uid }
		);
	}
	const count = touchedUsers.size;
	await logSystemEvent({
		service: 'security',
		level: 'ERROR',
		message: `SoC Emergency Kill-Switch: ${count} active user sessions revoked`,
		detail: { droppedSessionCount: count },
		userId: params.actorId,
		ip: params.ip,
	});
	return count;
}

export async function revokeAnomalousSessions(
	paramsOrActorId: { actorId: string; ip: string } | string,
	optionalIp?: string
): Promise<number> {
	const actorId = typeof paramsOrActorId === 'object' ? paramsOrActorId.actorId : paramsOrActorId;
	const ip = typeof paramsOrActorId === 'object' ? paramsOrActorId.ip : (optionalIp || '');

	await ensurePostgresInit();
	const pool = getPgPool();
	const now = Date.now();

	const res = await pool.query(
		`UPDATE users
		 SET session_token = NULL, session_expires_at = NULL
		 WHERE session_token IS NOT NULL
		   AND (session_expires_at IS NULL OR session_expires_at > $1)
		   AND id <> $2
		   AND last_login_ip IS NOT NULL
		   AND last_active_ip IS NOT NULL
		   AND last_login_ip <> last_active_ip
		 RETURNING id`,
		[now, actorId]
	);

	for (const row of res.rows) {
		const uid = String(row.id);
		closeUserTerminalSessions(uid);
		await publishEventQuiet(pool, { k: 'session', userId: uid });
	}

	const count = res.rowCount ?? 0;
	await logSystemEvent({
		service: 'security',
		level: 'WARN',
		message: `SoC Session Revocation: ${count} sessions with IP anomaly terminated`,
		detail: { droppedSessionCount: count },
		userId: actorId,
		ip,
	});

	return count;
}

export async function suspendUserAccount(params: {
	targetUserId: string;
	actorId: string;
	ip: string;
}): Promise<{ ok: boolean; error?: string }> {
	if (params.targetUserId === params.actorId) {
		return { ok: false, error: 'Cannot suspend own administrator account.' };
	}
	await ensurePostgresInit();
	const pool = getPgPool();
	const check = await pool.query(`SELECT id, email AS email, role_id AS "roleId" FROM users WHERE id = $1`, [
		params.targetUserId,
	]);
	if ((check.rowCount ?? 0) === 0) {
		return { ok: false, error: 'User not found.' };
	}
	const target = check.rows[0];
	if (target.roleId === 'role_admin') {
		return { ok: false, error: 'Cannot suspend an administrator account.' };
	}

	await pool.query(
		`UPDATE users
		 SET status = 'pending', session_token = NULL, session_expires_at = NULL
		 WHERE id = $1`,
		[params.targetUserId]
	);
	const devRes = await pool
		.query<{ id: string }>(
			`UPDATE user_sessions SET revoked_at = $2, revoke_reason = 'soc_suspended'
			 WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
			[params.targetUserId, Date.now()]
		)
		.catch(() => ({ rows: [] as Array<{ id: string }> }));
	closeUserTerminalSessions(params.targetUserId);
	const sids = devRes.rows.map((r) => String(r.id));
	await publishEventQuiet(
		pool,
		sids.length > 0
			? [
					{ k: 'session', userId: params.targetUserId },
					{ k: 'session_revoked', userId: params.targetUserId, sessionIds: sids, reason: 'soc_suspended' },
				]
			: { k: 'session', userId: params.targetUserId }
	);

	await logSystemEvent({
		service: 'security',
		level: 'ERROR',
		message: `Suspicious user account suspended and session closed by SOC: ${target.email}`,
		detail: { targetUserId: params.targetUserId, email: target.email },
		userId: params.actorId,
		ip: params.ip,
	});

	return { ok: true };
}
