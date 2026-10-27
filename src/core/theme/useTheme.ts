'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
	DEFAULT_THEME_PREFS,
	THEME_STORAGE_KEY,
	htmlAttributes,
	parseThemePrefs,
	resolveReduceMotion,
	resolveTheme,
	serializeThemePrefs,
	toggledTheme,
	type Accent,
	type ResolvedTheme,
	type ThemeMode,
	type ThemePrefs,
} from './pure';

/**
 * Appearance — theme, accent, transparency, reduced motion — as a small store outside
 * React. The preferences live in localStorage (the boot script in <head> reads the same
 * key before the first paint); this module keeps the attributes on <html> in step with
 * them and with the two system settings that can change under it (colour scheme, reduced
 * motion), whether or not any component is mounted.
 */

const DARK_QUERY = '(prefers-color-scheme: dark)';
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let prefs: ThemePrefs = DEFAULT_THEME_PREFS;
let loaded = false;
const listeners = new Set<() => void>();

function systemMatches(query: string): boolean {
	try {
		return window.matchMedia(query).matches;
	} catch {
		return false;
	}
}

function read(): ThemePrefs {
	try {
		return parseThemePrefs(localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		return DEFAULT_THEME_PREFS;
	}
}

function load(): ThemePrefs {
	if (!loaded && typeof window !== 'undefined') {
		loaded = true;
		prefs = read();
	}
	return prefs;
}

/** Writes the attributes on <html>; the boot script wrote the same ones before React started. */
function apply(): void {
	const a = htmlAttributes(load(), systemMatches(DARK_QUERY), systemMatches(MOTION_QUERY));
	const root = document.documentElement;
	root.setAttribute('data-theme', a.theme);
	root.setAttribute('data-accent', a.accent);
	root.setAttribute('data-transparency', a.transparency);
	root.setAttribute('data-motion', a.motion);
	root.classList.toggle('dark', a.theme === 'dark');
}

function emit(): void {
	apply();
	listeners.forEach((l) => l());
}

function update(patch: Partial<ThemePrefs>): void {
	prefs = { ...load(), ...patch };
	try {
		localStorage.setItem(THEME_STORAGE_KEY, serializeThemePrefs(prefs));
	} catch {
		// Private window or full storage: the choice still holds until the page is closed.
	}
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function subscribeMedia(query: string) {
	return (listener: () => void) => {
		const mq = window.matchMedia(query);
		mq.addEventListener('change', listener);
		return () => mq.removeEventListener('change', listener);
	};
}
const subscribeDark = subscribeMedia(DARK_QUERY);
const subscribeMotion = subscribeMedia(MOTION_QUERY);

/**
 * Keeps <html> in step with the preferences for the whole page: follows the system's
 * colour scheme and reduced-motion setting, and another tab's change. Mounted once, in WorkspaceProvider.
 */
export function ThemeSync(): null {
	useEffect(() => {
		load();
		apply();
		const dark = window.matchMedia(DARK_QUERY);
		const motion = window.matchMedia(MOTION_QUERY);
		const onSystem = () => emit();
		const onStorage = (e: StorageEvent) => {
			if (e.key !== THEME_STORAGE_KEY && e.key !== null) return;
			prefs = read();
			emit();
		};
		dark.addEventListener('change', onSystem);
		motion.addEventListener('change', onSystem);
		window.addEventListener('storage', onStorage);
		return () => {
			dark.removeEventListener('change', onSystem);
			motion.removeEventListener('change', onSystem);
			window.removeEventListener('storage', onStorage);
		};
	}, []);
	return null;
}

export interface ThemeValue {
	/** What the member chose: light, dark or system. */
	theme: ThemeMode;
	/** What is showing right now (system resolved). */
	resolvedTheme: ResolvedTheme;
	isDark: boolean;
	accent: Accent;
	transparency: boolean;
	/** Whether motion is reduced right now (the choice, else the system's). */
	reduceMotion: boolean;
	setTheme: (theme: ThemeMode) => void;
	/** Light ↔ dark, from what is showing now. */
	toggleTheme: () => void;
	setAccent: (accent: Accent) => void;
	setTransparency: (on: boolean) => void;
	setReduceMotion: (on: boolean) => void;
	/** Back to the defaults (system theme, blue, no transparency, system motion). */
	resetTheme: () => void;
}

const actions = {
	setTheme: (theme: ThemeMode) => update({ theme }),
	toggleTheme: () => update({ theme: toggledTheme(resolveTheme(load().theme, systemMatches(DARK_QUERY))) }),
	setAccent: (accent: Accent) => update({ accent }),
	setTransparency: (transparency: boolean) => update({ transparency }),
	setReduceMotion: (reduceMotion: boolean) => update({ reduceMotion }),
	resetTheme: () => update(DEFAULT_THEME_PREFS),
};

/** Theme, accent, transparency and reduced motion; changes apply at once and persist. */
export function useTheme(): ThemeValue {
	const current = useSyncExternalStore(subscribe, load, () => DEFAULT_THEME_PREFS);
	const systemDark = useSyncExternalStore(subscribeDark, () => systemMatches(DARK_QUERY), () => false);
	const systemReduced = useSyncExternalStore(subscribeMotion, () => systemMatches(MOTION_QUERY), () => false);
	return useMemo(() => {
		const resolvedTheme = resolveTheme(current.theme, systemDark);
		return {
			theme: current.theme,
			resolvedTheme,
			isDark: resolvedTheme === 'dark',
			accent: current.accent,
			transparency: current.transparency,
			reduceMotion: resolveReduceMotion(current.reduceMotion, systemReduced),
			...actions,
		};
	}, [current, systemDark, systemReduced]);
}
