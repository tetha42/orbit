'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { AppID, FocusTarget, FocusTargetInput, WindowState } from '@/types/workspace';
import { DEFAULT_DOCK_APPS, type ExtendedAppMetadata } from '@/configs/apps.config';
import { I18nProvider, useI18n, type I18nContextValue } from '@/core/i18n';
import { IdentityProvider } from '@/core/identity';
import { SessionProvider, useSession, useSessionEvent, type SessionContextValue } from '@/core/session';
import { DEFAULT_WALLPAPER, WALLPAPERS, ThemeSync, nextWallpaper, useTheme } from '@/core/theme';
import { SoundProvider, useSound, type SoundContextValue } from '@/core/sound';
import { WindowsProvider, useActiveApp, useWindowActions, useWindowCycleSetting, useWindowFocusTarget, useWindows, useWindowStore, type WindowActions } from '@/core/windows';
import { NotificationClickBridge } from '@/components/NotificationCenter/NotificationClickBridge';
import { ShellActionsContext, ShellStateContext, useShell, type ShellActions, type ShellState } from '@/core/shell/shell';
import { useContextMenus } from '@/core/contextMenu/useContextMenus';
import { useDock } from '@/core/dock/useDock';
import { useWorkspacePersistence } from '@/core/persistence/useWorkspacePersistence';
import { useGlobalShortcuts } from '@/core/shortcuts/useGlobalShortcuts';
import { clearWorkspaceSession } from '@/lib/client/indexedDB';

export type { RegisterPayload } from '@/core/session';

/**
 * The old all-in-one value, for code that has not moved to the focused hooks
 * (`useSession`, `useI18n`, `useSound`, `useWindow`, `useShell`… in src/core).
 * It is the union of those modules' values and re-renders on any change of them.
 */
