import { commonCoreStrings } from './i18n/core/common.ts';
import { desktopMenusCoreStrings } from './i18n/core/desktopMenus.ts';
import { eventsAndNotesCoreStrings } from './i18n/core/eventsAndNotes.ts';
import { operationsCoreStrings } from './i18n/core/operations.ts';
import { peopleAndTeamsCoreStrings } from './i18n/core/peopleAndTeams.ts';
import { shellChromeCoreStrings } from './i18n/core/shellChrome.ts';
import { EXTRA_TRANSLATIONS } from './i18nExtra.ts';
import { FEATURE_TRANSLATIONS } from './i18nFeatures.ts';
import { APP_TRANSLATIONS } from './i18nApps.ts';
import { DOMAIN_TRANSLATIONS } from './i18n/domains.gen.ts';

export type Language = 'tr' | 'en';

export type TranslationKey = string;

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
	tr: {
		...commonCoreStrings.tr,
		...desktopMenusCoreStrings.tr,
		...eventsAndNotesCoreStrings.tr,
		...operationsCoreStrings.tr,
		...peopleAndTeamsCoreStrings.tr,
		...shellChromeCoreStrings.tr,
	},
	en: {
		...commonCoreStrings.en,
		...desktopMenusCoreStrings.en,
		...eventsAndNotesCoreStrings.en,
		...operationsCoreStrings.en,
		...peopleAndTeamsCoreStrings.en,
		...shellChromeCoreStrings.en,
	},
};

for (const language of ['tr', 'en'] as const) {
	Object.assign(
		TRANSLATIONS[language],
		EXTRA_TRANSLATIONS[language],
		FEATURE_TRANSLATIONS[language],
		APP_TRANSLATIONS[language],
		DOMAIN_TRANSLATIONS[language]
	);
}

export function translate(language: Language, key: string, fallback?: string): string {
	return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || fallback || key;
}
