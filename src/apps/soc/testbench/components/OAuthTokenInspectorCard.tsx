'use client';

import React from 'react';
import { CheckCircle2, XCircle, Copy, Search } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from './Testbench.module.css';

interface OAuthTokenInspectorCardProps {
	tokenInput: string;
	onTokenInputChange: (val: string) => void;
	simulatedAccessToken?: string;
	inspectResult: {
		valid: boolean;
		payload: Record<string, unknown> | null;
		error: string | null;
	} | null;
	isInspecting: boolean;
	onInspectToken: (token?: string) => void;
}

export function OAuthTokenInspectorCard({
	tokenInput,
	onTokenInputChange,
	simulatedAccessToken,
	inspectResult,
	isInspecting,
	onInspectToken,
}: OAuthTokenInspectorCardProps) {
	const { t } = useI18n();

	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<span className={s.cardTitle}>
					<Search size={15} color="var(--accent)" /> {t('tbOAuthTokenInspector')}
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
				{simulatedAccessToken && (
					<button
						type="button"
						className={s.btnSecondaryLg}
						style={{ height: '36px', fontSize: '12.5px' }}
						onClick={() => {
							onTokenInputChange(simulatedAccessToken);
							onInspectToken(simulatedAccessToken);
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
	);
}
