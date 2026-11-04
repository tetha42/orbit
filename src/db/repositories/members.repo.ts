import { randomUUID, createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, isDatabaseConfigured, withTransaction } from '@/db/index';
import type { User, MemberRosterRow } from '@/db/schema';
import { MEMBER_ROSTER_SQL } from '@/db/schema';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { notificationEvents, publishEvent, publishEventQuiet } from '@/db/events';
import { cleanIp, memberTargetName } from '@/lib/audit';
import { decryptSecret } from '@/lib/auth/secretBox';
import { getUsersDiskUsage } from './files.repo';

export async function normalizeUserRow(
	row: Record<string, unknown> | undefined | null,
	options?: { skipTotpDecryption?: boolean } | unknown
): Promise<User | null> {
	if (!row) return null;
	const skip = Boolean(options && typeof options === 'object' && 'skipTotpDecryption' in options && (options as { skipTotpDecryption?: boolean }).skipTotpDecryption);
	const rawTotpSecret = (row.totpsecret ?? row.totpSecret ?? row.totp_secret) ? String(row.totpsecret ?? row.totpSecret ?? row.totp_secret) : null;
	const totpSecret = skip ? null : (rawTotpSecret ? await decryptSecret(rawTotpSecret) : null);
	const firstName = String(row.firstName ?? row.first_name ?? row.name ?? '');
	const lastName = String(row.lastName ?? row.last_name ?? row.surname ?? '');
	const handle = String(row.handle ?? row.studentNo ?? '');
	const department = String(row.department ?? '');
	const grade = Number(row.grade ?? 1);
	const avatarUrl = (row.avatarUrl ?? row.avatar_url ?? row.profilePhoto) ? String(row.avatarUrl ?? row.avatar_url ?? row.profilePhoto) : undefined;
	const createdAt = Number(row.createdAt ?? row.created_at ?? row.creation ?? 0);
	const lastLoginAt = row.lastLoginAt ? Number(row.lastLoginAt) : (row.last_login_at ? Number(row.last_login_at) : (row.lastLoginDate ? Number(row.lastLoginDate) : (row.lastLoginDate ? Number(row.lastLoginDate) : undefined)));
	return {
		id: String(row.id),
		firstName,
		lastName,
		name: firstName,
		surname: lastName,
		email: String(row.email ?? ''),
		passwordHash: String(row.passwordHash ?? row.password_hash ?? ''),
		handle,
		studentNo: handle,
		department,
		grade,
		roleId: (row.roleId ?? row.role_id ?? null) as string | null,
		avatarUrl,
		profilePhoto: avatarUrl,
		bio: (row.bio ?? '') ? String(row.bio) : undefined,
		xp: Number(row.xp ?? 0),
		status: ((row.status) as User['status']) || 'active',
		authMethod: (['password', 'totp', 'passkey'].includes(String(row.authMethod ?? ''))
			? String(row.authMethod)
			: 'password') as User['authMethod'],
		activeSessionToken: (row.sessionToken ?? row.session_token ?? row.activeSessionToken) ? String(row.sessionToken ?? row.session_token ?? row.activeSessionToken) : undefined,
		lastLoginAt,
		lastLoginDate: lastLoginAt,
		lastLoginIp: (row.lastLoginIp ?? row.last_login_ip) ? String(row.lastLoginIp ?? row.last_login_ip) : null,
		lastLoginUserAgent: (row.lastLoginUserAgent ?? row.last_login_user_agent) ? String(row.lastLoginUserAgent ?? row.last_login_user_agent) : null,
		lastActiveIp: (row.lastActiveIp ?? row.last_active_ip) ? String(row.lastActiveIp ?? row.last_active_ip) : null,
		lastActiveDate: row.lastActiveAt ? Number(row.lastActiveAt) : (row.last_active_at ? Number(row.last_active_at) : (row.lastActiveDate ? Number(row.lastActiveDate) : (row.lastActiveDate ? Number(row.lastActiveDate) : null))),
		sessionEnd: row.sessionExpiresAt ? Number(row.sessionExpiresAt) : (row.session_expires_at ? Number(row.session_expires_at) : (row.sessionEnd ? Number(row.sessionEnd) : (row.sessionEnd ? Number(row.sessionEnd) : null))),
		preferredLanguage: (row.preferredLanguage ?? row.preferred_language ?? row.preferredlanguage ?? 'tr') === 'en' ? 'en' : 'tr',
		totpSecret,
		totpEnabled: Number(row.totpEnabled ?? row.totp_enabled ?? row.totpenabled ?? 0),
		totpRecoveryCodes: (row.totpRecoveryCodes ?? row.totp_recovery_codes ?? row.totprecoverycodes) ? String(row.totpRecoveryCodes ?? row.totp_recovery_codes ?? row.totprecoverycodes) : null,
		totpConfirmedAt: row.totpConfirmedAt ? Number(row.totpConfirmedAt) : (row.totp_confirmed_at ? Number(row.totp_confirmed_at) : (row.totpconfirmedat ? Number(row.totpconfirmedat) : null)),
		totpLastStep: row.totpLastStep ? Number(row.totpLastStep) : (row.totp_last_step ? Number(row.totp_last_step) : (row.totpLastStep ? Number(row.totpLastStep) : (row.totpLastStep ? Number(row.totpLastStep) : null))),
		createdAt,
		creation: createdAt,
	};
}

