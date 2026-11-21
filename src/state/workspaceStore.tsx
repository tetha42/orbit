'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { DEFAULT_DOCK_APPS } from '@/configs/apps.config';
import { I18nProvider, useI18n } from '@/core/i18n';
import { LanguageSync } from '@/core/i18n/LanguageSync';
import { IdentityProvider } from '@/core/identity';
import { SessionProvider, useSession } from '@/core/session';
import { DEFAULT_WALLPAPER, ThemeSync, useTheme } from '@/core/theme';
import { SoundProvider, useSound } from '@/core/sound';
import { WindowsProvider, useActiveApp, useWindowActions, useWindowCycleSetting, useWindowFocusTarget, useWindows, useWindowStore } from '@/core/windows';
import { NotificationClickBridge } from '@/components/shell/NotificationCenter/NotificationClickBridge';
import { ShellActionsContext, ShellStateContext, ShellStoreContext, useShell, type ShellActions, type ShellState, type ShellStore } from '@/core/shell/shell';
import { useContextMenus } from '@/core/contextMenu/useContextMenus';
import { useDock } from '@/core/dock/useDock';
import { useWorkspacePersistence } from '@/core/persistence/useWorkspacePersistence';
import { useGlobalShortcuts } from '@/core/shortcuts/useGlobalShortcuts';
import { clearWorkspaceSession } from '@/lib/client/indexedDB';
import { useShellUiState } from './useShellUiState';
import type { WorkspaceContextType } from './workspaceTypes';

export type { RegisterPayload } from '@/core/session';

/**
 * The workspace: the core modules (language, sound, session, windows) side by
 * side, each with its own context so a change re-renders only whoever reads that
 * module, and the shell provider on top, which holds what is left (wallpaper,
 * brightness, dock, context menus, panels) and connects saving and the keyboard
 * shortcuts. The theme is its own module (core/theme), kept in sync by <ThemeSync />.
 */
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
	return (
		<I18nProvider>
			<IdentityProvider>
				<ThemeSync />
				<SoundProvider>
					<SessionProvider>
						<LanguageSync />
						<WindowsProvider>
							<NotificationClickBridge />
							<ShellProvider>{children}</ShellProvider>
						</WindowsProvider>
					</SessionProvider>
				</SoundProvider>
			</IdentityProvider>
		</I18nProvider>
	);
}

