import { AppID, MenuCategory, MenuItem } from '@/types/workspace';
import { Language } from '@/lib/i18n';
import { WINDOW_MANIFESTS } from '@/apps';
import type { AppMenuItem, L10n } from '@/core/apps/manifest';

/**
 * The menu bar's menus. The portal's own are listed here; every app's menus
 * come from its manifest (src/apps/<id>/manifest.ts → `menu`), so adding an app
 * adds its menus without touching this file.
 *
 * What an item does — and the level it needs — travels with the item
 * (`needs`, `command`, `opens`); the menu bar binds the few special actions
 * (About, Close, Export…) by id.
 */
const PORTAL_MENUS: MenuCategory[] = [
	{
		id: 'default',
		title: 'Kulüp Portali',
		items: [
			{ id: 'about-portal', label: 'Kulüp Portali Hakkında', shortcut: '⌘I' },
			{ id: 'preferences', label: 'Sistem Tercihleri...', shortcut: '⌘,' },
			{ id: 'sep1', label: '', separator: true },
			{ id: 'refresh-data', label: 'Tüm Verileri Yenile' },
			{ id: 'sep2', label: '', separator: true },
			{ id: 'hide', label: 'Portali Gizle', shortcut: '⌘H' },
			{ id: 'hide-others', label: 'Diğerlerini Gizle', shortcut: '⌥⌘H' },
		],
	},
	{
		id: 'file',
		title: 'Dosya',
		items: [
			{ id: 'new-event', label: 'Yeni CommunityEvent...', shortcut: '⌘N', needs: { appId: 'events', level: 'yonet' }, command: { appId: 'events', name: 'new-event' } },
			{ id: 'new-member', label: 'Yeni Üye Kaydı...', shortcut: '⇧⌘N', needs: { appId: 'members', level: 'yonet' }, command: { appId: 'members', name: 'add-member' } },
			{ id: 'new-budget-entry', label: 'Yeni Gelir / Gider Girişi...', shortcut: '⌥⌘N', needs: { appId: 'budget', level: 'yonet' }, command: { appId: 'budget', name: 'new-entry' } },
			{ id: 'sep1', label: '', separator: true },
			{ id: 'export-report', label: 'Yönetim Faaliyet Raporunu Al', shortcut: '⌘E', needs: { appId: 'members', level: 'yonet' } },
		],
	},
	{
		id: 'edit',
		title: 'Düzen',
		items: [
			{ id: 'undo', label: 'Geri Al', shortcut: '⌘Z' },
			{ id: 'redo', label: 'Yinele', shortcut: '⇧⌘Z' },
			{ id: 'sep1', label: '', separator: true },
			{ id: 'cut', label: 'Kes', shortcut: '⌘X' },
			{ id: 'copy', label: 'Kopyala', shortcut: '⌘C' },
			{ id: 'paste', label: 'Yapıştır', shortcut: '⌘V' },
		],
	},
	{
		id: 'view',
		title: 'Görünüm',
		items: [
			{ id: 'toggle-dock', label: 'Dock’u Göster / Gizle', shortcut: '⌥⌘D' },
			{ id: 'toggle-wallpapers', label: 'Duvar Kağıdını Değiştir...', shortcut: '⌃W' },
			{ id: 'sep1', label: '', separator: true },
			{ id: 'enter-fullscreen', label: 'Tam Ekrana Geç', shortcut: '⌃⌘F' },
		],
	},
	{
		id: 'window',
		title: 'Pencere',
		items: [
			{ id: 'minimize', label: 'Simge Durumuna Küçült', shortcut: '⌘M' },
			{ id: 'zoom', label: 'Büyüt / Küçült' },
			{ id: 'sep1', label: '', separator: true },
			{ id: 'tile-windows', label: 'Tüm Pencereleri Hizala', shortcut: '⌃⌘T' },
			{ id: 'reset-layout', label: 'Pencere Düzenini Sıfırla' },
			{ id: 'bring-all-front', label: 'Tümünü Öne Getir' },
		],
	},
	{
		id: 'help',
		title: 'Yardım',
		items: [
			{ id: 'documentation', label: 'Portal Kullanım Kılavuzu' },
			{ id: 'support', label: 'Topluluk Destek & İletişim' },
		],
	},
];

/** English for the portal's menus and the items every app shares (Turkish is the label above). */
const PORTAL_EN: Record<string, string> = {
	// Category titles
	'cat:portal:default': 'Orbit OS',
	'cat:portal:file': 'File',
	'cat:portal:edit': 'Edit',
	'cat:portal:view': 'View',
	'cat:portal:window': 'Window',
	'cat:portal:help': 'Help',

	// Item labels
	'about-portal': 'About Orbit Community OS',
	preferences: 'System Preferences...',
	'refresh-data': 'Refresh All Data',
	hide: 'Hide Portal',
	'hide-others': 'Hide Others',
	'new-event': 'New Event...',
	'new-member': 'New Member Registration...',
	'new-budget-entry': 'New Ledger Entry...',
	'export-report': 'Export Activity Report',
	undo: 'Undo',
	redo: 'Redo',
	cut: 'Cut',
	copy: 'Copy',
	paste: 'Paste',
	'toggle-dock': 'Toggle Dock Auto-Hide',
	'toggle-wallpapers': 'Change Wallpaper...',
	'enter-fullscreen': 'Enter Fullscreen',
	minimize: 'Minimize',
	zoom: 'Zoom / Maximize',
	'tile-windows': 'Tile All Windows',
	'reset-layout': 'Reset Window Layout',
	'bring-all-front': 'Bring All to Front',
	documentation: 'Portal User Guide',
	support: 'Community Support & Contact',
	close: 'Close Window',
};

