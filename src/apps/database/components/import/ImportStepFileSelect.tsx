'use client';

import React from 'react';
import { Upload, FileText } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface ImportStepFileSelectProps {
	onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ImportStepFileSelect({ onFileChange }: ImportStepFileSelectProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '40px 20px',
				border: '2px dashed var(--window-border)',
				borderRadius: '12px',
			}}
		>
			<Upload size={36} style={{ opacity: 0.5, marginBottom: '12px' }} />
			<div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
				{t('dbImportFileSelectTitle')}
			</div>
			<div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '18px', textAlign: 'center' }}>
				{t('dbImportFileSelectDesc')}
			</div>
			<label
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '8px',
					padding: '8px 18px',
					borderRadius: '8px',
					background: 'var(--accent)',
					color: 'var(--accent-contrast)',
					fontSize: '13px',
					fontWeight: 600,
					cursor: 'pointer',
				}}
			>
				<FileText size={15} />
				<span>{t('dbImportChooseFile')}</span>
				<input
					type="file"
					accept=".csv, .json"
					onChange={onFileChange}
					style={{ display: 'none' }}
				/>
			</label>
		</div>
	);
}
