'use client';

import { useSyncExternalStore } from 'react';
import { isInstalledApp } from '../pwaDetect';

/** Development builds may run in a normal tab; every other build must be installed. */
export const ALLOW_BROWSER_LOGIN = process.env.NODE_ENV === 'development';

export type InstallState = 'unknown' | 'installed' | 'browser';
export type PwaGate = 'checking' | 'wall' | 'open';

const INSTALLED_SESSION_KEY = 'orbit_pwa_installed_session_v2';
const LEGACY_INSTALLED_SESSION_KEY = 'beu_pwa_installed_session_v2';
let inMemoryInstalledLatch = false;

function readInstalledSession(): boolean {
	if (inMemoryInstalledLatch) return true;
	try {
		if (typeof sessionStorage !== 'undefined') {
			if (
				sessionStorage.getItem(INSTALLED_SESSION_KEY) === '1' ||
				sessionStorage.getItem(LEGACY_INSTALLED_SESSION_KEY) === '1'
			) {
				inMemoryInstalledLatch = true;
				return true;
			}
		}
	} catch {
		// Restricted storage or sandboxed environment
	}
	return false;
}

function markInstalledSession(): void {
	inMemoryInstalledLatch = true;
	try {
		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(INSTALLED_SESSION_KEY, '1');
		}
	} catch {
		// Storage quota/availability fallback
	}
}

const DISPLAY_QUERIES = [
	'(display-mode: standalone)',
	'(display-mode: minimal-ui)',
	'(display-mode: window-controls-overlay)',
	'(display-mode: fullscreen)',
] as const;

function readInstallState(): InstallState {
	if (typeof window === 'undefined') return 'unknown';

	let hasPwaLaunchParam = false;
	if (window.location?.search) {
		hasPwaLaunchParam =
			window.location.search.includes('source=pwa') ||
			window.location.search.includes('pwa=1');

		if (hasPwaLaunchParam) {
			markInstalledSession();
			try {
				const url = new URL(window.location.href);
				url.searchParams.delete('source');
				url.searchParams.delete('pwa');
				window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
			} catch {
				// URL cleanup fallback
			}
		}
	}

	const [standalone, minimalUi, windowControlsOverlay] = DISPLAY_QUERIES.slice(0, 3).map(
		(query) => window.matchMedia(query).matches
	);
	const rawInstalled = isInstalledApp({
		standalone,
		minimalUi,
		windowControlsOverlay,
		navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
		androidAppReferrer: document.referrer.startsWith('android-app://'),
	});

	if (rawInstalled || hasPwaLaunchParam) {
		markInstalledSession();
		return 'installed';
	}

	const isFullscreen =
		window.matchMedia('(display-mode: fullscreen)').matches ||
		(typeof document !== 'undefined' && !!document.fullscreenElement);

	if (isFullscreen && readInstalledSession()) return 'installed';
	if (readInstalledSession()) return 'installed';

	return 'browser';
}

function subscribeDisplayMode(onChange: () => void): () => void {
	const lists = DISPLAY_QUERIES.map((query) => window.matchMedia(query));
	lists.forEach((list) => list.addEventListener('change', onChange));
	if (typeof document !== 'undefined') {
		document.addEventListener('fullscreenchange', onChange);
	}
	return () => {
		lists.forEach((list) => list.removeEventListener('change', onChange));
		if (typeof document !== 'undefined') {
			document.removeEventListener('fullscreenchange', onChange);
		}
	};
}

/** Whether this page is an installed app. */
export function useInstallState(): InstallState {
	return useSyncExternalStore(subscribeDisplayMode, readInstallState, () => 'unknown');
}

const BYPASS_KEY = 'orbit_pwa_dev_bypass';
const LEGACY_BYPASS_KEY = 'beu_pwa_dev_bypass';
const bypassListeners = new Set<() => void>();

function readBypass(): boolean {
	try {
		return (
			sessionStorage.getItem(BYPASS_KEY) === '1' ||
			sessionStorage.getItem(LEGACY_BYPASS_KEY) === '1'
		);
	} catch {
		return false;
	}
}

function subscribeBypass(onChange: () => void): () => void {
	bypassListeners.add(onChange);
	return () => bypassListeners.delete(onChange);
}

/** Lets this tab past the wall. A no-op outside development. */
export function enableDevBypass(): void {
	if (!ALLOW_BROWSER_LOGIN) return;
	try {
		sessionStorage.setItem(BYPASS_KEY, '1');
	} catch {
		// Storage can be unavailable (private mode); the bypass simply doesn't stick.
	}
	bypassListeners.forEach((listener) => listener());
}

function useDevBypass(): boolean {
	return useSyncExternalStore(
		subscribeBypass,
		() => ALLOW_BROWSER_LOGIN && readBypass(),
		() => false
	);
}

/**
 * What to show: a neutral splash while the display mode is unknown, the download
 * page (`wall`) in a browser tab, or the portal (`open`).
 */
export function usePwaGate(options?: { allowSetup?: boolean }): PwaGate {
	const install = useInstallState();
	const bypassed = useDevBypass();
	if (options?.allowSetup) return 'open';
	if (install === 'unknown') return 'checking';
	if (install === 'installed') return 'open';
	if (bypassed) return 'open';
	return 'wall';
}
