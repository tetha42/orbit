'use client';

import { Volume2, VolumeX, SunMedium, Sparkles } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { useShell } from '@/core/shell';

export function ControlCenterSliders() {
	const { t } = useI18n();
	const { volume, setVolume, isMuted, toggleMute, playSystemSound, isAmbientSfxEnabled, toggleAmbientSfx } = useSound();
	const { brightness, setBrightness } = useShell();

	return (
		<>
			<div
				style={{
					background: 'var(--card-bg)',
					border: '1px solid var(--card-border)',
					borderRadius: '8px',
					padding: '10px 12px',
					display: 'flex',
					flexDirection: 'column',
					gap: '6px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
						<SunMedium size={14} />
						<span>{t('brightness')}</span>
					</div>
					<span style={{ opacity: 0.6, fontSize: '11px' }}>{brightness}%</span>
				</div>
				<input
					type="range"
					min={20}
					max={100}
					value={brightness}
					onChange={(e) => setBrightness(Number(e.target.value))}
					style={{ width: '100%', accentColor: 'var(--accent-blue)', height: '4px', cursor: 'pointer' }}
				/>
			</div>

			<div
				style={{
					background: 'var(--card-bg)',
					border: '1px solid var(--card-border)',
					borderRadius: '8px',
					padding: '10px 12px',
					display: 'flex',
					flexDirection: 'column',
					gap: '6px',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
					<div
						onClick={toggleMute}
						style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
						title={t('controlMuteToggle')}
					>
						{isMuted ? <VolumeX size={14} color="var(--danger)" /> : <Volume2 size={14} />}
						<span>{t('soundVolume')}</span>
					</div>
					<span style={{ opacity: 0.6, fontSize: '11px' }}>{isMuted ? t('muted') : `${volume}%`}</span>
				</div>
				<input
					type="range"
					min={0}
					max={100}
					disabled={isMuted}
					value={isMuted ? 0 : volume}
					onChange={(e) => {
						const val = Number(e.target.value);
						setVolume(val);
						playSystemSound();
					}}
					style={{
						width: '100%',
						accentColor: 'var(--accent-blue)',
						height: '4px',
						cursor: isMuted ? 'not-allowed' : 'pointer',
						opacity: isMuted ? 0.4 : 1,
					}}
				/>
			</div>

			<div
				onClick={toggleAmbientSfx}
				style={{
					background: isAmbientSfxEnabled && !isMuted ? 'color-mix(in srgb, var(--cyan) 15%, transparent)' : 'var(--card-bg)',
					border: isAmbientSfxEnabled && !isMuted ? '1px solid color-mix(in srgb, var(--cyan) 30%, transparent)' : '1px solid var(--card-border)',
					borderRadius: '8px',
					padding: '8px 12px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					cursor: 'pointer',
					transition: 'all 0.2s ease',
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 500 }}>
					<Sparkles size={14} color={isAmbientSfxEnabled && !isMuted ? 'var(--cyan)' : 'currentColor'} />
					<span>{t('ambientSound')}</span>
				</div>
				<span
					style={{
						fontSize: '11px',
						color: isAmbientSfxEnabled && !isMuted ? 'var(--cyan)' : 'inherit',
						opacity: isAmbientSfxEnabled && !isMuted ? 1 : 0.6,
					}}
				>
					{isAmbientSfxEnabled && !isMuted ? t('darkModeOn') : t('darkModeOff')}
				</span>
			</div>
		</>
	);
}
