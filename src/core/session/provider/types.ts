import type { SessionUser } from '@/types/session';

/** Fields the registration form submits. */
export interface RegisterPayload {
	name: string;
	surname: string;
	studentNo: string;
	department: string;
	grade: number;
	email: string;
	password: string;
	verificationCode?: string;
	hp_website?: string;
	/** Community-defined registration fields, keyed by their fieldKey. */
	customFields?: Record<string, string>;
	/** Accepted legal document ids from `/api/legal`. */
	acceptedDocumentIds?: string[];
	/** Optional invitation token from `/?invite=...`. */
	inviteToken?: string;
	/** Preferred language ('tr' or 'en') chosen by the user in the UI. */
	preferredLanguage?: 'tr' | 'en';
}

export interface SessionContextValue {
	/** The role opens this app (and a required second factor is in place). */
	canUseApp: (appId: string) => boolean;
	/** The role manages this app. */
	canManageApp: (appId: string) => boolean;
	/** Holds the built-in admin role. */
	isAdmin: boolean;
	currentUserId: string;
	currentUser: SessionUser | null;
	isAuthenticated: boolean;
	isAuthLoading: boolean;
	sessionConflict: boolean;
	sessionIpMismatch: boolean;
	connectionState: 'live' | 'reconnecting' | 'offline';
	login: (
		email: string,
		password: string
	) => Promise<{
		success: boolean;
		error?: string;
		status?: string;
		require2fa?: boolean;
		challengeToken?: string;
	}>;
	verify2fa: (challengeToken: string, code: string) => Promise<{ success: boolean; error?: string; code?: string }>;
	loginWithPasskey: (
		email: string
	) => Promise<{ success: boolean; error?: string }>;
	register: (formData: RegisterPayload) => Promise<{
		success: boolean;
		message?: string;
		error?: string;
		requireVerification?: boolean;
		mailQueued?: boolean;
		fieldErrors?: Record<string, string>;
	}>;
	logout: () => Promise<void>;
	isLocked: boolean;
	lockWorkspace: () => void;
	unlockWorkspace: (password: string) => Promise<{ success: boolean; error?: string }>;
	refreshSession: () => Promise<void>;
	/** DEFCON 1 hard lockdown active. */
	isLockdownActive: boolean;
	lockdownMessage: string;
	dismissLockdown: () => void;
}
