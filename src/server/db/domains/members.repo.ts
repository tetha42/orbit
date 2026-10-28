import { randomUUID, createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, isDatabaseConfigured, withTransaction } from '@/db/index';
import type { User, MemberRosterRow } from '@/db/schema';
import { MEMBER_ROSTER_SQL } from '@/db/schema';
import { logAuditEvent, type AuditContext } from '@/db/audit';
import { notificationEvents, publishEvent, publishEventQuiet } from '@/db/olaylar';
import { temizIp, uyeHedefAdi, uyeOzeti } from '@/lib/audit';
import { decryptSecret } from '@/lib/auth/secretBox';

export async function normalizeUserRow(row: Record<string, unknown> | undefined | null): Promise<User | null> {
	if (!row) return null;
	const rawTotpSecret = (row.totpsecret ?? row.totpSecret ?? row.totp_secret) ? String(row.totpsecret ?? row.totpSecret ?? row.totp_secret) : null;
	const totpSecret = rawTotpSecret ? await decryptSecret(rawTotpSecret) : null;
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
		aktifOturumToken: (row.aktivoturumtoken ?? row.aktifOturumToken ?? row.sessionToken ?? row.session_token) ? String(row.aktivoturumtoken ?? row.aktifOturumToken ?? row.sessionToken ?? row.session_token) : undefined,
		sonGirisTarihi: row.songiristarihi ? Number(row.songiristarihi) : (row.sonGirisTarihi ? Number(row.sonGirisTarihi) : (row.lastLoginAt ? Number(row.lastLoginAt) : (row.last_login_at ? Number(row.last_login_at) : undefined))),
		sonGirisIp: (row.songirisip ?? row.sonGirisIp ?? row.lastLoginIp ?? row.last_login_ip) ? String(row.songirisip ?? row.sonGirisIp ?? row.lastLoginIp ?? row.last_login_ip) : null,
		sonGirisUserAgent: (row.songirisuseragent ?? row.sonGirisUserAgent ?? row.lastLoginUserAgent ?? row.last_login_user_agent) ? String(row.songirisuseragent ?? row.sonGirisUserAgent ?? row.lastLoginUserAgent ?? row.last_login_user_agent) : null,
		sonAktifIp: (row.sonaktifip ?? row.sonAktifIp ?? row.lastActiveIp ?? row.last_active_ip) ? String(row.sonaktifip ?? row.sonAktifIp ?? row.lastActiveIp ?? row.last_active_ip) : null,
		sonAktifTarihi: row.sonaktiftarihi ? Number(row.sonaktiftarihi) : (row.sonAktifTarihi ? Number(row.sonAktifTarihi) : (row.lastActiveAt ? Number(row.lastActiveAt) : (row.last_active_at ? Number(row.last_active_at) : null))),
		oturumBitis: row.oturumbitis ? Number(row.oturumbitis) : (row.oturumBitis ? Number(row.oturumBitis) : (row.sessionExpiresAt ? Number(row.sessionExpiresAt) : (row.session_expires_at ? Number(row.session_expires_at) : null))),
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
	if (Array.isArray(raw)) {
		return raw.filter((item): item is NonNullable<MemberRosterRow['takimlar']>[number] => Boolean(item && typeof item === 'object' && (item as { id?: unknown }).id));
	}
	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				return parsed.filter((item): item is NonNullable<MemberRosterRow['takimlar']>[number] => Boolean(item && typeof item === 'object' && (item as { id?: unknown }).id));
			}
		} catch {
			return [];
		}
	}
	return [];
}

export async function getMemberRoster(): Promise<MemberRosterRow[]> {
	if (!isDatabaseConfigured()) return [];
	try {
		await ensurePostgresInit();
		const res = await getPgPool().query(MEMBER_ROSTER_SQL);
		if (!res.rows?.length) return [];
		return res.rows.map((r: Record<string, unknown>) => ({
			...(r as unknown as MemberRosterRow),
			id: String(r.id ?? ''),
			ad: String(r.ad ?? r.firstName ?? r.first_name ?? ''),
			soyad: String(r.soyad ?? r.lastName ?? r.last_name ?? ''),
			email: String(r.email ?? ''),
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
		}));
	} catch (err) {
		console.warn('[members.repo] getMemberRoster read warning:', err);
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
	telemetry?: { ip?: string | null; userAgent?: string | null }
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
			     last_active_at = $2
			 WHERE id = $6`,
			[storedToken, now, expiresAt, cleanIp, cleanUa, userId]
		);
	} else {
		await getPgPool().query(
			'UPDATE users SET session_token = $1, last_login_at = $2, session_expires_at = $3 WHERE id = $4',
			[storedToken, token ? now : null, token ? expiresAt : null, userId]
		);
	}
	await publishEventQuiet(getPgPool(), { k: 'oturum', userId });
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
		olusturma: Date.now(),
	};

	await withTransaction(async (client) => {
		await client.query(
			`INSERT INTO users (id, first_name, last_name, email, password_hash, handle, department, grade, bio, xp, status, created_at, role_id)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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
			]
		);
		if (newUser.status === 'beklemede') await publishEvent(client, notificationEvents());
		if (denetim && newUser.roleId) {
			const role = await client.query('SELECT ad FROM roles WHERE id = $1', [newUser.roleId]);
			await logAuditEvent(client, denetim, {
				islem: 'uye.rol_ata',
				hedefTur: 'uye',
				hedefId: id,
				hedefAd: uyeHedefAdi(newUser),
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
	await publishEvent(db, [{ k: 'oturum', userId }, { k: 'bildirim', userId }]);
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
		await logAuditEvent(client, denetim, { islem: 'uye.sil', hedefTur: 'uye', hedefId: id, hedefAd: uyeHedefAdi(u), onceki: uyeOzeti(u), sonraki: null });
		await publishEvent(client, { k: 'oturum', userId: id });
		return true;
	});
}
