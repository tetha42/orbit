'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AppID } from '@/types/workspace';
import { useIsActive, useWindow, useWindowActions } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { useShellActions } from '@/core/shell';
import { hasTextSelection, isEditableElement } from '@/lib/client/dom';
import { AppContent } from '@/core/apps/registry';
import { getSnapPreviewRectStyle, getWindowPositionStyle } from './frame/windowGeometry';
import { useWindowInteraction } from './frame/useWindowInteraction';
import { WindowTitlebar } from './frame/WindowTitlebar';
import { WindowResizeHandles } from './frame/WindowResizeHandles';

interface WindowFrameProps {
	appId: AppID;
}

const WindowAppContent = React.memo(function WindowAppContent({
	appId,
	close,
	minimize,
	maximize,
}: {
	appId: AppID;
	close: () => void;
	minimize: () => void;
	maximize: () => void;
}) {
	return (
		<AppContent
			appId={appId}
			instanceId={appId}
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
	const minW = meta.minWidth || 380;
	const minH = meta.minHeight || 260;
	const isActive = useIsActive(appId);

	const handleClose = useCallback(() => closeApp(appId), [closeApp, appId]);
	const handleMinimize = useCallback(() => minimizeApp(appId), [minimizeApp, appId]);
	const handleMaximize = useCallback(() => toggleMaximize(appId), [toggleMaximize, appId]);

	const [hasAnimatedOpen, setHasAnimatedOpen] = useState(false);
	useEffect(() => {
		if (!win?.isOpen) {
			setHasAnimatedOpen(false);
			return;
		}
		const timer = setTimeout(() => setHasAnimatedOpen(true), 300);
		return () => clearTimeout(timer);
	}, [win?.isOpen]);

	const frameRef = useRef<HTMLDivElement>(null);
	const {
		isDragging,
		isResizing,
		snapPreview,
		currentTile,
		setCurrentTile,
		handleTitlebarPointerDown,
		handleResizePointerDown,
	} = useWindowInteraction({
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
	});

	const handleFrameContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
		if (isEditableElement(e.target as Element) && hasTextSelection()) return;
		e.preventDefault();
		e.stopPropagation();
		focusApp(appId);
		openContextMenu({ x: e.clientX, y: e.clientY, mode: 'app', appId });
	};

	if (!win || !win.isOpen) return null;

	const positionStyle = getWindowPositionStyle(win.isMaximized, currentTile, win.position, win.size);

	return (
		<>
			{isDragging && snapPreview !== 'none' && (
				<div
					style={{
						position: 'fixed',
						zIndex: 9998,
						pointerEvents: 'none',
						border: '2px solid color-mix(in srgb, var(--cyan) 80%, transparent)',
						background: 'color-mix(in srgb, var(--cyan) 12%, transparent)',
						backdropFilter: 'var(--glass-blur-scrim)',
						borderRadius: snapPreview === 'maximize' ? '0' : '10px',
						boxShadow: '0 0 24px color-mix(in srgb, var(--cyan) 30%, transparent), inset 0 0 20px color-mix(in srgb, var(--cyan) 15%, transparent)',
						transition: 'all 120ms cubic-bezier(0.16, 1, 0.3, 1)',
						...getSnapPreviewRectStyle(snapPreview),
					}}
				/>
			)}

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
					willChange: isDragging ? 'transform' : isResizing ? 'top, left, width, height' : 'auto',
					...positionStyle,
					zIndex: win.zIndex,
					transition:
						isDragging || isResizing ? 'none' : 'top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease',
				}}
			>
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
					<WindowTitlebar
						appId={appId}
						title={meta.title}
						isDragging={isDragging}
						isMaximized={win.isMaximized}
						isTiled={currentTile !== 'none'}
						onPointerDown={handleTitlebarPointerDown}
						onDoubleClick={() => {
							if (currentTile !== 'none') setCurrentTile('none');
							else toggleMaximize(appId);
						}}
						onClose={() => closeApp(appId)}
						onMinimize={() => minimizeApp(appId)}
						onMaximize={() => {
							if (currentTile !== 'none') setCurrentTile('none');
							else toggleMaximize(appId);
						}}
					/>

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
							close={handleClose}
							minimize={handleMinimize}
							maximize={handleMaximize}
						/>
					</div>
				</div>

				{!win.isMaximized && currentTile === 'none' && !win.isMinimized && (
					<WindowResizeHandles onResizePointerDown={handleResizePointerDown} />
				)}
			</div>
		</>
	);
}
