import type { AppID } from '@/apps';
import type { AppCategory } from '@/core/apps/manifest';

/** AppID is derived from the manifests under src/apps (see src/apps/README.md). */
export type { AppID, AppCategory };

export interface AppMetadata {
	id: AppID;
	title: string;
	shortTitle: string;
	description: string;
	category: AppCategory;
	icon: string;
	accentColor: string;
	badge?: string;
	defaultWidth: number;
	defaultHeight: number;
	minWidth?: number;
	minHeight?: number;
}

export interface WindowState {
	isOpen: boolean;
	isMinimized: boolean;
	isMaximized: boolean;
	position: { x: number; y: number };
	size: { width: number; height: number };
	zIndex: number;
}

export interface MenuItem {
	id: string;
	label: string;
	shortcut?: string;
	disabled?: boolean;
	separator?: boolean;
	header?: boolean;
	checked?: boolean;
	badge?: string;
	icon?: React.ReactNode;
	danger?: boolean;
	meta?: Record<string, unknown>;
	action?: () => void;
	children?: MenuItem[];
	/** The role must hold this level in the app, otherwise the menu bar leaves the item out. */
	needs?: { appId: AppID; level: 'kullan' | 'yonet' };
	/** Opens the app, then sends it this command (the app reads it with `useAppCommand`). */
	command?: { appId: AppID; name: string };
	/** Opens this app. */
	opens?: AppID;
}

export interface MenuCategory {
	id: string;
	title: string;
	items: MenuItem[];
}

export interface DockContextMenuState {
	isOpen: boolean;
	appId: AppID | null;
	x: number;
	y: number;
}

export type ContextMenuMode = 'default' | 'app';

export interface GlobalContextMenuState {
	isOpen: boolean;
	x: number;
	y: number;
	mode: ContextMenuMode;
	appId?: AppID | null;
	customItems?: MenuItem[] | null;
}

export type DesktopContextMenuState = GlobalContextMenuState;

/**
 * Where an app should land when it is opened from search or a notification:
 * which section (tab, filter, settings page) to show and which record to reveal.
 * Every field is optional — a bare app id still just opens the app.
 */
export interface FocusTargetInput {
	/** App-specific section: a tab, a settings page, a kasa. */
	section?: string;
	/** What sort of record `itemId` names ('task', 'member', 'ledger'…). */
	kind?: string;
	itemId?: string;
	/** The owner of a nested record — e.g. the team a task belongs to. */
	parentId?: string;
}

export interface FocusTarget extends FocusTargetInput {
	appId: AppID;
	/**
	 * Distinguishes two requests for the same record, so opening it a second time
	 * fires again. It also lets a consumer ignore a target it has already handled.
	 */
	nonce: number;
}
