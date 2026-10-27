'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AppID, FocusTarget, WindowState } from '@/types/workspace';
import { useSession, useSessionEvent } from '@/core/session';
import { useSound } from '@/core/sound';
import { createWindowStore, visibleWindows, type WindowActions, type WindowStore, type WindowsState } from './store';

const WindowsContext = createContext<WindowStore | null>(null);

/**
 * Owns the window store and wires it to the session (who may open what) and the
 * sound (the chime for a refused app). The store never changes identity, so this
 * provider's context value never re-renders anyone; the hooks below subscribe to
 * the slice they show.
 */
export function WindowsProvider({ children }: { children: React.ReactNode }) {
	const [store] = useState(createWindowStore);
	const { canUseApp } = useSession();
	const { playSystemSound } = useSound();
	useEffect(() => {
		store.configure({ canOpen: canUseApp, onDenied: playSystemSound });
	}, [store, canUseApp, playSystemSound]);

	const savedOpenWindowsBeforeLockRef = useRef<AppID[]>([]);
	const savedActiveAppBeforeLockRef = useRef<AppID | 'portal'>('portal');

	useSessionEvent((event) => {
		if (event === 'lock') {
			const state = store.getState();
			const openIds = (Object.keys(state.windows) as AppID[]).filter(
				(id) => state.windows[id].isOpen && !state.windows[id].isMinimized
			);
			savedOpenWindowsBeforeLockRef.current = openIds;
			savedActiveAppBeforeLockRef.current = state.activeApp;
			store.actions.minimizeAll();
		} else if (event === 'unlock') {
			const toRestore = savedOpenWindowsBeforeLockRef.current;
			if (toRestore.length > 0) {
				store.actions.restoreWindows(toRestore, savedActiveAppBeforeLockRef.current);
			}
			savedOpenWindowsBeforeLockRef.current = [];
		} else if (event === 'logout') {
			savedOpenWindowsBeforeLockRef.current = [];
			savedActiveAppBeforeLockRef.current = 'portal';
		}
	});

	return <WindowsContext.Provider value={store}>{children}</WindowsContext.Provider>;
}

/** The store itself: for code that reacts to window changes without rendering (saving the workspace, shortcuts). */
export function useWindowStore(): WindowStore {
	const store = useContext(WindowsContext);
	if (!store) throw new Error('window hooks must be used within a WorkspaceProvider');
	return store;
}

/** Subscribes to one slice of the window state; re-renders only when that slice changes. */
function useWindowsSelector<T>(selector: (state: WindowsState) => T): T {
	const store = useWindowStore();
	return useSyncExternalStore(
		store.subscribe,
		() => selector(store.getState()),
		() => selector(store.getState())
	);
}

/**
 * One window's state, as the member sees it (closed when their role does not open
 * the app). Re-renders when this window changes — not when another one does.
 */
export function useWindow(id: AppID): WindowState {
	const raw = useWindowsSelector((s) => s.windows[id]);
	const { canUseApp } = useSession();
	return useMemo(() => (raw.isOpen && !canUseApp(id) ? { ...raw, isOpen: false, isMinimized: false } : raw), [raw, canUseApp, id]);
}

/** Every window, as the member sees them. Re-renders on any window change: prefer `useWindow(id)`. */
export function useWindows(): Record<AppID, WindowState> {
	const stored = useWindowsSelector((s) => s.windows);
	const { canUseApp } = useSession();
	return useMemo(() => visibleWindows(stored, canUseApp), [stored, canUseApp]);
}

/** Whether any window, as the member sees them, satisfies `test` — a boolean, so it re-renders only when the answer changes. */
export function useHasWindow(test: (win: WindowState) => boolean): boolean {
	const { canUseApp } = useSession();
	return useWindowsSelector((s) => Object.values(visibleWindows(s.windows, canUseApp)).some(test));
}

/** The focused app (the portal when none, or when the role no longer opens it). */
export function useActiveApp(): AppID | 'portal' {
	const stored = useWindowsSelector((s) => s.activeApp);
	const { canUseApp } = useSession();
	return stored !== 'portal' && !canUseApp(stored) ? 'portal' : stored;
}

/** Whether `id` is the focused app — re-renders only when this app gains or loses focus. */
export function useIsActive(id: AppID): boolean {
	const isStoredActive = useWindowsSelector((s) => s.activeApp === id);
	const { canUseApp } = useSession();
	return isStoredActive && canUseApp(id);
}

/** What a search or notification asked an app to reveal, and how to say it is done. */
export function useWindowFocusTarget(): { focusTarget: FocusTarget | null; clearFocusTarget: (nonce: number) => void } {
	const focusTarget = useWindowsSelector((s) => s.focusTarget);
	const { clearFocusTarget } = useWindowStore().actions;
	return { focusTarget, clearFocusTarget };
}

/** The Shift+Tab window switching setting. */
export function useWindowCycleSetting(): { isWindowCycleEnabled: boolean; setIsWindowCycleEnabled: (enabled: boolean) => void } {
	const isWindowCycleEnabled = useWindowsSelector((s) => s.isWindowCycleEnabled);
	return { isWindowCycleEnabled, setIsWindowCycleEnabled: useWindowStore().actions.setIsWindowCycleEnabled };
}

/**
 * open / close / minimise / focus / move… — one stable object, so a component that
 * only dispatches never re-renders because windows changed.
 */
export function useWindowActions(): WindowActions {
	return useWindowStore().actions;
}

export { INITIAL_WINDOWS } from './store';
