'use client';

import React from 'react';
import { ArrowRight, KeyRound, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';

export function TerminalPasskeyGate({
	isLight,
	error,
	onContinue,
}: {
	isLight: boolean;
	error?: string | null;
	onContinue: () => void;
}) {
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
				<KeyRound size={28} />
			</div>
			<h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.4rem' }}>{t('termPasskeyTitle')}</h2>
			<p
				style={{
					maxWidth: '430px',
					fontSize: '0.8125rem',
					color: isLight ? '#64748b' : '#94a3b8',
					lineHeight: 1.5,
					marginBottom: '1.5rem',
				}}
			>
				{t('termPasskeyDesc')}
			</p>
			{error && (
				<div style={{ color: 'var(--danger)', fontSize: '0.8125rem', marginBottom: '1rem', maxWidth: '420px' }}>
					{error}
				</div>
			)}
			<button
				type="button"
				onClick={onContinue}
				style={{
					padding: '0.625rem 1.25rem',
					borderRadius: '10px',
					background: 'var(--accent)',
					color: '#fff',
					fontSize: '0.875rem',
					fontWeight: 600,
					border: 'none',
					cursor: 'pointer',
				}}
			>
				{t('termPasskeyOpen')}
			</button>
		</div>
	);
}

export function TerminalTwoFactorRequired({ isLight }: { isLight: boolean }) {
	const { t } = useI18n();
	const { openApp } = useWindowActions();

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
			<h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>{t('twofactorSetupRequired')}</h2>
			<p
				style={{
					maxWidth: '440px',
					fontSize: '0.875rem',
					color: isLight ? '#64748b' : '#94a3b8',
					lineHeight: 1.6,
					marginBottom: '1.5rem',
				}}
			>
				{t('term2faRequiredDesc')}
			</p>
			<button
				type="button"
				onClick={() => openApp('settings', { section: 'security' })}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '0.5rem',
					padding: '0.625rem 1.25rem',
					borderRadius: '10px',
					background: '#2563eb',
					color: '#ffffff',
					fontSize: '0.875rem',
					fontWeight: 500,
					border: 'none',
					cursor: 'pointer',
					boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 25%, transparent)',
				}}
			>
				{t('term2faOpenSettings')}
				<ArrowRight size={16} />
			</button>
		</div>
	);
}
