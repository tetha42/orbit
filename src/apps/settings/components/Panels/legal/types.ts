import type React from 'react';
import type { LegalDocumentScope, LegalDocumentType } from '@/lib/i18n/data/legalDefaults';

export interface LegalDocument {
	id: string;
	docType: LegalDocumentType;
	scope: LegalDocumentScope;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	required: boolean;
	enabled: boolean;
	sortOrder: number;
	version?: number;
	updatedAt?: number;
}

export interface LegalDocumentVersion {
	id: string;
	version: number;
	titleTr: string;
	titleEn: string;
	bodyTr: string;
	bodyEn: string;
	scope: string;
	required: boolean;
	archivedAt: number;
	archivedBy: string | null;
}

export const legalInputStyle: React.CSSProperties = {
	width: '100%',
	padding: '8px 11px',
	borderRadius: '8px',
	border: '1px solid var(--window-border)',
	background: 'rgba(0, 0, 0, 0.22)',
	color: 'inherit',
	fontSize: '12.5px',
	outline: 'none',
	boxSizing: 'border-box',
};

export const legalLabelStyle: React.CSSProperties = {
	display: 'block',
	fontSize: '11.5px',
	fontWeight: 600,
	opacity: 0.82,
	marginBottom: '5px',
};

export const legalCardStyle: React.CSSProperties = {
	padding: '14px',
	borderRadius: '10px',
	border: '1px solid var(--window-border)',
	background: 'var(--card-bg, rgba(255,255,255,0.03))',
};
