'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { TwoFactorSettingsPanel } from './TwoFactorSettingsPanel';
import { PasskeySettingsPanel } from './PasskeySettingsPanel';

export function SecurityPanel() {
	const { t } = useI18n();

	return (
		<div data-focus-section="security" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsSecurityTitle')}</h2>
				<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>
					{t('settingsSecurityDesc')}
				</p>
			</div>

			<div
				style={{
					background: 'var(--card-bg)',
					borderRadius: '12px',
					border: '1px solid var(--window-border)',
					padding: '20px',
					display: 'flex',
					flexDirection: 'column',
					gap: '20px',
				}}
			>
				<div>
					<h3 style={{ fontSize: '15px', fontWeight: 650, margin: '0 0 10px 0' }}>
						{t('settings2faTitle')}
					</h3>
					<TwoFactorSettingsPanel />
				</div>

				<div style={{ height: '1px', background: 'var(--border-subtle)' }} />

				<div>
					<h3 style={{ fontSize: '15px', fontWeight: 650, margin: '0 0 10px 0' }}>
						{t('settingsPasskeysTitle')}
					</h3>
					<PasskeySettingsPanel />
				</div>
			</div>
		</div>
	);
}
