'use client';

import React, { useState } from 'react';
import { AppID } from '@/types/workspace';
import { useIsActive, useWindow, useWindowActions } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { useShellActions } from '@/core/shell';
import { ModernAppIcon } from '@/components/Common/ModernAppIcon';
import { useDockBadge } from './useDockBadge';
import { appDockIcon } from '@/apps';
import { prefetchApp } from '@/core/apps/registry';

interface DockItemProps {
	appId: AppID;
}

export function DockItem({ appId }: DockItemProps) {
	const { getAppMeta } = useI18n();
	const { openApp } = useWindowActions();
	const isOpen = useWindow(appId).isOpen;
	const isActive = useIsActive(appId);
	const { openDockContextMenu } = useShellActions();
	const meta = getAppMeta(appId);
	const badge = useDockBadge(appId);

	const [isHovered, setIsHovered] = useState(false);
	const [imageError, setImageError] = useState(false);

	const iconSrc = appDockIcon(appId);
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		openApp(appId);
	};

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const rect = e.currentTarget.getBoundingClientRect();
		// The menu sits above the dock bar (not the icon, which is lifted while hovered).
		const bar = e.currentTarget.closest('[data-dock]')?.getBoundingClientRect();
		openDockContextMenu(appId, rect.left + rect.width / 2, Math.min(rect.top, bar?.top ?? rect.top));
	};

	return (
		<div
			style={{
				position: 'relative',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
			}}
			onMouseEnter={() => {
				setIsHovered(true);
				prefetchApp(appId);
			}}
			onMouseLeave={() => setIsHovered(false)}
		>
			{/* macOS Hover Tooltip */}
			{isHovered && (
				<div
					style={{
						position: 'absolute',
						top: '-36px',
						background: 'var(--menu-bg)',
						backdropFilter: 'var(--glass-blur)',
						border: '1px solid var(--menu-border)',
						borderRadius: '6px',
						boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
						padding: '4px 10px',
						fontSize: '12px',
						fontWeight: 500,
						whiteSpace: 'nowrap',
						color: 'var(--text-primary)',
						pointerEvents: 'none',
						zIndex: 9999,
						animation: 'macosMenuFade 120ms ease-out',
					}}
				>
					{meta.title}
				</div>
			)}

			{/* Dock App Icon */}
			<button
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				aria-label={meta.title}
				data-dock-app={appId}
				style={{
					// The magnification is a transform only: the icon keeps its 50px box, so
					// hovering never re-lays out the dock. scale(1.3) and the 14px lift give
					// the size and position the old 58px box with scale(1.12) had (≈65px).
					width: '50px',
					height: '50px',
					borderRadius: '12px',
					background: 'transparent',
					display: 'grid',
					placeItems: 'center',
					transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
					transform: isHovered ? 'translateY(-14px) scale(1.3)' : 'none',
					willChange: 'transform',
					cursor: 'pointer',
					position: 'relative',
					padding: 0,
					border: 'none',
					outline: 'none',
				}}
			>



				{!imageError && iconSrc ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={iconSrc}
						alt={meta.title}
						width={58}
						height={58}
						draggable={false}
						onError={() => setImageError(true)}
						style={{
							width: '100%',
							height: '100%',
							objectFit: 'contain',
							filter: isHovered
								? 'drop-shadow(0 14px 20px rgba(0, 0, 0, 0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
								: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.35))',
							transition: 'filter 180ms ease',
							userSelect: 'none',
							pointerEvents: 'none',
						}}
					/>
				) : (
					// No picture: the app's drawn icon (or its manifest icon on an accent tile).
					<ModernAppIcon appId={appId} size={50} />
				)}

				{badge > 0 && (
					<span
						data-dock-badge={badge}
						aria-label={`${badge}`}
						style={{
							position: 'absolute',
							top: '-4px',
							right: '-4px',
							minWidth: '18px',
							height: '18px',
							padding: '0 5px',
							boxSizing: 'border-box',
							borderRadius: '9px',
							background: 'var(--danger)',
							color: '#fff',
							fontSize: '11px',
							fontWeight: 700,
							lineHeight: '18px',
							textAlign: 'center',
							boxShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
							pointerEvents: 'none',
						}}
					>
						{badge > 99 ? '99+' : badge}
					</span>
				)}
			</button>

			{/* macOS Running Indicator Dot */}
			<div
				style={{
					width: '4px',
					height: '4px',
					borderRadius: '50%',
					background: 'var(--text-primary)',
					marginTop: '4px',
					opacity: isOpen ? (isActive ? 1 : 0.65) : 0,
					boxShadow: isOpen && isActive ? '0 0 4px var(--text-primary)' : 'none',
					transform: isOpen ? 'scale(1)' : 'scale(0.5)',
					transition: 'opacity 180ms ease, transform 180ms ease, box-shadow 180ms ease',
				}}
			/>
		</div>
	);
}
