import type { User } from '@/db/schema';
import type { Permissions } from '@/core/permissions';

/**
 * The user object the client receives.
 *
 * A deliberately narrower view than the database row: it never carries
 * `passwordHash`, `aktifOturumToken`, `totpSecret` or the recovery-code hashes.
 * `toSessionUser` produces it, and the workspace store consumes it.
 */
export interface SessionUser {
	id: string;
	firstName: string;
	lastName: string;
	ad: string;
	soyad: string;
	email: string;
	handle: string;
	ogrenciNo: string;
	department: string;
	bolum: string;
	grade: number;
	sinif: number;
	avatarUrl?: string | null;
	profilFoto?: string | null;
	bio?: string | null;
	xp: number;
	status: User['status'];
	lastLoginAt?: number | null;
	sonGirisTarihi?: number | null;
	/** Two-factor auth is switched on for this account. */
	twoFactorEnabled: boolean;
	authMethod?: 'password' | 'totp' | 'passkey';
	/** The account's role requires two-factor auth. */
	twoFactorRequired: boolean;
	/** Required but not yet configured — drives the blocking setup prompt. */
	mustSetup2fa: boolean;
	/** The member's role (name and colour for badges); null until one is assigned. */
	rolBilgi: { id: string; ad: string; renk: string } | null;
	/** What the role grants per app — the UI shows only what this allows. */
	izinler: Permissions;
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
	ad: string;
	soyad: string;
	email: string;
	handle: string;
	ogrenciNo: string;
	department: string;
	bolum: string;
	grade: number;
	sinif: number;
	createdAt: number;
	olusturma: number;
}