export async function getUsers(): Promise<User[]> {
	if (!isDatabaseConfigured()) return [];
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query('SELECT * FROM users ORDER BY created_at ASC');
		if (!res.rows?.length) return [];
		const users = await Promise.all(res.rows.map(normalizeUserRow));
		return users.filter((u): u is User => u !== null);
	} catch (err) {
		console.warn('[members.repo] getUsers read warning:', err);
		return [];
	}
}

function parseRosterTeams(raw: unknown): MemberRosterRow['teams'] {
	let parsed: unknown = raw;
	if (typeof raw === 'string' && raw.trim()) {
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(parsed)) return [];
	// Legacy/foreign rows may contain the same team twice (leader + member).
	const byId = new Map<string, NonNullable<MemberRosterRow['teams']>[number]>();
	for (const item of parsed) {
		if (!item || typeof item !== 'object' || !(item as { id?: unknown }).id) continue;
		const team = item as NonNullable<MemberRosterRow['teams']>[number];
		const id = String(team.id);
		if (!byId.has(id)) byId.set(id, team);
	}
	return [...byId.values()];
}

export interface MemberRosterOptions {
	isManager?: boolean;
	page?: number;
	limit?: number;
	search?: string;
}

export interface PaginatedMemberRoster {
	members: MemberRosterRow[];
	totalCount: number;
	page: number;
	limit: number;
}

function mapRosterRow(r: Record<string, unknown>): MemberRosterRow {
	const email = String(r.email ?? '');
	const roleId = (r.roleId ?? r.role_id ?? null) as string | null;
	const status = ((r.status) as User['status']) || 'active';
	const firstName = String(r.firstName ?? r.first_name ?? r.name ?? '');
	const lastName = String(r.lastName ?? r.last_name ?? r.surname ?? '');
	const handle = String(r.handle ?? r.studentNo ?? '');
	const department = String(r.department ?? '');
	const grade = Number(r.grade ?? 1);
	const avatarUrl = (r.avatarUrl ?? r.avatar_url ?? r.profilePhoto ?? undefined) as string | undefined;
	const createdAt = Number(r.createdAt ?? r.created_at ?? r.creation ?? 0);
	const roleName = (r.roleName ?? null) as string | null;
	const roleColor = (r.roleColor ?? null) as string | null;
	return {
		id: String(r.id ?? ''),
		firstName,
		lastName,
		name: firstName,
		surname: lastName,
		email,
		passwordHash: String(r.passwordHash ?? r.password_hash ?? ''),
		handle,
		studentNo: handle,
		department,
		grade,
		roleId,
		roleName,
		roleColor,
		avatarUrl,
		profilePhoto: avatarUrl,
		bio: (r.bio ?? undefined) as string | undefined,
		xp: Number(r.xp ?? 0),
		status,
		createdAt,
		creation: createdAt,
		teamName: (r.teamName ?? undefined) as string | undefined,
		teams: parseRosterTeams(r.teams),
		attendanceCount: Number(r.attendanceCount ?? 0),
	};
}

