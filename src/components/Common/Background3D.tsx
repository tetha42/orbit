'use client';

import { useEffect, useRef } from 'react';
import { getCachedWebGLEvents, getOrInitWebGL, type WebGLApp } from './background3d/webglLoader';

/**
 * run    — animate (login screen, empty desktop)
 * freeze — keep the last frame on screen but stop drawing (windows open, lock screen)
 * off    — hidden and stopped (a static wallpaper, a maximised window)
 */
export type Background3DMode = 'run' | 'freeze' | 'off';

interface Background3DProps {
	mode?: Background3DMode;
}

export function Background3D({ mode = 'run' }: Background3DProps) {
	const wrapperRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const appRef = useRef<WebGLApp | null>(null);
	const isPaused = mode !== 'run';
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

				if (app.webgl?.renderer?.domElement) {
					const el = app.webgl.renderer.domElement;
					el.style.cssText =
						'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
					if (el.parentElement !== wrapper) {
						wrapper!.prepend(el);
					}
				}

				try {
					const tradingPage = app.webgl?.pages?.Trading;
					if (tradingPage) {
						app.webgl!.currentPage = tradingPage;
						const heroChapter = tradingPage.chapters?.Hero;
						if (heroChapter && !heroChapter.isActive) {
							heroChapter.enter?.();
						}
					}
				} catch {
					// Optional WebGL scene chapter hook; static gradient fallback remains active.
				}

				try {
					app.tools?.viewport?.resize?.();
					app.state?.emit(events.RESIZE);
					if (!pausedRef.current) {
						app.core?.ticker?.play?.();
					}
				} catch {
					// WebGL viewport/ticker may be unavailable under software/disabled-3D contexts.
				}
			} catch (err) {
				console.warn('3D background unavailable, using static fallback:', err);
			}
		}

		setupScene();

		const onResize = () => {
			try {
				appRef.current?.tools?.viewport?.resize?.();
				const events = getCachedWebGLEvents();
				if (events.RESIZE) {
					appRef.current?.state?.emit(events.RESIZE);
				}
			} catch {
				// Ignore WebGL resize failures if the rendering context was lost.
			}
		};
		window.addEventListener('resize', onResize, { signal: controller.signal });

		const onVisibilityChange = () => {
			try {
				if (document.hidden) {
					appRef.current?.core?.ticker?.pause?.();
				} else if (!pausedRef.current) {
					appRef.current?.core?.ticker?.play?.();
				}
			} catch {
				// Ignore ticker toggle errors when the WebGL context is unavailable or disposed.
			}
		};
		document.addEventListener('visibilitychange', onVisibilityChange, {
			signal: controller.signal,
		});

		return () => {
			isMounted = false;
			controller.abort();
			try {
				appRef.current?.core?.ticker?.pause?.();
			} catch {
				// Ignore ticker pause error during component unmount.
			}
		};
	}, []);

	useEffect(() => {
		const ticker = appRef.current?.core?.ticker;
		if (!ticker) return;
		try {
			if (isPaused) {
				ticker.pause?.();
			} else {
				ticker.play?.();
				appRef.current?.tools?.viewport?.resize?.();
				const events = getCachedWebGLEvents();
				if (events.RESIZE) {
					appRef.current?.state?.emit(events.RESIZE);
				}
			}
		} catch {
			// Ignore WebGL ticker/resize errors when context is unavailable.
		}
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
