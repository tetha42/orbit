'use client';

import React from 'react';
import { CornerDownLeft, LoaderCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { hintKeyStyle } from './spotlightTypes';

export interface SpotlightStatus {
	text: string;
	tone: 'info' | 'warn';
	busy?: boolean;
}

export function SpotlightFooter({ status }: { status: SpotlightStatus | null }) {
	const { t } = useI18n();

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: '16px',
				padding: '8px 14px',
				borderTop: '1px solid var(--menu-border, rgba(255, 255, 255, 0.1))',
				fontSize: '11px',
				minHeight: '34px',
			}}
		>
			<div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: '14px', opacity: 0.6, flexShrink: 0 }}>
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
					<span style={hintKeyStyle}>↑↓</span>
					{t('spotFooterNavigate')}
				</span>
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
					<span style={hintKeyStyle}>
						<CornerDownLeft size={11} />
					</span>
					{t('spotFooterOpen')}
				</span>
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
					<span style={hintKeyStyle}>esc</span>
					{t('spotFooterClose')}
				</span>
			</div>
			<div
				role="status"
				aria-live="polite"
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 6,
					minWidth: 0,
					textAlign: 'right',
					color: status?.tone === 'warn' ? 'var(--warning)' : 'inherit',
					opacity: status ? (status.tone === 'warn' ? 1 : 0.6) : 0,
				}}
			>
				{status?.busy && <LoaderCircle size={12} className="spot-spinner" aria-hidden="true" />}
				<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{status?.text}</span>
			</div>
		</div>
	);
}
