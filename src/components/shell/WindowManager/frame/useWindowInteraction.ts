'use client';

import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { AppID, WindowState } from '@/types/workspace';
import {
	RESIZE_CURSORS,
	computeResizeRect,
	detectSnapTarget,
	type ResizeDirection,
	type SnapTarget,
	type WindowRect,
} from './windowGeometry';
import {
	paintWindowFrame,
	attachDetachedSnapDrag,
	commitDragSnapState,
} from './windowInteractionHelpers';
import { useWindowShortcuts } from './useWindowShortcuts';

interface UseWindowInteractionDeps {
	appId: AppID;
	win: WindowState | undefined;
	isActive: boolean;
	minW: number;
	minH: number;
	frameRef: React.RefObject<HTMLDivElement | null>;
	focusApp: (appId: AppID) => void;
	minimizeApp: (appId: AppID) => void;
	toggleMaximize: (appId: AppID) => void;
	updateWindowPos: (appId: AppID, x: number, y: number) => void;
	updateWindowSize: (appId: AppID, w: number, h: number) => void;
}

export function useWindowInteraction({
	appId,
	win,
	isActive,
	minW,
	minH,
	frameRef,
	focusApp,
	minimizeApp,
	toggleMaximize,
	updateWindowPos,
	updateWindowSize,
}: UseWindowInteractionDeps) {
	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0, winX: 0, winY: 0 });
	const [snapPreview, setSnapPreview] = useState<SnapTarget>('none');
	const [currentTile, setCurrentTile] = useState<SnapTarget>('none');

	const [isResizing, setIsResizing] = useState(false);
	const [resizeDir, setResizeDir] = useState<ResizeDirection | null>(null);
	const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, winX: 0, winY: 0, w: 0, h: 0 });

	const preSnapBounds = useRef({ x: 75, y: 50, w: 800, h: 520 });
	const rafIdRef = useRef<number | null>(null);
	const liveRect = useRef<WindowRect | null>(null);
	const snapRef = useRef<SnapTarget>('none');

	const setSnap = (next: SnapTarget) => {
		if (snapRef.current === next) return;
		snapRef.current = next;
		setSnapPreview(next);
	};

	// The shell turns glass blur off while any window is being dragged (globals.css keys on
	// `<html data-window-moving>`); removing the attribute on every pointer up keeps it from
	// sticking when the release lands outside the frame.
	useEffect(() => {
		const root = document.documentElement;
		if (!isDragging) {
			root.removeAttribute('data-window-moving');
			return;
		}
		root.setAttribute('data-window-moving', '');
		return () => root.removeAttribute('data-window-moving');
	}, [isDragging]);

	const handleTitlebarPointerDown = (e: React.PointerEvent) => {
		if (!win || (e.pointerType === 'mouse' && e.button !== 0)) return;
		focusApp(appId);

		if (win.isMaximized || currentTile !== 'none') {
			attachDetachedSnapDrag(e.clientX, e.clientY, (move) => {
				const savedW = preSnapBounds.current.w;
				const newX = Math.max(10, move.clientX - savedW / 2);
				const newY = Math.max(0, move.clientY - 20);
				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile('none');
				updateWindowPos(appId, newX, newY);
				setIsDragging(true);
				setDragStart({ x: move.clientX, y: move.clientY, winX: newX, winY: newY });
			});
			return;
		}

		preSnapBounds.current = {
			x: win.position?.x ?? 75,
			y: win.position?.y ?? 50,
			w: win.size?.width ?? 800,
			h: win.size?.height ?? 520,
		};
		setIsDragging(true);
		setDragStart({ x: e.clientX, y: e.clientY, winX: win.position?.x ?? 75, winY: win.position?.y ?? 50 });
	};

	const handleResizePointerDown = (dir: ResizeDirection, e: React.PointerEvent) => {
		if (!win || (e.pointerType === 'mouse' && e.button !== 0)) return;
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

	useEffect(() => {
		if ((!isDragging && !isResizing) || !win) return;

		document.body.style.userSelect = 'none';
		if (isResizing && resizeDir) document.body.style.cursor = RESIZE_CURSORS[resizeDir];

		const applyResize = (clientX: number, clientY: number) => {
			if (!resizeDir) return;
			paintWindowFrame(frameRef, liveRect, computeResizeRect(resizeDir, resizeStart, clientX, clientY, minW, minH));
		};

		const applyDrag = (clientX: number, clientY: number) => {
			const dx = clientX - dragStart.x;
			const dy = clientY - dragStart.y;
			const winW = win.size?.width ?? 800;
			const newX = Math.max(-winW + 100, Math.min(window.innerWidth - 100, dragStart.winX + dx));
			const newY = Math.max(0, dragStart.winY + dy);
			paintWindowFrame(
				frameRef,
				liveRect,
				{ x: newX, y: newY, w: winW, h: win.size?.height ?? 520 },
				{ x: win.position?.x ?? dragStart.winX, y: win.position?.y ?? dragStart.winY }
			);
			setSnap(detectSnapTarget(clientX, clientY));
		};

		const handlePointerUp = (e?: PointerEvent) => {
			document.body.style.userSelect = '';
			document.body.style.cursor = '';
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			if (isResizing && e) applyResize(e.clientX, e.clientY);
			if (isDragging && e && liveRect.current) applyDrag(e.clientX, e.clientY);
			if (frameRef.current) {
				frameRef.current.style.transform = '';
			}
			const finalRect = liveRect.current;
			liveRect.current = null;
			const snapTarget = snapRef.current;

			if (isDragging) {
				commitDragSnapState({
					finalRect,
					snapTarget,
					isMaximized: Boolean(win.isMaximized),
					onUpdatePos: (x, y) => updateWindowPos(appId, x, y),
					onToggleMaximize: () => toggleMaximize(appId),
					onSetTile: setCurrentTile,
				});
				setSnap('none');
				setIsDragging(false);
			}
			if (isResizing) {
				if (finalRect) {
					updateWindowSize(appId, finalRect.w, finalRect.h);
					if (finalRect.x !== resizeStart.winX || finalRect.y !== resizeStart.winY) {
						updateWindowPos(appId, finalRect.x, finalRect.y);
					}
				}
				setIsResizing(false);
				setResizeDir(null);
			}
		};

		const handlePointerMove = (e: PointerEvent) => {
			if (e.pointerType === 'mouse' && e.buttons === 0) {
				handlePointerUp(e);
				return;
			}
			if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = requestAnimationFrame(() => {
				if (isDragging) applyDrag(e.clientX, e.clientY);
				else if (isResizing && resizeDir) applyResize(e.clientX, e.clientY);
			});
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
	}, [isDragging, isResizing, resizeDir, dragStart, resizeStart, appId, frameRef, updateWindowPos, updateWindowSize, toggleMaximize, win, minW, minH]);

	useWindowShortcuts({
		appId,
		win,
		isActive,
		currentTile,
		setCurrentTile,
		toggleMaximize,
		minimizeApp,
		updateWindowPos,
	});

	return {
		isDragging,
		isResizing,
		snapPreview,
		currentTile,
		setCurrentTile,
		handleTitlebarPointerDown,
		handleResizePointerDown,
	};
}
