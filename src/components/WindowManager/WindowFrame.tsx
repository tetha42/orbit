'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppID } from '@/types/workspace';
import { useIsActive, useWindow, useWindowActions } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { useShellActions } from '@/core/shell';
import { TrafficLights } from './TrafficLights';
import { hasTextSelection, isEditableElement } from '@/lib/client/dom';

import { AppIcon } from '@/components/Common/AppIcon';
import { AppContent } from '@/core/apps/registry';

interface WindowFrameProps {
	appId: AppID;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const RESIZE_CURSORS: Record<ResizeDirection, string> = {
	n: 'ns-resize',
	s: 'ns-resize',
	e: 'ew-resize',
	w: 'ew-resize',
	ne: 'nesw-resize',
	sw: 'nesw-resize',
	nw: 'nwse-resize',
	se: 'nwse-resize',
};
type SnapTarget = 'none' | 'maximize' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Memoised so a window move or drag does not re-render the app inside it.
const WindowAppContent = React.memo(function WindowAppContent({
	appId,
	isForeground,
	close,
	minimize,
	maximize,
}: {
	appId: AppID;
	isForeground: boolean;
	close: () => void;
	minimize: () => void;
	maximize: () => void;
}) {
	return (
		<AppContent
			appId={appId}
			instanceId={appId}
			isForeground={isForeground}
			close={close}
			minimize={minimize}
			maximize={maximize}
		/>
	);
});

export function WindowFrame({ appId }: WindowFrameProps) {
	const { getAppMeta } = useI18n();
	const { focusApp, closeApp, minimizeApp, toggleMaximize, updateWindowPos, updateWindowSize } = useWindowActions();
	const { openContextMenu } = useShellActions();

	const win = useWindow(appId);
	const meta = getAppMeta(appId);
	// Plain numbers for the drag effect: `meta` is a new object on every render, and as an effect
	// dependency it re-subscribed the pointer listeners — cancelling the pending frame — on each one.
	const minW = meta.minWidth || 380;
	const minH = meta.minHeight || 260;
	const isActive = useIsActive(appId);

	const handleClose = useCallback(() => closeApp(appId), [closeApp, appId]);
	const handleMinimize = useCallback(() => minimizeApp(appId), [minimizeApp, appId]);
	const handleMaximize = useCallback(() => toggleMaximize(appId), [toggleMaximize, appId]);

	// Dragging & Resizing States
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0, winX: 0, winY: 0 });
	const [snapPreview, setSnapPreview] = useState<SnapTarget>('none');
	const [currentTile, setCurrentTile] = useState<SnapTarget>('none');

	const [isResizing, setIsResizing] = useState(false);
	const [resizeDir, setResizeDir] = useState<ResizeDirection | null>(null);
	const [resizeStart, setResizeStart] = useState({
		x: 0,
		y: 0,
		winX: 0,
		winY: 0,
		w: 0,
		h: 0,
	});

	/**
	 * Keeps the open animation to the initial mount only, so it does not re-trigger
	 * on focus, drag or resize (which caused a visible blink).
	 *
	 * Held in state rather than a ref: the value is read while rendering the
	 * window's style, and reading a ref during render can produce a stale or
	 * inconsistent value once React starts re-rendering concurrently.
	 */
	const [hasAnimatedOpen, setHasAnimatedOpen] = useState(false);
	useEffect(() => {
		// Cleared just after the 180ms animation finishes.
		const timer = setTimeout(() => setHasAnimatedOpen(true), 300);
		return () => clearTimeout(timer);
	}, []);

	// Keep saved floating bounds before snapping or maximizing
	const preSnapBounds = useRef({ x: 75, y: 50, w: 800, h: 520 });

	// Titlebar pointer down for dragging (mouse, pen, or touch)
	const handleTitlebarPointerDown = (e: React.PointerEvent) => {
		if (e.pointerType === 'mouse' && e.button !== 0) return; // Only primary button for mouse
		focusApp(appId);

		// If window was maximized or tiled, unsnap gently back to cursor — but only once the
		// pointer really moves: a plain click/tap (or the first half of a double-click/tap) on the
		// title bar must leave the window as it is.
		if (win.isMaximized || currentTile !== 'none') {
			const startX = e.clientX;
			const startY = e.clientY;
			const stop = () => {
				window.removeEventListener('pointermove', onMove);
				window.removeEventListener('pointerup', stop);
				window.removeEventListener('pointercancel', stop);
			};
			const onMove = (move: PointerEvent) => {
				if (move.pointerType === 'mouse' && move.buttons === 0) return stop();
				if (Math.hypot(move.clientX - startX, move.clientY - startY) < 4) return;
				stop();
				const savedW = preSnapBounds.current.w;
				const newX = Math.max(10, move.clientX - savedW / 2);
				const newY = Math.max(0, move.clientY - 20);

				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile('none');
				updateWindowPos(appId, newX, newY);

				setIsDragging(true);
				setDragStart({
					x: move.clientX,
					y: move.clientY,
					winX: newX,
					winY: newY,
				});
			};
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', stop);
			window.addEventListener('pointercancel', stop);
			return;
		}

		preSnapBounds.current = {
			x: win.position?.x ?? 75,
			y: win.position?.y ?? 50,
			w: win.size?.width ?? 800,
			h: win.size?.height ?? 520,
		};

		setIsDragging(true);
		setDragStart({
			x: e.clientX,
			y: e.clientY,
			winX: win.position?.x ?? 75,
			winY: win.position?.y ?? 50,
		});
	};

	// 8-Direction Resizing pointer down (mouse, pen, or touch)
	const handleResizePointerDown = (dir: ResizeDirection, e: React.PointerEvent) => {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();
		if (win.isMaximized || currentTile !== 'none') return;

		focusApp(appId);
		setIsResizing(true);
		setResizeDir(dir);
		setResizeStart({
			x: e.clientX,
			y: e.clientY,
			winX: win.position?.x ?? 75,
			winY: win.position?.y ?? 50,
			w: win.size?.width ?? 800,
			h: win.size?.height ?? 520,
		});
	};


	const handleFrameContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isEditableElement(e.target as Element) && hasTextSelection()) return;
		e.preventDefault();
		e.stopPropagation();

		// Right click first focuses the app, then opens the context menu
		focusApp(appId);
		openContextMenu({
			x: e.clientX,
			y: e.clientY,
			mode: 'app',
			appId,
		});
	};

	const rafIdRef = useRef<number | null>(null);
	/**
	 * While dragging or resizing, the window is moved by writing its style
	 * directly and the store is updated once, on release. Writing the store on
	 * every pointer move re-rendered the whole desktop (~60 components) per frame.
	 */
	const frameRef = useRef<HTMLDivElement>(null);
	const liveRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
	const snapRef = useRef<SnapTarget>('none');
	const setSnap = (next: SnapTarget) => {
		if (snapRef.current === next) return;
		snapRef.current = next;
		setSnapPreview(next);
	};
	const paint = (r: { x: number; y: number; w: number; h: number }) => {
		liveRect.current = r;
		const el = frameRef.current;
		if (!el) return;
		el.style.left = `${r.x}px`;
		el.style.top = `${r.y}px`;
		el.style.width = `${r.w}px`;
		el.style.height = `${r.h}px`;
	};

	// Global pointer movement & release listeners with 120Hz RAF throttle & boundary clamping
	useEffect(() => {
		if (!isDragging && !isResizing) return;

		// Prevent background text selection during window manipulation
		document.body.style.userSelect = 'none';
		if (isResizing && resizeDir) document.body.style.cursor = RESIZE_CURSORS[resizeDir];

		// Resizes for a pointer position. Shared by the throttled mousemove path and by mouseup,
		// which applies the final position itself: cancelling the pending frame on release used to
		// drop the last movement, so a drag ended short of where the pointer was let go.
		const applyResize = (clientX: number, clientY: number) => {
			if (!resizeDir) return;
			const dx = clientX - resizeStart.x;
			const dy = clientY - resizeStart.y;

			let newW = resizeStart.w;
			let newH = resizeStart.h;
			let newX = resizeStart.winX;
			let newY = resizeStart.winY;

			// East/West
			if (resizeDir.includes('e')) {
				newW = Math.max(minW, resizeStart.w + dx);
			} else if (resizeDir.includes('w')) {
				const potentialW = resizeStart.w - dx;
				if (potentialW >= minW) {
					newW = potentialW;
					newX = resizeStart.winX + dx;
				}
			}

			// North/South (Prevent resizing top edge above viewport)
			if (resizeDir.includes('s')) {
				newH = Math.max(minH, resizeStart.h + dy);
			} else if (resizeDir.includes('n')) {
				const potentialH = resizeStart.h - dy;
				if (potentialH >= minH) {
					newH = potentialH;
					newY = Math.max(0, resizeStart.winY + dy);
				}
			}

			paint({ x: newX, y: newY, w: newW, h: newH });
		};

		// Moves the window and picks the snap zone for a pointer position; used by the throttled
		// mousemove path and again by mouseup, so a release acts on where the pointer really is
		// even when the last frame was never painted.
		const applyDrag = (clientX: number, clientY: number) => {
			const dx = clientX - dragStart.x;
			const dy = clientY - dragStart.y;
			const winW = win.size?.width ?? 800;
			// Absolute boundary clamping: never go above TopBar (y < 0) or completely offscreen
			const newX = Math.max(-winW + 100, Math.min(window.innerWidth - 100, dragStart.winX + dx));
			const newY = Math.max(0, dragStart.winY + dy);

			paint({ x: newX, y: newY, w: win.size?.width ?? 800, h: win.size?.height ?? 520 });

			// macOS Sequoia / Aero Snap zones detection:
			if (clientY <= 55 && clientX <= 60) {
				setSnap('top-left');
			} else if (clientY <= 55 && clientX >= window.innerWidth - 60) {
				setSnap('top-right');
			} else if (clientY >= window.innerHeight - 80 && clientX <= 60) {
				setSnap('bottom-left');
			} else if (clientY >= window.innerHeight - 80 && clientX >= window.innerWidth - 60) {
				setSnap('bottom-right');
			} else if (clientY <= 34) {
				setSnap('maximize');
			} else if (clientX <= 20) {
				setSnap('left');
			} else if (clientX >= window.innerWidth - 20) {
				setSnap('right');
			} else {
				setSnap('none');
			}
		};

		const handlePointerMove = (e: PointerEvent) => {
			// For mouse, if button was released outside browser, stop dragging immediately.
			// For touch, pointerup/pointercancel handles release.
			if (e.pointerType === 'mouse' && e.buttons === 0) {
				handlePointerUp(e);
				return;
			}
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
			}

			rafIdRef.current = requestAnimationFrame(() => {
				if (isDragging) {
					applyDrag(e.clientX, e.clientY);
				} else if (isResizing && resizeDir) {
					applyResize(e.clientX, e.clientY);
				}
			});
		};

		const handlePointerUp = (e?: PointerEvent) => {
			document.body.style.userSelect = '';
			document.body.style.cursor = '';
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			// Land exactly where the pointer was released (a drag only: a plain click on the
			// title bar has painted nothing and must not move or snap the window).
			if (isResizing && e) applyResize(e.clientX, e.clientY);
			if (isDragging && e && liveRect.current) applyDrag(e.clientX, e.clientY);
			const finalRect = liveRect.current;
			liveRect.current = null;
			const snapTarget = snapRef.current;

			if (isDragging) {
				// One store write for the whole drag.
				if (finalRect && snapTarget === 'none') updateWindowPos(appId, finalRect.x, finalRect.y);
				// Apply snap upon release
				if (snapTarget === 'maximize') {
					if (!win.isMaximized) toggleMaximize(appId);
					setCurrentTile('none');
				} else if (snapTarget !== 'none') {
					if (win.isMaximized) toggleMaximize(appId);
					setCurrentTile(snapTarget);
				}
				setSnap('none');
				setIsDragging(false);
			}

			if (isResizing) {
				if (finalRect) {
					updateWindowSize(appId, finalRect.w, finalRect.h);
					if (finalRect.x !== resizeStart.winX || finalRect.y !== resizeStart.winY) updateWindowPos(appId, finalRect.x, finalRect.y);
				}
				setIsResizing(false);
				setResizeDir(null);
			}
		};

		window.addEventListener('pointermove', handlePointerMove, { passive: true });
		window.addEventListener('pointerup', handlePointerUp);
		window.addEventListener('pointercancel', handlePointerUp);

		return () => {
			document.body.style.userSelect = '';
			document.body.style.cursor = '';
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
			window.removeEventListener('pointercancel', handlePointerUp);
		};
	}, [isDragging, isResizing, resizeDir, dragStart, resizeStart, appId, updateWindowPos, updateWindowSize, toggleMaximize, win, minW, minH]);

	// Window Tiling & Management Keyboard Shortcuts (macOS Option+Cmd+Arrows or Alt+Ctrl+Arrows)
	useEffect(() => {
		if (!isActive || !win?.isOpen || win?.isMinimized) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (appId === 'terminal' || isEditableElement(document.activeElement)) return;
			const isCombo = (e.metaKey && e.altKey) || (e.ctrlKey && e.altKey);
			if (!isCombo) return;

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile((prev) => (prev === 'left' ? 'none' : 'left'));
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile((prev) => (prev === 'right' ? 'none' : 'right'));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setCurrentTile('none');
				if (!win.isMaximized) toggleMaximize(appId);
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				if (win.isMaximized) {
					toggleMaximize(appId);
				} else if (currentTile !== 'none') {
					setCurrentTile('none');
				} else {
					minimizeApp(appId);
				}
			} else if (e.key?.toLowerCase() === 'c') {
				e.preventDefault();
				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile('none');
				const targetW = win.size?.width ?? 800;
				const targetH = win.size?.height ?? 520;
				const cx = Math.max(20, Math.round((window.innerWidth - targetW) / 2));
				const cy = Math.max(36, Math.round((window.innerHeight - targetH) / 2));
				updateWindowPos(appId, cx, cy);
			}
		};

		// Capture phase: the 3D wallpaper stops keydown propagation at `document` (see the store).
		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [isActive, win?.isOpen, win?.isMinimized, win?.isMaximized, win?.size, currentTile, appId, toggleMaximize, minimizeApp, updateWindowPos]);

	if (!win || !win.isOpen) return null;

	// Calculate window dimensions based on state (Maximized, Tiled, or Floating)
	let positionStyle: React.CSSProperties = {
		top: `${win.position.y}px`,
		left: `${win.position.x}px`,
		width: `${win.size.width}px`,
		height: `${win.size.height}px`,
		borderRadius: 'var(--radius-window)',
	};

	if (win.isMaximized) {
		positionStyle = {
			top: 0,
			left: 0,
			width: '100vw',
			height: '100%',
			borderRadius: 0,
		};
	} else if (currentTile === 'left') {
		positionStyle = {
			top: 0,
			left: 0,
			width: '50vw',
			height: '100%',
			borderRadius: '0 8px 8px 0',
		};
	} else if (currentTile === 'right') {
		positionStyle = {
			top: 0,
			left: '50vw',
			width: '50vw',
			height: '100%',
			borderRadius: '8px 0 0 8px',
		};
	} else if (currentTile === 'top-left') {
		positionStyle = {
			top: 0,
			left: 0,
			width: '50vw',
			height: '50%',
			borderRadius: '0 0 8px 0',
		};
	} else if (currentTile === 'top-right') {
		positionStyle = {
			top: 0,
			left: '50vw',
			width: '50vw',
			height: '50%',
			borderRadius: '0 0 0 8px',
		};
	} else if (currentTile === 'bottom-left') {
		positionStyle = {
			top: '50%',
			left: 0,
			width: '50vw',
			height: '50%',
			borderRadius: '0 8px 0 0',
		};
	} else if (currentTile === 'bottom-right') {
		positionStyle = {
			top: '50%',
			left: '50vw',
			width: '50vw',
			height: '50%',
			borderRadius: '8px 0 0 0',
		};
	}

	return (
		<>
			{/* KDE / Sequoia Aero Snap Preview Outline Ghost */}
			{isDragging && snapPreview !== 'none' && (
				<div
					style={{
						position: 'fixed',
						zIndex: 9998,
						pointerEvents: 'none',
						border: '2px solid rgba(56, 189, 248, 0.8)',
						background: 'rgba(56, 189, 248, 0.12)',
						backdropFilter: 'var(--glass-blur-scrim)',
						borderRadius: snapPreview === 'maximize' ? '0' : '10px',
						boxShadow: '0 0 24px rgba(56, 189, 248, 0.3), inset 0 0 20px rgba(56, 189, 248, 0.15)',
						transition: 'all 120ms cubic-bezier(0.16, 1, 0.3, 1)',
						...(snapPreview === 'maximize'
							? { top: '28px', left: 0, width: '100vw', height: 'calc(100vh - 28px)' }
							: snapPreview === 'left'
							? { top: '28px', left: 0, width: '50vw', height: 'calc(100vh - 28px)' }
							: snapPreview === 'right'
							? { top: '28px', left: '50vw', width: '50vw', height: 'calc(100vh - 28px)' }
							: snapPreview === 'top-left'
							? { top: '28px', left: 0, width: '50vw', height: 'calc(50vh - 14px)' }
							: snapPreview === 'top-right'
							? { top: '28px', left: '50vw', width: '50vw', height: 'calc(50vh - 14px)' }
							: snapPreview === 'bottom-left'
							? { top: 'calc(50vh + 14px)', left: 0, width: '50vw', height: 'calc(50vh - 14px)' }
							: { top: 'calc(50vh + 14px)', left: '50vw', width: '50vw', height: 'calc(50vh - 14px)' }),
					}}
				/>
			)}

			{/* Main Window Frame Container */}
			<div
				ref={frameRef}
				data-lenis-prevent
				data-lenis-prevent-wheel
				data-lenis-prevent-touch
				onWheel={(e) => e.stopPropagation()}
				onPointerDownCapture={() => focusApp(appId)}
				onContextMenu={handleFrameContextMenu}
				style={{
					position: 'absolute',
					pointerEvents: win.isMinimized ? 'none' : 'auto',
					display: win.isMinimized ? 'none' : 'block',
					contentVisibility: win.isMinimized ? 'hidden' : 'visible',
					contain: isDragging ? 'strict' : 'layout',
					willChange: isDragging || isResizing ? 'top, left, width, height' : 'auto',
					...positionStyle,
					zIndex: win.zIndex,
					transition: isDragging || isResizing ? 'none' : 'top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease',
				}}
			>
				{/* Inner Window Visual Box (Rounded corners, backdrop blur, shadows, and content clipping) */}
				<div
					data-window-frame={appId}
					data-lenis-prevent
					data-lenis-prevent-wheel
					data-lenis-prevent-touch
					style={{
						width: '100%',
						height: '100%',
						display: 'flex',
						flexDirection: 'column',
						background: 'var(--vibrancy-window)',
						backdropFilter: 'var(--glass-blur)',
						contain: 'layout',
						border: win.isMaximized ? 'none' : '1px solid var(--window-border)',
						borderRadius: positionStyle.borderRadius,
						boxShadow: win.isMaximized
							? 'none'
							: isActive
								? 'var(--shadow-window-active)'
								: 'var(--shadow-window-inactive)',
						overflow: 'hidden',
						animation: hasAnimatedOpen ? 'none' : 'macosWindowOpen 180ms cubic-bezier(0.16, 1, 0.3, 1)',
						transition: isDragging || isResizing ? 'none' : 'border-radius 200ms ease, box-shadow 150ms ease',
					}}
				>
					{/* Window Titlebar */}
					<div
						onPointerDown={handleTitlebarPointerDown}
						onDoubleClick={() => {
							if (currentTile !== 'none') {
								setCurrentTile('none');
							} else {
								toggleMaximize(appId);
							}
						}}
						style={{
							height: '38px',
							flexShrink: 0,
							position: 'relative',
							zIndex: 50,
							background: 'var(--vibrancy-window)',
							borderBottom: '1px solid var(--window-border)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							padding: '0 12px',
							cursor: isDragging ? 'grabbing' : win.isMaximized ? 'default' : 'grab',
							userSelect: 'none',
							touchAction: 'none',
							opacity: 1,
							pointerEvents: 'auto',
						}}
					>
						{/* Traffic Lights (Window Controls) */}
						<TrafficLights
							onClose={() => closeApp(appId)}
							onMinimize={() => minimizeApp(appId)}
							onMaximize={() => {
								if (currentTile !== 'none') {
									setCurrentTile('none');
								} else {
									toggleMaximize(appId);
								}
							}}
							isMaximized={win.isMaximized || currentTile !== 'none'}
						/>

						{/* Title in center with subtle category badge */}
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
								fontSize: '13px',
								fontWeight: 600,
								letterSpacing: '-0.1px',
								color: 'inherit',
							}}
						>
							<AppIcon appId={appId} size={15} />
							<span>{meta.title}</span>
						</div>

						{/* Spacer on right for visual centering */}
						<div style={{ width: '64px' }} />
					</div>

					{/* Window Body / Native Workspace App Content (Acts like an iframe frame) */}
					<div
						className="mini-app-frame"
						data-app-id={appId}
						data-lenis-prevent
						data-lenis-prevent-wheel
						data-lenis-prevent-touch
						onWheel={(e) => e.stopPropagation()}
						style={{
							flex: '1 1 auto',
							minHeight: 0,
							height: 'calc(100% - 38px)',
							width: '100%',
							position: 'relative',
							isolation: 'isolate',
							overflowY: appId === 'terminal' || appId === 'settings' || appId === 'database' ? 'hidden' : 'auto',
							overflowX: 'hidden',
							overscrollBehavior: 'contain',
							WebkitOverflowScrolling: 'touch',
							display: 'block',
						}}
					>
						<WindowAppContent
							appId={appId}
							isForeground={isActive}
							close={handleClose}
							minimize={handleMinimize}
							maximize={handleMaximize}
						/>
					</div>
				</div>

				{/* KDE-style 8-Direction Resizing Handles (Placed on outer perimeter edges so they NEVER overlay the scrollbar!) */}
				{!win.isMaximized && currentTile === 'none' && !win.isMinimized && (
					<>
						{/* Edges - touch-friendly 12px hitboxes with touchAction: 'none' */}
						<div
							onPointerDown={(e) => handleResizePointerDown('n', e)}
							style={{ position: 'absolute', top: -6, left: 12, right: 12, height: '12px', cursor: 'ns-resize', zIndex: 40, touchAction: 'none' }}
						/>
						<div
							onPointerDown={(e) => handleResizePointerDown('s', e)}
							style={{ position: 'absolute', bottom: -6, left: 12, right: 12, height: '12px', cursor: 'ns-resize', zIndex: 40, touchAction: 'none' }}
						/>
						<div
							onPointerDown={(e) => handleResizePointerDown('w', e)}
							style={{ position: 'absolute', top: 12, bottom: 12, left: -6, width: '12px', cursor: 'ew-resize', zIndex: 40, touchAction: 'none' }}
						/>
						<div
							onPointerDown={(e) => handleResizePointerDown('e', e)}
							style={{ position: 'absolute', top: 12, bottom: 12, right: -6, width: '12px', cursor: 'ew-resize', zIndex: 40, touchAction: 'none' }}
						/>

						{/* Corners - generous 18x18px touch-friendly hitboxes */}
						<div
							onPointerDown={(e) => handleResizePointerDown('nw', e)}
							style={{ position: 'absolute', top: -8, left: -8, width: '18px', height: '18px', cursor: 'nwse-resize', zIndex: 41, touchAction: 'none' }}
						/>
						<div
							onPointerDown={(e) => handleResizePointerDown('ne', e)}
							style={{ position: 'absolute', top: -8, right: -8, width: '18px', height: '18px', cursor: 'nesw-resize', zIndex: 41, touchAction: 'none' }}
						/>
						<div
							onPointerDown={(e) => handleResizePointerDown('sw', e)}
							style={{ position: 'absolute', bottom: -8, left: -8, width: '18px', height: '18px', cursor: 'nesw-resize', zIndex: 41, touchAction: 'none' }}
						/>
						<div
							onPointerDown={(e) => handleResizePointerDown('se', e)}
							style={{ position: 'absolute', bottom: -8, right: -8, width: '18px', height: '18px', cursor: 'nwse-resize', zIndex: 41, touchAction: 'none' }}
						/>
					</>
				)}
			</div>
		</>
	);
}
