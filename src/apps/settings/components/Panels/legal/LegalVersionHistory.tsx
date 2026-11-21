'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { LegalDocumentVersion } from './types';

interface LegalVersionHistoryProps {
	versions: LegalDocumentVersion[];
	currentVersion?: number;
	getTitle: (doc: { titleTr: string; titleEn: string }) => string;
	getBody: (doc: { bodyTr: string; bodyEn: string }) => string;
}

export function LegalVersionHistory({
	versions,
	currentVersion,
	getTitle,
	getBody,
}: LegalVersionHistoryProps) {
	const { t, language } = useI18n();

	return (
		<div
			style={{
				borderTop: '1px solid var(--window-border)',
				paddingTop: '10px',
				display: 'flex',
				flexDirection: 'column',
				gap: '6px',
			}}
		>
			<div style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
				<FileText size={13} />
				{t('legalVersionHistory')}
				<span style={{ opacity: 0.55, fontWeight: 500 }}>
					{t('legalCurrentVersion')}: v{currentVersion ?? 1}
				</span>
			</div>
			{versions.length === 0 ? (
				<div style={{ fontSize: '11.5px', opacity: 0.55 }}>{t('legalNoVersions')}</div>
			) : (
				versions.map((version) => (
					<details key={version.id} style={{ fontSize: '11.5px' }}>
						<summary style={{ cursor: 'pointer', opacity: 0.8 }}>
							v{version.version} · {getTitle(version)} ·{' '}
							{new Date(version.archivedAt).toLocaleDateString(language)}
						</summary>
						<pre
							style={{
								whiteSpace: 'pre-wrap',
								fontFamily: 'ui-monospace, monospace',
								fontSize: '11px',
								lineHeight: 1.5,
								maxHeight: '180px',
								overflowY: 'auto',
								padding: '8px',
								borderRadius: '6px',
								background: 'rgba(0,0,0,0.18)',
								marginTop: '5px',
							}}
						>
							{getBody(version)}
						</pre>
					</details>
				))
			)}
		</div>
	);
}
