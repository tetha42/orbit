export { I18nProvider, useI18n } from './I18nProvider';
export type { I18nContextValue } from './I18nProvider';
export {
	LOCALE_REGISTRY,
	DEFAULT_LOCALE,
	isSupportedLocale,
	normalizeLocale,
	getLocaleDefinition,
	getNextLocale,
	resolveLocalizedText,
	resolveLocalizedRecord,
} from '@/locales/registry';
export type { LocaleDefinition } from '@/locales/registry';
