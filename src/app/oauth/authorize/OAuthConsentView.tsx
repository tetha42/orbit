'use client';

import React from 'react';
import { Shield, ArrowRight, Info } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import styles from './oauth.module.css';
import type { AuthorizeClientData, AuthorizeUserData } from './types';
import { OAuthScopeList } from './OAuthScopeList';

interface OAuthConsentViewProps {
	client?: AuthorizeClientData;
	user?: AuthorizeUserData;
	selectedScopes: string[];
	blockedScopes: string[];
	actionBusy: boolean;
	isScopeEffective: (scopeId: string) => boolean;
	onToggleScope: (scopeId: string) => void;
	onDecision: (approved: boolean) => void;
}

export function OAuthConsentView({
	client,
	user,
	selectedScopes,
	blockedScopes,
	actionBusy,
	isScopeEffective,
	onToggleScope,
	onDecision,
}: OAuthConsentViewProps) {
	const { t } = useI18n();
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			{/* Target App Card */}
			<div className={styles.clientCard}>
				<div className={styles.clientIcon}>
					<Shield size={18} />
				</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontWeight: 600, fontSize: '15px', color: '#fafafa' }}>{client?.name}</div>
					{client?.description && (
						<div style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '2px', lineHeight: 1.4 }}>
							{client.description}
						</div>
					)}
				</div>
			</div>

			{/* Notice Banner */}
			<div className={styles.notice}>
				<strong style={{ color: '#fafafa' }}>{t('oauthScopeSelectionTitle')}</strong> {t('oauthScopeSelectionDesc')}
			</div>

			{/* Scope Permission Cards with Live Preview */}
			<OAuthScopeList
				user={user}
				selectedScopes={selectedScopes}
				isScopeEffective={isScopeEffective}
				onToggleScope={onToggleScope}
			/>

			{/* Admin Ceiling Policy Notice if any requested scope was blocked */}
			{blockedScopes.length > 0 && (
				<div
					style={{
						padding: '8px 12px',
						borderRadius: '6px',
						backgroundColor: 'color-mix(in srgb, var(--warning) 8%, transparent)',
						border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
						fontSize: '11.5px',
						color: 'var(--warning)',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
					}}
				>
					<Info size={14} style={{ flexShrink: 0 }} />
					<span>
						{t('oauthScopeCeilingNotice')} <code>{blockedScopes.join(', ')}</code>
					</span>
				</div>
			)}

			{/* Logged in as User */}
			<div className={styles.sessionBar}>
				<span style={{ color: '#a1a1aa' }}>{t('oauthAuthSession')}</span>
				<strong style={{ color: '#fafafa' }}>
					{user?.nameSurname} <span style={{ color: '#a1a1aa', fontWeight: 400 }}>({user?.email})</span>
				</strong>
			</div>

			{/* Action Buttons */}
			<div className={styles.actions}>
				<button
					type="button"
					disabled={actionBusy}
					onClick={() => onDecision(false)}
					className={styles.denyBtn}
				>
					{t('oauthDenyBtn')}
				</button>

				<button
					type="button"
					disabled={actionBusy}
					onClick={() => onDecision(true)}
					className={styles.approveBtn}
				>
					<span>{actionBusy ? t('oauthRedirecting') : t('oauthApproveBtn')}</span>
					<ArrowRight size={15} />
				</button>
			</div>
		</div>
	);
}
