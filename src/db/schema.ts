import type { NewsVisibility } from '@/types/news';
import type { InventoryStatus } from '@/types/inventory';
import type { BudgetRecordCategory } from '@/types/budget';
import type { TaskStatus, TaskPriority } from '@/lib/kanban';
import type { ProjectStatus } from '@/lib/projects';

/**
 * Default `sistem_ayarlari` rows.
 *
 * Defined once so both the SQLite and Postgres backends hand callers the same
 * shape — previously only SQLite pre-populated these, so a fresh Postgres install
 * returned an empty object and every consumer had to carry its own fallbacks.
 */
export const SYSTEM_SETTINGS_DEFAULTS: Record<string, string> = {
	smtp_host: process.env.SMTP_HOST || '',
	smtp_port: process.env.SMTP_PORT || '465',
	smtp_secure: 'true',
	smtp_user: process.env.SMTP_USER || '',
	smtp_pass: process.env.SMTP_PASS || '',
	smtp_from: process.env.SMTP_FROM || '',
	organization_name: process.env.CLUB_NAME || process.env.COMMUNITY_NAME || 'Orbit Community',
	organization_domain: process.env.CLUB_DOMAIN || process.env.COMMUNITY_DOMAIN || 'orbit.local',
	parent_entity: process.env.CLUB_UNIVERSITY || process.env.COMMUNITY_PARENT || 'tetha42',
	signatory_1_name: process.env.CLUB_PRESIDENT_NAME || '',
	signatory_1_title: process.env.CLUB_PRESIDENT_TITLE || 'Community Leader',
	signatory_2_name: process.env.CLUB_ADVISOR_NAME || '',
	signatory_2_title: process.env.CLUB_ADVISOR_TITLE || 'Studio Coordinator',
	// Fallback mappings for legacy callers
	club_Name: process.env.CLUB_NAME || process.env.COMMUNITY_NAME || 'Orbit Community',
	club_domain: process.env.CLUB_DOMAIN || process.env.COMMUNITY_DOMAIN || 'orbit.local',
	university: process.env.CLUB_UNIVERSITY || process.env.COMMUNITY_PARENT || 'tetha42',
	signature1_Name: process.env.CLUB_PRESIDENT_NAME || '',
	signature1_Rank: process.env.CLUB_PRESIDENT_TITLE || 'Community Leader',
	signature2_Name: process.env.CLUB_ADVISOR_NAME || '',
	signature2_Rank: process.env.CLUB_ADVISOR_TITLE || 'Studio Coordinator',
};

/**
 * Member roster for the directory app: every member plus their first team name
 * and attendance count. No bind parameters, so SQLite and PostgreSQL run the
 * exact same statement.
 */
