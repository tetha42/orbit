import { TEAM_CATEGORIES } from './teams.ts';

/**
 * Team categories are a community-managed vocabulary, not a hard-coded enum.
 * `teams.kategori` keeps the selected string; removing a category never
 * rewrites existing teams, and their old value still appears in edit/filter
 * menus as a legacy option.
 */
export const TEAM_CATEGORIES_SETTINGS_KEY = 'team_categories';
export const TEAM_CATEGORY_MAX_LENGTH = 60;
export const TEAM_CATEGORY_MAX = 40;

export const DEFAULT_TEAM_CATEGORIES: readonly string[] = [...TEAM_CATEGORIES];

/** Old Turkish factory categories → their English replacements (one-time migration). */
export const LEGACY_TEAM_CATEGORY_MAP: Record<string, string> = {
	'Havacılık & İHA': 'Aviation & UAV',
	'Yapay Zeka': 'Artificial Intelligence',
	'Web & Mobil': 'Web & Mobile',
	'Siber Güvenlik': 'Cybersecurity',
	'Robotik & Gömülü': 'Robotics & Embedded',
	'Ar-Ge & Diğer': 'R&D & Other',
};

/** Merges stored categories with defaults, trims, de-duplicates and caps them. */
export function normalizeTeamCategories(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [...DEFAULT_TEAM_CATEGORIES];
	const seen = new Set<string>();
	const categories: string[] = [];
	for (const item of raw.slice(0, TEAM_CATEGORY_MAX)) {
		if (typeof item !== 'string') continue;
		const value = item.trim().replace(/\s+/g, ' ').slice(0, TEAM_CATEGORY_MAX_LENGTH);
		if (!value || /[<>\u0000-\u001f]/.test(value)) continue;
		const key = value.toLocaleLowerCase('tr');
		if (seen.has(key)) continue;
		seen.add(key);
		categories.push(value);
	}
	return categories.length > 0 ? categories : [...DEFAULT_TEAM_CATEGORIES];
}
