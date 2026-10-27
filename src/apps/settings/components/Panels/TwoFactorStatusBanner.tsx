'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { AlertCircle, CheckCircle2, ShieldCheck, ShieldOff } from 'lucide-react';

interface TwoFactorStatusBannerProps {
	status: {
		enabled: boolean;
		required: boolean;
	} | null;
	feedback: { type: 'ok' | 'err'; text: string } | null;
}

export function TwoFactorStatusBanner({ status, feedback }: TwoFactorStatusBannerProps) {
	const { t } = useI18n();
	return (
		<>
			<div
				style={{
					padding: '12px 16px',
					borderRadius: '10px',
					background: status?.enabled ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 159, 10, 0.15)',
					border: `1px solid ${status?.enabled ? 'rgba(52, 199, 89, 0.4)' : 'rgba(255, 159, 10, 0.4)'}`,
					color: status?.enabled ? '#34c759' : '#ff9f0a',
					fontSize: '13px',
					fontWeight: 600,
					display: 'flex',
					alignItems: 'center',
					gap: '8px',
				}}
			>
				{status?.enabled ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
				<span>
					{fill(t('twofactorStatus'), { status: status?.enabled ? t('twofactorActive') : t('twofactorDisabled') })}
					{status?.required ? ` · ${t('twofactorRequiredBadge')}` : ''}
				</span>
			</div>

			{feedback && (
				<div
					style={{
						padding: '12px 16px',
						borderRadius: '10px',
						background: feedback.type === 'ok' ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 69, 58, 0.15)',
						border: `1px solid ${feedback.type === 'ok' ? 'rgba(52, 199, 89, 0.4)' : 'rgba(255, 69, 58, 0.4)'}`,
						color: feedback.type === 'ok' ? '#34c759' : '#ff453a',
						fontSize: '13px',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
					}}
				>
					{feedback.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
					<span>{feedback.text}</span>
				</div>
			)}
		</>
	);
}
