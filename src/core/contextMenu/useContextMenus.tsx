'use client';

import { useCallback, useState } from 'react';
import type { AppID, ContextMenuMode, DockContextMenuState, GlobalContextMenuState, MenuItem } from '@/types/workspace';

function areMenuItemsEqual(a?: MenuItem[] | null, b?: MenuItem[] | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	if (a.length !== b.length) return false;
	return a.every((itemA, i) => {
		const itemB = b[i];
		if (!itemB) return false;
		if (
			itemA.id !== itemB.id ||
			itemA.label !== itemB.label ||
			itemA.disabled !== itemB.disabled ||
			itemA.separator !== itemB.separator ||
			itemA.shortcut !== itemB.shortcut ||
			itemA.badge !== itemB.badge ||
			itemA.checked !== itemB.checked
		) {
			return false;
		}
		if (itemA.children || itemB.children) {
			if (!areMenuItemsEqual(itemA.children, itemB.children)) return false;
		}
		return true;
	});
}

/**
 * Context menus: the dock's, the desktop/app right-click menu, and the extra
 * items an app registers for its own windows. A module of its own; the
 * workspace provider composes it.
 */
export function useContextMenus() {
	const [dockContextMenu, setDockContextMenu] = useState<DockContextMenuState>({
		isOpen: false,
		appId: null,
		x: 0,
		y: 0,
	});

	const [globalContextMenu, setGlobalContextMenu] = useState<GlobalContextMenuState>({
		isOpen: false,
		x: 0,
		y: 0,
		mode: 'default',
		appId: null,
		customItems: null,
	});

	const [appCustomMenus, setAppCustomMenus] = useState<Partial<Record<AppID, MenuItem[]>>>({});

	const registerAppContextMenu = useCallback((appId: AppID, items: MenuItem[] | null) => {
		setAppCustomMenus((prev) => {
			if (!items) {
				if (!prev[appId]) return prev;
				const next = { ...prev };
				delete next[appId];
				return next;
			}
			if (areMenuItemsEqual(prev[appId], items)) return prev;
			return { ...prev, [appId]: items };
		});
	}, []);

	const closeContextMenu = useCallback(() => {
		setGlobalContextMenu((prev) => ({ ...prev, isOpen: false }));
	}, []);

	const openContextMenu = useCallback((options: {
		x: number;
		y: number;
		mode?: ContextMenuMode;
		appId?: AppID | null;
		customItems?: MenuItem[] | null;
	}) => {
		const mode = options.mode || (options.appId ? 'app' : 'default');
		setGlobalContextMenu({
			isOpen: true,
			x: options.x,
			y: options.y,
			mode,
			appId: options.appId ?? null,
			customItems: options.customItems ?? null,
		});
		setDockContextMenu((prev) => ({ ...prev, isOpen: false }));
	}, []);

	const openDockContextMenu = useCallback((appId: AppID, x: number, y: number) => {
		setDockContextMenu({
			isOpen: true,
			appId,
			x,
			y,
		});
		setGlobalContextMenu((prev) => ({ ...prev, isOpen: false }));
	}, []);

	const closeDockContextMenu = useCallback(() => {
		setDockContextMenu((prev) => ({ ...prev, isOpen: false }));
	}, []);

	const openDesktopContextMenu = useCallback((x: number, y: number) => {
		openContextMenu({ x, y, mode: 'default' });
	}, [openContextMenu]);

	const closeDesktopContextMenu = closeContextMenu;

	return {
		dockContextMenu,
		globalContextMenu,
		appCustomMenus,
		registerAppContextMenu,
		closeContextMenu,
		openContextMenu,
		openDockContextMenu,
		closeDockContextMenu,
		openDesktopContextMenu,
		closeDesktopContextMenu,
	};
}
