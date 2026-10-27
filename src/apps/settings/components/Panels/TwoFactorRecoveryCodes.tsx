'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { Copy, KeyRound } from 'lucide-react';

interface TwoFactorRecoveryCodesProps {
	recoveryCodes: string[];
	onCopy: () => void;
	onAcknowledge: () => void;
}

export function TwoFactorRecoveryCodes({
	recoveryCodes,
	onCopy,
	onAcknowledge,
}: TwoFactorRecoveryCodesProps) {
	const { t } = useI18n();
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34c759', fontSize: '13px', fontWeight: 600 }}>
				<KeyRound size={16} />
				<span>{t('twofactorRecoveryTitle')}</span>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
					gap: '8px',
					padding: '14px',
					borderRadius: '10px',
					background: 'rgba(0, 0, 0, 0.25)',
					border: '1px solid var(--window-border)',
					fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
					fontSize: '13px',
					userSelect: 'all',
				}}
			>
				{recoveryCodes.map((c) => (
					<span key={c}>{c}</span>
				))}
			</div>

			<p style={{ fontSize: '12px', opacity: 0.7, margin: 0, lineHeight: 1.5 }}>
				{t('twofactorRecoveryDesc')}
			</p>

			<div style={{ display: 'flex', gap: '10px' }}>
				<button
					onClick={onCopy}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 16px',
						borderRadius: '8px',
						border: '1px solid var(--window-border)',
						background: 'transparent',
						color: 'inherit',
						fontSize: '13px',
						cursor: 'pointer',
					}}
				>
					<Copy size={15} />
					{t('twofactorCopyCodes')}
				</button>
				<button
					onClick={onAcknowledge}
					style={{
						padding: '10px 16px',
						borderRadius: '8px',
						border: 'none',
						background: 'var(--accent-blue)',
						color: '#fff',
						fontSize: '13px',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					{t('twofactorDone')}
				</button>
			</div>
		</div>
	);
}
