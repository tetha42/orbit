import { AppID, AppMetadata } from '@/types/workspace';
import { Language } from '@/lib/i18n';
import { DEFAULT_DOCK_ORDER, WINDOW_MANIFESTS } from '@/apps';

/**
 * What the desktop knows about each app, derived from the manifests under
 * src/apps/<id>/ — nothing is listed here. Every app is something a role
 * grants: a manifest without its `permission` does not compile (src/apps/index.ts).
 *
 * Who may open an app is the member's role (src/core/permissions), not a field here.
 */
export type ExtendedAppMetadata = AppMetadata;

export function getAppMeta(appId: AppID, lang: Language = 'en'): ExtendedAppMetadata {
	const base = APPS_CONFIG[appId];
	const manifest = WINDOW_MANIFESTS.find((m) => m.id === appId);
	if (!base || !manifest) return base;
	const localized = lang === 'tr' ? (manifest.tr ?? undefined) : (lang === 'en' ? manifest.en : undefined);
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
}

export const APPS_CONFIG = Object.fromEntries(
	WINDOW_MANIFESTS.map((m): [AppID, ExtendedAppMetadata] => [
		m.id as AppID,
		{
			id: m.id as AppID,
			title: m.title,
			shortTitle: m.shortTitle,
			description: m.description,
			category: m.category,
			icon: m.icon,
			accentColor: m.accentColor,
			...(m.badge ? { badge: typeof m.badge === 'object' ? m.badge.tr : m.badge } : {}),
			defaultWidth: m.window.width,
			defaultHeight: m.window.height,
			...(m.window.minWidth ? { minWidth: m.window.minWidth, minHeight: m.window.minHeight } : {}),
		},
	])
) as Record<AppID, ExtendedAppMetadata>;

export const DEFAULT_DOCK_APPS: AppID[] = [...DEFAULT_DOCK_ORDER];
