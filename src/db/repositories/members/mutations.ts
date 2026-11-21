import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, isDatabaseConfigured, withTransaction } from '@/db/index';
import type { User } from '@/db/schema';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { notificationEvents, publishEvent, publishEventQuiet } from '@/db/events';
import { cleanIp, memberTargetName } from '@/lib/audit';
import { hashSessionToken } from './normalize';

export async function updateUserSession(
	userId: string,
	token: string | null,
	expiresAt: number | null = null,
	telemetry?: { ip?: string | null; userAgent?: string | null },
	authMethod: 'password' | 'totp' | 'passkey' = 'password'
): Promise<void> {
	if (!isDatabaseConfigured()) return;
	await ensurePostgresInit();
	const now = Date.now();
	const cleanedIp = telemetry?.ip ? cleanIp(telemetry.ip) : null;
	const cleanUa = telemetry?.userAgent
		? String(telemetry.userAgent).replace(/[\r\n\0]+/g, ' ').trim().slice(0, 240)
		: null;
	const storedToken = token ? hashSessionToken(token) : null;

	if (token && (cleanedIp || cleanUa)) {
		await getPgPool().query(
			`UPDATE users
			 SET session_token = $1,
			     last_login_at = $2,
			     session_expires_at = $3,
			     last_login_ip = $4,
			     last_login_user_agent = $5,
			     last_active_ip = $4,
			     last_active_at = $2,
			     auth_method = $6
			 WHERE id = $7`,
			[storedToken, now, expiresAt, cleanedIp, cleanUa, authMethod, userId]
		);
	} else {
		await getPgPool().query(
			'UPDATE users SET session_token = $1, last_login_at = $2, session_expires_at = $3, auth_method = $4 WHERE id = $5',
			[storedToken, token ? now : null, token ? expiresAt : null, token ? authMethod : 'password', userId]
		);
	}
	await publishEventQuiet(getPgPool(), { k: 'session', userId });
}

export async function createUser(
	data: {
		firstName?: string;
		name?: string;
		lastName?: string;
		surname?: string;
		email: string;
		passwordHash: string;
		handle?: string;
		studentNo?: string;
		department?: string;
		grade?: number;
		roleId?: string | null;
		status?: 'active' | 'pending' | 'rejected' | 'alumni';
		bio?: string;
		preferredLanguage?: 'tr' | 'en';
	},
	audit?: AuditContext
): Promise<User> {
	await ensurePostgresInit();
	const id = `usr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const firstName = (data.firstName ?? data.name ?? '').trim();
	const lastName = (data.lastName ?? data.surname ?? '').trim();
	const handle = (data.handle ?? data.studentNo ?? '').trim();
	const department = (data.department ?? '').trim();
	const grade = Number(data.grade) || 1;
	const createdAt = Date.now();
	const newUser: User = {
		id,
		firstName,
		lastName,
		name: firstName,
		surname: lastName,
		email: data.email.trim().toLowerCase(),
		passwordHash: data.passwordHash,
		handle,
		studentNo: handle,
		department,
		grade,
		roleId: data.roleId ?? null,
		bio: data.bio || '',
		xp: 50,
		status: data.status || 'pending',
		preferredLanguage: data.preferredLanguage === 'tr' ? 'tr' : 'en',
		createdAt,
	};

	await withTransaction(async (client) => {
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, bio, xp, status, created_at, role_id, preferred_language)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
			[
				newUser.id,
				newUser.firstName,
				newUser.lastName,
				newUser.email,
				newUser.passwordHash,
				newUser.handle,
				newUser.department,
				newUser.grade,
				newUser.bio,
				newUser.xp,
				newUser.status,
				newUser.createdAt,
				newUser.roleId ?? null,
				newUser.preferredLanguage ?? 'en',
			]
		);
		if (newUser.status === 'pending') await publishEvent(client, notificationEvents());
		if (audit && newUser.roleId) {
			const role = await client.query('SELECT name FROM roles WHERE id = $1', [newUser.roleId]);
			const roleNameVal = role.rows[0]?.name ?? null;
			await logAuditEvent(client, audit, {
				action: 'member.role_grant',
				targetType: 'member',
				targetId: id,
				targetName: memberTargetName(newUser),
				before: { roleId: null, roleName: null },
				after: { roleId: newUser.roleId, roleName: roleNameVal, memberAdded: true },
			});
		}
	});

	return newUser;
}

export async function updateUserStatus(
	userId: string,
	status: 'active' | 'pending' | 'rejected' | 'alumni',
	db: Pick<PoolClient, 'query'> = getPgPool()
): Promise<void> {
	await ensurePostgresInit();
	if (status === 'active') {
		await db.query(
			"UPDATE users SET status = $1, xp = COALESCE(xp, 0) + CASE WHEN status = 'pending' THEN 50 ELSE 0 END WHERE id = $2",
			[status, userId]
		);
	} else {
		await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
	}
	await publishEvent(db, [{ k: 'session', userId }, { k: 'notification', userId }]);
}

export async function addUserXp(userId: string, amount: number): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2', [amount, userId]);
}

export async function deleteUser(id: string, audit: AuditContext): Promise<boolean> {
	return withTransaction(async (client) => {
		const res = await client.query(
			`DELETE FROM users u WHERE u.id = $1
			 RETURNING u.first_name AS "firstName", u.first_name AS name,
			   u.last_name AS "lastName", u.last_name AS surname,
			   u.email AS email, u.status AS status, u.role_id AS "roleId",
			   (SELECT r.name FROM roles r WHERE r.id = u.role_id) AS "roleName"`,
			[id]
		);
		const u = res.rows[0];
		if (!u) return false;
		await logAuditEvent(client, audit, {
			action: 'member.delete',
			targetType: 'member',
			targetId: id,
			targetName: memberTargetName(u),
			before: {
				name: `${u.name} ${u.surname}`.trim(),
				email: u.email,
				status: u.status,
				roleId: u.roleId ?? null,
				roleName: u.roleName ?? null,
			},
			after: null,
		});
		await publishEvent(client, { k: 'session', userId: id });
		return true;
	});
}
