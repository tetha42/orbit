'use client';

import type React from 'react';
import type { SnapTarget, WindowRect } from './windowGeometry';

export function paintWindowFrame(
	frameRef: React.RefObject<HTMLDivElement | null>,
	liveRect: React.MutableRefObject<WindowRect | null>,
	r: WindowRect,
	basePos?: { x: number; y: number }
) {
	liveRect.current = r;
	const el = frameRef.current;
	if (!el) return;
	if (basePos) {
		const dx = r.x - basePos.x;
		const dy = r.y - basePos.y;
		el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
		return;
	}
	el.style.transform = '';
	el.style.left = `${r.x}px`;
	el.style.top = `${r.y}px`;
	el.style.width = `${r.w}px`;
	el.style.height = `${r.h}px`;
}

export function attachDetachedSnapDrag(
	startX: number,
	startY: number,
	onDetach: (move: PointerEvent) => void
) {
	const stop = () => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', stop);
		window.removeEventListener('pointercancel', stop);
	};
	const onMove = (move: PointerEvent) => {
		if (move.pointerType === 'mouse' && move.buttons === 0) return stop();
		if (Math.hypot(move.clientX - startX, move.clientY - startY) < 4) return;
		stop();
		onDetach(move);
	};
	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', stop);
	window.addEventListener('pointercancel', stop);
}

export function commitDragSnapState(opts: {
	finalRect: WindowRect | null;
	snapTarget: SnapTarget;
	isMaximized: boolean;
	onUpdatePos: (x: number, y: number) => void;
	onToggleMaximize: () => void;
	onSetTile: (tile: SnapTarget) => void;
}) {
	if (opts.finalRect && opts.snapTarget === 'none') {
		opts.onUpdatePos(opts.finalRect.x, opts.finalRect.y);
	}
	if (opts.snapTarget === 'maximize') {
		if (!opts.isMaximized) opts.onToggleMaximize();
		opts.onSetTile('none');
	} else if (opts.snapTarget !== 'none') {
		if (opts.isMaximized) opts.onToggleMaximize();
		opts.onSetTile(opts.snapTarget);
	}
}
