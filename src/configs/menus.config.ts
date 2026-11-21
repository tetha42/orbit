import { AppID, MenuCategory, MenuItem } from '@/types/workspace';
import { Language } from '@/lib/i18n';
import { WINDOW_MANIFESTS } from '@/apps';
import type { AppMenuItem, L10n } from '@/core/apps/manifest';
import { PORTAL_DICTS, PORTAL_EN, PORTAL_MENUS, PORTAL_TR } from '../lib/i18n/data/portalMenusData';

const shared = (id: string, shortcut?: string): AppMenuItem => ({
	id,
	label: { tr: PORTAL_TR[id], en: PORTAL_EN[id] },
	...(shortcut ? { shortcut } : {}),
});

const sharedWindowItems = (lang: Language): MenuItem[] => {
	const dict = PORTAL_DICTS[lang];
	return [
		{ id: 'sep-shared-window', label: '', separator: true },
		{ id: 'hide-others', label: dict['hide-others'], shortcut: '⌥⌘H' },
		{ id: 'tile-windows', label: dict['tile-windows'], shortcut: '⌃⌘T' },
		{ id: 'reset-layout', label: dict['reset-layout'] },
		{ id: 'bring-all-front', label: dict['bring-all-front'] },
	];
};

function withSharedWindowItems(appId: string, cat: MenuCategory, lang: Language): MenuCategory {
	if (appId === 'portal' || cat.id !== 'window') return cat;
	const have = new Set((cat.items || []).map((i) => i.id));
	const extra = sharedWindowItems(lang).filter((i) => i.separator || !have.has(i.id));
	return extra.length > 1 ? { ...cat, items: [...(cat.items || []), ...extra] } : cat;
}

const separator = (id: string): MenuItem => ({ id, label: '', separator: true });

function toMenuItem(appId: AppID, item: AppMenuItem, lang: Language): MenuItem {
	return {
		id: item.id,
		label: item.label[lang],
		...(item.shortcut ? { shortcut: item.shortcut } : {}),
		...(item.permission ? { needs: { appId, level: item.permission } } : {}),
		...(item.command ? { command: { appId, name: item.command } } : {}),
		...(item.open ? { opens: appId } : {}),
	};
}

function appMenus(appId: AppID, lang: Language): MenuCategory[] | null {
	const menu = WINDOW_MANIFESTS.find((m) => m.id === appId)?.menu;
	if (!menu?.about) return null;
	const text = (l: L10n) => l[lang];
	const extraDefault = menu.defaultItems
		? [...menu.defaultItems.map((i) => toMenuItem(appId, i, lang)), separator('sep2')]
		: [];
	return [
		{
			id: 'default',
			title: text(menu.title),
			items: [
				toMenuItem(appId, menu.about, lang),
				separator('sep1'),
				...extraDefault,
				toMenuItem(appId, shared('close', '⌘W'), lang),
			],
		},
		...(menu.categories ?? []).map((cat) => ({
			id: cat.id,
			title: text(cat.title),
			items: cat.items.map((i) => toMenuItem(appId, i, lang)),
		})),
		{
			id: 'window',
			title: PORTAL_DICTS[lang]['cat:portal:window'],
			items: [
				toMenuItem(appId, shared('minimize', '⌘M'), lang),
				toMenuItem(appId, shared('zoom'), lang),
				toMenuItem(appId, shared('close', '⌘W'), lang),
			],
		},
	];
}

function portalMenus(appId: string, lang: Language): MenuCategory[] {
	const dict = PORTAL_DICTS[lang];
	const ownTitle = WINDOW_MANIFESTS.find((m) => m.id === appId)?.menu?.title;
	return PORTAL_MENUS.map((cat) => ({
		...cat,
		title:
			(cat.id === 'default' && ownTitle ? ownTitle[lang] : undefined) ??
			dict[`cat:portal:${cat.id}`] ??
			cat.title,
		items: cat.items.map((item) =>
			item.separator ? item : { ...item, label: dict[item.id] ?? item.label }
		),
	}));
}

export function getGlobalMenus(appId: string, lang: Language = 'tr'): MenuCategory[] {
	const own = appMenus(appId as AppID, lang);
	return (own ?? portalMenus(appId, lang)).map((cat) => withSharedWindowItems(appId, cat, lang));
}