type WorkspaceContextType = SessionContextValue &
	I18nContextValue &
	SoundContextValue &
	WindowActions &
	ShellState &
	ShellActions & {
		windows: Record<AppID, WindowState>;
		activeApp: AppID | 'portal';
		focusTarget: FocusTarget | null;
		isWindowCycleEnabled: boolean;
		setIsWindowCycleEnabled: (enabled: boolean) => void;
		/** Opens an app, optionally at a record: `openApp('events', { section, kind, itemId })`. */
		openApp: (id: AppID, target?: FocusTargetInput) => void;
		getAppMeta: (appId: AppID) => ExtendedAppMetadata;
	};

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
	const { closeDockContextMenu, closeDesktopContextMenu } = menus;

	const [activeWallpaper, setActiveWallpaper] = useState<string>(() => {
		if (typeof window !== 'undefined') {
			try {
				const saved = localStorage.getItem('kulup_active_wallpaper');
				// Custom wallpapers live under the custom asset route and are not in the
				// compile-time catalogue, so accept any well-formed image path here.
				if (
					saved &&
					(WALLPAPERS.some((w) => w.src === saved) ||
						saved.startsWith('/wallpapers/') ||
						saved.startsWith('/api/custom-assets/wallpapers/'))
				)
					return saved;
			} catch {}
		}
		return DEFAULT_WALLPAPER;
	});
	const [brightness, setBrightness] = useState<number>(100);

	const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
	const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
	const [isWorkspaceAppletOpen, setWorkspaceAppletOpen] = useState(false);
	const [isControlCenterOpen, setControlCenterOpen] = useState(false);
	const [isNotificationCenterOpen, setNotificationCenterOpen] = useState<boolean>(false);
	const [isCalendarOpen, setCalendarOpen] = useState(false);

	// Only one menu-bar panel is open at a time: opening one closes the others (clicks and keys alike).
	const setIsWorkspaceAppletOpen = useCallback((open: boolean) => {
		setWorkspaceAppletOpen(open);
		if (open) {
			setControlCenterOpen(false);
			setNotificationCenterOpen(false);
			setCalendarOpen(false);
		}
	}, []);
	const setIsControlCenterOpen = useCallback((open: boolean) => {
		setControlCenterOpen(open);
		if (open) {
			setWorkspaceAppletOpen(false);
			setNotificationCenterOpen(false);
			setCalendarOpen(false);
		}
	}, []);
	const setIsNotificationCenterOpen = useCallback((open: boolean) => {
		setNotificationCenterOpen(open);
		if (open) {
			setWorkspaceAppletOpen(false);
			setControlCenterOpen(false);
			setCalendarOpen(false);
		}
	}, []);
	const setIsCalendarOpen = useCallback((open: boolean) => {
		setCalendarOpen(open);
		if (open) {
			setWorkspaceAppletOpen(false);
			setControlCenterOpen(false);
			setNotificationCenterOpen(false);
		}
	}, []);

	// The panel lists people's names and deadlines; it must not stay readable over the lock screen or after signing out.
	useSessionEvent(() => {
		setNotificationCenterOpen(false);
		setCalendarOpen(false);
	});

	const cycleWallpaper = useCallback(() => {
		setActiveWallpaper((prev) => {
			const nextWp = nextWallpaper(prev);
			if (typeof window !== 'undefined') {
				try {
					localStorage.setItem('kulup_active_wallpaper', nextWp);
				} catch {}
			}
			return nextWp;
		});
	}, []);

	const setWallpaper = useCallback((url: string) => {
		setActiveWallpaper(url);
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('kulup_active_wallpaper', url);
			} catch {}
		}
	}, []);

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
	}, [windowStore, resetTheme, setWallpaper, setVolume, setIsMuted, setIsDockAutoHide, setDockApps]);

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

	const { dockContextMenu, globalContextMenu, appCustomMenus, registerAppContextMenu, closeContextMenu, openContextMenu, openDockContextMenu, openDesktopContextMenu } = menus;

	// Every action is stable, so this object — and everything that only acts — never re-renders.
	const actions = useMemo<ShellActions>(
		() => ({
			setIsNotificationCenterOpen,
			openDockContextMenu,
			closeDockContextMenu,
			openDesktopContextMenu,
			closeDesktopContextMenu,
			openContextMenu,
			closeContextMenu,
			registerAppContextMenu,
			cycleWallpaper,
			setWallpaper,
			setBrightness,
			setIsDockAutoHide,
			toggleDockAutoHide,
			resetWorkspaceSession,
			setIsAboutModalOpen,
			setIsSpotlightOpen,
			setIsWorkspaceAppletOpen,
			setIsControlCenterOpen,
			setIsCalendarOpen,
		}),
		[setIsNotificationCenterOpen, setIsWorkspaceAppletOpen, setIsControlCenterOpen, setIsCalendarOpen, openDockContextMenu, closeDockContextMenu, openDesktopContextMenu, closeDesktopContextMenu, openContextMenu, closeContextMenu, registerAppContextMenu, cycleWallpaper, setWallpaper, setIsDockAutoHide, toggleDockAutoHide, resetWorkspaceSession]
	);

	const state = useMemo<ShellState>(
		() => ({
			dockApps,
			activeWallpaper,
			brightness,
			isDockAutoHide,
			dockContextMenu,
			desktopContextMenu: globalContextMenu,
			contextMenu: globalContextMenu,
			appCustomMenus,
			isAboutModalOpen,
			isSpotlightOpen,
			isWorkspaceAppletOpen,
			isControlCenterOpen,
			isNotificationCenterOpen,
			isCalendarOpen,
		}),
		[dockApps, activeWallpaper, brightness, isDockAutoHide, dockContextMenu, globalContextMenu, appCustomMenus, isAboutModalOpen, isSpotlightOpen, isWorkspaceAppletOpen, isControlCenterOpen, isNotificationCenterOpen, isCalendarOpen]
	);

	return (
		<ShellActionsContext.Provider value={actions}>
			<ShellStateContext.Provider value={state}>{children}</ShellStateContext.Provider>
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
