'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const INTERACTIVE_SELECTOR = 'button, input, textarea, select, a, label, [role="button"]';

/** Provides smooth pointer dragging for a modal / Zenity window header, clamped to the viewport. */
export function useDraggableSheet(enabled = true) {
	const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const [dragging, setDragging] = useState(false);
	const offsetRef = useRef(offset);
	useEffect(() => {
		offsetRef.current = offset;
	}, [offset]);

	const onHeaderMouseDown = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			if (!enabled || e.button !== 0) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest(INTERACTIVE_SELECTOR)) return;

			const startX = e.clientX;
			const startY = e.clientY;
			const origX = offsetRef.current.x;
			const origY = offsetRef.current.y;
			let active = false;

			const onMove = (move: MouseEvent) => {
				if (move.buttons === 0) {
					cleanup();
					return;
				}
				const dx = move.clientX - startX;
				const dy = move.clientY - startY;
				if (!active) {
					if (Math.hypot(dx, dy) < 3) return;
					active = true;
					setDragging(true);
					document.body.style.userSelect = 'none';
				}
				const maxX = Math.max(120, Math.floor(window.innerWidth * 0.42));
				const maxY = Math.max(80, Math.floor(window.innerHeight * 0.42));
				const clampedX = Math.max(-maxX, Math.min(maxX, origX + dx));
				const clampedY = Math.max(-maxY, Math.min(maxY, origY + dy));
				setOffset({ x: clampedX, y: clampedY });
			};

			const cleanup = () => {
				window.removeEventListener('mousemove', onMove);
				window.removeEventListener('mouseup', cleanup);
				if (active) {
					setDragging(false);
					document.body.style.userSelect = '';
				}
			};

			window.addEventListener('mousemove', onMove);
			window.addEventListener('mouseup', cleanup);
		},
		[enabled]
	);

	const onHeaderDoubleClick = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			if (!enabled) return;
			const target = e.target as HTMLElement | null;
			if (target?.closest(INTERACTIVE_SELECTOR)) return;
			setOffset({ x: 0, y: 0 });
		},
		[enabled]
	);

	const resetOffset = useCallback(() => setOffset({ x: 0, y: 0 }), []);

	return {
		offset,
		dragging,
		onHeaderMouseDown,
		onHeaderDoubleClick,
		resetOffset,
	};
}
