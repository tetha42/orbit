import { TRANSLATIONS, type Language } from '@/lib/i18n';
import { fill } from '@/lib/text';

export function formatAlertTemplate(
	language: Language,
	key: string,
	vars: Record<string, string | number> = {}
): string {
	const dict = TRANSLATIONS[language] ?? TRANSLATIONS.en;
	return fill(dict[key] || TRANSLATIONS.en[key] || key, vars);
}

export function replaceLocalizedAlertTerm(text: string, language: Language, key: string): string {
	const target = formatAlertTemplate(language, key);
	const variants = [TRANSLATIONS.tr[key], TRANSLATIONS.en[key]].filter(
		(variant): variant is string => Boolean(variant && variant !== target)
	);
	let next = text;
	for (const source of variants) {
		if (next.includes(source)) {
			next = next.replace(source, target);
		}
	}
	return next;
}

type AlertMatchMode = 'startsWith' | 'includes';

/**
 * Whether the stored alert still uses the text from either catalog (historical
 * records were written in Turkish before the English migration).
 */
function matchesAlertTerm(trimmed: string, key: string, mode: AlertMatchMode): boolean {
	const matches = (text: string) => (mode === 'startsWith' ? trimmed.startsWith(text) : trimmed.includes(text));
	return matches(formatAlertTemplate('tr', key)) || matches(formatAlertTemplate('en', key));
}

export function formatSessionAndCsrfAlert(trimmed: string, language: Language): string | null {
	if (
		matchesAlertTerm(trimmed, 'socAlertPrivateIdorRead', 'startsWith') ||
		matchesAlertTerm(trimmed, 'socAlertPrivateIdorWrite', 'startsWith')
	) {
		let next = replaceLocalizedAlertTerm(trimmed, language, 'socAlertPrivateIdorRead');
		next = replaceLocalizedAlertTerm(next, language, 'socAlertPrivateIdorWrite');
		return next;
	}

	if (matchesAlertTerm(trimmed, 'socAlertCsrfBlocked', 'includes')) {
		return replaceLocalizedAlertTerm(trimmed, language, 'socAlertCsrfBlocked');
	}

	if (matchesAlertTerm(trimmed, 'socAlertSessionHijack', 'includes')) {
		return replaceLocalizedAlertTerm(trimmed, language, 'socAlertSessionHijack');
	}

	if (matchesAlertTerm(trimmed, 'socAlertInvalidSessionToken', 'includes')) {
		return replaceLocalizedAlertTerm(trimmed, language, 'socAlertInvalidSessionToken');
	}

	if (matchesAlertTerm(trimmed, 'socAlertForcedTerminate', 'startsWith')) {
		return replaceLocalizedAlertTerm(trimmed, language, 'socAlertForcedTerminate');
	}

	if (matchesAlertTerm(trimmed, 'socAlertKillSwitchPrefix', 'includes')) {
		let next = replaceLocalizedAlertTerm(trimmed, language, 'socAlertKillSwitchPrefix');
		next = replaceLocalizedAlertTerm(next, language, 'socAlertKillSwitchSuffix');
		return next;
	}

	if (matchesAlertTerm(trimmed, 'socAlertMassTerminatePrefix', 'includes')) {
		let next = replaceLocalizedAlertTerm(trimmed, language, 'socAlertMassTerminatePrefix');
		next = replaceLocalizedAlertTerm(next, language, 'socAlertMassTerminateMid');
		next = replaceLocalizedAlertTerm(next, language, 'socAlertMassTerminateSuffix');
		return next;
	}

	return null;
}