async function enrichRosterRows(rows: MemberRosterRow[], isManager?: boolean): Promise<MemberRosterRow[]> {
	const ids = rows.map((row) => row.id).filter(Boolean);
	if (ids.length > 0) {
		const visibilityFilter = isManager
			? "f.directory_visibility IN ('members', 'managers', 'hidden')"
			: "f.directory_visibility = 'members'";
		const values = await getPgPool().query(
			`SELECT v.user_id AS "userId", f.field_key AS "fieldKey", f.type, v.value
			 FROM member_field_values v
			 JOIN form_fields f ON f.id = v.field_id
			 WHERE v.user_id = ANY($1)
			   AND f.enabled = 1
			   AND f.archived_at IS NULL
			   AND ${visibilityFilter}`,
			[ids]
		);
		const byUser = new Map<string, Record<string, string>>();
		for (const row of values.rows) {
			const map = byUser.get(String(row.userId)) ?? {};
			map[String(row.fieldKey)] =
				String(row.type) === 'password' ? '••••••••' : String(row.value ?? '');
			byUser.set(String(row.userId), map);
		}
		for (const row of rows) row.customFields = byUser.get(row.id) ?? {};

		const diskMap = await getUsersDiskUsage(ids);
		for (const row of rows) {
			const disk = diskMap.get(row.id);
			row.diskUsageBytes = disk?.bytes ?? 0;
			row.fileCount = disk?.count ?? 0;
		}
	}
	return rows;
}

