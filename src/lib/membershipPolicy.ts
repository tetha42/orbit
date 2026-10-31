/**
 * Community membership policy. Pure: no imports, so the schema and the tests
 * can share the exact same normalisation.
 */

export const MEMBERSHIP_POLICY_SETTINGS_KEY = 'membership_policy';

export type SelfRegistrationMode = 'open' | 'closed';

export interface MembershipPolicy {
	/** May a visitor apply from the public registration form? */
	selfRegistration: SelfRegistrationMode;
	/** May a member manager create accounts from the Members app? */
	adminCreate: boolean;
	/** May a member manager issue invitation links? */
	inviteEnabled: boolean;
	/** Must the applicant verify the e-mail before the application is created? */
	emailVerification: boolean;
	/** Days before a rejected applicant may apply again. */
	reapplyCooldownDays: number;
	/** Days an invitation link stays valid. */
	inviteExpiryDays: number;
	/** Empty = every domain is accepted. */
	allowedEmailDomains: string[];
	/** How many open applications one e-mail may have. */
	maxOpenApplications: number;
}

export const DEFAULT_MEMBERSHIP_POLICY: MembershipPolicy = {
	selfRegistration: 'open',
	adminCreate: true,
	inviteEnabled: true,
	emailVerification: true,
	reapplyCooldownDays: 30,
	inviteExpiryDays: 7,
	allowedEmailDomains: [],
	maxOpenApplications: 1,
};

const MAX_DAYS = 365;
const MAX_DOMAINS = 20;

function cleanDomain(raw: unknown): string {
	const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
	return value.replace(/^@/, '').replace(/[^a-z0-9.-]/g, '').slice(0, 120);
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
	const value = Number(raw);
	if (!Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function normalizeMembershipPolicy(raw: unknown): MembershipPolicy {
	const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const domains = Array.isArray(input.allowedEmailDomains)
		? [...new Set(input.allowedEmailDomains.map(cleanDomain).filter(Boolean))].slice(0, MAX_DOMAINS)
		: [];
	return {
		selfRegistration: input.selfRegistration === 'closed' ? 'closed' : 'open',
		adminCreate: input.adminCreate === undefined ? true : input.adminCreate !== false,
		inviteEnabled: input.inviteEnabled === undefined ? true : input.inviteEnabled !== false,
		emailVerification: input.emailVerification === undefined ? true : input.emailVerification !== false,
		reapplyCooldownDays: clampInt(input.reapplyCooldownDays, 30, 0, MAX_DAYS),
		inviteExpiryDays: clampInt(input.inviteExpiryDays, 7, 1, 90),
		allowedEmailDomains: domains,
		maxOpenApplications: clampInt(input.maxOpenApplications, 1, 1, 5),
	};
}

/** Whether an e-mail address belongs to one of the allowed domains. */
export function emailDomainAllowed(email: string, allowedDomains: readonly string[]): boolean {
	if (allowedDomains.length === 0) return true;
	const domain = email.trim().toLowerCase().split('@')[1] ?? '';
	if (!domain) return false;
	return allowedDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}
