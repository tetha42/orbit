/**
 * The shape of an app manifest — the single file an app is registered with.
 *
 * Every folder under `src/apps/<id>/` holds a `manifest.ts` exporting one of
 * these as its default export (see src/apps/README.md). Everything the desktop
 * knows about an app is derived from it: the window defaults, the dock and
 * launcher entries, the menu bar menus, what the role editor shows, and the
 * component that is loaded when the window opens.
 *
 * Pure types, no runtime: manifests are also read by Node (scripts/gen-apps.mjs,
 * scripts/check-pure.mjs) and by the server, so they must not import UI code.
 */

/** Turkish is the base language; English sits beside it. */
export interface L10n {
	tr: string;
	en: string;
}

/** The level an item needs: `kullan` = use the app, `yonet` = manage it. */
export type MenuLevel = 'kullan' | 'yonet';

export type AppCategory = 'Operations' | 'Finance' | 'Community' | 'Productivity';

/** One entry of an app's menu-bar menu. */
export interface AppMenuItem {
	/** Unique across the portal: translations and the menu bar's special cases are keyed by it. */
	id: string;
	label: L10n;
	shortcut?: string;
	/** The role must hold this level in the app, otherwise the item is not shown at all. */
	permission?: MenuLevel;
	/** Opens the app, then sends it this command — the app receives it with `useAppCommand`. */
	komut?: string;
	/** Just opens the app. */
	ac?: true;
}

export interface AppMenuCategory {
	/** `default` and `window` are built in; any other id adds a menu between them. */
	id: string;
	title: L10n;
	items: readonly AppMenuItem[];
}

export interface AppMenu {
	/** The app's name in bold at the start of the menu bar. */
	title: L10n;
	/**
	 * The "About …" item that opens the first menu. Without it the app has no menus
	 * of its own: the portal's menus are shown under `title`.
	 */
	about?: AppMenuItem;
	/** More items in the first menu, between "About" and "Close". */
	defaultItems?: readonly AppMenuItem[];
	/** Extra menus (Tasks, Records…) between the first menu and "Window". */
	categories?: readonly AppMenuCategory[];
}

/** What the role editor shows for the app: its name and what each level allows. */
export interface AppPermission {
	ad: string;
	kullan: string;
	yonet: string;
	uyari?: string;
	/** Everyone gets at least `kullan` (Settings: password, 2FA, theme…). */
	herkeseAcik?: true;
	/** Position in the role editor; apps without one come last, by id. */
	sira?: number;
}

/** The component an app opens in its window, loaded the first time the window opens. */
export interface AppComponent {
	/** Module path: `@/…`, or `./File` relative to the manifest's folder. */
	module: string;
	/** Named export of the module that holds the component. */
	export: string;
}

export interface AppWindow {
	width: number;
	height: number;
	minWidth?: number;
	minHeight?: number;
	/** Where the window first appears. */
	x: number;
	y: number;
	/** Initial stacking order (default 10). */
	z?: number;
	/** Open on a fresh desktop (default false). */
	open?: true;
}

interface ManifestBase {
	/** Same as the folder name under src/apps. Lower-case letters and digits. */
	id: string;
	permission: AppPermission;
	/**
	 * The notification kinds this app produces, each with the level a member needs
	 * to receive it. The server filters notifications through this: a role that
	 * cannot open the app gets none of them.
	 */
	notifications?: Readonly<Record<string, MenuLevel>>;
}

/**
 * An app that only exists for permissions: the role editor lists it, but it has
 * no window, dock icon or launcher entry (yet).
 */
export interface PermissionOnlyManifest extends ManifestBase {
	window?: undefined;
}

/** An app with a window on the desktop. */
export interface WindowManifest extends ManifestBase {
	title: string;
	shortTitle: string;
	description: string;
	/** English title, short title and description. */
	en: { title: string; shortTitle: string; description: string };
	/** Turkish title, short title and description. */
	tr?: { title: string; shortTitle: string; description: string };
	category: AppCategory;
	/** A lucide-react icon name ("FolderGit2"). */
	icon: string;
	accentColor: string;
	/** Icon tints where they differ from `accentColor`: the AppIcon, the app menus, Spotlight. */
	colors?: { icon?: string; menu?: string; search?: string };
	/** Dock icon image (without it the lucide icon on an accent tile is used). */
	dockIcon?: string;
	/** The little label on the launcher card ("Yeni", "Canlı") — string or { tr, en }. */
	badge?: string | L10n;
	window: AppWindow;
	component: AppComponent;
	/** Shown next to the app in the menus ("⌘1"). */
	shortcut?: string;
	/** The key that opens the app together with ⌘ / Ctrl / Shift ("1", ","). */
	hotkey?: string;
	/** Position in the default dock (apps without one follow, by id). */
	dock?: number;
	/** Position in launcher, Spotlight and menu lists (apps without one follow, by id). */
	order?: number;
	menu?: AppMenu;
}

export type AppManifest = PermissionOnlyManifest | WindowManifest;