export const MEMBER_ROSTER_SQL = `
	SELECT
		k.id,
		k.first_name AS "firstName",
		k.first_name AS "name",
		k.last_name AS "lastName",
		k.last_name AS "surname",
		k.email AS "email",
		k.handle AS "handle",
		k.handle AS "studentNo",
		k.department AS "department",
		k.department AS "department",
		k.grade AS "grade",
		k.grade AS "grade",
		k.role_id AS "roleId",
		k.role_id AS "roleId",
		r.name AS "roleName",
		r.name AS "roleName",
		r.color AS "roleColor",
		r.color AS "roleColor",
		k.avatar_url AS "avatarUrl",
		k.avatar_url AS "profilePhoto",
		k.bio,
		k.xp,
		k.status AS "status",
		k.status AS "status",
		k.custom_fields AS "customFields",
		k.created_at AS "createdAt",
		k.created_at AS "creation",
		(
			SELECT STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name)
			FROM teams t
			LEFT JOIN team_members tu ON tu.team_id = t.id AND (tu.status = 'aktif' OR tu.status = 'active' OR tu.status IS NULL)
			WHERE tu.user_id = k.id OR t.lead_id = k.id
		) AS "teamName",
		(
			SELECT STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name)
			FROM teams t
			LEFT JOIN team_members tu ON tu.team_id = t.id AND (tu.status = 'aktif' OR tu.status = 'active' OR tu.status IS NULL)
			WHERE tu.user_id = k.id OR t.lead_id = k.id
		) AS "teamName",
		(
			-- One row per team. A leader can also have a team_members row; without
			-- DISTINCT ON that produced two JSON objects with the same id.
			SELECT COALESCE(
				JSON_AGG(
					JSONB_BUILD_OBJECT(
						'id', x.id,
						'name', x.name,
						'name', x.name,
						'category', x.category,
						'category', x.category,
						'leaderMi', (x.lead_id = k.id),
						'isLeader', (x.lead_id = k.id),
						'role', x.role
					)
				),
				'[]'::json
			)
			FROM (
				SELECT DISTINCT ON (t.id)
					t.id, t.name, t.category, t.lead_id,
					CASE WHEN t.lead_id = k.id THEN NULL ELSE tu.role_title END AS role
				FROM teams t
				LEFT JOIN team_members tu ON tu.team_id = t.id
					AND tu.user_id = k.id
					AND (tu.status = 'aktif' OR tu.status = 'active' OR tu.status IS NULL)
				WHERE tu.user_id = k.id OR t.lead_id = k.id
				ORDER BY t.id, (t.lead_id = k.id) DESC, tu.joined_at ASC NULLS LAST
			) x
		) AS "teams",
		(
			SELECT COALESCE(
				JSON_AGG(
					JSONB_BUILD_OBJECT(
						'id', x.id,
						'name', x.name,
						'category', x.category,
						'isLeader', (x.lead_id = k.id),
						'role', x.role
					)
				),
				'[]'::json
			)
			FROM (
				SELECT DISTINCT ON (t.id)
					t.id, t.name, t.category, t.lead_id,
					CASE WHEN t.lead_id = k.id THEN NULL ELSE tu.role_title END AS role
				FROM teams t
				LEFT JOIN team_members tu ON tu.team_id = t.id
					AND tu.user_id = k.id
					AND (tu.status = 'aktif' OR tu.status = 'active' OR tu.status IS NULL)
				WHERE tu.user_id = k.id OR t.lead_id = k.id
				ORDER BY t.id, (t.lead_id = k.id) DESC, tu.joined_at ASC NULLS LAST
			) x
		) AS "teams",
		(
			SELECT COUNT(*)::int
			FROM event_participants ep
			WHERE ep.user_id = k.id AND (ep.status = 'attended' OR ep.status = 'katildi')
		) AS "attendanceCount",
		(
			SELECT COUNT(*)::int
			FROM event_participants ep
			WHERE ep.user_id = k.id AND (ep.status = 'attended' OR ep.status = 'katildi')
		) AS "attendanceCount"
	FROM users k
	LEFT JOIN roles r ON r.id = k.role_id
	ORDER BY
		r.is_system DESC NULLS LAST,
		r.created_at ASC NULLS LAST,
		k.created_at ASC
`;

/** A roster row: a member plus the derived directory columns. */
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
	status: 'active' | 'pending' | 'suspended' | 'alumni' | 'rejected' | 'aktif' | 'beklemede' | 'reddedildi' | 'mezun';
	createdAt?: number;
	creation?: number;
	preferredLanguage?: 'tr' | 'en';
	archetype?: string;
	/** How the current session authenticated: password only, password+TOTP, or a passkey. */
	authMethod?: 'password' | 'totp' | 'passkey';
	sessionToken?: string;
	activeSessionToken?: string;
	lastLoginAt?: number;
	lastLoginDate?: number;
	lastLoginIp?: string | null;
	lastLoginUserAgent?: string | null;
	lastActiveIp?: string | null;
	lastActiveAt?: number | null;
	lastActiveDate?: number | null;
	/** Base32 TOTP secret. Only trusted once `totpEnabled` is 1 — before that it is a pending setup. */
	totpSecret?: string | null;
	/** 1 when the member has confirmed a code from their authenticator app. */
	totpEnabled?: number;
	/** JSON array of bcrypt hashes for one-time recovery codes. */
	totpRecoveryCodes?: string | null;
	totpConfirmedAt?: number | null;
	totpLastStep?: number | null;
	sessionExpiresAt?: number | null;
	sessionEnd?: number | null;
}

export interface Team {
	id: string;
	name: string;
	slug: string;
	description: string;
	/** One of TAKIM_KATEGORILERI; older rows may hold a free-form value. */
	category: string;
	leadId: string;
	leaderNameSurname?: string;
	capacity: number;
	activeMemberCount?: number;
	repoUrl?: string;
	status: 'aktif' | 'tamamlandi' | 'askida';
	/** `acik`: join at once; `onayli`: apply, and the captain decides. */
	participationType?: 'acik' | 'onayli';
	/** `working_group` (default) or the decision body `committee`. */
	type?: 'working_group' | 'committee';
	/** Quorum for a committee, 0 when unspecified. */
	quorum?: number;
	creation: number;
}

