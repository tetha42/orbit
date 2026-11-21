import { AppID, AppMetadata } from '@/types/workspace';
import { Language } from '@/lib/i18n';
import { ALL_WINDOW_MANIFESTS, DEFAULT_DOCK_ORDER, WINDOW_MANIFESTS } from '@/apps';

/**
 * What the desktop knows about each app, derived from the manifests under
 * src/apps/<id>/ — nothing is listed here. Every app is something a role
 * grants: a manifest without its `permission` does not compile (src/apps/index.ts).
 *
 * Who may open an app is the member's role (src/core/permissions), not a field here.
 */
export type ExtendedAppMetadata = AppMetadata;

export const ALL_APPS_CONFIG = Object.fromEntries(
	ALL_WINDOW_MANIFESTS.map((m): [AppID, ExtendedAppMetadata] => [
		m.id as AppID,
		{
			id: m.id as AppID,
			title: m.title,
			shortTitle: m.shortTitle,
			description: m.description,
			category: m.category,
			icon: m.icon,
			accentColor: m.accentColor,
			...(m.badge ? { badge: typeof m.badge === 'object' ? m.badge.en : m.badge } : {}),
			defaultWidth: m.window.width,
			defaultHeight: m.window.height,
			...(m.window.minWidth ? { minWidth: m.window.minWidth, minHeight: m.window.minHeight } : {}),
		},
	])
) as Record<AppID, ExtendedAppMetadata>;

const buildLocalizedAppMeta = (
	base: ExtendedAppMetadata,
	manifest: (typeof ALL_WINDOW_MANIFESTS)[number],
	lang: Language
): ExtendedAppMetadata => {
	const manifestByLang: Partial<Record<Language, typeof manifest.tr>> = {
		tr: manifest.tr,
		en: manifest.en,
	};
	const localized = manifestByLang[lang] ?? undefined;
	const badge = typeof manifest.badge === 'object' ? manifest.badge[lang] : manifest.badge;
	return {
		...base,
		...(localized
			? {
					title: localized.title,
					shortTitle: localized.shortTitle,
					description: localized.description,
			  }
			: {}),
		...(badge !== undefined ? { badge } : {}),
	};
};

const buildLangMap = (lang: Language): Record<AppID, ExtendedAppMetadata> =>
	Object.fromEntries(
		ALL_WINDOW_MANIFESTS.map((m) => [
			m.id as AppID,
			buildLocalizedAppMeta(ALL_APPS_CONFIG[m.id as AppID], m, lang),
		])
	) as Record<AppID, ExtendedAppMetadata>;

const LOCALIZED_APPS_CONFIG: Record<Language, Record<AppID, ExtendedAppMetadata>> = {
	tr: buildLangMap('tr'),
	en: buildLangMap('en'),
};

export function getAppMeta(appId: AppID, lang: Language = 'en'): ExtendedAppMetadata {
	return LOCALIZED_APPS_CONFIG[lang]?.[appId] ?? ALL_APPS_CONFIG[appId];
}

/** Launcher, dock, Spotlight and context menus only list user-facing apps. */
export const APPS_CONFIG = Object.fromEntries(
	WINDOW_MANIFESTS.map((m) => [m.id, ALL_APPS_CONFIG[m.id as AppID]])
) as Record<string, ExtendedAppMetadata>;

export const DEFAULT_DOCK_APPS: AppID[] = [...DEFAULT_DOCK_ORDER];
