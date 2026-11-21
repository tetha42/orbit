'use client';

import { Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ACCENTS, THEME_MODES, useTheme, type ThemeMode } from '@/core/theme';
import {
	AppearanceSwitch,
	MODE_ICONS,
	Miniature,
	appearanceSectionStyle,
} from './AppearancePrimitives';

export function ThemeAndAccentSection() {
	const { t } = useI18n();
	const { theme, accent, transparency, reduceMotion, setTheme, setAccent, setTransparency, setReduceMotion } = useTheme();
	const modeLabels: Record<ThemeMode, string> = {
		light: t('settingsThemeLight'),
		dark: t('settingsThemeDark'),
		system: t('settingsThemeSystem'),
	};

	return (
		<>
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

			<div style={appearanceSectionStyle}>
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

			<div style={appearanceSectionStyle}>
				<AppearanceSwitch
					name="transparency"
					label={t('settingsTransparency')}
					desc={t('settingsTransparencyDesc')}
					checked={transparency}
					onChange={setTransparency}
				/>
				<div style={{ height: '1px', background: 'var(--window-border)' }} />
				<AppearanceSwitch
					name="reduce-motion"
					label={t('settingsReduceMotion')}
					desc={t('settingsReduceMotionDesc')}
					checked={reduceMotion}
					onChange={setReduceMotion}
				/>
			</div>
		</>
	);
}
