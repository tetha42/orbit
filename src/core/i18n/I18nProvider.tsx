'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppID } from '@/types/workspace';
import { ExtendedAppMetadata, getAppMeta as getAppMetaConfig } from '@/configs/apps.config';
import { Language, TRANSLATIONS } from '@/lib/i18n';
import { DEFAULT_LOCALE, getLocaleDefinition, isSupportedLocale, normalizeLocale } from '@/locales/registry';

export interface I18nContextValue {
	language: Language;
	setLanguage: (lang: Language) => void;
	/** The text for `key` in the member's language (English when a translation is missing, then `fallback`, then the key). */
	t: (key: string, fallback?: string) => string;
	/** An app's title, short title and description in the member's language. */
	getAppMeta: (appId: AppID) => ExtendedAppMetadata;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** The interface language, remembered in localStorage under `orbit_locale`, and `t()`. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
	const [language, setLanguageState] = useState<Language>(() => {
		if (typeof window !== 'undefined') {
			try {
				const stored = localStorage.getItem('orbit_locale');
				if (isSupportedLocale(stored)) {
					return stored;
				}
			} catch {
				// Storage blocked (private window): default to DEFAULT_LOCALE.
			}
		}
		return DEFAULT_LOCALE;
	});

	const setLanguage = useCallback((lang: Language) => {
		const nextLang = normalizeLocale(lang, DEFAULT_LOCALE);
		setLanguageState(nextLang);
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('orbit_locale', nextLang);
			} catch {
				// Storage blocked: the choice holds until the page closes.
			}
		}
	}, []);

	const getAppMeta = useCallback(
		(appId: AppID): ExtendedAppMetadata => {
			return getAppMetaConfig(appId, language);
		},
		[language]
	);

	const t = useCallback(
		(key: string, fallback?: string): string => {
			const dict = TRANSLATIONS[language];
			if (dict && dict[key]) return dict[key];
			const defaultDict = TRANSLATIONS[DEFAULT_LOCALE];
			if (defaultDict && defaultDict[key]) return defaultDict[key];
			return fallback || key;
		},
		[language]
	);

	useEffect(() => {
		if (typeof document !== 'undefined') {
			const def = getLocaleDefinition(language);
			document.documentElement.setAttribute('lang', def.code);
			document.documentElement.setAttribute('dir', def.dir);
		}
	}, [language]);

	const value = useMemo<I18nContextValue>(() => ({ language, setLanguage, t, getAppMeta }), [language, setLanguage, t, getAppMeta]);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The interface language and `t()` — `const { t, language } = useI18n()`. */
export function useI18n(): I18nContextValue {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error('useI18n must be used within a WorkspaceProvider');
	return ctx;
}
