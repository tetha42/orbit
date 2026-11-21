import { ensurePostgresInit, getPgPool } from '@/db';
import {
	DEFAULT_MEMBERSHIP_POLICY,
	MEMBERSHIP_POLICY_SETTINGS_KEY,
	normalizeMembershipPolicy,
	type MembershipPolicy,
} from '@/lib/membershipPolicy';

export async function getMembershipPolicy(): Promise<MembershipPolicy> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT value FROM system_settings WHERE key = $1',
		[MEMBERSHIP_POLICY_SETTINGS_KEY]
	);
	const raw = res.rows[0]?.value;
	if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_MEMBERSHIP_POLICY;
	try {
		return normalizeMembershipPolicy(JSON.parse(raw));
	} catch {
		return DEFAULT_MEMBERSHIP_POLICY;
	}
}

export async function setMembershipPolicy(input: unknown): Promise<MembershipPolicy> {
	await ensurePostgresInit();
	const policy = normalizeMembershipPolicy(input);
	await getPgPool().query(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
		[MEMBERSHIP_POLICY_SETTINGS_KEY, JSON.stringify(policy), Date.now()]
	);
	return policy;
}
