'use client';

import { useI18n } from '@/core/i18n';
import { ThemeAndAccentSection } from './appearance/ThemeAndAccentSection';
import { DisplaySoundDockSections } from './appearance/DisplaySoundDockSections';

/** Settings → Appearance: theme, accent colour, transparency and reduced motion. Every change applies at once. */
export function AppearancePanel() {
	const { t } = useI18n();

	return (
		<div data-focus-section="appearance" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsAppearanceTitle')}</h2>
				<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>{t('settingsAppearanceDesc')}</p>
			</div>

			<ThemeAndAccentSection />
			<DisplaySoundDockSections />
		</div>
	);
}
