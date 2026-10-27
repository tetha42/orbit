'use client';

import { useEffect, useRef } from 'react';

/**
 * run    — animate (login screen, empty desktop)
 * freeze — keep the last frame on screen but stop drawing (windows open, lock
 *          screen): the scene behind working windows was the main cost of an
 *          open app, especially under the windows' frosted backgrounds
 * off    — hidden and stopped (a static wallpaper, a maximised window)
 */
export type Background3DMode = 'run' | 'freeze' | 'off';

interface Background3DProps {
	mode?: Background3DMode;
}

/** Hashed Astro/Three.js bundle copied from the public landing site. */
const APP_MODULE_URL = '/_astro/App.66a1ff56.js';

/** Declared in src/types/globals.d.ts alongside the other window globals. */
type WebGLApp = WebGLAppHandle;

/**
 * Shared 3D WebGL aurora/mountain background used behind both the login portal
 * and the authenticated desktop workspace.
 *
 * The scene bundle is a pre-built ESM module that attaches itself to a wrapper
 * element plus canvas. It is loaded exactly once per document (guarded by
 * `window.__3d_inited`) because the bundle registers global tickers/listeners
 * that must not be duplicated.
 */
let webglInitPromise: Promise<{ app: WebGLApp; events: Record<string, unknown> }> | null = null;
let cachedEvents: Record<string, unknown> = {};

function getOrInitWebGL(
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
		// Load the pre-built browser ESM bundle without letting bundlers rewrite it.
		const mod = (await new Function('url', 'return import(url)')(APP_MODULE_URL)) as {
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
					await tradingPage.load();
				}
				tradingPage.beforeEnter?.();
				tradingPage.afterEnter?.();
				const heroChapter = tradingPage.chapters?.Hero;
				if (heroChapter) {
					if (!heroChapter.isLoaded) {
						await heroChapter.load();
					}
					if (!heroChapter.isActive) {
						heroChapter.enter();
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

export function Background3D({ mode = 'run' }: Background3DProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const appRef = useRef<WebGLApp | null>(null);
	const isPaused = mode !== 'run';
	// The scene is set up once; the latest mode is read from here, so changing it
	// no longer tears the scene down and builds it again.
	const pausedRef = useRef(isPaused);
	useEffect(() => {
		pausedRef.current = isPaused;
	});

	useEffect(() => {
		const wrapper = wrapperRef.current;
		const canvas = canvasRef.current;
		if (!wrapper || !canvas) return;

		let isMounted = true;
		const controller = new AbortController();

		async function setupScene() {
			try {
				const { app, events } = await getOrInitWebGL(wrapper!, canvas!);
				if (!isMounted) return;

				appRef.current = app;
				app.$wrapper = wrapper!;
				app.$canvas = canvas!;

				// Re-attach WebGL renderer DOM element if needed (e.g. after remount or wallpaper change)
				if (app.webgl?.renderer?.domElement) {
					const el = app.webgl.renderer.domElement;
					el.style.cssText =
						'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
					if (el.parentElement !== wrapper) {
						wrapper!.prepend(el);
					}
				}

				// Ensure Hero chapter is active
				try {
					const tradingPage = app.webgl?.pages?.Trading;
					if (tradingPage) {
						app.webgl!.currentPage = tradingPage;
						const heroChapter = tradingPage.chapters?.Hero;
						if (heroChapter && !heroChapter.isActive) {
							heroChapter.enter?.();
						}
					}
				} catch {}

				// Sizing & ticker
				try {
					app.tools?.viewport?.resize?.();
					app.state?.emit(events.RESIZE);
					if (!pausedRef.current) {
						app.core?.ticker?.play?.();
					}
				} catch {}
			} catch (err) {
				console.warn('3D background unavailable, using static fallback:', err);
			}
		}

		setupScene();

		const onResize = () => {
			try {
				appRef.current?.tools?.viewport?.resize?.();
				if (cachedEvents.RESIZE) {
					appRef.current?.state?.emit(cachedEvents.RESIZE);
				}
			} catch {}
		};
		window.addEventListener('resize', onResize, { signal: controller.signal });

		const onVisibilityChange = () => {
			try {
				if (document.hidden) {
					appRef.current?.core?.ticker?.pause?.();
				} else if (!pausedRef.current) {
					appRef.current?.core?.ticker?.play?.();
				}
			} catch {}
		};
		document.addEventListener('visibilitychange', onVisibilityChange, {
			signal: controller.signal,
		});

		return () => {
			isMounted = false;
			controller.abort();
			try {
				appRef.current?.core?.ticker?.pause?.();
			} catch {}
		};
	}, []);

	// React to isPaused prop changes directly
	useEffect(() => {
		const ticker = appRef.current?.core?.ticker;
		if (!ticker) return;
		try {
			if (isPaused) {
				ticker.pause?.();
			} else {
				ticker.play?.();
				appRef.current?.tools?.viewport?.resize?.();
				if (cachedEvents.RESIZE) {
					appRef.current?.state?.emit(cachedEvents.RESIZE);
				}
			}
		} catch {}
	}, [isPaused]);

	return (
		<div
			ref={wrapperRef}
			id="canvas-wrapper"
			style={{
				position: 'fixed',
				inset: 0,
				width: '100vw',
				height: '100vh',
				zIndex: 0,
				pointerEvents: 'none',
				overflow: 'hidden',
				// Static aurora fallback — visible while the bundle loads and if WebGL fails.
				background:
					'radial-gradient(ellipse 80% 60% at 50% 120%, #1e3a5f 0%, #0b1a2e 45%, #030712 100%)',
				visibility: mode === 'off' ? 'hidden' : 'visible',
				opacity: mode === 'off' ? 0 : 1,
				transition: 'opacity 200ms ease',
			}}
			aria-hidden="true"
		>
			<canvas
				ref={canvasRef}
				style={{
					display: 'block',
					width: '100%',
					height: '100%',
				}}
			/>
			{/* The scene bundle resolves pages/chapters from these markers and measures them
			    with getBoundingClientRect() to place the camera and compute scroll ranges, so
			    they must keep real dimensions. `display:none` would collapse them to 0x0 and
			    the scene would render nothing; `visibility:hidden` hides them from view while
			    preserving layout. */}
			<div
				aria-hidden="true"
				style={{
					position: 'fixed',
					inset: 0,
					zIndex: -1,
					visibility: 'hidden',
					pointerEvents: 'none',
					overflow: 'hidden',
				}}
			>
				<main data-scene="Trading" style={{ width: '100vw', height: '100vh' }}>
					<section
						data-chapter="Hero"
						data-chapter-first="true"
						style={{ width: '100%', height: '100vh' }}
					/>
				</main>
				<button id="scroll-top" type="button" tabIndex={-1} />
				<div className="buttons-container">
					<div className="sound">
						<canvas id="sound-canvas" />
					</div>
				</div>
				<header id="header">
					<div className="container-menu">
						<ul />
					</div>
					<div className="menu-cta" />
				</header>
			</div>
		</div>
	);
}
