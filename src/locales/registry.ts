import type { Language } from '@/lib/i18n';

export interface LocaleDefinition {
	code: string;
	name: string;
	nativeName: string;
	dir: 'ltr' | 'rtl';
	dateLocale: string;
}

export const DEFAULT_LOCALE: Language = 'en';

export const LOCALE_REGISTRY: readonly LocaleDefinition[] = [
	{
		code: 'en',
		name: 'English',
		nativeName: 'English',
		dir: 'ltr',
		dateLocale: 'en-US',
	},
	{
		code: 'tr',
		name: 'Turkish',
		nativeName: 'Türkçe',
		dir: 'ltr',
		dateLocale: 'tr-TR',
	},
] as const;

export function isSupportedLocale(code: unknown): code is Language {
	return (
		typeof code === 'string' &&
		LOCALE_REGISTRY.some((locale) => locale.code === code)
	);
}

export function getLocaleDefinition(code: string): LocaleDefinition {
	return (
		LOCALE_REGISTRY.find((locale) => locale.code === code) ??
		LOCALE_REGISTRY.find((locale) => locale.code === DEFAULT_LOCALE) ??
		LOCALE_REGISTRY[0]
	);
}

export function getNextLocale(currentCode: string): Language {
	const index = LOCALE_REGISTRY.findIndex((locale) => locale.code === currentCode);
	const nextIndex = index === -1 ? 0 : (index + 1) % LOCALE_REGISTRY.length;
	return LOCALE_REGISTRY[nextIndex].code as Language;
}

/**
 * Resolves a localized string from a `{ [locale]: string }` map (such as a JSONB
 * `translations` column or an inline locale dictionary), falling back to
 * `DEFAULT_LOCALE` ('en'), then the first non-empty locale entry, and finally `fallback`.
 */
export function resolveLocalizedText(
	translations: Record<string, string | undefined> | null | undefined,
	locale: string,
	fallback = ''
): string {
	if (!translations || typeof translations !== 'object') {
		return fallback;
	}
	const direct = translations[locale];
	if (typeof direct === 'string' && direct.length > 0) {
		return direct;
	}
	const defaultVal = translations[DEFAULT_LOCALE];
	if (typeof defaultVal === 'string' && defaultVal.length > 0) {
		return defaultVal;
	}
	for (const val of Object.values(translations)) {
		if (typeof val === 'string' && val.length > 0) {
			return val;
		}
	}
	return fallback;
}

/**
 * Resolves a structured localized record from a `{ [locale]: T }` JSONB map,
 * falling back to `DEFAULT_LOCALE` ('en') and then the first available locale entry.
 */
export function resolveLocalizedRecord<T extends Record<string, string>>(
	translations: Record<string, T> | null | undefined,
	locale: string
): T | undefined {
	if (!translations || typeof translations !== 'object') {
		return undefined;
	}
	if (translations[locale] !== undefined) {
		return translations[locale];
	}
	if (translations[DEFAULT_LOCALE] !== undefined) {
		return translations[DEFAULT_LOCALE];
	}
	const firstKey = Object.keys(translations)[0];
	return firstKey !== undefined ? translations[firstKey] : undefined;
}
