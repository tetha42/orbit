'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { AlertCircle, ShieldCheck } from 'lucide-react';

interface SmtpInfoCardsProps {
	from: string;
	emailReady: boolean;
}

export function SmtpInfoCards({ from, emailReady }: SmtpInfoCardsProps) {
	const { t } = useI18n();

	return (
		<>
			<div
				style={{
					background: 'rgba(10, 132, 255, 0.08)',
					border: '1px solid rgba(10, 132, 255, 0.25)',
					borderRadius: '12px',
					padding: '14px 16px',
					display: 'flex',
					alignItems: 'flex-start',
					gap: '12px',
					fontSize: '12.5px',
					lineHeight: 1.5,
				}}
			>
				<ShieldCheck size={20} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
				<div>
					<div style={{ fontWeight: 600, color: 'var(--accent-blue)', marginBottom: '2px' }}>
						{t('smtpOutgoingTitle')}
					</div>
					<div style={{ opacity: 0.85 }}>
						{from.trim() ? (
							<>{fill(t('smtpInfoActive'), { from: from.trim() })}</>
						) : (
							<>{t('smtpOutgoingFallback')}</>
						)}
					</div>
				</div>
			</div>

			{!emailReady && (
				<div
					role="status"
					style={{
						padding: '14px 16px',
						borderRadius: '12px',
						background: 'rgba(255, 69, 58, 0.12)',
						border: '1px solid rgba(255, 69, 58, 0.35)',
						color: '#ff453a',
						fontSize: '13px',
						lineHeight: 1.5,
						display: 'flex',
						alignItems: 'flex-start',
						gap: '10px',
					}}
				>
					<AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
					<div>
						<div style={{ fontWeight: 700, marginBottom: '2px' }}>
							{t('smtpRequiredTitle')}
						</div>
						<span style={{ opacity: 0.9 }}>
							{t('smtpRequiredDesc')}
						</span>
					</div>
				</div>
			)}
		</>
	);
}
