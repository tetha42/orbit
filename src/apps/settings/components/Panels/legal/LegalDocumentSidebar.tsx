'use client';

import React from 'react';
import { FileText, Lock } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { LegalDocument } from './types';

interface LegalDocumentSidebarProps {
	documents: LegalDocument[];
	activeId: string | null;
	getTitle: (doc: { titleTr: string; titleEn: string }) => string;
	onSelect: (doc: LegalDocument) => void;
}

export function LegalDocumentSidebar({
	documents,
	activeId,
	getTitle,
	onSelect,
}: LegalDocumentSidebarProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			{documents.map((document) => {
				const active = document.id === activeId;
				return (
					<button
						key={document.id}
						type="button"
						onClick={() => onSelect(document)}
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '7px',
							padding: '8px 9px',
							borderRadius: '8px',
							border: active ? '1px solid var(--accent)' : '1px solid transparent',
							background: active ? 'var(--accent-subtle, color-mix(in srgb, var(--indigo) 16%, transparent))' : 'transparent',
							color: 'inherit',
							fontSize: '12px',
							fontWeight: active ? 600 : 500,
							textAlign: 'left',
							cursor: 'pointer',
						}}
					>
						<FileText size={13} style={{ opacity: 0.7, flexShrink: 0 }} />
						<span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{getTitle(document)}
						</span>
						{!document.enabled && <Lock size={11} style={{ opacity: 0.5 }} />}
					</button>
				);
			})}
			{documents.length === 0 && (
				<div style={{ fontSize: '11.5px', opacity: 0.6 }}>{t('legalEmpty')}</div>
			)}
		</div>
	);
}