export interface TeamMember {
	id: string;
	teamId: string;
	userId: string;
	userNameSurname?: string;
	userDepartment?: string;
	teamRole: string;
	status: 'aktif' | 'basvurdu';
	/** What the applicant wrote with an application. */
	applicationNote?: string | null;
	participationDate: number;
	/** Committee members only. */
	votingRight?: number;
	termStart?: number | null;
	termEnd?: number | null;
}

// Kanban vocabulary lives in a pure module the board shares with the API.
export type { TaskStatus, TaskPriority } from '@/lib/kanban';

export interface TeamTask {
	id: string;
	teamId: string;
	title: string;
	description?: string;
	status: TaskStatus;
	priority: TaskPriority;
	assigneeMemberId?: string;
	assigneeNameSurname?: string;
	dueDate?: number;
	/** Position within its column; smaller sorts higher. */
	order?: number;
	/** Free-form labels ("frontend", "donanım"); stored as a JSON array. */
	tags?: string[];
	creatorId?: string | null;
	creatorNameSurname?: string | null;
	update?: number;
	/** When it last reached `tamamlandi`; null while it is open. */
	completion?: number | null;
	/** Checklist progress and discussion size, for the card face. */
	itemCount?: number;
	doneItemCount?: number;
	commentCount?: number;
	creation: number;
}

/** One checklist line of a task. */
export interface TeamTaskItem {
	id: string;
	taskId: string;
	text: string;
	doneMi: number;
	order: number;
	creation: number;
}

/** A comment in a task's discussion. */
export interface TeamTaskComment {
	id: string;
	taskId: string;
	userId: string | null;
	userNameSurname?: string | null;
	content: string;
	creation: number;
}

/**
 * What happened to a task, as facts: the client writes the sentence. `detay` is
 * a small JSON object whose shape depends on `tur` (e.g. `{ "from": "suruyor", "to": "inceleme" }`).
 */
export type TaskActivityType =
	| 'olusturuldu'
	| 'tasindi'
	| 'duzenlendi'
	| 'atandi'
	| 'madde_eklendi'
	| 'madde_tamamlandi'
	| 'yorum';

export interface TeamTaskActivity {
	id: string;
	taskId: string;
	actorId: string | null;
	actorNameSurname?: string | null;
	typeValue: TaskActivityType;
	detail: Record<string, string | number | null> | null;
	creation: number;
}

/** Everything the task detail sheet shows. */
export interface TeamTaskDetail {
	task: TeamTask;
	items: TeamTaskItem[];
	comments: TeamTaskComment[];
	activity: TeamTaskActivity[];
}

/** An open task assigned to a member, with the project it belongs to. */
export interface UpcomingTask {
	id: string;
	teamId: string;
	teamName: string;
	title: string;
	priority: TeamTask['priority'];
	dueDate: number;
}

/** An inventory item on loan to a member, with the date it is due back. */
export interface UpcomingReturn {
	id: string;
	code: string;
	name: string;
	returnDate: number;
}

export interface CommunityEvent {
	id: string;
	slug: string;
	title: string;
	typeValue: 'atolye' | 'seminer' | 'yarisma' | 'toplanti';
	description: string;
	location: string;
	start: number;
	endTime: number;
	capacity: number;
	registeredCount?: number;
	status: 'taslak' | 'yayinda' | 'tamamlandi' | 'iptal';
	creatorId: string;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
	createdBy?: string | null;
	ownerTeamName?: string | null;
	ownerUserNameSurname?: string | null;
	creation: number;
}

export interface Attendance {
	id: string;
	eventId: string;
	userId: string;
	method: 'qr' | 'manuel';
	participationTime: number;
}

