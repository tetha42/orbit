'use client';

import { useEffect, useRef } from 'react';
import type { AppID } from '@/types/workspace';
import { INTERNAL_WINDOW_MANIFESTS } from '@/apps';
import { APPS_CONFIG, DEFAULT_DOCK_APPS } from '@/configs/apps.config';
import { useSession, useSessionEvent } from '@/core/session';
import { useWindowStore } from '@/core/windows';
import { clearWorkspaceSession, loadWorkspaceSession, saveWorkspaceSession } from '@/lib/client/indexedDB';
import { WALLPAPERS } from '@/core/theme';

/** What the workspace remembers between visits, besides the windows (those the window store holds). */
export interface PersistedShell {
	activeWallpaper: string;
	brightness: number;
	volume: number;
	isMuted: boolean;
	isDockAutoHide: boolean;
	dockApps: AppID[];
}

export interface PersistedSetters {
	setWallpaper: (url: string) => void;
	setBrightness: (value: number) => void;
	setVolume: (value: number) => void;
	setIsMuted: (muted: boolean) => void;
	setIsDockAutoHide: (value: boolean) => void;
	setDockApps: (apps: AppID[]) => void;
}

/**
 * Keeps the workspace across reloads (IndexedDB) and roams it across devices (Server Sync).
 *
 * 1. Immediate startup hydration from client IndexedDB.
 * 2. Background server-state hydration from /api/profile/workspace when authenticated,
 *    allowing window layouts, custom wallpapers, and dock apps to roam across machines.
 * 3. Debounced local storage and server sync upon changes.
 */
