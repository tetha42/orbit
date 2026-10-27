/**
 * Appearance preferences, with no browser or React in them so they can be tested
 * on their own (scripts/check-pure.mjs) and so the same rules run in the boot script.
 *
 * Four preferences, all kept in localStorage under `THEME_STORAGE_KEY`:
 *   theme         light | dark | system (follows prefers-color-scheme)
 *   accent        one of ACCENTS — the colour of the selected tab, primary button and focus ring
 *   transparency  frosted glass on or off; off is the default, because blurring what is behind
 *                 every window costs frames
 *   reduceMotion  true/false; null means "whatever the system says" (prefers-reduced-motion)
 *
 * They reach the page as attributes on <html> (see `htmlAttributes`): data-theme,
 * data-accent, data-transparency and data-motion. globals.css does the rest.
 */

export const THEME_STORAGE_KEY = 'kulup_theme';

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = 'light' | 'dark';

/** The six ready-made accents. Their colours live in globals.css (`[data-accent]`). */
export const ACCENTS = ['blue', 'purple', 'pink', 'orange', 'green', 'graphite'] as const;
export type Accent = (typeof ACCENTS)[number];

export interface ThemePrefs {
	theme: ThemeMode;
	accent: Accent;
	transparency: boolean;
	/** null: follow the system's prefers-reduced-motion. */
	reduceMotion: boolean | null;
}

export const DEFAULT_THEME_PREFS: ThemePrefs = {
	theme: 'system',
	accent: 'blue',
	transparency: false,
	reduceMotion: null,
};

export interface HtmlThemeAttributes {
	theme: ResolvedTheme;
	accent: Accent;
	transparency: 'on' | 'off';
	motion: 'reduce' | 'full';
}

export function isThemeMode(value: unknown): value is ThemeMode {
	return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

export function isAccent(value: unknown): value is Accent {
	return typeof value === 'string' && (ACCENTS as readonly string[]).includes(value);
}

/** Reads what localStorage held; anything unreadable or out of range falls back to the default, field by field. */
export function parseThemePrefs(raw: string | null | undefined): ThemePrefs {
	let data: unknown = null;
	try {
		data = raw ? JSON.parse(raw) : null;
	} catch {
		data = null;
	}
	const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
	return {
		theme: isThemeMode(o.theme) ? o.theme : DEFAULT_THEME_PREFS.theme,
		accent: isAccent(o.accent) ? o.accent : DEFAULT_THEME_PREFS.accent,
		transparency: typeof o.transparency === 'boolean' ? o.transparency : DEFAULT_THEME_PREFS.transparency,
		reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : DEFAULT_THEME_PREFS.reduceMotion,
	};
}

export function serializeThemePrefs(prefs: ThemePrefs): string {
	return JSON.stringify({ theme: prefs.theme, accent: prefs.accent, transparency: prefs.transparency, reduceMotion: prefs.reduceMotion });
}

/** The theme actually shown: "system" is whatever the OS prefers right now. */
export function resolveTheme(theme: ThemeMode, systemDark: boolean): ResolvedTheme {
	return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** Whether motion is reduced: the explicit choice, else the system setting. */
export function resolveReduceMotion(reduceMotion: boolean | null, systemReduced: boolean): boolean {
	return reduceMotion ?? systemReduced;
}

export function htmlAttributes(prefs: ThemePrefs, systemDark: boolean, systemReduced: boolean): HtmlThemeAttributes {
	return {
		theme: resolveTheme(prefs.theme, systemDark),
		accent: prefs.accent,
		transparency: prefs.transparency ? 'on' : 'off',
		motion: resolveReduceMotion(prefs.reduceMotion, systemReduced) ? 'reduce' : 'full',
	};
}

/** The explicit theme a quick toggle (menu item, Control Center) switches to. */
export function toggledTheme(current: ResolvedTheme): ResolvedTheme {
	return current === 'dark' ? 'light' : 'dark';
}

/**
 * A small script for <head> that runs before the first paint and writes the attributes
 * on <html>, so a dark theme never shows a light frame while React starts. It must stay
 * self-contained (no imports) and mirror `parseThemePrefs` + `htmlAttributes`; a check in
 * scripts/check-pure.mjs runs it against those. A storage error (private window) leaves the defaults.
 */
export function themeBootScript(): string {
	return `(function(){var d=document.documentElement,p={};try{var r=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||'null');if(r&&typeof r==='object')p=r}catch(e){}function m(q){try{return matchMedia(q).matches}catch(e){return false}}var t=p.theme==='light'||p.theme==='dark'?p.theme:m('(prefers-color-scheme: dark)')?'dark':'light';var a=${JSON.stringify(ACCENTS)}.indexOf(p.accent)>=0?p.accent:${JSON.stringify(DEFAULT_THEME_PREFS.accent)};var x=typeof p.reduceMotion==='boolean'?p.reduceMotion:m('(prefers-reduced-motion: reduce)');d.setAttribute('data-theme',t);d.setAttribute('data-accent',a);d.setAttribute('data-transparency',p.transparency===true?'on':'off');d.setAttribute('data-motion',x?'reduce':'full');d.classList.toggle('dark',t==='dark')})()`;
}
