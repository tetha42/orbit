'use client';

import React from 'react';
import { Play } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { SQL_SYSTEM_TEMPLATES } from '../../utils/sqlTemplates';

interface SqlDrawerTemplatesTabProps {
	onSelectQuery: (sql: string) => void;
}

export function SqlDrawerTemplatesTab({ onSelectQuery }: SqlDrawerTemplatesTabProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
			{SQL_SYSTEM_TEMPLATES.map((tmpl) => (
				<div
					key={tmpl.title}
					style={{
						padding: '10px 12px',
						borderRadius: '8px',
						background: 'var(--fill-softer)',
						border: '1px solid var(--window-border)',
						display: 'flex',
						flexDirection: 'column',
						gap: '6px',
					}}
				>
					<div style={{ fontSize: '12px', fontWeight: 700 }}>{t(tmpl.titleKey)}</div>
					<div style={{ fontSize: '11px', opacity: 0.65 }}>{t(tmpl.descKey)}</div>
					<button
						type="button"
						onClick={() => onSelectQuery(tmpl.sql)}
						style={{
							alignSelf: 'flex-start',
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							marginTop: '4px',
							padding: '4px 9px',
							borderRadius: '5px',
							fontSize: '11px',
							fontWeight: 600,
							background: 'var(--accent)',
							color: 'var(--accent-contrast)',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						<Play size={10} fill="currentColor" />
						<span>{t('dbPasteToEditor')}</span>
					</button>
				</div>
			))}
		</div>
	);
}
