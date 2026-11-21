import { detectBrowser, detectPlatform, type Platform } from '@/lib/client/pwaDetect';

export const OS_NAMES: Record<Platform, string> = {
	macos: 'macOS',
	windows: 'Windows',
	linux: 'Linux',
	ios: 'iOS',
	android: 'Android',
};

export function getInitialPlatform(): { platform: Platform; osName: string } {
	if (typeof window === 'undefined') return { platform: 'windows', osName: OS_NAMES.windows };
	const platform = detectPlatform(window.navigator.userAgent, window.navigator.maxTouchPoints);
	return { platform, osName: OS_NAMES[platform] };
}

export type InstallBlocker = 'insecure' | 'inapp' | 'firefox-desktop';

/** Reasons the browser will never offer an install here, explained up front. */
export function detectBlocker(platform: Platform): InstallBlocker | null {
	if (typeof window === 'undefined') return null;
	if (!window.isSecureContext) return 'insecure';
	const browser = detectBrowser(window.navigator.userAgent);
	if (browser === 'inapp') return 'inapp';
	if (browser === 'firefox' && platform !== 'android' && platform !== 'ios') return 'firefox-desktop';
	return null;
}

export function getBlockerMessage(
	blocker: InstallBlocker | null,
	t: (key: string, fallback?: string) => string
): string | null {
	if (blocker === 'insecure') {
		return t(
			'pwaBlockerInsecure',
			'This address is not secure (HTTPS), and browsers do not allow installing apps from insecure pages. Open the portal over https:// or contact your administrator.'
		);
	}
	if (blocker === 'inapp') {
		return t(
			'pwaBlockerInapp',
			'This is an embedded in-app browser, which cannot install web apps. Open the link in Chrome, Edge, or Safari.'
		);
	}
	if (blocker === 'firefox-desktop') {
		return t(
			'pwaBlockerFirefoxDesktop',
			'Desktop Firefox does not support installing web apps. Open the portal in Chrome, Edge, or Brave.'
		);
	}
	return null;
}
