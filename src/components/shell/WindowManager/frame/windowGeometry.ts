import type React from 'react';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const RESIZE_CURSORS: Record<ResizeDirection, string> = {
	n: 'ns-resize',
	s: 'ns-resize',
	e: 'ew-resize',
	w: 'ew-resize',
	ne: 'nesw-resize',
	sw: 'nesw-resize',
	nw: 'nwse-resize',
	se: 'nwse-resize',
};

export type SnapTarget =
	| 'none'
	| 'maximize'
	| 'left'
	| 'right'
	| 'top-left'
	| 'top-right'
	| 'bottom-left'
	| 'bottom-right';

export interface WindowRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export function detectSnapTarget(clientX: number, clientY: number): SnapTarget {
	if (clientY <= 55 && clientX <= 60) return 'top-left';
	if (clientY <= 55 && clientX >= window.innerWidth - 60) return 'top-right';
	if (clientY >= window.innerHeight - 80 && clientX <= 60) return 'bottom-left';
	if (clientY >= window.innerHeight - 80 && clientX >= window.innerWidth - 60) return 'bottom-right';
	if (clientY <= 34) return 'maximize';
	if (clientX <= 20) return 'left';
	if (clientX >= window.innerWidth - 20) return 'right';
	return 'none';
}

export function computeResizeRect(
	dir: ResizeDirection,
	start: { x: number; y: number; winX: number; winY: number; w: number; h: number },
	clientX: number,
	clientY: number,
	minW: number,
	minH: number
): WindowRect {
	const dx = clientX - start.x;
	const dy = clientY - start.y;
	let w = start.w;
	let h = start.h;
	let x = start.winX;
	let y = start.winY;

	if (dir.includes('e')) {
		w = Math.max(minW, start.w + dx);
	} else if (dir.includes('w')) {
		const potentialW = start.w - dx;
		if (potentialW >= minW) {
			w = potentialW;
			x = start.winX + dx;
		}
	}

	if (dir.includes('s')) {
		h = Math.max(minH, start.h + dy);
	} else if (dir.includes('n')) {
		const potentialH = start.h - dy;
		if (potentialH >= minH) {
			h = potentialH;
			y = Math.max(0, start.winY + dy);
		}
	}

	return { x, y, w, h };
}

export function getWindowPositionStyle(
	isMaximized: boolean,
	currentTile: SnapTarget,
	position: { x: number; y: number },
	size: { width: number; height: number }
): React.CSSProperties {
	if (isMaximized) {
		return { top: 0, left: 0, width: '100vw', height: '100%', borderRadius: 0 };
	}
	switch (currentTile) {
		case 'left':
			return { top: 0, left: 0, width: '50vw', height: '100%', borderRadius: '0 8px 8px 0' };
		case 'right':
			return { top: 0, left: '50vw', width: '50vw', height: '100%', borderRadius: '8px 0 0 8px' };
		case 'top-left':
			return { top: 0, left: 0, width: '50vw', height: '50%', borderRadius: '0 0 8px 0' };
		case 'top-right':
			return { top: 0, left: '50vw', width: '50vw', height: '50%', borderRadius: '0 0 0 8px' };
		case 'bottom-left':
			return { top: '50%', left: 0, width: '50vw', height: '50%', borderRadius: '0 8px 0 0' };
		case 'bottom-right':
			return { top: '50%', left: '50vw', width: '50vw', height: '50%', borderRadius: '8px 0 0 0' };
		default:
			return {
				top: `${position.y}px`,
				left: `${position.x}px`,
				width: `${size.width}px`,
				height: `${size.height}px`,
				borderRadius: 'var(--radius-window)',
			};
	}
}

export function getSnapPreviewRectStyle(snap: SnapTarget): React.CSSProperties {
	switch (snap) {
		case 'maximize':
			return { top: '28px', left: 0, width: '100vw', height: 'calc(100vh - 28px)' };
		case 'left':
			return { top: '28px', left: 0, width: '50vw', height: 'calc(100vh - 28px)' };
		case 'right':
			return { top: '28px', left: '50vw', width: '50vw', height: 'calc(100vh - 28px)' };
		case 'top-left':
			return { top: '28px', left: 0, width: '50vw', height: 'calc(50vh - 14px)' };
		case 'top-right':
			return { top: '28px', left: '50vw', width: '50vw', height: 'calc(50vh - 14px)' };
		case 'bottom-left':
			return { top: 'calc(50vh + 14px)', left: 0, width: '50vw', height: 'calc(50vh - 14px)' };
		default:
			return { top: 'calc(50vh + 14px)', left: '50vw', width: '50vw', height: 'calc(50vh - 14px)' };
	}
}
