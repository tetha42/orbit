'use client';

import { useSyncExternalStore } from 'react';
import { isInstalledApp } from './pwaDetect';

/**
 * Installed-app gate.
 *
 * Outside development the portal only runs as an installed PWA; a plain browser
 * tab is shown the download page instead. This is a product rule, not a security
 * boundary — the display mode is client-reported — so nothing on the server
 * trusts it, and it must never be able to lock anyone out by mistake (which is
 * why a false "not installed" only ever shows the download page, never an error).
 */

/** Development builds may run in a normal tab; every other build must be installed. */
export const ALLOW_BROWSER_LOGIN = process.env.NODE_ENV === 'development';

export type InstallState = 'unknown' | 'installed' | 'browser';
export type PwaGate = 'checking' | 'wall' | 'open';

/* ------------------------------------------------------------------ */
/* Display mode & Session Latch                                       */
/* ------------------------------------------------------------------ */

const INSTALLED_SESSION_KEY = 'orbit_pwa_installed_session_v2';
const LEGACY_INSTALLED_SESSION_KEY = 'beu_pwa_installed_session_v2';
let inMemoryInstalledLatch = false;

function readInstalledSession(): boolean {
	if (inMemoryInstalledLatch) return true;
	try {
		if (typeof sessionStorage !== 'undefined') {
			if (sessionStorage.getItem(INSTALLED_SESSION_KEY) === '1' || sessionStorage.getItem(LEGACY_INSTALLED_SESSION_KEY) === '1') {
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

	// 1. Check for PWA launch marker (e.g. from manifest.json start_url: "/?source=pwa")
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

	// 2. Query standard W3C display modes and proprietary native app flags
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

	// 3. When a desktop or mobile PWA enters fullscreen, W3C display-mode switches from
	// 'standalone' to 'fullscreen'. An ordinary browser tab doing F11 does NOT have
	// an established PWA session latch, preserving the install wall for browser tabs.
	const isFullscreen =
		window.matchMedia('(display-mode: fullscreen)').matches ||
		(typeof document !== 'undefined' && !!document.fullscreenElement);

	if (isFullscreen && readInstalledSession()) {
		return 'installed';
	}

	// 4. In-session persistence: if this tab was verified as a PWA launch, retain installed state
	if (readInstalledSession()) {
		return 'installed';
	}

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

/**
 * Whether this page is an installed app.
 *
 * `'unknown'` is what the server and the hydration pass see. It is a distinct
 * state so the UI can hold a neutral splash instead of guessing — guessing
 * "installed" flashed the whole portal at browser visitors before the check ran.
 */
export function useInstallState(): InstallState {
	return useSyncExternalStore(subscribeDisplayMode, readInstallState, () => 'unknown');
}

/* ------------------------------------------------------------------ */
/* Development-only bypass                                             */
/* ------------------------------------------------------------------ */

// Per tab (sessionStorage), not per browser. The old localStorage flag was
// permanent and nothing cleared it, so anyone who had ever pressed "open in
// browser" — or accepted an install prompt — never saw the download page again.
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

/* ------------------------------------------------------------------ */
/* Install prompt                                                      */
/* ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const promptListeners = new Set<() => void>();
const notifyPrompt = () => promptListeners.forEach((listener) => listener());

// Captured when this module loads, not when the download page mounts.
// `beforeinstallprompt` fires once, early, and usually before React has hydrated;
// a listener added from a component effect misses it and the page is left with
// only a manual-instructions fallback.
if (typeof window !== 'undefined') {
	const flagged = window as Window & { __orbitPwaBootstrapped?: boolean; __beuPwaBootstrapped?: boolean };
	// Guards against Fast Refresh evaluating the module again and stacking listeners.
	if (!flagged.__orbitPwaBootstrapped && !flagged.__beuPwaBootstrapped) {
		flagged.__orbitPwaBootstrapped = true;
		window.addEventListener('beforeinstallprompt', (event) => {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
			notifyPrompt();
		});
		window.addEventListener('appinstalled', () => {
			deferredPrompt = null;
			justInstalled = true;
			notifyPrompt();
		});
	}
}

function subscribePrompt(onChange: () => void): () => void {
	promptListeners.add(onChange);
	return () => promptListeners.delete(onChange);
}

/** True once the browser has offered the native install prompt. */
export function useCanPromptInstall(): boolean {
	return useSyncExternalStore(subscribePrompt, () => deferredPrompt !== null, () => false);
}

/** True after the browser reports the app was installed during this visit. */
export function useJustInstalled(): boolean {
	return useSyncExternalStore(subscribePrompt, () => justInstalled, () => false);
}

/**
 * Shows the native install prompt, if the browser has offered one.
 * `'unavailable'` means there is nothing to show — the caller falls back to
 * written instructions.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
	const event = deferredPrompt;
	if (!event) return 'unavailable';
	// A prompt event can be used once.
	deferredPrompt = null;
	notifyPrompt();
	await event.prompt();
	const { outcome } = await event.userChoice;
	return outcome;
}
