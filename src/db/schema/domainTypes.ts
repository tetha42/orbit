import type { NewsVisibility } from '@/types/news';
import type { InventoryStatus } from '@/types/inventory';
import type { BudgetRecordCategory } from '@/types/budget';
import type { ProjectStatus } from '@/lib/projects';

export interface CommunityEvent {
	id: string;
	slug: string;
	title: string;
	type: 'workshop' | 'seminar' | 'competition' | 'meeting';
	description: string;
	location: string;
	start: number;
	endTime: number;
	capacity: number;
	registeredCount?: number;
	status: 'draft' | 'published' | 'done' | 'cancelled';
	creatorId: string;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
	createdBy?: string | null;
	ownerTeamName?: string | null;
	ownerUserName?: string | null;
	checkinOpen?: number;
	createdAt: number;
}

export interface Attendance {
	id: string;
	eventId: string;
	userId: string;
	method: 'qr' | 'manual';
	participationTime: number;
}

export interface BudgetRecord {
	id: string;
	date: number;
	type: 'income' | 'expense';
	category: BudgetRecordCategory;
	amountMinor: number; // Minor currency units (150000 = 1,500.00)
	description: string;
	receiptUrl?: string | null;
	recorderId: string;
	recorderName?: string | null;
	/** The project (team) whose vault this row belongs to; null/absent = the general vault. */
	teamId?: string | null;
	createdAt: number;
	/** Shared by the two rows of an allocation between vaults; they are deleted together. */
	transferId?: string | null;
	/** The other vault of an allocation (`null` = general vault), filled in on read. */
	counterpartVaultName?: string | null;
	/** Last correction of the description, category, date or receipt. */
	updaterId?: string | null;
	updaterName?: string | null;
	updatedAt?: number | null;
}

export interface Decision {
	id: string;
	referenceNumber: number;
	documentType?: string;
	title: string;
	date: number;
	agenda: string;
	content: string; // Markdown-supported resolution text
	isPublic: number;
	isLocked: number;
	creatorId: string;
	creatorName?: string;
	createdAt: number;
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
	isImportant: number;
	imageUrl?: string;
	/** Who can read it: `draft` (management), `members` (signed-in members), `published` (everyone). */
	publishStatus: NewsVisibility;
	/** When it first became visible beyond management; null while it is still a draft. */
	publishDate: number | null;
	authorId?: string;
	authorName?: string;
	createdAt: number;
	updatedAt: number;
}

export interface Certificate {
	id: string;
	verificationCode: string; // e.g. "ORB-2026-NXT-9042"
	userId: string;
	userName?: string;
	eventId?: string;
	title: string;
	category?: string | null;
	language?: string | null;
	description?: string | null;
	issuanceDate: number;
	pdfUrl?: string;
	createdAt: number;
}

export interface InventoryItem {
	id: string;
	code: string; // e.g. "LAB-RPI-004"
	name: string;
	category: string;
	/** Canonical status vocabulary — see src/types/inventory.ts. */
	status: InventoryStatus;
	location: string;
	holderUserId?: string;
	holderName?: string;
	dueDate?: number;
	/** When the current loan started; extensions are limited from here. */
	loanDate?: number | null;
	description?: string | null;
	serialNo?: string | null;
}

/** A project in the showcase (Projects app). */
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
	creatorName?: string | null;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
	createdBy?: string | null;
	ownerTeamName?: string | null;
	ownerUserName?: string | null;
	status: ProjectStatus;
	/** Pinned to the top of the showcase by management. */
	isFeatured: number;
	likeCount?: number;
	/** Whether the member asking has starred it. */
	likedByMe?: boolean;
	createdAt: number;
	updatedAt: number;
}
