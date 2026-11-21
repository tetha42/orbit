'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import styles from './oauth.module.css';

interface OAuthLoginFormProps {
	clientName?: string;
	loginEmail: string;
	onEmailChange: (value: string) => void;
	loginPassword: string;
	onPasswordChange: (value: string) => void;
	loginBusy: boolean;
	loginError: string;
	onSubmit: (e: React.FormEvent) => void;
}

export function OAuthLoginForm({
	clientName,
	loginEmail,
	onEmailChange,
	loginPassword,
	onPasswordChange,
	loginBusy,
	loginError,
	onSubmit,
}: OAuthLoginFormProps) {
	const { t } = useI18n();
	const prompt = fill(t('oauthLoginPrompt'), { name: '__CLIENT__' });
	const [prefix, suffix] = prompt.split('__CLIENT__');
	return (
		<form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ fontSize: '13.5px', color: '#a1a1aa', lineHeight: 1.5 }}>
				{prefix}
				<strong style={{ color: '#fafafa' }}>{clientName || t('oauthExternalAppFallback')}</strong>
				{suffix}
			</div>

			{loginError && (
				<div
					style={{
						padding: '8px 12px',
						borderRadius: '6px',
						backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
						border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
						color: 'var(--danger)',
						fontSize: '12px',
					}}
				>
					{loginError}
				</div>
			)}

			<label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
				<span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>{t('authEmailAddressLabel')}</span>
				<input
					type="email"
					required
					value={loginEmail}
					onChange={(e) => onEmailChange(e.target.value)}
					placeholder="member@domain.org"
					className={styles.input}
				/>
			</label>

			<label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
				<span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>{t('authPasswordLabel')}</span>
				<input
					type="password"
					required
					value={loginPassword}
					onChange={(e) => onPasswordChange(e.target.value)}
					placeholder="••••••••••••"
					className={styles.input}
				/>
			</label>

			<button
				type="submit"
				disabled={loginBusy}
				className={styles.approveBtn}
				style={{ marginTop: '4px' }}
			>
				{loginBusy ? t('authSigningIn') : t('oauthSignInContinue')}
			</button>
		</form>
	);
}
