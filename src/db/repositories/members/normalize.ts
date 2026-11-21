import { createHash } from 'crypto';
import type { User, MemberRosterRow } from '@/db/schema';
import { decryptSecret } from '@/lib/auth/secretBox';

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

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export async function normalizeUserRow(
	row: Record<string, unknown> | undefined | null,
	options?: { skipTotpDecryption?: boolean } | unknown
): Promise<User | null> {
	if (!row) return null;
	const skip = Boolean(
		options &&
			typeof options === 'object' &&
			'skipTotpDecryption' in options &&
			(options as { skipTotpDecryption?: boolean }).skipTotpDecryption
	);
	const rawTotpSecret =
		row.totpsecret ?? row.totpSecret ?? row.totp_secret
			? String(row.totpsecret ?? row.totpSecret ?? row.totp_secret)
			: null;
	const totpSecret = skip ? null : rawTotpSecret ? await decryptSecret(rawTotpSecret) : null;
	const firstName = String(row.firstName ?? row.first_name ?? row.name ?? '');
	const lastName = String(row.lastName ?? row.last_name ?? row.surname ?? '');
	const handle = String(row.handle ?? row.studentNo ?? '');
	const department = String(row.department ?? '');
	const grade = Number(row.grade ?? 1);
	const avatarUrl =
		row.avatarUrl ?? row.avatar_url ?? row.profilePhoto
			? String(row.avatarUrl ?? row.avatar_url ?? row.profilePhoto)
			: undefined;
	const createdAt = Number(row.createdAt ?? row.created_at ?? row.creation ?? 0);
	const lastLoginAt = row.lastLoginAt
		? Number(row.lastLoginAt)
		: row.last_login_at
			? Number(row.last_login_at)
			: row.lastLoginDate
				? Number(row.lastLoginDate)
				: undefined;
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
		status: (row.status as User['status']) || 'active',
		authMethod: (['password', 'totp', 'passkey'].includes(String(row.authMethod ?? ''))
			? String(row.authMethod)
			: 'password') as User['authMethod'],
		activeSessionToken:
			row.sessionToken ?? row.session_token ?? row.activeSessionToken
				? String(row.sessionToken ?? row.session_token ?? row.activeSessionToken)
				: undefined,
		lastLoginAt,
		lastLoginDate: lastLoginAt,
		lastLoginIp: (row.lastLoginIp ?? row.last_login_ip) ? String(row.lastLoginIp ?? row.last_login_ip) : null,
		lastLoginUserAgent:
			row.lastLoginUserAgent ?? row.last_login_user_agent
				? String(row.lastLoginUserAgent ?? row.last_login_user_agent)
				: null,
		lastActiveIp: (row.lastActiveIp ?? row.last_active_ip) ? String(row.lastActiveIp ?? row.last_active_ip) : null,
		lastActiveDate: row.lastActiveAt
			? Number(row.lastActiveAt)
			: row.last_active_at
				? Number(row.last_active_at)
				: row.lastActiveDate
					? Number(row.lastActiveDate)
					: null,
		sessionEnd: row.sessionExpiresAt
			? Number(row.sessionExpiresAt)
			: row.session_expires_at
				? Number(row.session_expires_at)
				: row.sessionEnd
					? Number(row.sessionEnd)
					: null,
		preferredLanguage: (row.preferredLanguage ?? row.preferred_language ?? row.preferredlanguage ?? 'en') === 'tr' ? 'tr' : 'en',
		totpSecret,
		totpEnabled: Number(row.totpEnabled ?? row.totp_enabled ?? row.totpenabled ?? 0),
		totpRecoveryCodes:
			row.totpRecoveryCodes ?? row.totp_recovery_codes ?? row.totprecoverycodes
				? String(row.totpRecoveryCodes ?? row.totp_recovery_codes ?? row.totprecoverycodes)
				: null,
		totpConfirmedAt: row.totpConfirmedAt
			? Number(row.totpConfirmedAt)
			: row.totp_confirmed_at
				? Number(row.totp_confirmed_at)
				: row.totpconfirmedat
					? Number(row.totpconfirmedat)
					: null,
		totpLastStep: row.totpLastStep
			? Number(row.totpLastStep)
			: row.totp_last_step
				? Number(row.totp_last_step)
				: null,
		createdAt,
	};
}
