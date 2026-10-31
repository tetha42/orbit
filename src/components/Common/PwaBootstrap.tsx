'use client';

import { useEffect } from 'react';
// Imported for its side effect: `@/lib/client/pwa` attaches the
// `beforeinstallprompt` / `appinstalled` listeners as soon as the client bundle
// loads. Mounting this in the root layout (rather than importing the module from
// the download page) is what lets it catch the event, which usually fires before
// the page's own components have hydrated.
import '@/lib/client/pwa';

/**
 * Installed desktop PWAs should use the whole screen. Browsers only allow the
 * Fullscreen API from a user gesture, so the first pointer/key interaction after
 * launch is used once; a denied request is ignored and the app stays usable.
 */
export function PwaBootstrap() {
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const installed =
			window.matchMedia('(display-mode: standalone)').matches ||
			window.matchMedia('(display-mode: fullscreen)').matches ||
			Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
		if (!installed || document.fullscreenElement) return;

		let done = false;
		const cleanup = () => {
			window.removeEventListener('pointerdown', enter, true);
			window.removeEventListener('keydown', enter, true);
		};
		const enter = () => {
			if (done) return;
			done = true;
			cleanup();
			const element = document.documentElement as HTMLElement & {
				webkitRequestFullscreen?: () => Promise<void> | void;
			};
			try {
				const request = element.requestFullscreen?.() ?? element.webkitRequestFullscreen?.();
				if (request && typeof (request as Promise<void>).catch === 'function') {
					void (request as Promise<void>).catch(() => {});
				}
			} catch {
				// Fullscreen is a progressive enhancement; never block the workspace.
			}
		};

		window.addEventListener('pointerdown', enter, { capture: true, once: true });
		window.addEventListener('keydown', enter, { capture: true, once: true });
		return cleanup;
	}, []);

	return null;
}
