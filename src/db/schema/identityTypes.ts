export interface MemberRosterRow extends User {
	/** Community-defined extra fields, with password values masked. */
	customFields?: Record<string, string>;
	roleName?: string | null;
	roleColor?: string | null;
	teamName?: string | null;
	teams?: Array<{ id: string; name: string; category?: string; isLeader?: boolean; role?: string }> | null;
	attendanceCount?: number;
	diskUsageBytes?: number;
	fileCount?: number;
}

export interface User {
	id: string;
	firstName: string;
	lastName: string;
	name?: string;
	surname?: string;
	email: string;
	passwordHash: string;
	handle: string;
	studentNo?: string;
	department: string;
	grade: number;
	/** Role from the `roles` table; null = no role yet (personal settings only). */
	roleId?: string | null;
	avatarUrl?: string;
	profilePhoto?: string;
	bio?: string;
	xp: number;
	status: 'active' | 'pending' | 'suspended' | 'alumni' | 'rejected';
	createdAt?: number;
	preferredLanguage?: 'tr' | 'en';
	archetype?: string;
	/** How the current session authenticated: password only, password+TOTP, or a passkey. */
	authMethod?: 'password' | 'totp' | 'passkey';
	sessionToken?: string;
	activeSessionToken?: string;
	activeSessionId?: string;
	lastLoginAt?: number;
	lastLoginDate?: number;
	lastLoginIp?: string | null;
	lastLoginUserAgent?: string | null;
	lastActiveIp?: string | null;
	lastActiveAt?: number | null;
	lastActiveDate?: number | null;
	sessionEnd?: number | null;
	/** Base32 TOTP secret. Only trusted once `totpEnabled` is 1 — before that it is a pending setup. */
	totpSecret?: string | null;
	/** 1 when the member has confirmed a code from their authenticator app. */
	totpEnabled?: number;
	/** JSON array of bcrypt hashes for one-time recovery codes. */
	totpRecoveryCodes?: string | null;
	totpConfirmedAt?: number | null;
	totpLastStep?: number | null;
	sessionExpiresAt?: number | null;
}

/** Ownership record for an uploaded file; bytes live under UPLOAD_DIR. */
export interface StoredFile {
	name: string;
	uploaderId: string | null;
	mime: string;
	size: number;
	/** 1 for files every signed-in member may read (profile photos). */
	everyoneOpen?: number;
	/** Set for chat attachments; read access follows the room. */
	chatRoomId?: string | null;
	createdAt: number;
}

export interface UserNote {
	id: string;
	userId: string;
	title: string;
	content: string;
	color?: string;
	isPinned?: boolean;
	folderId?: string;
	isTrashed?: boolean;
	updatedAt: number;
	createdAt: number;
}

export interface UserNoteFolder {
	id: string;
	userId: string;
	name: string;
	color?: string;
	order?: number;
	createdAt: number;
}

export interface SystemSetting {
	key: string;
	value: string;
	updatedAt: number;
}

export interface WebauthnCredential {
	/** base64url credential id — the primary key the authenticator reports. */
	id: string;
	userId: string;
	/** base64url COSE public key. */
	publicKey: string;
	/** Signature counter, used to detect cloned authenticators. */
	counter: number;
	/** Comma-separated transport hints reported at registration. */
	transports?: string | null;
	deviceType?: string | null;
	backedUp?: number;
	/** Member-supplied label, e.g. "iPhone" or "YubiKey". */
	nickname?: string | null;
	createdAt: number;
	lastUsage?: number | null;
}

export interface WebauthnChallenge {
	id: string;
	/** Null for a sign-in challenge, which happens before the member is identified. */
	userId?: string | null;
	challenge: string;
	type: 'registration' | 'login';
	createdAt: number;
}
