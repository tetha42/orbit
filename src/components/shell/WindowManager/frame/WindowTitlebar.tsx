'use client';

import type React from 'react';
import type { AppID } from '@/types/workspace';
import { AppIcon } from '@/components/Common/AppIcon';
import { TrafficLights } from '../TrafficLights';

interface WindowTitlebarProps {
	appId: AppID;
	title: string;
	isDragging: boolean;
	isMaximized: boolean;
	isTiled: boolean;
	onPointerDown: (e: React.PointerEvent) => void;
	onDoubleClick: () => void;
	onClose: () => void;
	onMinimize: () => void;
	onMaximize: () => void;
}

export function WindowTitlebar({
	appId,
	title,
	isDragging,
	isMaximized,
	isTiled,
	onPointerDown,
	onDoubleClick,
	onClose,
	onMinimize,
	onMaximize,
}: WindowTitlebarProps) {
	return (
		<div
			onPointerDown={onPointerDown}
			onDoubleClick={onDoubleClick}
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
				cursor: isDragging ? 'grabbing' : isMaximized ? 'default' : 'grab',
				userSelect: 'none',
				touchAction: 'none',
				opacity: 1,
				pointerEvents: 'auto',
			}}
		>
			<TrafficLights
				onClose={onClose}
				onMinimize={onMinimize}
				onMaximize={onMaximize}
				isMaximized={isMaximized || isTiled}
			/>

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
				<span>{title}</span>
			</div>

			<div style={{ width: '64px' }} />
		</div>
	);
}
