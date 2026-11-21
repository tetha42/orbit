import type { User } from '@/db/schema';
import type { Permissions } from '@/core/permissions';

/**
 * The user object the client receives.
 *
 * A deliberately narrower view than the database row: it never carries
 * `passwordHash`, `sessionToken`, `totpSecret` or the recovery-code hashes.
 * `toSessionUser` produces it, and the workspace store consumes it.
 */
export interface SessionUser {
	id: string;
	firstName: string;
	lastName: string;
	name: string;
	surname: string;
	email: string;
	handle: string;
	studentNo: string;
	department: string;
	grade: number;
	avatarUrl?: string | null;
	profilePhoto?: string | null;
	bio?: string | null;
	xp: number;
	status: User['status'];
	lastLoginAt?: number | null;
	lastLoginDate?: number | null;
	/** Two-factor auth is switched on for this account. */
	twoFactorEnabled: boolean;
	authMethod?: 'password' | 'totp' | 'passkey';
	/** The account's role requires two-factor auth. */
	twoFactorRequired: boolean;
	/** Required but not yet configured — drives the blocking setup prompt. */
	mustSetup2fa: boolean;
	/** The account's language for the interface and outgoing e-mail. */
	preferredLanguage: 'tr' | 'en';
	roleInfo: { id: string; name: string; color: string } | null;
	/** What the role grants per app — the UI shows only what this allows. */
	permissions: Permissions;
	/** Holds the built-in admin role. */
	admin: boolean;
}

/**
 * A membership application shown in the approval queue.
 *
 * Only the fields the reviewer needs. The endpoint previously returned whole
 * rows, which shipped every applicant's password hash and session token.
 */
export interface PendingApplicant {
	id: string;
	firstName: string;
	lastName: string;
	name: string;
	surname: string;
	email: string;
	handle: string;
	studentNo: string;
	department: string;
	grade: number;
	createdAt: number;
}
