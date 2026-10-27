'use client';

import React, { useState } from 'react';
import {
	Play,
	ExternalLink,
	Shield,
	CheckCircle2,
	XCircle,
	Copy,
	Search,
	Key,
	Check,
	Plus,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from './Testbench.module.css';
import type { OAuthSimulateResult, OAuthClientOption } from '../types';

interface OAuthSimulatorTabProps {
	clients: OAuthClientOption[];
	selectedClientId: string;
	onSelectClientId: (id: string) => void;
	selectedScopes: string[];
	onToggleScope: (scope: string) => void;
	oauthLoading: boolean;
	oauthResult: OAuthSimulateResult | null;
	onRunSimulation: () => void;
	tokenInput: string;
	onTokenInputChange: (val: string) => void;
	inspectResult: {
		valid: boolean;
		payload: Record<string, unknown> | null;
		error: string | null;
	} | null;
	isInspecting: boolean;
	onInspectToken: (token?: string) => void;
}

const ALL_SCOPES = [
	{ id: 'openid', key: 'tbOAuthScopeOpenId' },
	{ id: 'profile', key: 'tbOAuthScopeProfile' },
	{ id: 'email', key: 'tbOAuthScopeEmail' },
	{ id: 'roles', key: 'tbOAuthScopeRoles' },
	{ id: 'academic', key: 'tbOAuthScopeAcademic' },
];

export function OAuthSimulatorTab({
	clients,
	selectedClientId,
	onSelectClientId,
	selectedScopes,
	onToggleScope,
	oauthLoading,
	oauthResult,
	onRunSimulation,
	tokenInput,
	onTokenInputChange,
	inspectResult,
	isInspecting,
	onInspectToken,
}: OAuthSimulatorTabProps) {
	const { t } = useI18n();
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const copyText = (text: string, key: string) => {
		void navigator.clipboard.writeText(text);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
			{/* Controls Card */}
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
									{c.ad} ({c.id.slice(0, 16)}…)
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

			{/* Flow Trace Result */}
			{oauthResult && (
				<div className={s.stepper}>
					{/* Step 1: PKCE */}
					<div className={s.step}>
						<div className={s.stepHead}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<span className={s.stepNum}>{t('tbOAuthStep1')}</span>
								<strong style={{ fontSize: '13px' }}>{t('tbOAuthPkceTitle')}</strong>
							</div>
							<span style={{ fontSize: '11px', opacity: 0.6 }}>{t('tbOAuthMethodS256')}</span>
						</div>
						<div className={s.pkceSplitGrid}>
							<div>
								<span style={{ fontSize: '11px', opacity: 0.65, display: 'block', marginBottom: 4 }}>code_verifier:</span>
								<div className={s.codeBlock}>{oauthResult.codeVerifier}</div>
							</div>
							<div>
								<span style={{ fontSize: '11px', opacity: 0.65, display: 'block', marginBottom: 4 }}>code_challenge (SHA-256 base64url):</span>
								<div className={s.codeBlock}>{oauthResult.codeChallenge}</div>
							</div>
						</div>
					</div>

					{/* Step 2: Tokens */}
					<div className={s.step}>
						<div className={s.stepHead}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<span className={s.stepNum}>{t('tbOAuthStep2')}</span>
								<strong style={{ fontSize: '13px' }}>{t('tbOAuthTokenResponseTitle')}</strong>
							</div>
							<div style={{ display: 'flex', gap: '6px' }}>
								<span className={`${s.badge} ${s.badgeOk}`}>200 OK</span>
								<span style={{ fontSize: '11px', opacity: 0.6 }}>{oauthResult.latencyMs} ms</span>
							</div>
						</div>

						<div>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
								<span style={{ fontSize: '11.5px', opacity: 0.75, fontWeight: 500 }}>Access Token (Bearer):</span>
								<button
									type="button"
									className={s.btnCopy}
									onClick={() => copyText(oauthResult.tokenResponse?.access_token || '', 'access')}
								>
									{copiedKey === 'access' ? <CheckCircle2 size={12} color="#34c759" /> : <Copy size={12} />}
									<span>{copiedKey === 'access' ? t('tbOAuthCopied') : t('tbOAuthCopy')}</span>
								</button>
							</div>
							<div className={s.codeBlock} style={{ maxHeight: 75 }}>
								{oauthResult.tokenResponse?.access_token}
							</div>
						</div>

						<div>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
								<span style={{ fontSize: '11.5px', opacity: 0.75, fontWeight: 500 }}>ID Token (OIDC JWT):</span>
								<button
									type="button"
									className={s.btnCopy}
									onClick={() => copyText(oauthResult.tokenResponse?.id_token || '', 'id_token')}
								>
									{copiedKey === 'id_token' ? <CheckCircle2 size={12} color="#34c759" /> : <Copy size={12} />}
									<span>{copiedKey === 'id_token' ? t('tbOAuthCopied') : t('tbOAuthCopy')}</span>
								</button>
							</div>
							<div className={s.codeBlock} style={{ maxHeight: 75 }}>
								{oauthResult.tokenResponse?.id_token}
							</div>
						</div>
					</div>

					{/* Step 3: Decoded Claims & UserInfo */}
					<div className={s.step}>
						<div className={s.stepHead}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<span className={s.stepNum}>{t('tbOAuthStep3')}</span>
								<strong style={{ fontSize: '13px' }}>{t('tbOAuthDecodedProfile')}</strong>
							</div>
							<span className={`${s.badge} ${s.badgeOk}`}>
								<Shield size={12} /> {t('tbOAuthVerified')}
							</span>
						</div>

						<div className={s.pkceSplitGrid}>
							<div>
								<span style={{ fontSize: '11.5px', opacity: 0.75, display: 'block', marginBottom: 4, fontWeight: 500 }}>
									{t('tbOAuthIdTokenClaims')}
								</span>
								<div className={s.codeBlock}>
									{JSON.stringify(oauthResult.decodedIdToken, null, 2)}
								</div>
							</div>
							<div>
								<span style={{ fontSize: '11.5px', opacity: 0.75, display: 'block', marginBottom: 4, fontWeight: 500 }}>
									{t('tbOAuthUserInfoResponse')}
								</span>
								<div className={s.codeBlock}>
									{JSON.stringify(oauthResult.userInfoResponse, null, 2)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Token Inspector Section */}
			<div className={s.card}>
				<div className={s.cardHeader}>
					<span className={s.cardTitle}>
						<Search size={15} color="#0a84ff" /> {t('tbOAuthTokenInspector')}
					</span>
				</div>
				<p style={{ fontSize: '12px', opacity: 0.7, margin: '0 0 10px', lineHeight: 1.45 }}>
					{t('tbOAuthTokenInspectorDesc')}
				</p>
				<textarea
					className={s.textarea}
					style={{ minHeight: 70, width: '100%', boxSizing: 'border-box' }}
					placeholder="eyJh..."
					value={tokenInput}
					onChange={(e) => onTokenInputChange(e.target.value)}
				/>
				<div style={{ display: 'flex', gap: '10px', marginTop: 8 }}>
					<button
						type="button"
						className={s.btnAccentLg}
						style={{ height: '36px', fontSize: '12.5px' }}
						disabled={isInspecting}
						onClick={() => onInspectToken()}
					>
						<Search size={14} />
						<span>{t('tbOAuthInspectBtn')}</span>
					</button>
					{oauthResult?.tokenResponse?.access_token && (
						<button
							type="button"
							className={s.btnSecondaryLg}
							style={{ height: '36px', fontSize: '12.5px' }}
							onClick={() => {
								onTokenInputChange(oauthResult.tokenResponse!.access_token);
								onInspectToken(oauthResult.tokenResponse!.access_token);
							}}
						>
							<Copy size={13} />
							<span>{t('tbOAuthPasteSimToken')}</span>
						</button>
					)}
				</div>

				{inspectResult && (
					<div style={{ marginTop: 12 }}>
						<span
							className={`${s.badge} ${inspectResult.valid ? s.badgeOk : s.badgeFail}`}
							style={{ marginBottom: 8 }}
						>
							{inspectResult.valid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
							<span>
								{inspectResult.valid
									? t('tbOAuthSigValid')
									: fill(t('tbOAuthSigError'), { error: inspectResult.error ?? '' })}
							</span>
						</span>
						{inspectResult.payload && (
							<div className={s.codeBlock} style={{ marginTop: 6 }}>
								{JSON.stringify(inspectResult.payload, null, 2)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
