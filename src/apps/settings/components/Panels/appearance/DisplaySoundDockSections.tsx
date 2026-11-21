'use client';

import { Layout, SunMedium, Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { useSound } from '@/core/sound';
import { useWindowCycleSetting } from '@/core/windows';
import { AppearanceSwitch, appearanceSectionStyle } from './AppearancePrimitives';

export function DisplaySoundDockSections() {
	const { t } = useI18n();
	const { brightness, setBrightness, isDockAutoHide, toggleDockAutoHide } = useShell();
	const { isWindowCycleEnabled, setIsWindowCycleEnabled } = useWindowCycleSetting();
	const { volume, setVolume, isMuted, toggleMute, playSystemSound } = useSound();

	return (
		<>
			{/* Display & Brightness */}
			<div data-focus-section="display" style={appearanceSectionStyle}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<div>
						<div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
							<SunMedium size={16} /> {t('settingsBrightness')}
						</div>
						<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('settingsDisplayDesc')}</div>
					</div>
					<span style={{ fontSize: '13px', fontWeight: 700 }}>{brightness}%</span>
				</div>
				<input
					type="range"
					min="20"
					max="100"
					value={brightness}
					onChange={(e) => setBrightness(Number(e.target.value))}
					style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
				/>
			</div>

			{/* Sound & Effects */}
			<div data-focus-section="sound" style={appearanceSectionStyle}>
				<div>
					<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
						<span style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
							{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />} {t('settingsOutputVolume')}
						</span>
						<span style={{ fontSize: '13px', fontWeight: 700 }}>{isMuted ? 'Muted' : `${volume}%`}</span>
					</div>
					<input
						type="range"
						min="0"
						max="100"
						value={isMuted ? 0 : volume}
						onChange={(e) => {
							if (isMuted) toggleMute();
							setVolume(Number(e.target.value));
						}}
						style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
					/>
				</div>

				<div style={{ height: '1px', background: 'var(--window-border)' }} />

				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<button
						type="button"
						onClick={toggleMute}
						style={{
							background: 'var(--window-border)',
							padding: '6px 14px',
							borderRadius: '6px',
							fontSize: '13px',
							fontWeight: 600,
							color: 'inherit',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						{isMuted ? t('settingsUnmute') : t('settingsMute')}
					</button>

					<button
						type="button"
						onClick={playSystemSound}
						style={{
							background: 'var(--accent)',
							padding: '6px 14px',
							borderRadius: '6px',
							fontSize: '13px',
							fontWeight: 600,
							color: '#fff',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						{t('settingsTestSound')}
					</button>
				</div>
			</div>

			{/* Dock & Window Management */}
			<div style={appearanceSectionStyle}>
				<div>
					<h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
						<Layout size={16} /> {t('settingsDockTitle')}
					</h3>
					<p style={{ fontSize: '12.5px', opacity: 0.65, margin: '2px 0 0 0' }}>{t('settingsDockDesc')}</p>
				</div>

				<AppearanceSwitch
					name="dockAutoHide"
					label={t('settingsDockAutoHide')}
					desc={t('settingsDockAutoHideDesc')}
					checked={isDockAutoHide}
					onChange={toggleDockAutoHide}
				/>

				<div style={{ height: '1px', background: 'var(--card-border)' }} />

				<AppearanceSwitch
					name="windowCycle"
					label={t('settingsWindowCycleTitle')}
					desc={t('settingsWindowCycleDesc')}
					checked={isWindowCycleEnabled}
					onChange={setIsWindowCycleEnabled}
				/>
			</div>
		</>
	);
}
