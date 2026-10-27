'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { useWindowCycleSetting } from '@/core/windows';

export function DockSettingsPanel() {
	const { t } = useI18n();
	const { isDockAutoHide, toggleDockAutoHide } = useShell();
	const { isWindowCycleEnabled, setIsWindowCycleEnabled } = useWindowCycleSetting();

	return (
		<div data-focus-section="dock" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsDockTitle')}</h2>
				<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>
					{t('settingsDockDesc')}
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
				<label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
					<div>
						<div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('settingsDockAutoHide')}</div>
						<div style={{ fontSize: '12px', opacity: 0.65 }}>{t('settingsDockAutoHideDesc')}</div>
					</div>
					<input
						type="checkbox"
						checked={isDockAutoHide}
						onChange={toggleDockAutoHide}
						style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
					/>
				</label>

				<div style={{ height: '1px', background: 'var(--border-subtle)' }} />

				<label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
					<div>
						<div style={{ fontSize: '13.5px', fontWeight: 600 }}>{t('settingsWindowCycleTitle')}</div>
						<div style={{ fontSize: '12px', opacity: 0.65 }}>{t('settingsWindowCycleDesc')}</div>
					</div>
					<input
						type="checkbox"
						checked={isWindowCycleEnabled}
						onChange={(e) => setIsWindowCycleEnabled(e.target.checked)}
						style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
					/>
				</label>
			</div>
		</div>
	);
}