export function useWorkspacePersistence(shell: PersistedShell, set: PersistedSetters): void {
	const store = useWindowStore();
	const { isAuthenticated } = useSession();
	const isHydratedRef = useRef(false);
	const lastSyncedTimestampRef = useRef<number>(0);
	const remoteLoadedRef = useRef<boolean>(false);

	// Latest values for the save timer, which the window store also triggers.
	const shellRef = useRef(shell);
	useEffect(() => {
		shellRef.current = shell;
	});
	const setRef = useRef(set);
	useEffect(() => {
		setRef.current = set;
	});

	// 1. Put the saved workspace back on startup (from local IndexedDB cache)
	useEffect(() => {
		loadWorkspaceSession()
			.then((saved) => {
				isHydratedRef.current = true;
				if (saved) {
					lastSyncedTimestampRef.current = saved.updatedAt || 0;
					const s = setRef.current;
					store.restore({
						windows: saved.windows,
						activeApp: saved.activeApp && (saved.activeApp === 'portal' || APPS_CONFIG[saved.activeApp]) ? saved.activeApp : undefined,
					});
					if (
						saved.activeWallpaper &&
						(WALLPAPERS.some((w) => w.src === saved.activeWallpaper) ||
							saved.activeWallpaper.startsWith('/wallpapers/') ||
							saved.activeWallpaper.startsWith('/api/custom-assets/wallpapers/'))
					) {
						s.setWallpaper(saved.activeWallpaper);
					}
					if (typeof saved.brightness === 'number') s.setBrightness(saved.brightness);
					if (typeof saved.volume === 'number') s.setVolume(saved.volume);
					if (typeof saved.isMuted === 'boolean') s.setIsMuted(saved.isMuted);
					if (typeof saved.isDockAutoHide === 'boolean') s.setIsDockAutoHide(saved.isDockAutoHide);
					if (Array.isArray(saved.dockApps) && saved.dockApps.length > 0) {
						s.setDockApps(saved.dockApps);
					} else {
						s.setDockApps(DEFAULT_DOCK_APPS);
					}
				}
			})
			.catch((err) => {
				console.warn('Error hydrating session from IndexedDB:', err);
				isHydratedRef.current = true;
			});
	}, [store]);

	// 2. Fetch server-persisted workspace on authentication (Cross-device Roaming)
	useEffect(() => {
		if (!isAuthenticated || remoteLoadedRef.current) return;
		remoteLoadedRef.current = true;

		fetch('/api/profile/workspace')
			.then((res) => (res.ok ? res.json() : null))
			.then((res) => {
				const remote = res?.data?.workspace;
				const remoteUpdatedAt = Number(res?.data?.updatedAt) || 0;
				if (!remote || typeof remote !== 'object') return;

				// If remote is newer or local was completely empty, restore remote state
				if (remoteUpdatedAt > lastSyncedTimestampRef.current || lastSyncedTimestampRef.current === 0) {
					lastSyncedTimestampRef.current = remoteUpdatedAt;
					const s = setRef.current;
					if (remote.windows && typeof remote.windows === 'object') {
						store.restore({
							windows: remote.windows,
							activeApp: remote.activeApp && (remote.activeApp === 'portal' || APPS_CONFIG[remote.activeApp]) ? remote.activeApp : undefined,
						});
					}
					if (remote.activeWallpaper && typeof remote.activeWallpaper === 'string') {
						s.setWallpaper(remote.activeWallpaper);
					}
					if (typeof remote.brightness === 'number') s.setBrightness(remote.brightness);
					if (typeof remote.volume === 'number') s.setVolume(remote.volume);
					if (typeof remote.isMuted === 'boolean') s.setIsMuted(remote.isMuted);
					if (typeof remote.isDockAutoHide === 'boolean') s.setIsDockAutoHide(remote.isDockAutoHide);
					if (Array.isArray(remote.dockApps) && remote.dockApps.length > 0) {
						s.setDockApps(remote.dockApps);
					}

					// Update local IndexedDB with remote's fresh state
					saveWorkspaceSession({
						windows: remote.windows || {},
						activeApp: remote.activeApp,
						activeWallpaper: remote.activeWallpaper || shellRef.current.activeWallpaper,
						brightness: remote.brightness ?? shellRef.current.brightness,
						volume: remote.volume ?? shellRef.current.volume,
						isMuted: remote.isMuted ?? shellRef.current.isMuted,
						isDockAutoHide: remote.isDockAutoHide ?? shellRef.current.isDockAutoHide,
						dockApps: remote.dockApps || shellRef.current.dockApps,
						updatedAt: remoteUpdatedAt,
					});
				}
			})
			.catch((err) => {
				console.warn('Could not sync workspace from server:', err);
			});
	}, [isAuthenticated, store]);

	// 3. Debounced auto-save (Local IndexedDB + Server Sync)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const serverSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const save = () => {
			if (!isHydratedRef.current) return;
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				const { windows, activeApp } = store.getState();
				const persistedWindows = { ...windows };
				for (const manifest of INTERNAL_WINDOW_MANIFESTS) {
					const id = manifest.id as AppID;
					persistedWindows[id] = { ...persistedWindows[id], isOpen: false, isMinimized: false, isMaximized: false };
				}
				const now = Date.now();
				lastSyncedTimestampRef.current = now;
				const payload = { windows: persistedWindows, activeApp, ...shellRef.current, updatedAt: now };
				saveWorkspaceSession(payload);

				// Remote server sync when authenticated (throttled to 1.5s)
				if (isAuthenticated) {
					if (serverSyncTimerRef.current) clearTimeout(serverSyncTimerRef.current);
					serverSyncTimerRef.current = setTimeout(() => {
						fetch('/api/profile/workspace', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(payload),
						}).catch(() => {});
					}, 1500);
				}
			}, 300);
		};
		save();
		let last = store.getState();
		const unsubscribe = store.subscribe(() => {
			const now = store.getState();
			if (now.windows !== last.windows || now.activeApp !== last.activeApp) save();
			last = now;
		});
		return () => {
			unsubscribe();
			if (timerRef.current) clearTimeout(timerRef.current);
			if (serverSyncTimerRef.current) clearTimeout(serverSyncTimerRef.current);
		};
	}, [store, isAuthenticated, shell.activeWallpaper, shell.brightness, shell.volume, shell.isMuted, shell.isDockAutoHide, shell.dockApps]);

	// Drop every trace of the previous identity on logout
	useSessionEvent((event) => {
		if (event === 'logout') {
			remoteLoadedRef.current = false;
			clearWorkspaceSession().catch(() => {});
		}
	});
}
