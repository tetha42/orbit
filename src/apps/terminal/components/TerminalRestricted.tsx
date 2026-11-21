'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface TerminalRestrictedProps {
	isLight: boolean;
}

export function TerminalRestricted({ isLight }: TerminalRestrictedProps) {
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
				background: isLight ? 'color-mix(in srgb, var(--ink-text) 98%, transparent)' : 'color-mix(in srgb, var(--ink-bg) 95%, transparent)',
				color: isLight ? '#0f172a' : '#f8fafc',
				textAlign: 'center',
			}}
		>
			<div
				style={{
					width: '64px',
					height: '64px',
					borderRadius: '16px',
					background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
					border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					marginBottom: '1.25rem',
					color: 'var(--danger)',
				}}
			>
				<ShieldAlert size={36} />
			</div>
			<h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
				{t('termRestricted')}
			</h2>
			<p
				style={{
					maxWidth: '420px',
					fontSize: '0.875rem',
					color: isLight ? '#64748b' : '#94a3b8',
					lineHeight: 1.5,
				}}
			>
				{t('termRestrictedDesc')}
			</p>
		</div>
	);
}