function ShellProvider({ children }: { children: React.ReactNode }) {
	const { dockApps, setDockApps, isDockAutoHide, setIsDockAutoHide, toggleDockAutoHide } = useDock();
	const { volume, setVolume, isMuted, setIsMuted } = useSound();
	const windowStore = useWindowStore();
	const { resetTheme } = useTheme();
	const menus = useContextMenus();
	const {
		dockContextMenu, globalContextMenu, appCustomMenus, registerAppContextMenu,
		closeContextMenu, openContextMenu, openDockContextMenu, closeDockContextMenu,
		openDesktopContextMenu, closeDesktopContextMenu,
	} = menus;

	const ui = useShellUiState();
	const {
		activeWallpaper, brightness, setBrightness, cycleWallpaper, setWallpaper,
		setIsNotificationCenterOpen, setIsWorkspaceAppletOpen, setIsControlCenterOpen,
		setIsCalendarOpen, setIsAboutModalOpen, setIsSpotlightOpen, isAboutModalOpen,
		isSpotlightOpen, isWorkspaceAppletOpen, isControlCenterOpen,
		isNotificationCenterOpen, isCalendarOpen,
	} = ui;

	useWorkspacePersistence(
		{ activeWallpaper, brightness, volume, isMuted, isDockAutoHide, dockApps },
		{ setWallpaper, setBrightness, setVolume, setIsMuted, setIsDockAutoHide, setDockApps }
	);

	const resetWorkspaceSession = useCallback(async () => {
		await clearWorkspaceSession();
		windowStore.reset();
		resetTheme();
		setWallpaper(DEFAULT_WALLPAPER);
		setBrightness(100);
		setVolume(80);
		setIsMuted(false);
		setIsDockAutoHide(false);
		setDockApps(DEFAULT_DOCK_APPS);
	}, [windowStore, resetTheme, setWallpaper, setBrightness, setVolume, setIsMuted, setIsDockAutoHide, setDockApps]);

	const closeContextMenus = useCallback(() => {
		closeDockContextMenu();
		closeDesktopContextMenu();
	}, [closeDockContextMenu, closeDesktopContextMenu]);

	useGlobalShortcuts({
		isWorkspaceAppletOpen,
		isAboutModalOpen,
		isSpotlightOpen,
		isNotificationCenterOpen,
		isCalendarOpen,
		setIsWorkspaceAppletOpen,
		setIsAboutModalOpen,
		setIsSpotlightOpen,
		setIsNotificationCenterOpen,
		setIsCalendarOpen,
		closeContextMenus,
		toggleDockAutoHide,
	});

	// Every action is stable, so this object — and everything that only acts — never re-renders.
	const actions = useMemo<ShellActions>(
		() => ({
			setIsNotificationCenterOpen, openDockContextMenu, closeDockContextMenu,
			openDesktopContextMenu, closeDesktopContextMenu, openContextMenu,
			closeContextMenu, registerAppContextMenu, cycleWallpaper, setWallpaper,
			setBrightness, setIsDockAutoHide, toggleDockAutoHide, resetWorkspaceSession,
			setIsAboutModalOpen, setIsSpotlightOpen, setIsWorkspaceAppletOpen,
			setIsControlCenterOpen, setIsCalendarOpen,
		}),
		[
			setIsNotificationCenterOpen, setIsWorkspaceAppletOpen, setIsControlCenterOpen,
			setIsCalendarOpen, setIsAboutModalOpen, setIsSpotlightOpen, setBrightness,
			openDockContextMenu, closeDockContextMenu, openDesktopContextMenu,
			closeDesktopContextMenu, openContextMenu, closeContextMenu,
			registerAppContextMenu, cycleWallpaper, setWallpaper, setIsDockAutoHide,
			toggleDockAutoHide, resetWorkspaceSession,
		]
	);

	const state = useMemo<ShellState>(
		() => ({
			dockApps, activeWallpaper, brightness, isDockAutoHide, dockContextMenu,
			desktopContextMenu: globalContextMenu, contextMenu: globalContextMenu,
			appCustomMenus, isAboutModalOpen, isSpotlightOpen, isWorkspaceAppletOpen,
			isControlCenterOpen, isNotificationCenterOpen, isCalendarOpen,
		}),
		[
			dockApps, activeWallpaper, brightness, isDockAutoHide, dockContextMenu,
			globalContextMenu, appCustomMenus, isAboutModalOpen, isSpotlightOpen,
			isWorkspaceAppletOpen, isControlCenterOpen, isNotificationCenterOpen,
			isCalendarOpen,
		]
	);

	const stateRef = useRef<ShellState>(state);
	const listenersRef = useRef(new Set<() => void>());
	useEffect(() => {
		stateRef.current = state;
		listenersRef.current.forEach((fn) => fn());
	}, [state]);

	const shellStore = useMemo<ShellStore>(
		() => ({
			getState: () => stateRef.current,
			subscribe: (listener) => {
				listenersRef.current.add(listener);
				return () => {
					listenersRef.current.delete(listener);
				};
			},
		}),
		[]
	);

	return (
		<ShellActionsContext.Provider value={actions}>
			<ShellStoreContext.Provider value={shellStore}>
				<ShellStateContext.Provider value={state}>{children}</ShellStateContext.Provider>
			</ShellStoreContext.Provider>
		</ShellActionsContext.Provider>
	);
}

/**
 * Everything the workspace offers in one object. Convenient, but it re-renders on
 * any change of any module: components should read what they need through
 * `useSession()`, `useI18n()`, `useSound()`, `useWindow(id)`, `useShell()` and the
 * other hooks of src/core.
 */
export function useWorkspace(): WorkspaceContextType {
	const session = useSession();
	const i18n = useI18n();
	const sound = useSound();
	const actions = useWindowActions();
	const shell = useShell();
	const windows = useWindows();
	const activeApp = useActiveApp();
	const { focusTarget } = useWindowFocusTarget();
	const cycle = useWindowCycleSetting();
	return useMemo(
		() => ({ ...session, ...i18n, ...sound, ...actions, ...shell, ...cycle, windows, activeApp, focusTarget }),
		[session, i18n, sound, actions, shell, cycle, windows, activeApp, focusTarget]
	);
}
