'use client';

import React from 'react';
import { Database } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface PasskeyVerifyViewProps {
	isLight: boolean;
	loading: boolean;
	error: string | null;
	onVerify: () => void;
}

export function PasskeyVerifyView({
	isLight,
	loading,
	error,
	onVerify,
}: PasskeyVerifyViewProps) {
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
					width: '56px',
					height: '56px',
					borderRadius: '14px',
					background: 'color-mix(in srgb, var(--success) 12%, transparent)',
					border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					marginBottom: '1.25rem',
					color: 'var(--success)',
				}}
			>
				<Database size={28} />
			</div>
			<h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
				{t('dbPasskeyTitle')}
			</h3>
			<p
				style={{
					maxWidth: '440px',
					fontSize: '0.8125rem',
					color: isLight ? '#64748b' : '#94a3b8',
					lineHeight: 1.5,
					margin: '0 0 1.5rem 0',
				}}
			>
				{t('dbPasskeyDesc')}
			</p>
			<button
				type="button"
				disabled={loading}
				onClick={onVerify}
				style={{
					padding: '0.625rem 1.25rem',
					borderRadius: '8px',
					background: 'var(--accent)',
					color: '#fff',
					border: 'none',
					fontWeight: 600,
					fontSize: '0.875rem',
					cursor: loading ? 'wait' : 'pointer',
					opacity: loading ? 0.7 : 1,
				}}
			>
				{loading ? t('loading') : t('dbPasskeyOpen')}
			</button>
			{error && (
				<div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.75rem' }}>
					{error}
				</div>
			)}
		</div>
	);
}
