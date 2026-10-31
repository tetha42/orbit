'use client';

import type { CSSProperties } from 'react';
import { Check, Monitor, Moon, Sun, SunMedium, Volume2, VolumeX, Layout, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ACCENTS, THEME_MODES, useTheme, type ThemeMode } from '@/core/theme';
import { useShell } from '@/core/shell';
import { useSound } from '@/core/sound';
import { useWindowCycleSetting } from '@/core/windows';

const MODE_ICONS: Record<ThemeMode, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

// A miniature window per mode; "system" shows both halves. The colours are the point here, so they stay fixed.
const PREVIEW: Record<'light' | 'dark', { bg: string; border: string; bar: string; line1: string; line2: string }> = {
	light: { bg: '#f2f2f7', border: '#d1d1d6', bar: 'var(--accent)', line1: '#c7c7cc', line2: '#e5e5ea' },
	dark: { bg: '#1c1c1e', border: '#38383a', bar: 'var(--accent)', line1: '#48484a', line2: '#2c2c2e' },
};

function Miniature({ mode }: { mode: 'light' | 'dark' }) {
	const p = PREVIEW[mode];
	return (
		<div style={{ flex: 1, height: '100%', background: p.bg, display: 'flex', flexDirection: 'column', padding: '6px', gap: '4px' }}>
			<div style={{ height: '8px', width: '40%', background: p.bar, borderRadius: '4px' }} />
			<div style={{ height: '6px', width: '80%', background: p.line1, borderRadius: '3px' }} />
			<div style={{ height: '6px', width: '60%', background: p.line2, borderRadius: '3px' }} />
		</div>
	);
}

function Switch({ name, label, desc, checked, onChange }: { name: string; label: string; desc: string; checked: boolean; onChange: (on: boolean) => void }) {
	return (
		<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
			<div>
				<div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
				<div style={{ fontSize: '12px', opacity: 0.6 }}>{desc}</div>
			</div>
			<button
				role="switch"
				data-setting={name}
				aria-checked={checked}
				aria-label={label}
				onClick={() => onChange(!checked)}
				style={{
					flexShrink: 0,
					width: '46px',
					height: '26px',
					borderRadius: '13px',
					background: checked ? 'var(--accent)' : 'var(--input-border)',
					position: 'relative',
					cursor: 'pointer',
					transition: 'background 200ms ease',
					padding: '2px',
				}}
			>
				<div
					style={{
						width: '22px',
						height: '22px',
						borderRadius: '50%',
						background: '#ffffff',
						boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
						transform: checked ? 'translateX(20px)' : 'translateX(0px)',
						transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
					}}
				/>
			</button>
		</div>
	);
}

const sectionStyle: CSSProperties = {
	background: 'var(--card-bg)',
	border: '1px solid var(--card-border)',
	borderRadius: '12px',
	padding: '16px 18px',
	display: 'flex',
	flexDirection: 'column',
	gap: '14px',
};

