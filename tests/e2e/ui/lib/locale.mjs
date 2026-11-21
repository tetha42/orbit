// Tests drive the Turkish interface without hard-coding its wording: they ask the
// same translation catalog the app uses. That keeps Turkish text in the i18n files
// (where it belongs) and leaves the suites language-neutral.
import { TRANSLATIONS } from '../../../../src/lib/i18n.ts';

function resolve(language, key, vars) {
	const text = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
	if (!vars) return text;
	return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])));
}

/** The Turkish text for a catalog key (the suite UI locale). */
export const tr = (key, vars) => resolve('tr', key, vars);
/** The Turkish text for a catalog key, with `{name}` placeholders filled. */
export const trf = (key, vars) => resolve('tr', key, vars);
/** The English text for a catalog key. */
export const en = (key, vars) => resolve('en', key, vars);
