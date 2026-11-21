import type { BudgetRecordCategory } from '@/types/budget';

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