/** Settings → Appearance: theme, accent colour, transparency and reduced motion. Every change applies at once. */
export function AppearancePanel() {
	const { t } = useI18n();
	const { theme, accent, transparency, reduceMotion, setTheme, setAccent, setTransparency, setReduceMotion } = useTheme();
	const { brightness, setBrightness, isDockAutoHide, toggleDockAutoHide } = useShell();
	const { isWindowCycleEnabled, setIsWindowCycleEnabled } = useWindowCycleSetting();
	const { volume, setVolume, isMuted, toggleMute, playSystemSound } = useSound();
	const modeLabels: Record<ThemeMode, string> = { light: t('settingsThemeLight'), dark: t('settingsThemeDark'), system: t('settingsThemeSystem') };

	return (
		<div data-focus-section="appearance" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsAppearanceTitle')}</h2>
				<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>{t('settingsAppearanceDesc')}</p>
			</div>

			<div role="group" aria-label={t('settingsThemeMode')} style={{ display: 'flex', gap: '12px' }}>
				{THEME_MODES.map((mode) => {
					const Icon = MODE_ICONS[mode];
					const selected = theme === mode;
					return (
						<button
							key={mode}
							data-theme-option={mode}
							aria-pressed={selected}
							onClick={() => setTheme(mode)}
							style={{
								flex: 1,
								padding: '14px',
								borderRadius: '12px',
								border: selected ? '2.5px solid var(--accent)' : '1px solid var(--window-border)',
								background: 'var(--card-bg)',
								color: 'inherit',
								cursor: 'pointer',
								boxShadow: selected ? '0 0 0 2px var(--accent-muted)' : 'none',
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'center',
								gap: '10px',
							}}
						>
							<div style={{ width: '100%', height: '70px', borderRadius: '8px', border: '1px solid var(--window-border)', overflow: 'hidden', display: 'flex' }}>
								{mode !== 'dark' && <Miniature mode="light" />}
								{mode !== 'light' && <Miniature mode="dark" />}
							</div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
								<Icon size={15} />
								<span>{modeLabels[mode]}</span>
							</div>
						</button>
					);
				})}
			</div>

			<div style={sectionStyle}>
				<div>
					<div style={{ fontSize: '14px', fontWeight: 600 }}>{t('settingsAccent')}</div>
					<div style={{ fontSize: '12px', opacity: 0.6 }}>{t('settingsAccentDesc')}</div>
				</div>
				<div role="group" aria-label={t('settingsAccent')} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
					{ACCENTS.map((id) => {
						const selected = accent === id;
						return (
							<button
								key={id}
								// data-accent on the swatch makes --accent resolve to this colour inside it.
								data-accent={id}
								data-accent-option={id}
								aria-pressed={selected}
								aria-label={t(`settingsAccent_${id}`)}
								title={t(`settingsAccent_${id}`)}
								onClick={() => setAccent(id)}
								style={{
									width: '30px',
									height: '30px',
									borderRadius: '50%',
									background: 'var(--accent)',
									color: 'var(--accent-contrast)',
									display: 'grid',
									placeItems: 'center',
									cursor: 'pointer',
									border: '2px solid var(--card-bg)',
									boxShadow: selected ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--window-border)',
								}}
							>
								{selected && <Check size={15} strokeWidth={3} />}
							</button>
						);
					})}
				</div>
			</div>

			<div style={sectionStyle}>
				<Switch name="transparency" label={t('settingsTransparency')} desc={t('settingsTransparencyDesc')} checked={transparency} onChange={setTransparency} />
				<div style={{ height: '1px', background: 'var(--window-border)' }} />
				<Switch name="reduce-motion" label={t('settingsReduceMotion')} desc={t('settingsReduceMotionDesc')} checked={reduceMotion} onChange={setReduceMotion} />
			</div>

			{/* Display & Brightness */}
			<div data-focus-section="display" style={sectionStyle}>
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

			{/* Ses ve Efektler */}
			<div data-focus-section="sound" style={sectionStyle}>
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
			<div style={sectionStyle}>
				<div>
					<h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
						<Layout size={16} /> {t('settingsDockTitle')}
					</h3>
					<p style={{ fontSize: '12.5px', opacity: 0.65, margin: '2px 0 0 0' }}>{t('settingsDockDesc')}</p>
				</div>

				<Switch
					name="dockAutoHide"
					label={t('settingsDockAutoHide')}
					desc={t('settingsDockAutoHideDesc')}
					checked={isDockAutoHide}
					onChange={toggleDockAutoHide}
				/>

				<div style={{ height: '1px', background: 'var(--card-border)' }} />

				<Switch
					name="windowCycle"
					label={t('settingsWindowCycleTitle')}
					desc={t('settingsWindowCycleDesc')}
					checked={isWindowCycleEnabled}
					onChange={setIsWindowCycleEnabled}
				/>
			</div>
		</div>
	);
}
