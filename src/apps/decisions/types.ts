import type React from 'react';

export interface Committee {
	id: string;
	name: string;
	slug: string;
	description: string;
	category: string;
	leadId?: string | null;
	leaderName?: string | null;
	activeMemberCount?: number;
	quorum?: number;
	createdAt: number;
}

export interface CommitteeMember {
	id: string;
	userId: string;
	userName?: string;
	userDepartment?: string;
	teamRole: string;
	votingRight?: number;
	termStart?: number | null;
	termEnd?: number | null;
}

export interface Meeting {
	id: string;
	title: string;
	date: number;
	agenda: string;
	minutes: string;
	status: string;
}

export interface Decision {
	id: string;
	referenceNumber: number;
	title: string;
	date: number;
	agenda: string;
	content: string;
	bodyId?: string | null;
	bodyName?: string | null;
	documentType?: string;
	decisionType?: string;
	quorumMet?: number;
	votesFor?: number;
	votesAgainst?: number;
	votesAbstain?: number;
	isPublic: number;
	/** Not part of the row itself: the server prints the digest next to the document. */
	summary?: string;
	isLocked?: number;
	creatorName?: string | null;
	createdAt?: number;
}

export interface CommitteeDetail {
	committee: Committee;
	members: CommitteeMember[];
	meetings: Meeting[];
	decisions: Decision[];
}

export interface MemberOption {
	id: string;
	name: string;
	surname: string;
	email: string;
	department?: string;
}

export const inputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 10px',
	borderRadius: '7px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0,0,0,0.22)',
	color: 'inherit',
	fontSize: '12px',
	boxSizing: 'border-box',
};

export const labelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11px',
	fontWeight: 600,
	opacity: 0.75,
	marginBottom: '4px',
};

export const cardStyle: React.CSSProperties = {
	padding: '12px',
	borderRadius: '9px',
	border: '1px solid var(--window-border)',
	background: 'rgba(255,255,255,0.025)',
};

export const gridStyle: React.CSSProperties = {
	display: 'grid',
	gridTemplateColumns: '1fr 1fr',
	gap: '8px',
};
