'use client';

import React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface TwoFactorSetupRequiredViewProps {
	isLight: boolean;
	onOpenSettings: () => void;
}

export function TwoFactorSetupRequiredView({
	isLight,
	onOpenSettings,
}: TwoFactorSetupRequiredViewProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				height: '100%',
				padding: '2rem',
				background: isLight ? '#f8fafc' : '#080b11',
				color: isLight ? '#0f172a' : '#f8fafc',
				textAlign: 'center',
			}}
		>
			<div
				style={{
					width: '64px',
					height: '64px',
					borderRadius: '16px',
					background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
					border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					marginBottom: '1.25rem',
					color: 'var(--danger)',
				}}
			>
				<ShieldAlert size={34} />
			</div>
			<h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
				{t('twofactorSetupRequired')}
			</h2>
			<p
				style={{
					maxWidth: '440px',
					color: isLight ? '#64748b' : '#94a3b8',
					fontSize: '0.875rem',
					lineHeight: 1.5,
					marginBottom: '1.5rem',
				}}
			>
				{t('db2faRequiredDesc')}
			</p>
			<button
				type="button"
				onClick={onOpenSettings}
				style={{
					padding: '0.625rem 1.25rem',
					borderRadius: '8px',
					background: 'var(--accent)',
					color: 'var(--accent-contrast, #ffffff)',
					border: 'none',
					fontWeight: 500,
					fontSize: '0.875rem',
					cursor: 'pointer',
					display: 'flex',
					alignItems: 'center',
					gap: '0.5rem',
				}}
			>
				<span>{t('db2faOpenSettings')}</span>
				<ArrowRight size={16} />
			</button>
		</div>
	);
}