export async function getMemberRoster(options: MemberRosterOptions & { page: number }): Promise<PaginatedMemberRoster>;
export async function getMemberRoster(options: MemberRosterOptions & { limit: number }): Promise<PaginatedMemberRoster>;
export async function getMemberRoster(options?: { isManager?: boolean; search?: string }): Promise<MemberRosterRow[]>;
export async function getMemberRoster(options?: MemberRosterOptions): Promise<MemberRosterRow[] | PaginatedMemberRoster> {
	const isPaginated = options?.page !== undefined || options?.limit !== undefined;
	if (!isDatabaseConfigured()) {
		if (isPaginated) {
			return {
				members: [],
				totalCount: 0,
				page: options?.page ?? 1,
				limit: options?.limit ?? 20,
			};
		}
		return [];
	}

	try {
		await ensurePostgresInit();

		if (isPaginated) {
			const page = Math.max(1, options?.page ?? 1);
			const limit = Math.max(1, Math.min(200, options?.limit ?? 20));
			const offset = (page - 1) * limit;

			const conditions: string[] = ['1=1'];
			const params: unknown[] = [];

			if (!options?.isManager) {
				conditions.push("(status = 'active' OR status = 'alumni')");
			}

			if (options?.search?.trim()) {
				params.push(`%${options.search.trim()}%`);
				conditions.push(
					`("firstName" ILIKE $${params.length} OR "lastName" ILIKE $${params.length} OR ("firstName" || ' ' || "lastName") ILIKE $${params.length} OR email ILIKE $${params.length} OR handle ILIKE $${params.length} OR department ILIKE $${params.length})`
				);
			}

			const whereClause = conditions.join(' AND ');

			const countSql = `
				SELECT COUNT(*)::int AS count FROM (
					${MEMBER_ROSTER_SQL}
				) sub WHERE ${whereClause}
			`;
			const countRes = await getPgPool().query(countSql, params);
			const totalCount = Number(countRes.rows[0]?.count ?? 0);

			const dataParams = [...params, limit, offset];
			const limitIdx = dataParams.length - 1;
			const offsetIdx = dataParams.length;

			const dataSql = `
				SELECT * FROM (
					${MEMBER_ROSTER_SQL}
				) sub WHERE ${whereClause} LIMIT $${limitIdx} OFFSET $${offsetIdx}
			`;
			const dataRes = await getPgPool().query(dataSql, dataParams);
			const rows = await enrichRosterRows(dataRes.rows.map(mapRosterRow), options?.isManager);

			return {
				members: rows,
				totalCount,
				page,
				limit,
			};
		}

		if (options?.search?.trim()) {
			const conditions: string[] = ['1=1'];
			const params: unknown[] = [];
			if (!options?.isManager) {
				conditions.push("(status = 'active' OR status = 'alumni')");
			}
			params.push(`%${options.search.trim()}%`);
			conditions.push(
				`("firstName" ILIKE $${params.length} OR "lastName" ILIKE $${params.length} OR ("firstName" || ' ' || "lastName") ILIKE $${params.length} OR email ILIKE $${params.length} OR handle ILIKE $${params.length} OR department ILIKE $${params.length})`
			);
			const whereClause = conditions.join(' AND ');
			const searchSql = `
				SELECT * FROM (
					${MEMBER_ROSTER_SQL}
				) sub WHERE ${whereClause}
			`;
			const res = await getPgPool().query(searchSql, params);
			return await enrichRosterRows(res.rows.map(mapRosterRow), options?.isManager);
		}

		const res = await getPgPool().query(MEMBER_ROSTER_SQL);
		if (!res.rows?.length) return [];
		return await enrichRosterRows(res.rows.map(mapRosterRow), options?.isManager);
	} catch (err) {
		console.warn('[members.repo] getMemberRoster read warning:', err);
		if (isPaginated) {
			return {
				members: [],
				totalCount: 0,
				page: options?.page ?? 1,
				limit: options?.limit ?? 20,
			};
		}
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

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function getUserBySessionToken(token: string): Promise<User | null> {
	if (!token) return null;
	if (!isDatabaseConfigured()) return null;
	try {
		await ensurePostgresInit();
		const tokenHash = hashSessionToken(token);
		const res = await getPgPool().query(
			'SELECT * FROM users WHERE session_token = $1 OR session_token = $2 LIMIT 1',
			[tokenHash, token]
		);
		const user = await normalizeUserRow(res.rows[0]);
		if (!user) return null;

		// Transparent seamless upgrade: if stored token was plaintext, upgrade to sha256 hash immediately
		const rawRow = res.rows[0];
		if (rawRow && (rawRow.session_token === token)) {
			void getPgPool().query('UPDATE users SET session_token = $1 WHERE id = $2', [tokenHash, user.id]).catch(() => {});
		}

		const expiresAt = user.sessionEnd ? Number(user.sessionEnd) : null;
		if (expiresAt === null || expiresAt <= Date.now()) {
			await updateUserSession(user.id, null);
			return null;
		}

		return user;
	} catch {
		console.warn('[Session Auth]: Database unconfigured or unreachable, returning unauthenticated state.');
		return null;
	}
}

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
		preferredLanguage: data.preferredLanguage === 'en' ? 'en' : 'tr',
		createdAt,
		creation: createdAt,
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
				newUser.preferredLanguage ?? 'tr',
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

export async function getPendingUsers(): Promise<User[]> {
	if (!isDatabaseConfigured()) return [];
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query(
			"SELECT * FROM users WHERE status = 'pending' ORDER BY created_at ASC"
		);
		if (!res.rows?.length) return [];
		const users = await Promise.all(res.rows.map(normalizeUserRow));
		return users.filter((u): u is User => u !== null);
	} catch (err) {
		console.warn('[members.repo] getPendingUsers read warning:', err);
		return [];
	}
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

export async function addUserXp(
	userId: string,
	amount: number
): Promise<void> {
	await ensurePostgresInit();
	await getPgPool().query('UPDATE users SET xp = COALESCE(xp, 0) + $1 WHERE id = $2', [amount, userId]);
}

export async function deleteUser(id: string, audit: AuditContext): Promise<boolean> {
	return withTransaction(async (client) => {
		const res = await client.query(
			`DELETE FROM users u WHERE u.id = $1
			 RETURNING u.first_name AS "firstName", u.first_name AS name, u.last_name AS "lastName", u.last_name AS surname, u.email AS email, u.status AS status, u.role_id AS "roleId", (SELECT r.name FROM roles r WHERE r.id = u.role_id) AS "roleName", (SELECT r.name FROM roles r WHERE r.id = u.role_id) AS "roleName"`,
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
