'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useI18n } from '@/core/i18n';

interface StorageSettingsPanelProps {
	resetMessage: string | null;
	onReset: () => void;
}

export function StorageSettingsPanel({ resetMessage, onReset }: StorageSettingsPanelProps) {
	const { t } = useI18n();

	return (
		<div data-focus-section="storage" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsStorageTitle')}</h2>
				<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>
					{t('settingsStorageDesc')}
				</p>
			</div>

			<div
				style={{
					background: 'var(--card-bg)',
					borderRadius: '10px',
					border: '1px solid var(--window-border)',
					padding: '16px',
					display: 'flex',
					flexDirection: 'column',
					gap: '14px',
				}}
			>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<div>
						<div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('settingsResetWorkspace')}</div>
						<div style={{ fontSize: '12px', opacity: 0.65 }}>{t('settingsResetWorkspaceDesc')}</div>
					</div>
					<button
						onClick={onReset}
						style={{
							background: 'rgba(255, 59, 48, 0.12)',
							color: '#ff3b30',
							border: '1px solid rgba(255, 59, 48, 0.3)',
							padding: '6px 14px',
							borderRadius: '6px',
							fontSize: '13px',
							fontWeight: 600,
							display: 'flex',
							alignItems: 'center',
							gap: '6px',
							cursor: 'pointer',
						}}
					>
						<RotateCcw size={14} />
						{t('dlgReset')}
					</button>
				</div>
				{resetMessage && (
					<div
						style={{
							fontSize: '12px',
							color: '#34c759',
							background: 'rgba(52, 199, 89, 0.1)',
							padding: '6px 10px',
							borderRadius: '6px',
						}}
					>
						{resetMessage}
					</div>
				)}
			</div>
		</div>
	);
}
