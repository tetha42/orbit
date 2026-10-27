'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from '@/core/session';
import { useHasWindow } from '@/core/windows';
import { useShell } from '@/core/shell';
import { DockItem } from './DockItem';
import { DockContextMenu } from './DockContextMenu';

/** Safari's prefixed fullscreen API, which lib.dom does not declare. */
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null };

export function Dock() {
	const { canUseApp } = useSession();
	const { dockApps, isDockAutoHide, dockContextMenu } = useShell();
	// Only treat as maximized if the window is currently open and not minimized
	const anyMaximized = useHasWindow((win) => win.isOpen && !win.isMinimized && win.isMaximized);
	// Keep dock visible if auto-hide is off, or if hovering, or if context menu is open, and not fullscreen or maximized
	const [isFullScreen, setIsFullScreen] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Keep dock visible if auto-hide is off, or if hovering, or if context menu is open, and not fullscreen or maximized
	const keepVisible = (!isFullScreen && !anyMaximized && (!isDockAutoHide || dockContextMenu.isOpen)) || isHovered;

	// An app the role does not open is not in the dock at all.
	const visibleDockApps = dockApps.filter((appId) => canUseApp(appId));

	const handleMouseEnter = () => {
		if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		setIsHovered(true);
	};

	const handleMouseLeave = () => {
		if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = setTimeout(() => {
			setIsHovered(false);
		}, 300);
	};

	useEffect(() => {
		const handleFullScreenChange = () => {
			// Exclude browser UI fullscreen (e.g., F11) which sets the <html> element as fullscreen
			const el = document.fullscreenElement || (document as FullscreenDocument).webkitFullscreenElement;
			const isAppFs = el && el.tagName !== 'HTML';
			setIsFullScreen(Boolean(isAppFs));
		};
		document.addEventListener('fullscreenchange', handleFullScreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
		return () => {
			if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
			document.removeEventListener('fullscreenchange', handleFullScreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
		};
	}, []);

	const shouldShowHotspot = isDockAutoHide || anyMaximized || isFullScreen;

	return (
		<>
			{/* Bottom trigger hotspot when dock is auto-hidden or obscured by maximized/fullscreen window */}
			{shouldShowHotspot && (
				<div
					onMouseEnter={handleMouseEnter}
					onPointerEnter={handleMouseEnter}
					style={{
						position: 'fixed',
						bottom: 0,
						left: 0,
						width: '100vw',
						height: '14px',
						zIndex: 9997,
						pointerEvents: 'auto',
						touchAction: 'none',
					}}
				/>
			)}

			<div
				data-dock=""
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				style={{
					position: 'fixed',
					bottom: '12px',
					left: '50%',
					transform: keepVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(calc(100% + 24px))',
					opacity: keepVisible ? 1 : 0,
					transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
					zIndex: 9998,
					background: 'var(--dock-bg)',
					backdropFilter: 'var(--glass-blur-strong)',
					border: '1px solid var(--dock-border)',
					borderRadius: '20px',
					padding: '8px 12px 6px',
					display: 'flex',
					alignItems: 'flex-end',
					gap: '10px',
					boxShadow: 'var(--shadow-dock)',
					userSelect: 'none',
				}}
			>
				{visibleDockApps.map((appId) => (
					<DockItem key={appId} appId={appId} />
				))}
			</div>

			<DockContextMenu />
		</>
	);
}