/** Turkish labels of the items the apps' menus share; the portal's own are in PORTAL_MENUS. */
const SHARED_TR: Record<string, string> = {
	minimize: 'Simge Durumuna Küçült',
	zoom: 'Büyüt / Küçült',
	close: 'Pencereyi Kapat',
};

const shared = (id: string, shortcut?: string): AppMenuItem => ({
	id,
	label: { tr: SHARED_TR[id], en: PORTAL_EN[id] },
	...(shortcut ? { shortcut } : {}),
});

/**
 * Window commands every app's "Pencere" menu offers, as on macOS — kept here once
 * instead of being repeated (and forgotten) in each app's list.
 */
const sharedWindowItems = (lang: Language): MenuItem[] => [
	{ id: 'sep-shared-window', label: '', separator: true },
	{ id: 'hide-others', label: lang === 'en' ? PORTAL_EN['hide-others'] : 'Diğerlerini Gizle', shortcut: '⌥⌘H' },
	{ id: 'tile-windows', label: lang === 'en' ? PORTAL_EN['tile-windows'] : 'Tüm Pencereleri Hizala', shortcut: '⌃⌘T' },
	{ id: 'reset-layout', label: lang === 'en' ? PORTAL_EN['reset-layout'] : 'Pencere Düzenini Sıfırla' },
	{ id: 'bring-all-front', label: lang === 'en' ? PORTAL_EN['bring-all-front'] : 'Tümünü Öne Getir' },
];

function withSharedWindowItems(appId: string, cat: MenuCategory, lang: Language): MenuCategory {
	if (appId === 'portal' || cat.id !== 'window') return cat;
	const have = new Set((cat.items || []).map((i) => i.id));
	const extra = sharedWindowItems(lang).filter((i) => i.separator || !have.has(i.id));
	return extra.length > 1 ? { ...cat, items: [...(cat.items || []), ...extra] } : cat;
}

const separator = (id: string): MenuItem => ({ id, label: '', separator: true });

const PORTAL_MENU_TITLES = { window: { tr: 'Pencere', en: PORTAL_EN['cat:portal:window'] } };

/** An app's manifest item as a menu item in `lang`. */
function toMenuItem(appId: AppID, item: AppMenuItem, lang: Language): MenuItem {
	return {
		id: item.id,
		label: item.label[lang],
		...(item.shortcut ? { shortcut: item.shortcut } : {}),
		...(item.permission ? { needs: { appId, level: item.permission } } : {}),
		...(item.komut ? { command: { appId, name: item.komut } } : {}),
		...(item.ac ? { opens: appId } : {}),
	};
}

/** The menus an app declares in its manifest: its own first menu, its extra menus, then Window. */
function appMenus(appId: AppID, lang: Language): MenuCategory[] | null {
	const menu = WINDOW_MANIFESTS.find((m) => m.id === appId)?.menu;
	if (!menu?.about) return null;
	const text = (l: L10n) => l[lang];
	return [
		{
			id: 'default',
			title: text(menu.title),
			items: [
				toMenuItem(appId, menu.about, lang),
				separator('sep1'),
				...(menu.defaultItems ? [...menu.defaultItems.map((i) => toMenuItem(appId, i, lang)), separator('sep2')] : []),
				toMenuItem(appId, shared('close', '⌘W'), lang),
			],
		},
		...(menu.categories ?? []).map((cat) => ({ id: cat.id, title: text(cat.title), items: cat.items.map((i) => toMenuItem(appId, i, lang)) })),
		{
			id: 'window',
			title: PORTAL_MENU_TITLES.window[lang],
			items: [toMenuItem(appId, shared('minimize', '⌘M'), lang), toMenuItem(appId, shared('zoom'), lang), toMenuItem(appId, shared('close', '⌘W'), lang)],
		},
	];
}

/** The portal's menus in `lang`; apps without menus of their own get these (under their own name). */
function portalMenus(appId: string, lang: Language): MenuCategory[] {
	const dict = lang === 'en' ? PORTAL_EN : {};
	const ownTitle = WINDOW_MANIFESTS.find((m) => m.id === appId)?.menu?.title;
	return PORTAL_MENUS.map((cat) => ({
		...cat,
		title: (cat.id === 'default' && ownTitle ? ownTitle[lang] : undefined) ?? dict[`cat:portal:${cat.id}`] ?? cat.title,
		items: cat.items.map((item) => (item.separator ? item : { ...item, label: dict[item.id] ?? item.label })),
	}));
}

export function getGlobalMenus(appId: string, lang: Language = 'tr'): MenuCategory[] {
	const own = appMenus(appId as AppID, lang);
	return (own ?? portalMenus(appId, lang)).map((cat) => withSharedWindowItems(appId, cat, lang));
}
