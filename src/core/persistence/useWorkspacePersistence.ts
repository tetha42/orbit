'use client';

import { useEffect, useRef } from 'react';
import type { AppID } from '@/types/workspace';
import { APPS_CONFIG, DEFAULT_DOCK_APPS } from '@/configs/apps.config';
import { useSessionEvent } from '@/core/session';
import { clearWorkspaceSession, loadWorkspaceSession, saveWorkspaceSession } from '@/lib/client/indexedDB';
import { WALLPAPERS } from '@/core/theme';

/** Lightweight client-only shell preferences persisted in IndexedDB. Window positions/open states are ephemeral. */
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

function normalizeDockApps(candidate: unknown): AppID[] {
	if (!Array.isArray(candidate)) return DEFAULT_DOCK_APPS;
	const valid = candidate.filter((id): id is AppID => typeof id === 'string' && Boolean(APPS_CONFIG[id]));
	if (valid.length !== DEFAULT_DOCK_APPS.length || DEFAULT_DOCK_APPS.some((id) => !valid.includes(id))) {
		return DEFAULT_DOCK_APPS;
	}
	return valid;
}

/**
 * Persists lightweight desktop shell preferences (wallpaper, audio, brightness, dock)
 * locally in IndexedDB with zero server roundtrips and zero window location persistence.
 */
export function useWorkspacePersistence(shell: PersistedShell, set: PersistedSetters): void {
	const isHydratedRef = useRef(false);
	const shellRef = useRef(shell);
	useEffect(() => {
		shellRef.current = shell;
	});
	const setRef = useRef(set);
	useEffect(() => {
		setRef.current = set;
	});

	// 1. Hydrate client shell preferences on startup from singleton IndexedDB
	useEffect(() => {
		loadWorkspaceSession()
			.then((saved) => {
				isHydratedRef.current = true;
				if (saved) {
					const s = setRef.current;
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
					s.setDockApps(normalizeDockApps(saved.dockApps));
				}
			})
			.catch((err) => {
				console.warn('Error hydrating session from IndexedDB:', err);
				isHydratedRef.current = true;
			});
	}, []);

	// 2. Debounced local IndexedDB save when shell preferences change
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!isHydratedRef.current) return;
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			saveWorkspaceSession({
				...shellRef.current,
				updatedAt: Date.now(),
			});
		}, 300);

		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [
		shell.activeWallpaper,
		shell.brightness,
		shell.volume,
		shell.isMuted,
		shell.isDockAutoHide,
		shell.dockApps,
	]);

	useSessionEvent((event) => {
		if (event === 'logout') {
			clearWorkspaceSession().catch(() => {});
		}
	});
}
