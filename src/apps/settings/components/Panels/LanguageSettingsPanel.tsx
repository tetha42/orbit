'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Language } from '@/lib/i18n';

export function LanguageSettingsPanel() {
	const { language, setLanguage, t } = useI18n();

	const languages: { id: Language; label: string; sublabel: string; flag: string }[] = [
		{ id: 'tr', label: 'Türkçe', sublabel: t('settingsLangDefaultSystemLang'), flag: '🇹🇷' },
		{ id: 'en', label: 'English', sublabel: 'United States', flag: '🇬🇧' },
	];

	return (
		<div data-focus-section="language" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
			<div>
				<h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('settingsLangTitle')}</h2>
				<p style={{ fontSize: '13px', opacity: 0.65, margin: '3px 0 0 0' }}>
					{t('settingsLangDesc')}
				</p>
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
					gap: '14px',
				}}
			>
				{languages.map((lang) => {
					const isSelected = language === lang.id;
					return (
						<button
							key={lang.id}
							type="button"
							onClick={() => setLanguage(lang.id)}
							aria-pressed={isSelected}
							style={{
								display: 'flex',
								flexDirection: 'column',
								alignItems: 'flex-start',
								gap: '12px',
								padding: '16px 18px',
								borderRadius: '12px',
								background: isSelected ? 'var(--accent-subtle, rgba(0, 122, 255, 0.12))' : 'var(--card-bg)',
								border: isSelected ? '2px solid var(--accent)' : '1px solid var(--window-border)',
								boxShadow: isSelected ? '0 0 0 2px var(--accent-muted)' : 'none',
								color: 'inherit',
								cursor: 'pointer',
								textAlign: 'left',
								transition: 'all 160ms ease',
								position: 'relative',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
								<span style={{ fontSize: '32px', lineHeight: 1 }}>{lang.flag}</span>
								{isSelected && (
									<div
										style={{
											width: '22px',
											height: '22px',
											borderRadius: '50%',
											background: 'var(--accent)',
											color: '#fff',
											display: 'grid',
											placeItems: 'center',
										}}
									>
										<Check size={14} strokeWidth={3} />
									</div>
								)}
							</div>
							<div>
								<div style={{ fontSize: '15px', fontWeight: 700 }}>{lang.label}</div>
								<div style={{ fontSize: '12px', opacity: 0.65, marginTop: '2px' }}>{lang.sublabel}</div>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
