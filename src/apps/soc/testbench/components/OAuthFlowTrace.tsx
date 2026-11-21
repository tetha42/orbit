'use client';

import React, { useState } from 'react';
import { Shield, CheckCircle2, Copy } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import s from './Testbench.module.css';
import type { OAuthSimulateResult } from '../types';

interface OAuthFlowTraceProps {
	oauthResult: OAuthSimulateResult;
}

export function OAuthFlowTrace({ oauthResult }: OAuthFlowTraceProps) {
	const { t } = useI18n();
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const copyText = (text: string, key: string) => {
		void navigator.clipboard.writeText(text);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
	};

	return (
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
							{copiedKey === 'access' ? <CheckCircle2 size={12} color="var(--success)" /> : <Copy size={12} />}
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
							{copiedKey === 'id_token' ? <CheckCircle2 size={12} color="var(--success)" /> : <Copy size={12} />}
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
	);
}
