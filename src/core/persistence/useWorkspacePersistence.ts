'use client';

import { useEffect, useRef } from 'react';
import type { AppID } from '@/types/workspace';
import { APPS_CONFIG, DEFAULT_DOCK_APPS } from '@/configs/apps.config';
import { useSessionEvent } from '@/core/session';
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
 * Keeps the workspace across reloads (IndexedDB): the windows and the active
 * app from the window store, the rest from `shell`.
 *
 * On start it puts the saved workspace back; afterwards every change is saved
 * after 300 ms of quiet. Role and user id are deliberately NOT stored: they are
 * server-owned, so a cached role can never outlive its session — and signing out
 * wipes what was saved for the previous identity.
 */
export function useWorkspacePersistence(shell: PersistedShell, set: PersistedSetters): void {
	const store = useWindowStore();
	const isHydratedRef = useRef(false);

	// Latest values for the save timer, which the window store also triggers.
	const shellRef = useRef(shell);
	useEffect(() => {
		shellRef.current = shell;
	});
	const setRef = useRef(set);
	useEffect(() => {
		setRef.current = set;
	});

	// 1. Put the saved workspace back on startup
	useEffect(() => {
		loadWorkspaceSession()
			.then((saved) => {
				isHydratedRef.current = true;
				if (saved) {
					const s = setRef.current;
					store.restore({
						windows: saved.windows,
						activeApp: saved.activeApp && (saved.activeApp === 'portal' || APPS_CONFIG[saved.activeApp]) ? saved.activeApp : undefined,
					});
					if (saved.activeWallpaper && WALLPAPERS.some((w) => w.src === saved.activeWallpaper)) {
						s.setWallpaper(saved.activeWallpaper);
					}
					if (typeof saved.brightness === 'number') s.setBrightness(saved.brightness);
					if (typeof saved.volume === 'number') s.setVolume(saved.volume);
					if (typeof saved.isMuted === 'boolean') s.setIsMuted(saved.isMuted);
					if (typeof saved.isDockAutoHide === 'boolean') s.setIsDockAutoHide(saved.isDockAutoHide);
					s.setDockApps(DEFAULT_DOCK_APPS);
				}
			})
			.catch((err) => {
				console.warn('Error hydrating session from IndexedDB:', err);
				isHydratedRef.current = true;
			});
	}, [store]);

	// 2. Debounced auto-save, on a window change or a change of `shell`
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		const save = () => {
			if (!isHydratedRef.current) return;
			// Without clearing, every change scheduled another save while the old one still fired.
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				const { windows, activeApp } = store.getState();
				saveWorkspaceSession({ windows, activeApp, ...shellRef.current, updatedAt: Date.now() });
			}, 300);
		};
		save();
		let last = store.getState();
		const unsubscribe = store.subscribe(() => {
			const now = store.getState();
			// A focus target or the cycle setting changing is not part of the saved workspace.
			if (now.windows !== last.windows || now.activeApp !== last.activeApp) save();
			last = now;
		});
		return () => {
			unsubscribe();
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [store, shell.activeWallpaper, shell.brightness, shell.volume, shell.isMuted, shell.isDockAutoHide, shell.dockApps]);

	// Drop every trace of the previous identity — a stale role must never be restored on the next page load.
	useSessionEvent((event) => {
		if (event === 'logout') clearWorkspaceSession().catch(() => {});
	});
}
