import type { Language } from './i18n';
import { authAndPasswordFeatureStrings } from './i18n/features/authAndPassword.ts';
import { formDesignerFeatureStrings } from './i18n/features/formDesigner.ts';
import { governanceFeatureStrings } from './i18n/features/governance.ts';
import { identityAndShellFeatureStrings } from './i18n/features/identityAndShell.ts';
import { legalFeatureStrings } from './i18n/features/legal.ts';
import { mediaAndStorageFeatureStrings } from './i18n/features/mediaAndStorage.ts';
import { registrationAndMembershipFeatureStrings } from './i18n/features/registrationAndMembership.ts';
import { settingsAndAppsFeatureStrings } from './i18n/features/settingsAndApps.ts';

export const FEATURE_TRANSLATIONS: Record<Language, Record<string, string>> = {
	tr: {
		...authAndPasswordFeatureStrings.tr,
		...formDesignerFeatureStrings.tr,
		...governanceFeatureStrings.tr,
		...identityAndShellFeatureStrings.tr,
		...legalFeatureStrings.tr,
		...mediaAndStorageFeatureStrings.tr,
		...registrationAndMembershipFeatureStrings.tr,
		...settingsAndAppsFeatureStrings.tr,
	},
	en: {
		...authAndPasswordFeatureStrings.en,
		...formDesignerFeatureStrings.en,
		...governanceFeatureStrings.en,
		...identityAndShellFeatureStrings.en,
		...legalFeatureStrings.en,
		...mediaAndStorageFeatureStrings.en,
		...registrationAndMembershipFeatureStrings.en,
		...settingsAndAppsFeatureStrings.en,
	},
};
