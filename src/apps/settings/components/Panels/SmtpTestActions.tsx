'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { Send } from 'lucide-react';

interface SmtpTestActionsProps {
	isSaving: boolean;
	isTesting: boolean;
	testEmail: string;
	onTestEmailChange: (val: string) => void;
	onTestEmail: () => void;
}

export function SmtpTestActions({
	isSaving,
	isTesting,
	testEmail,
	onTestEmailChange,
	onTestEmail,
}: SmtpTestActionsProps) {
	const { t } = useI18n();
	return (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				justifyContent: 'space-between',
				alignItems: 'center',
				gap: '12px',
				marginTop: '10px',
				paddingTop: '16px',
				borderTop: '1px solid var(--window-border)',
			}}
		>
			<button
				type="submit"
				disabled={isSaving}
				style={{
					padding: '9px 20px',
					borderRadius: '8px',
					border: 'none',
					background: 'var(--success)',
					color: '#fff',
					fontWeight: 700,
					fontSize: '13px',
					cursor: 'pointer',
					boxShadow: '0 2px 8px color-mix(in srgb, var(--success) 30%, transparent)',
				}}
			>
				{isSaving ? t('smtpSaving') : t('smtpSaveBtn')}
			</button>

			<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
				<input
					type="email"
					placeholder={t('smtpTestEmailPh')}
					value={testEmail}
					onChange={(e) => onTestEmailChange(e.target.value)}
					style={{
						padding: '7px 10px',
						borderRadius: '8px',
						background: 'rgba(0, 0, 0, 0.25)',
						border: '1px solid var(--window-border)',
						color: 'inherit',
						fontSize: '12px',
						width: '180px',
					}}
				/>
				<button
					type="button"
					onClick={onTestEmail}
					disabled={isTesting}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						padding: '8px 14px',
						borderRadius: '8px',
						border: '1px solid var(--accent-blue)',
						background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
						color: 'var(--accent-blue)',
						fontWeight: 600,
						fontSize: '12.5px',
						cursor: 'pointer',
					}}
				>
					<Send size={13} />
					<span>{isTesting ? t('smtpTesting') : t('smtpTestBtn')}</span>
				</button>
			</div>
		</div>
	);
}
