'use client';

import { useState, useCallback } from 'react';
import { useSessionEvent } from '@/core/session';
import { DEFAULT_WALLPAPER, WALLPAPERS, nextWallpaper } from '@/core/theme';

function readInitialWallpaper(): string {
	if (typeof window !== 'undefined') {
		try {
			const saved = localStorage.getItem('club_active_wallpaper');
			// Custom wallpapers live under the custom asset route and are not in the
			// compile-time catalogue, so accept any well-formed image path here.
			if (
				saved &&
				(WALLPAPERS.some((w) => w.src === saved) ||
					saved.startsWith('/wallpapers/') ||
					saved.startsWith('/api/custom-assets/wallpapers/'))
			) {
				return saved;
			}
		} catch {
			// Storage may be blocked in private/sandboxed windows; fall back to DEFAULT_WALLPAPER.
		}
	}
	return DEFAULT_WALLPAPER;
}

export function useShellUiState() {
	const [activeWallpaper, setActiveWallpaper] = useState<string>(readInitialWallpaper);
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
					localStorage.setItem('club_active_wallpaper', nextWp);
				} catch {
					// Storage may be blocked in private windows; React state still updates.
				}
			}
			return nextWp;
		});
	}, []);

	const setWallpaper = useCallback((url: string) => {
		setActiveWallpaper(url);
		if (typeof window !== 'undefined') {
			try {
				localStorage.setItem('club_active_wallpaper', url);
			} catch {
				// Storage may be blocked in private windows; React state still updates.
			}
		}
	}, []);

	return {
		activeWallpaper,
		brightness,
		setBrightness,
		cycleWallpaper,
		setWallpaper,
		isAboutModalOpen,
		setIsAboutModalOpen,
		isSpotlightOpen,
		setIsSpotlightOpen,
		isWorkspaceAppletOpen,
		setIsWorkspaceAppletOpen,
		isControlCenterOpen,
		setIsControlCenterOpen,
		isNotificationCenterOpen,
		setIsNotificationCenterOpen,
		isCalendarOpen,
		setIsCalendarOpen,
	};
}
