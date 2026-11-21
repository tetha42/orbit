'use client';

import React, { Suspense } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useIsMounted } from '@/lib/client/useClientValue';
import styles from './oauth.module.css';
import { useOAuthAuthorize } from './useOAuthAuthorize';
import { OAuthLoginForm } from './OAuthLoginForm';
import { OAuthConsentView } from './OAuthConsentView';

function AuthorizeContent() {
	const { t } = useI18n();
	const {
		state,
		selectedScopes,
		blockedScopes,
		isScopeEffective,
		toggleScope,
		loginEmail,
		setLoginEmail,
		loginPassword,
		setLoginPassword,
		loginBusy,
		loginError,
		actionBusy,
		handleLogin,
		handleConsentDecision,
	} = useOAuthAuthorize();

	const isMounted = useIsMounted();

	if (!isMounted) {
		return <main suppressHydrationWarning className={styles.viewport} />;
	}

	return (
		<main suppressHydrationWarning className={styles.viewport}>
			<div suppressHydrationWarning className={styles.panel}>
				<header className={styles.header}>
					<span>ORBIT // TETHA42</span>
					<span style={{ color: '#fafafa' }}>OAUTH 2.0 / OIDC</span>
				</header>

				<div className={styles.body}>
					{/* Top Brand Identity */}
					<div className={styles.brandRow}>
						<div className={styles.brandIcon}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src="/assets/img/logo-orbit.svg"
								alt="Orbit Community OS"
								style={{ width: '24px', height: '24px' }}
							/>
						</div>
						<div>
							<div className={styles.brandTitle}>{t('oauthIdpTitle')}</div>
							<div className={styles.brandSub}>{t('oauthIdpSub')}</div>
						</div>
					</div>

					{/* Loading State */}
					{state.loading && (
						<div
							style={{
								textAlign: 'center',
								padding: '32px 0',
								color: '#a1a1aa',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: '12px',
							}}
						>
							<Loader2 size={28} className="spin" style={{ animation: 'spin 1s linear infinite', color: '#fafafa' }} />
							<div style={{ fontSize: '13px' }}>{t('oauthValidatingReq')}</div>
						</div>
					)}

					{/* Error State */}
					{state.error && (
						<div
							style={{
								padding: '12px 14px',
								backgroundColor: 'color-mix(in srgb, var(--danger) 10%, transparent)',
								border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
								borderRadius: '6px',
								color: 'var(--danger)',
								fontSize: '13px',
								display: 'flex',
								alignItems: 'center',
								gap: '10px',
							}}
						>
							<ShieldAlert size={18} style={{ flexShrink: 0 }} />
							<span>{state.error}</span>
						</div>
					)}

					{/* Login Required */}
					{state.requiresLogin && (
						<OAuthLoginForm
							clientName={state.client?.name}
							loginEmail={loginEmail}
							onEmailChange={setLoginEmail}
							loginPassword={loginPassword}
							onPasswordChange={setLoginPassword}
							loginBusy={loginBusy}
							loginError={loginError}
							onSubmit={handleLogin}
						/>
					)}

					{/* Consent Prompt */}
					{state.requiresConsent && (
						<OAuthConsentView
							client={state.client}
							user={state.user}
							selectedScopes={selectedScopes}
							blockedScopes={blockedScopes}
							actionBusy={actionBusy}
							isScopeEffective={isScopeEffective}
							onToggleScope={toggleScope}
							onDecision={handleConsentDecision}
						/>
					)}
				</div>
			</div>
		</main>
	);
}

export default function OAuthAuthorizePage() {
	return (
		<Suspense fallback={<div style={{ minHeight: '100dvh', backgroundColor: '#09090b' }} />}>
			<AuthorizeContent />
		</Suspense>
	);
}