export interface BudgetRecord {
	id: string;
	date: number;
	typeValue: 'gelir' | 'gider';
	category: BudgetRecordCategory;
	amountMinor: number; // Kuruş cinsinden (150000 = 1.500,00 TL)
	description: string;
	receiptPhotoUrl?: string;
	recorderId: string;
	recorderNameSurname?: string;
	/** The project (takım) whose kasa this row belongs to; null/absent = the general kasa. */
	teamId?: string | null;
	creation: number;
	/** Shared by the two rows of an allocation between kasas; they are deleted together. */
	transferId?: string | null;
	/** The other kasa of an allocation (`null` = general kasa), filled in on read. */
	counterpartVaultName?: string | null;
	/** Last correction of the description, category, date or receipt. */
	updaterId?: string | null;
	updaterNameSurname?: string | null;
	update?: number | null;
}

/** Ownership record for an uploaded receipt; the bytes live under UPLOAD_DIR. */
export interface StoredFile {
	name: string;
	uploaderId: string | null;
	mime: string;
	size: number;
	/** 1 for files every signed-in member may read (profile photos). */
	everyoneOpen?: number;
	/** Set for chat attachments; read access follows the room. */
	chatRoomId?: string | null;
	creation: number;
}

export interface Decision {
	id: string;
	decisionNo: number; // Örn: 2026001
	documentType?: string; // 'karar' | 'salon_tahsisi' | 'etkinlik_izni' | 'malzeme_talep' | 'ust_yazi'
	title: string;
	date: number;
	agenda: string;
	content: string; // Markdown destekli karar metni
	publicOpenMi: number; // 1: Üyeler görebilir, 0: Sadece YK
	lockedMi: number;
	creatorId: string;
	creatorNameSurname?: string;
	creation: number;
	/** Committee that issued the decision, if any. */
	bodyId?: string | null;
	bodyName?: string | null;
	decisionType?: string;
	quorumMet?: number;
	votesFor?: number;
	votesAgainst?: number;
	votesAbstain?: number;
	publishedAt?: number | null;
}

export interface NewsItem {
	id: string;
	/** Stable, human-readable address of the article in the public API: `/news?s=<slug>`. */
	slug: string;
	title: string;
	summary: string;
	content: string;
	category: string;
	importantMi: number;
	imageUrl?: string;
	/** Who can read it: `taslak` (management), `uyeler` (signed-in members), `yayinda` (everyone). */
	publishStatus: NewsVisibility;
	/** When it first became visible beyond management; null while it is still a draft. */
	publishDate: number | null;
	authorId?: string;
	authorNameSurname?: string;
	creation: number;
	update: number;
}

export interface Certificate {
	id: string;
	verificationCode: string; // Örn: "BEU-2026-NXT-9042"
	userId: string;
	userNameSurname?: string;
	eventId?: string;
	title: string;
	category?: string | null;
	language?: string | null;
	description?: string | null;
	issuanceDate: number;
	pdfUrl?: string;
	creation: number;
}

export interface InventoryItem {
	id: string;
	code: string; // Örn: "LAB-RPI-004"
	name: string;
	category: 'Gömülü Sistem' | 'Sensör' | 'Geliştirme Kartı' | 'Test Ekipmanı' | string;
	/** Canonical status vocabulary — see src/types/inventory.ts. */
	status: InventoryStatus;
	location: string;
	loanFieldId?: string;
	loanFieldNameSurname?: string;
	returnDate?: number;
	/** When the current loan started; extensions are limited from here. */
	loanDate?: number | null;
	description?: string | null;
	seriesNo?: string | null;
}

export interface UserNote {
	id: string;
	userId: string;
	title: string;
	content: string;
	color?: string;
	pinnedMi?: boolean;
	folderId?: string;
	trashedMi?: boolean;
	update: number;
	creation: number;
}

export interface UserNoteFolder {
	id: string;
	userId: string;
	name: string;
	color?: string;
	order?: number;
	creation: number;
}

export interface SystemSetting {
	key: string;
	value: string;
	update: number;
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
	creation: number;
	lastUsage?: number | null;
}

export interface WebauthnChallenge {
	id: string;
	/** Null for a sign-in challenge, which happens before the member is identified. */
	userId?: string | null;
	challenge: string;
	typeValue: 'registration' | 'login';
	creation: number;
}



