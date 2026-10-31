/**
 * Project showcase vocabulary and input rules, shared by the API and the app.
 *
 * Kept free of imports so `scripts/check-pure.mjs` can load it directly.
 */

/**
 * `oneri`: proposed by a member, visible to them and to management only.
 * `yayinda`: in the showcase for every member. `arsiv`: kept, but out of the way.
 */
export const PROJECT_STATUSES = ['oneri', 'yayinda', 'arsiv'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_TITLE_MAX = 120;
export const PROJECT_SUMMARY_MAX = 280;
export const PROJECT_DESCRIPTION_MAX = 6000;
export const TEKNOLOJI_MAX = 24;
export const TEKNOLOJI_SAYISI_MAX = 12;

export function isProjectStatus(value: unknown): value is ProjectStatus {
	return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}

/**
 * An http(s) URL with a host, normalised; `null` for an empty value and
 * `undefined` for anything else (javascript:, ftp:, garbage). Used for repo and
 * demo links, which end up in `href`s.
 */
export function normalizeHttpUrl(value: unknown): string | null | undefined {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') return undefined;
	const raw = value.trim();
	if (!raw) return null;
	try {
		const url = new URL(raw);
		if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname.includes('.')) return undefined;
		return url.toString();
	} catch {
		return undefined;
	}
}

/**
 * Technologies: accepts an array or a comma-separated string, keeps the author's
 * casing ("Next.js", "ROS2"), trims, caps length and count, drops case-insensitive
 * duplicates. `null` when the input is neither a string nor an array of strings.
 */
export function normalizeTeknolojiler(value: unknown): string[] | null {
	const items = typeof value === 'string' ? value.split(',') : value;
	if (!Array.isArray(items)) return null;
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of items) {
		if (typeof raw !== 'string') return null;
		const tech = raw.trim().replace(/\s+/g, ' ').slice(0, TEKNOLOJI_MAX);
		const key = tech.toLocaleLowerCase('tr-TR');
		if (tech && !seen.has(key)) {
			seen.add(key);
			out.push(tech);
		}
		if (out.length === TEKNOLOJI_SAYISI_MAX) break;
	}
	return out;
}

/** "github.com/beuteknoloji/portal" — a repo URL without the noise, for display. */
export function shortRepo(url: string | null | undefined): string {
	if (!url) return '';
	try {
		const u = new URL(url);
		return (u.hostname.replace(/^www\./, '') + u.pathname).replace(/\/+$/, '');
	} catch {
		return url;
	}
}
