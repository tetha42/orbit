'use client';

import type React from 'react';
import type { ResizeDirection } from './windowGeometry';

interface WindowResizeHandlesProps {
	onResizePointerDown: (dir: ResizeDirection, e: React.PointerEvent) => void;
}

export function WindowResizeHandles({ onResizePointerDown }: WindowResizeHandlesProps) {
	return (
		<>
			<div
				onPointerDown={(e) => onResizePointerDown('n', e)}
				style={{ position: 'absolute', top: -6, left: 12, right: 12, height: '12px', cursor: 'ns-resize', zIndex: 40, touchAction: 'none' }}
			/>
			<div
				onPointerDown={(e) => onResizePointerDown('s', e)}
				style={{ position: 'absolute', bottom: -6, left: 12, right: 12, height: '12px', cursor: 'ns-resize', zIndex: 40, touchAction: 'none' }}
			/>
			<div
				onPointerDown={(e) => onResizePointerDown('w', e)}
				style={{ position: 'absolute', top: 12, bottom: 12, left: -6, width: '12px', cursor: 'ew-resize', zIndex: 40, touchAction: 'none' }}
			/>
			<div
				onPointerDown={(e) => onResizePointerDown('e', e)}
				style={{ position: 'absolute', top: 12, bottom: 12, right: -6, width: '12px', cursor: 'ew-resize', zIndex: 40, touchAction: 'none' }}
			/>
			<div
				onPointerDown={(e) => onResizePointerDown('nw', e)}
				style={{ position: 'absolute', top: -8, left: -8, width: '18px', height: '18px', cursor: 'nwse-resize', zIndex: 41, touchAction: 'none' }}
			/>
			<div
				onPointerDown={(e) => onResizePointerDown('ne', e)}
				style={{ position: 'absolute', top: -8, right: -8, width: '18px', height: '18px', cursor: 'nesw-resize', zIndex: 41, touchAction: 'none' }}
			/>
			<div
				onPointerDown={(e) => onResizePointerDown('sw', e)}
				style={{ position: 'absolute', bottom: -8, left: -8, width: '18px', height: '18px', cursor: 'nesw-resize', zIndex: 41, touchAction: 'none' }}
			/>
			<div
				onPointerDown={(e) => onResizePointerDown('se', e)}
				style={{ position: 'absolute', bottom: -8, right: -8, width: '18px', height: '18px', cursor: 'nwse-resize', zIndex: 41, touchAction: 'none' }}
			/>
		</>
	);
}
