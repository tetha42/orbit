import { randomUUID, createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, isDatabaseConfigured, withTransaction } from '@/db/index';
import type { User, MemberRosterRow } from '@/db/schema';
import { MEMBER_ROSTER_SQL } from '@/db/schema';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { notificationEvents, publishEvent, publishEventQuiet } from '@/db/events';
import { temizIp, memberTargetName, memberSummary } from '@/lib/audit';
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
	return {
		id: String(row.id),
		ad: String(row.ad ?? row.firstName ?? row.first_name ?? ''),
		soyad: String(row.soyad ?? row.lastName ?? row.last_name ?? ''),
		email: String(row.email ?? row.email ?? ''),
		passwordHash: String(row.sifrehash ?? row.passwordHash ?? row.passwordHash ?? row.password_hash ?? ''),
		ogrenciNo: String(row.ogrencino ?? row.ogrenciNo ?? row.handle ?? ''),
		bolum: String(row.bolum ?? row.department ?? ''),
		sinif: Number(row.sinif ?? row.grade ?? 1),
		roleId: (row.rolid ?? row.roleId ?? row.roleId ?? row.role_id ?? null) as string | null,
		profilFoto: (row.profilfoto ?? row.profilFoto ?? row.avatarUrl ?? row.avatar_url) ? String(row.profilfoto ?? row.profilFoto ?? row.avatarUrl ?? row.avatar_url) : undefined,
		bio: (row.bio ?? '') ? String(row.bio) : undefined,
		xp: Number(row.xp ?? 0),
		status: ((row.status ?? row.status) as User['status']) || 'aktif',
		authMethod: (['password', 'totp', 'passkey'].includes(String(row.authMethod ?? ''))
			? String(row.authMethod)
			: 'password') as User['authMethod'],
		aktifOturumToken: (row.aktivoturumtoken ?? row.aktifOturumToken ?? row.sessionToken ?? row.session_token) ? String(row.aktivoturumtoken ?? row.aktifOturumToken ?? row.sessionToken ?? row.session_token) : undefined,
		sonGirisTarihi: row.songiristarihi ? Number(row.songiristarihi) : (row.sonGirisTarihi ? Number(row.sonGirisTarihi) : (row.lastLoginAt ? Number(row.lastLoginAt) : (row.last_login_at ? Number(row.last_login_at) : undefined))),
		sonGirisIp: (row.songirisip ?? row.sonGirisIp ?? row.lastLoginIp ?? row.last_login_ip) ? String(row.songirisip ?? row.sonGirisIp ?? row.lastLoginIp ?? row.last_login_ip) : null,
		sonGirisUserAgent: (row.songirisuseragent ?? row.sonGirisUserAgent ?? row.lastLoginUserAgent ?? row.last_login_user_agent) ? String(row.songirisuseragent ?? row.sonGirisUserAgent ?? row.lastLoginUserAgent ?? row.last_login_user_agent) : null,
		sonAktifIp: (row.sonaktifip ?? row.sonAktifIp ?? row.lastActiveIp ?? row.last_active_ip) ? String(row.sonaktifip ?? row.sonAktifIp ?? row.lastActiveIp ?? row.last_active_ip) : null,
		sonAktifTarihi: row.sonaktiftarihi ? Number(row.sonaktiftarihi) : (row.sonAktifTarihi ? Number(row.sonAktifTarihi) : (row.lastActiveAt ? Number(row.lastActiveAt) : (row.last_active_at ? Number(row.last_active_at) : null))),
		oturumBitis: row.oturumbitis ? Number(row.oturumbitis) : (row.oturumBitis ? Number(row.oturumBitis) : (row.sessionExpiresAt ? Number(row.sessionExpiresAt) : (row.session_expires_at ? Number(row.session_expires_at) : null))),
		preferredLanguage: (row.preferredlanguage ?? row.preferred_language ?? row.preferredLanguage ?? 'tr') === 'en' ? 'en' : 'tr',
		totpSecret,
		totpEnabled: Number(row.totpenabled ?? row.totpEnabled ?? row.totp_enabled ?? 0),
		totpRecoveryCodes: (row.totprecoverycodes ?? row.totpRecoveryCodes ?? row.totp_recovery_codes) ? String(row.totprecoverycodes ?? row.totpRecoveryCodes ?? row.totp_recovery_codes) : null,
		totpConfirmedAt: row.totpconfirmedat ? Number(row.totpconfirmedat) : (row.totpConfirmedAt ? Number(row.totpConfirmedAt) : (row.totp_confirmed_at ? Number(row.totp_confirmed_at) : null)),
		totpSonAdim: row.totpsonadim ? Number(row.totpsonadim) : (row.totpSonAdim ? Number(row.totpSonAdim) : (row.totpLastStep ? Number(row.totpLastStep) : (row.totp_last_step ? Number(row.totp_last_step) : null))),
		olusturma: Number(row.olusturma ?? row.createdAt ?? row.created_at ?? 0),
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

function parseRosterTeams(raw: unknown): MemberRosterRow['takimlar'] {
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
	const byId = new Map<string, NonNullable<MemberRosterRow['takimlar']>[number]>();
	for (const item of parsed) {
		if (!item || typeof item !== 'object' || !(item as { id?: unknown }).id) continue;
		const team = item as NonNullable<MemberRosterRow['takimlar']>[number];
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
	return {
		id: String(r.id ?? ''),
		ad: String(r.ad ?? r.firstName ?? r.first_name ?? ''),
		soyad: String(r.soyad ?? r.lastName ?? r.last_name ?? ''),
		email: String(r.email ?? ''),
		passwordHash: String(r.passwordHash ?? r.password_hash ?? ''),
		ogrenciNo: String(r.ogrenciNo ?? r.ogrencino ?? r.handle ?? ''),
		bolum: String(r.bolum ?? r.department ?? ''),
		sinif: Number(r.sinif ?? r.grade ?? 1),
		roleId: (r.roleId ?? r.rolid ?? r.role_id ?? null) as string | null,
		rolAd: (r.rolAd ?? r.rolad ?? null) as string | null,
		rolRenk: (r.rolRenk ?? r.rolrenk ?? null) as string | null,
		profilFoto: (r.profilFoto ?? r.profilfoto ?? r.avatarUrl ?? r.avatar_url ?? undefined) as string | undefined,
		bio: (r.bio ?? undefined) as string | undefined,
		xp: Number(r.xp ?? 0),
		status: ((r.status as User['status']) || 'aktif'),
		olusturma: Number(r.olusturma ?? r.createdAt ?? r.created_at ?? 0),
		takimAdi: (r.takimAdi ?? r.takimadi ?? undefined) as string | undefined,
		takimlar: parseRosterTeams(r.takimlar),
		yoklamaSayisi: Number(r.yoklamaSayisi ?? r.yoklamasayisi ?? 0),
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
				conditions.push("(status = 'aktif' OR status = 'mezun')");
			}

			if (options?.search?.trim()) {
				params.push(`%${options.search.trim()}%`);
				conditions.push(
					`(ad ILIKE $${params.length} OR soyad ILIKE $${params.length} OR (ad || ' ' || soyad) ILIKE $${params.length} OR email ILIKE $${params.length} OR "ogrenciNo" ILIKE $${params.length} OR bolum ILIKE $${params.length})`
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
				conditions.push("(status = 'aktif' OR status = 'mezun')");
			}
			params.push(`%${options.search.trim()}%`);
			conditions.push(
				`(ad ILIKE $${params.length} OR soyad ILIKE $${params.length} OR (ad || ' ' || soyad) ILIKE $${params.length} OR email ILIKE $${params.length} OR "ogrenciNo" ILIKE $${params.length} OR bolum ILIKE $${params.length})`
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

export async function getUserByHandle(ogrenciNo: string): Promise<User | null> {
	if (!ogrenciNo || !isDatabaseConfigured()) return null;
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query('SELECT * FROM users WHERE handle = $1', [
			ogrenciNo.trim(),
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
		if (rawRow && (rawRow.session_token === token || rawRow.session_token === token)) {
			void getPgPool().query('UPDATE users SET session_token = $1 WHERE id = $2', [tokenHash, user.id]).catch(() => {});
		}

		const expiresAt = user.oturumBitis ? Number(user.oturumBitis) : null;
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
	const cleanIp = telemetry?.ip ? temizIp(telemetry.ip) : null;
	const cleanUa = telemetry?.userAgent
		? String(telemetry.userAgent).replace(/[\r\n\0]+/g, ' ').trim().slice(0, 240)
		: null;
	const storedToken = token ? hashSessionToken(token) : null;

	if (token && (cleanIp || cleanUa)) {
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
			[storedToken, now, expiresAt, cleanIp, cleanUa, authMethod, userId]
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
		ad: string;
		soyad: string;
		email: string;
		passwordHash: string;
		ogrenciNo: string;
		bolum: string;
		sinif: number;
		roleId?: string | null;
		status?: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun';
		bio?: string;
		preferredLanguage?: 'tr' | 'en';
	},
	denetim?: AuditContext
): Promise<User> {
	await ensurePostgresInit();
	const id = `usr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const newUser: User = {
		id,
		ad: data.ad.trim(),
		soyad: data.soyad.trim(),
		email: data.email.trim().toLowerCase(),
		passwordHash: data.passwordHash,
		ogrenciNo: data.ogrenciNo.trim(),
		bolum: data.bolum.trim(),
		sinif: Number(data.sinif) || 1,
		roleId: data.roleId ?? null,
		bio: data.bio || '',
		xp: 50,
		status: data.status || 'beklemede',
		preferredLanguage: data.preferredLanguage === 'en' ? 'en' : 'tr',
		olusturma: Date.now(),
	};

	await withTransaction(async (client) => {
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, bio, xp, status, created_at, role_id, preferred_language)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
			[
				newUser.id,
				newUser.ad,
				newUser.soyad,
				newUser.email,
				newUser.passwordHash,
				newUser.ogrenciNo,
				newUser.bolum,
				newUser.sinif,
				newUser.bio,
				newUser.xp,
				newUser.status,
				newUser.olusturma,
				newUser.roleId ?? null,
				newUser.preferredLanguage ?? 'tr',
			]
		);
		if (newUser.status === 'beklemede') await publishEvent(client, notificationEvents());
		if (denetim && newUser.roleId) {
			const role = await client.query('SELECT ad FROM roles WHERE id = $1', [newUser.roleId]);
			await logAuditEvent(client, denetim, {
				islem: 'uye.rol_ata',
				hedefTur: 'uye',
				hedefId: id,
				hedefAd: memberTargetName(newUser),
				onceki: { roleId: null, rolAd: null },
				sonraki: { roleId: newUser.roleId, rolAd: role.rows[0]?.ad ?? null, uyeEklendi: true },
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
			"SELECT * FROM users WHERE status = 'beklemede' ORDER BY created_at ASC"
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
	status: 'aktif' | 'beklemede' | 'reddedildi' | 'mezun',
	db: Pick<PoolClient, 'query'> = getPgPool()
): Promise<void> {
	await ensurePostgresInit();
	if (status === 'aktif') {
		await db.query(
			"UPDATE users SET status = $1, xp = COALESCE(xp, 0) + CASE WHEN status = 'beklemede' THEN 50 ELSE 0 END WHERE id = $2",
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

export async function deleteUser(id: string, denetim: AuditContext): Promise<boolean> {
	return withTransaction(async (client) => {
		const res = await client.query(
			`DELETE FROM users u WHERE u.id = $1
			 RETURNING u.first_name AS ad, u.last_name AS soyad, u.email AS email, u.status AS status, u.role_id AS "roleId", (SELECT r.ad FROM roles r WHERE r.id = u.role_id) AS "rolAd"`,
			[id]
		);
		const u = res.rows[0];
		if (!u) return false;
		await logAuditEvent(client, denetim, { islem: 'uye.sil', hedefTur: 'uye', hedefId: id, hedefAd: memberTargetName(u), onceki: memberSummary(u), sonraki: null });
		await publishEvent(client, { k: 'session', userId: id });
		return true;
	});
}
