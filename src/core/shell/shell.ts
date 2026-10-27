'use client';

import { createContext, useContext, useMemo } from 'react';
import type { AppID, ContextMenuMode, DesktopContextMenuState, DockContextMenuState, GlobalContextMenuState, MenuItem } from '@/types/workspace';

/**
 * The shell: what the desktop itself holds, outside the core modules (session,
 * language, sound, windows, theme) — wallpaper, brightness, the dock, context
 * menus and which panel is open. The provider lives in state/workspaceStore.tsx.
 *
 * It is split in two so that a component that only acts (open a context menu,
 * close a panel) takes `useShellActions()` — a stable object that never
 * re-renders it — and only a component that shows shell state takes `useShellState()`.
 */
export interface ShellState {
	dockApps: AppID[];
	activeWallpaper: string;
	brightness: number;
	isDockAutoHide: boolean;
	dockContextMenu: DockContextMenuState;
	desktopContextMenu: DesktopContextMenuState;
	contextMenu: GlobalContextMenuState;
	appCustomMenus: Partial<Record<AppID, MenuItem[]>>;
	isAboutModalOpen: boolean;
	isSpotlightOpen: boolean;
	isWorkspaceAppletOpen: boolean;
	isControlCenterOpen: boolean;
	isNotificationCenterOpen: boolean;
	isCalendarOpen: boolean;
}

export interface ShellActions {
	setIsNotificationCenterOpen: (open: boolean) => void;
	openDockContextMenu: (appId: AppID, x: number, y: number) => void;
	closeDockContextMenu: () => void;
	openDesktopContextMenu: (x: number, y: number) => void;
	closeDesktopContextMenu: () => void;
	openContextMenu: (options: { x: number; y: number; mode?: ContextMenuMode; appId?: AppID | null; customItems?: MenuItem[] | null }) => void;
	closeContextMenu: () => void;
	registerAppContextMenu: (appId: AppID, items: MenuItem[] | null) => void;
	cycleWallpaper: () => void;
	setWallpaper: (url: string) => void;
	setBrightness: (val: number) => void;
	setIsDockAutoHide: (val: boolean | ((prev: boolean) => boolean)) => void;
	toggleDockAutoHide: () => void;
	resetWorkspaceSession: () => Promise<void>;
	setIsAboutModalOpen: (open: boolean) => void;
	setIsSpotlightOpen: (open: boolean) => void;
	setIsWorkspaceAppletOpen: (open: boolean) => void;
	setIsControlCenterOpen: (open: boolean) => void;
	setIsCalendarOpen: (open: boolean) => void;
}

export const ShellStateContext = createContext<ShellState | null>(null);
export const ShellActionsContext = createContext<ShellActions | null>(null);

/** Wallpaper, dock, context-menu and panel state — re-renders when any of it changes. */
export function useShellState(): ShellState {
	const ctx = useContext(ShellStateContext);
	if (!ctx) throw new Error('useShellState must be used within a WorkspaceProvider');
	return ctx;
}

/** The shell's actions (open a context menu, close a panel, change the wallpaper…): one stable object. */
export function useShellActions(): ShellActions {
	const ctx = useContext(ShellActionsContext);
	if (!ctx) throw new Error('useShellActions must be used within a WorkspaceProvider');
	return ctx;
}

/** Shell state and actions together. */
export function useShell(): ShellState & ShellActions {
	const state = useShellState();
	const actions = useShellActions();
	return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
