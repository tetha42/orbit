// Every string in TRANSLATIONS (i18n.ts + i18nExtra.ts) must exist in both languages.
//
//   node scripts/check-i18n.mjs
//
import { TRANSLATIONS } from '../src/lib/i18n.ts';

const tr = new Set(Object.keys(TRANSLATIONS.tr));
const en = new Set(Object.keys(TRANSLATIONS.en));

const missingInEn = [...tr].filter((key) => !en.has(key));
const missingInTr = [...en].filter((key) => !tr.has(key));
const empty = [...tr, ...en].filter(
	(key) => !TRANSLATIONS.tr[key]?.trim() && !TRANSLATIONS.en[key]?.trim()
);

if (missingInEn.length || missingInTr.length || empty.length) {
	if (missingInEn.length) console.error('Missing in en:', missingInEn.join(', '));
	if (missingInTr.length) console.error('Missing in tr:', missingInTr.join(', '));
	if (empty.length) console.error('Empty in both languages:', empty.join(', '));
	process.exit(1);
}

console.log(`check-i18n: ${tr.size} keys in TRANSLATIONS, tr and en match perfectly`);
