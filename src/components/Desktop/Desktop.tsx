'use client';

import React from 'react';
import { useShellActions, useShellState } from '@/core/shell';
import { useWindowActions } from '@/core/windows';
import { TopBar } from '@/components/TopBar/TopBar';
import { Dock } from '@/components/Dock/Dock';
import { WindowFrame } from '@/components/WindowManager/WindowFrame';
import { DesktopContextMenu } from './DesktopContextMenu';
import { AboutPortalModal } from './AboutPortalModal';
import { SpotlightModal } from './SpotlightModal';
import { NotificationsProvider } from '@/components/NotificationCenter/NotificationsProvider';
import { NotificationPanel } from '@/components/NotificationCenter/NotificationPanel';
import { isAuroraWallpaper } from '@/core/theme';
import { APPS_CONFIG } from '@/configs/apps.config';
import { AppID } from '@/types/workspace';
import { NoRoleNotice } from './NoRoleNotice';

export function Desktop() {
	const { activeWallpaper, brightness, isSpotlightOpen } = useShellState();
	const { openDesktopContextMenu } = useShellActions();
	const { focusApp } = useWindowActions();

	const handleDesktopClick = (e: React.MouseEvent) => {
		// If clicking directly on wallpaper background, switch focus to portal
		if (e.target === e.currentTarget) {
			focusApp('portal');
		}
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		openDesktopContextMenu(e.clientX, e.clientY);
	};


	return (
		<NotificationsProvider>
		<div
			data-lenis-prevent
			data-lenis-prevent-wheel
			data-lenis-prevent-touch
			onClick={handleDesktopClick}
			onContextMenu={handleContextMenu}
			style={{
				position: 'relative',
				width: '100vw',
				height: '100vh',
				overflow: 'hidden',
				backgroundImage:
					isAuroraWallpaper(activeWallpaper)
						? 'none'
						: `url(${activeWallpaper})`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				backgroundColor:
					isAuroraWallpaper(activeWallpaper)
						? 'transparent'
						: '#000000',
				fontFamily: 'var(--system-font)',
			}}
		>
			{/* Top Bar Header */}
			<TopBar />

			{/* Floating Workspace Windows Area */}
			<div
				data-lenis-prevent
				data-lenis-prevent-wheel
				data-lenis-prevent-touch
				style={{
					position: 'absolute',
					top: '28px',
					left: 0,
					width: '100vw',
					height: 'calc(100vh - 28px)',
					pointerEvents: 'none',
					overflow: 'hidden',
				}}
			>
				{(Object.keys(APPS_CONFIG) as AppID[]).map((appId) => (
					<WindowFrame key={appId} appId={appId} />
				))}
			</div>

			{/* A member whose role opens nothing yet is told why the dock is empty */}
			<NoRoleNotice />

			{/* Dock */}
			<Dock />

			{/* Desktop Context Menu */}
			<DesktopContextMenu />

			{/* About Club Portal Modal */}
			<AboutPortalModal />

			{/* Spotlight Search & Command Palette Modal */}
			{isSpotlightOpen && <SpotlightModal />}

			{/* Notification center: the bell lives in the top bar, the panel opens under it */}
			<NotificationPanel />

			{/* Hardware Display Brightness Filter Overlay */}
			{brightness < 100 && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						width: '100vw',
						height: '100vh',
						backgroundColor: '#000000',
						opacity: Math.max(0, ((100 - brightness) / 100) * 0.85),
						pointerEvents: 'none',
						zIndex: 99999999,
						transition: 'opacity 60ms ease',
					}}
				/>
			)}
		</div>
		</NotificationsProvider>
	);
}
