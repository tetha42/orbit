'use client';

import React from 'react';
import { Play, ExternalLink, Key, Check, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from './Testbench.module.css';
import type { OAuthSimulateResult, OAuthClientOption } from '../types';

const ALL_SCOPES = [
	{ id: 'openid', key: 'tbOAuthScopeOpenId' },
	{ id: 'profile', key: 'tbOAuthScopeProfile' },
	{ id: 'email', key: 'tbOAuthScopeEmail' },
	{ id: 'roles', key: 'tbOAuthScopeRoles' },
	{ id: 'academic', key: 'tbOAuthScopeAcademic' },
];

interface OAuthConfigCardProps {
	clients: OAuthClientOption[];
	selectedClientId: string;
	onSelectClientId: (id: string) => void;
	selectedScopes: string[];
	onToggleScope: (scope: string) => void;
	oauthLoading: boolean;
	oauthResult: OAuthSimulateResult | null;
	onRunSimulation: () => void;
}

export function OAuthConfigCard({
	clients,
	selectedClientId,
	onSelectClientId,
	selectedScopes,
	onToggleScope,
	oauthLoading,
	oauthResult,
	onRunSimulation,
}: OAuthConfigCardProps) {
	const { t } = useI18n();

	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<span className={s.cardTitle}>
					<Key size={16} color="var(--accent)" /> {t('tbOAuthClientConfig')}
				</span>
				<span className={`${s.badge} ${s.badgeOk}`}>RFC 7636 (PKCE S256)</span>
			</div>

			<div className={s.oauthSplitGrid}>
				<div>
					<label style={{ fontSize: '12px', fontWeight: 600, opacity: 0.75, display: 'block', marginBottom: 6 }}>
						{t('tbOAuthClientToTest')}
					</label>
					<select
						className={s.select}
						style={{ width: '100%' }}
						value={selectedClientId}
						onChange={(e) => onSelectClientId(e.target.value)}
						aria-label={t('tbOAuthClientAria')}
					>
						{clients.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name} ({c.id.slice(0, 16)}…)
							</option>
						))}
						{clients.length === 0 && <option value="client_test">{t('tbOAuthDemoClient')}</option>}
					</select>
				</div>

				<div>
					<label style={{ fontSize: '12px', fontWeight: 600, opacity: 0.75, display: 'block', marginBottom: 8 }}>
						{t('tbOAuthScopesToRequest')}
					</label>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
						{ALL_SCOPES.map((sc) => {
							const isSelected = selectedScopes.includes(sc.id);
							return (
								<button
									key={sc.id}
									type="button"
									className={`${s.scopePill} ${isSelected ? s.scopePillActive : ''}`}
									onClick={() => onToggleScope(sc.id)}
								>
									{isSelected ? (
										<Check size={13} strokeWidth={2.5} />
									) : (
										<Plus size={13} strokeWidth={2} />
									)}
									<span>{t(sc.key)}</span>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			<div style={{ display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'center' }}>
				<button
					type="button"
					className={s.btnAccentLg}
					disabled={oauthLoading}
					onClick={onRunSimulation}
				>
					<Play size={14} fill="currentColor" />
					<span>{oauthLoading ? t('tbOAuthSimulating') : t('tbOAuthRunSim')}</span>
				</button>

				{oauthResult?.authUrl && (
					<a
						href={oauthResult.authUrl}
						target="_blank"
						rel="noreferrer noopener"
						className={s.btnSecondaryLg}
					>
						<ExternalLink size={14} />
						<span>{t('tbOAuthOpenLiveLogin')}</span>
					</a>
				)}
			</div>
		</div>
	);
}
