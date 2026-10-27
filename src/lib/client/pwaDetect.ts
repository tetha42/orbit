/**
 * Pure helpers behind the PWA gate.
 *
 * No imports and no browser globals, so they run under plain Node
 * (`node scripts/check-pure.mjs`) as well as in the browser.
 */

export type Platform = 'macos' | 'windows' | 'linux' | 'ios' | 'android';
export type BrowserKind = 'chromium' | 'firefox' | 'safari' | 'inapp' | 'other';

/**
 * Which OS the visitor is on, for choosing the install instructions.
 *
 * Order matters. An iPhone's user agent contains "like Mac OS X", so testing for
 * "mac os" first (as the old code did) filed every iPhone under macOS. And since
 * iPadOS 13 the iPad reports itself as a Mac ("Macintosh"); the only tell is that
 * it has a touch screen, which no Mac has.
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
	const ua = userAgent.toLowerCase();
	if (/iphone|ipad|ipod/.test(ua)) return 'ios';
	if (ua.includes('macintosh') && maxTouchPoints > 1) return 'ios';
	if (ua.includes('android')) return 'android';
	if (ua.includes('windows')) return 'windows';
	if (ua.includes('macintosh') || ua.includes('mac os')) return 'macos';
	if (ua.includes('linux') || ua.includes('x11') || ua.includes('cros')) return 'linux';
	return 'windows';
}

/**
 * Coarse browser family, for explaining why an install is not possible.
 *
 * In-app browsers (Instagram, Facebook, WhatsApp, Android WebViews) come first:
 * they embed Chromium or WebKit but expose no way to install anything.
 */
export function detectBrowser(userAgent: string): BrowserKind {
	const ua = userAgent.toLowerCase();
	if (/fban|fbav|instagram|micromessenger|snapchat|tiktok|whatsapp|line\/|; wv\)/.test(ua)) return 'inapp';
	if (/firefox|fxios/.test(ua)) return 'firefox';
	if (/chrome|chromium|crios|edg\/|edga|edgios|opr\/|brave/.test(ua)) return 'chromium';
	if (ua.includes('safari')) return 'safari';
	return 'other';
}

export interface DisplayModeSignals {
	standalone: boolean;
	minimalUi: boolean;
	windowControlsOverlay: boolean;
	/** iOS Safari's proprietary `navigator.standalone`. */
	navigatorStandalone: boolean;
	/** Trusted Web Activity launches carry an `android-app://` referrer. */
	androidAppReferrer: boolean;
}

/**
 * True when the page is running as an installed app rather than in a browser tab.
 *
 * `fullscreen` is deliberately not counted. F11, and the app's own "enter full
 * screen" menu command, put an ordinary tab into `display-mode: fullscreen`; if
 * that counted as installed, the wall would lift for as long as the tab was
 * fullscreen and drop again — mid-session — when the user left it.
 */
export function isInstalledApp(signals: DisplayModeSignals): boolean {
	return (
		signals.standalone ||
		signals.minimalUi ||
		signals.windowControlsOverlay ||
		signals.navigatorStandalone ||
		signals.androidAppReferrer
	);
}
