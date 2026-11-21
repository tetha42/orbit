/** Hashed Astro/Three.js bundle copied from the public landing site. */
const APP_MODULE_URL = '/_astro/App.66a1ff56.js';

/** Declared in src/types/globals.d.ts alongside the other window globals. */
export type WebGLApp = WebGLAppHandle;

let webglInitPromise: Promise<{ app: WebGLApp; events: Record<string, unknown> }> | null = null;
let cachedEvents: Record<string, unknown> = {};

export function getCachedWebGLEvents(): Record<string, unknown> {
	return cachedEvents;
}

export function getOrInitWebGL(
	wrapper: HTMLElement,
	canvas: HTMLCanvasElement
): Promise<{ app: WebGLApp; events: Record<string, unknown> }> {
	if (typeof window !== 'undefined' && window.__webgl_app && window.__3d_inited) {
		return Promise.resolve({ app: window.__webgl_app, events: cachedEvents });
	}

	if (webglInitPromise) {
		return webglInitPromise;
	}

	webglInitPromise = (async () => {
		// Load the pre-built browser ESM bundle via native dynamic import (CSP-safe without unsafe-eval).
		const mod = (await import(
			/* webpackIgnore: true */
			/* turbopackIgnore: true */
			APP_MODULE_URL
		)) as {
			a: WebGLApp;
			E: Record<string, unknown>;
		};
		const app = mod.a;
		const events = mod.E ?? {};
		cachedEvents = events;

		// Neutralize Lenis smooth scroll manager from the imported Astro bundle.
		try {
			const astroGlobal = (mod as Record<string, unknown>).G as {
				scrollManager?: {
					lenis?: {
						destroy?: () => void;
						stop?: () => void;
						start?: () => void;
						raf?: (t: number) => void;
					};
				};
			} | undefined;
			if (astroGlobal?.scrollManager?.lenis) {
				astroGlobal.scrollManager.lenis.destroy?.();
				astroGlobal.scrollManager.lenis.start = () => {};
				astroGlobal.scrollManager.lenis.stop = () => {};
				astroGlobal.scrollManager.lenis.raf = () => {};
			}
		} catch (lenisErr) {
			console.warn('Lenis teardown skipped:', lenisErr);
		}

		window.__3d_inited = true;
		window.__webgl_app = app;

		await app.init(wrapper, canvas);
		app.state?.emit(events.ATTACH);

		// Start on the Trading / Hero chapter — the scene trimmed for this bundle.
		try {
			const tradingPage = app.webgl?.pages?.Trading;
			if (tradingPage) {
				app.webgl!.currentPage = tradingPage;
				if (!tradingPage.isLoaded) {
					await tradingPage.load?.();
				}
				tradingPage.beforeEnter?.();
				tradingPage.afterEnter?.();
				const heroChapter = tradingPage.chapters?.Hero;
				if (heroChapter) {
					if (!heroChapter.isLoaded) {
						await heroChapter.load?.();
					}
					if (!heroChapter.isActive) {
						heroChapter.enter?.();
					}
				}
			}
		} catch (chapterErr) {
			console.warn('3D background chapter init skipped:', chapterErr);
		}

		return { app, events };
	})().catch((err) => {
		webglInitPromise = null;
		if (typeof window !== 'undefined') {
			window.__3d_inited = false;
			window.__webgl_app = undefined;
		}
		throw err;
	});

	return webglInitPromise;
}