/** A project in the showcase (Projeler app). */
export interface Project {
	id: string;
	slug: string;
	title: string;
	/** One or two sentences for the card. */
	summary: string;
	/** The long write-up shown in the detail view. */
	description: string;
	repoUrl: string | null;
	liveUrl: string | null;
	technologies: string[];
	/** The R&D team behind it, if any. */
	teamId: string | null;
	teamName?: string | null;
	creatorId: string | null;
	creatorNameSurname?: string | null;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
	createdBy?: string | null;
	ownerTeamName?: string | null;
	ownerUserNameSurname?: string | null;
	status: ProjectStatus;
	/** Pinned to the top of the showcase by management. */
	oneLeaving: number;
	likeCount?: number;
	/** Whether the member asking has starred it. */
	iLikedMi?: boolean;
	creation: number;
	update: number;
}

export type {
	OrganizationArchetype,
	ArchetypePreset,
	ArchetypeUnitCategory,
} from '@/lib/archetypes';
export {
	ARCHETYPE_PRESETS,
	DEFAULT_ARCHETYPE,
	ORGANIZATION_ARCHETYPES,
	getArchetypePreset,
	isOrganizationArchetype,
} from '@/lib/archetypes';

/** Consolidated v3 organization setting with optional JSONB translations & metadata. */
export interface OrganizationSetting {
	key: string;
	value: string;
	category: string;
	translations: Record<string, Record<string, string>>;
	metadata: Record<string, unknown>;
	updatedAt: number;
}

/** Unified v3 verification token (replaces separate email_verifications, email_change_requests, webauthn_challenges). */
export interface VerificationToken {
	id: string;
	userId?: string | null;
	tokenType: 'email_verification' | 'email_change' | 'webauthn_challenge' | 'password_reset';
	target?: string | null;
	tokenHash: string;
	payload: Record<string, unknown>;
	attempts: number;
	expiresAt: number;
	usedAt?: number | null;
	createdAt: number;
}

/** Unified v3 event participant record (consolidates event_registrations and attendances). */
export interface EventParticipant {
	id: string;
	eventId: string;
	userId: string;
	status: 'registered' | 'waitlisted' | 'attended' | 'cancelled';
	checkinMethod?: 'qr' | 'manual' | 'none' | null;
	registeredAt: number;
	attendedAt?: number | null;
	recordedBy?: string | null;
}

/** Unified v3 governance record (consolidates decisions and committee_meetings). */
export interface GovernanceRecord {
	id: string;
	recordType: 'resolution' | 'minutes' | 'proposal' | 'meeting';
	referenceNumber?: number | null;
	documentKind: string;
	unitId?: string | null;
	title: string;
	date: number;
	agenda: string;
	content: string;
	status: string;
	isPublic: boolean;
	isLocked: boolean;
	quorumMet: boolean;
	votesFor: number;
	votesAgainst: number;
	votesAbstain: number;
	createdBy?: string | null;
	publishedAt?: number | null;
	createdAt: number;
	updatedAt: number;
}

/** Modern v3 multi-currency / DAO treasury entry (consolidates and upgrades budget_records). */
export interface TreasuryEntry {
	id: string;
	date: number;
	entryType: 'income' | 'expense' | 'transfer';
	category: BudgetRecordCategory | string;
	amountMinor: number;
	currency: string;
	description: string;
	receiptUrl?: string | null;
	unitId?: string | null;
	transferGroupId?: string | null;
	recordedBy?: string | null;
	updatedBy?: string | null;
	metadata: Record<string, unknown>;
	createdAt: number;
	updatedAt?: number | null;
}

/** Universal v3 organizational unit (consolidates teams, committees, labs, pods, commissions). */
export interface OrganizationUnit {
	id: string;
	name: string;
	slug: string;
	description: string;
	category: string;
	unitType: 'working_group' | 'committee' | 'pod' | 'lab_group' | 'commission';
	leadId?: string | null;
	capacity: number;
	quorum: number;
	joinPolicy: 'open' | 'approval' | 'invite_only';
	repoUrl?: string | null;
	status: 'active' | 'completed' | 'archived';
	metadata: Record<string, unknown>;
	createdAt: number;
}

/** Universal v3 organizational unit membership (consolidates team_members and team_application_decisions). */
export interface OrganizationUnitMember {
	id: string;
	unitId: string;
	userId: string;
	roleTitle: string;
	status: 'active' | 'pending' | 'rejected' | 'alumni';
	applicationNote?: string | null;
	decisionReason?: string | null;
	decidedBy?: string | null;
	decidedAt?: number | null;
	votingRight: boolean;
	termStart?: number | null;
	termEnd?: number | null;
	joinedAt: number;
}

