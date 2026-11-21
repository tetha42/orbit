/**
 * Text helpers for search. Pure — no imports — so they run under plain Node
 * (`node scripts/check-pure.mjs`) as well as on the server and in the browser.
 */

/**
 * Folds text for accent- and case-insensitive matching, with Turkish case rules.
 *
 * Default `toLowerCase()` gets Turkish wrong: U+0130 (LATIN CAPITAL LETTER I WITH
 * DOT ABOVE) lowercases to "i" plus a combining dot, and "I" to "i" — but in Turkish
 * the capital "I" is U+0131 (LATIN SMALL LETTER DOTLESS I). Lowercasing with the
 * Turkish locale first fixes that, then diacritics are stripped from each accented
 * letter and U+0131 is folded to "i", so the upper-case, title-case, dotless
 * lower-case and dotted lower-case spellings of a name all find each other, and
 * an accent-free spelling finds the accented one.
 */
export function foldSearchText(input: string | null | undefined): string {
	if (!input) return '';
	return input
		.toLocaleLowerCase('tr')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/\u0131/g, 'i');
}

export const foldTr = foldSearchText;

export interface SearchField {
	text: string | null | undefined;
	/** How much a hit in this field is worth; a title outweighs a description. */
	weight: number;
}

/**
 * Scores a record against a query. 0 means no match.
 *
 * Every word of the query has to hit some field — a query with two words must
 * find a team whose name contains both, not one that contains only one. A word
 * scores 3× the field's weight when it starts a word in the field, 1× when it
 * only appears inside one, so "aut" ranks "Autonomous drone" above "Cauterize".
 */
export function scoreMatch(query: string, fields: SearchField[]): number {
	const terms = foldSearchText(query).split(/\s+/).filter(Boolean);
	if (terms.length === 0) return 0;

	const folded = fields.map((field) => {
		const text = foldSearchText(field.text);
		return { text, words: text.split(/[^a-z0-9]+/).filter(Boolean), weight: field.weight };
	});

	let total = 0;
	for (const term of terms) {
		let best = 0;
		for (const field of folded) {
			if (!field.text.includes(term)) continue;
			const startsWord = field.words.some((word) => word.startsWith(term));
			best = Math.max(best, (startsWord ? 3 : 1) * field.weight);
		}
		if (best === 0) return 0;
		total += best;
	}
	return total;
}

/** Fills `{name}` placeholders in a translated string: `fill('{n} days left', { n: 3 })`. Unknown names are left as they are. */
export function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

/**
 * "Autumn Term Python & Machine Learning" → "autumn-term-python-machine-learning".
 *
 * The ad-hoc `toLowerCase().replace(/[^a-z0-9]+/g, '-')` used before dropped every
 * non-ASCII letter and returned an empty string for a title made only of them;
 * folding first keeps the words.
 */
export function slugify(input: string, maxLength = 80): string {
	return foldSearchText(input)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, maxLength)
		.replace(/-+$/g, '');
}

/**
 * Finds a slug nobody uses yet: `base`, then `base-2`, `base-3`…
 * `taken` answers "is this slug in use?" — a database lookup in production.
 */
export async function uniqueSlug(
	base: string,
	taken: (candidate: string) => Promise<boolean>,
	fallback = 'registration'
): Promise<string> {
	const root = base || fallback;
	let candidate = root;
	for (let suffix = 2; await taken(candidate); suffix += 1) {
		candidate = `${root}-${suffix}`;
	}
	return candidate;
}
