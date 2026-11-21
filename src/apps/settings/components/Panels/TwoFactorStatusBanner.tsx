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
					background: status?.enabled ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--warning) 15%, transparent)',
					border: `1px solid ${status?.enabled ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'color-mix(in srgb, var(--warning) 40%, transparent)'}`,
					color: status?.enabled ? 'var(--success)' : 'var(--warning)',
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
						background: feedback.type === 'ok' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : 'color-mix(in srgb, var(--danger) 15%, transparent)',
						border: `1px solid ${feedback.type === 'ok' ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'color-mix(in srgb, var(--danger) 40%, transparent)'}`,
						color: feedback.type === 'ok' ? 'var(--success)' : 'var(--danger)',
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
