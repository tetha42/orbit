'use client';

import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useWindowActions, useWindows } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { useSession } from '@/core/session';
import { useShell } from '@/core/shell';
import { useTheme } from '@/core/theme';
import { APPS_CONFIG } from '@/configs/apps.config';
import { AppID, MenuItem } from '@/types/workspace';
import { MacOSMenu } from '@/components/Common/MacOSMenu';
import { AppIcon } from '@/components/Common/AppIcon';
import { appIconColor } from '@/core/apps/icons';

export function GlobalContextMenu() {
	const { canUseApp, canManageApp } = useSession();
	const { t, language, getAppMeta } = useI18n();
	const { openApp, closeApp, minimizeApp, tileWindows, minimizeAll, closeAll } = useWindowActions();
	const windows = useWindows();
	const { contextMenu, closeContextMenu, cycleWallpaper, setIsAboutModalOpen, appCustomMenus } = useShell();
	const { isDark, toggleTheme } = useTheme();

	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState(() => {
		const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
		return {
			x: Math.max(10, Math.min(contextMenu.x, winW - 230)),
			y: Math.max(30, Math.min(contextMenu.y, winH - 320)),
		};
	});

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				closeContextMenu();
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	}, [closeContextMenu]);

	useLayoutEffect(() => {
		if (!contextMenu.isOpen || !ref.current || typeof window === 'undefined') return;
		const rect = ref.current.getBoundingClientRect();
		const winWidth = window.innerWidth;
		const winHeight = window.innerHeight;

		let x = contextMenu.x;
		let y = contextMenu.y;

		// Flip / clamp horizontally
		if (x + rect.width > winWidth - 10) {
			x = Math.max(10, winWidth - rect.width - 10);
		}

		// Flip / clamp vertically
		if (y + rect.height > winHeight - 10) {
			y = Math.max(30, winHeight - rect.height - 10);
		}

		setPos({ x, y });
	}, [contextMenu.isOpen, contextMenu.x, contextMenu.y]);

	if (!contextMenu.isOpen) return null;

	let items: MenuItem[] = [];

	// Mode 1: Custom / Per-App Context Menu
	if (contextMenu.customItems && contextMenu.customItems.length > 0) {
		items = contextMenu.customItems;
	} else if (contextMenu.mode === 'app' && contextMenu.appId) {
		const custom = appCustomMenus[contextMenu.appId];
		if (custom && custom.length > 0) {
			items = custom;
		}
	}

	// Mode 2: Default Context Menu (used for desktop, or when an app has no custom context menu)
	if (items.length === 0) {
		items = [
			...(contextMenu.appId
				? [
						{
							id: 'app-close',
							label: language === 'tr' ? `${getAppMeta(contextMenu.appId).title} Kapat` : `Close ${getAppMeta(contextMenu.appId).title}`,
							shortcut: '⌘W',
							action: () => closeApp(contextMenu.appId!),
						},
						{
							id: 'app-minimize',
							label: language === 'tr' ? 'Simge Durumuna Küçült' : 'Minimize',
							shortcut: '⌘M',
							action: () => minimizeApp(contextMenu.appId!),
						},
						{ id: 'sep-app-actions', label: '', separator: true },
				  ]
				: []),
			// "New …" shortcuts only for those who manage that app.
			...(canManageApp('events')
				? [
						{
							id: 'dt-new-event',
							label: t('ctxNewEvent'),
							shortcut: '⇧⌘E',
							action: () => openApp('events'),
						},
				  ]
				: []),
			...(canManageApp('members')
				? [
						{
							id: 'dt-new-member',
							label: t('ctxNewMember'),
							shortcut: '⇧⌘M',
							action: () => openApp('members'),
						},
				  ]
				: []),
			...(canManageApp('budget')
				? [
						{
							id: 'dt-new-budget',
							label: t('ctxNewBudget'),
							shortcut: '⇧⌘B',
							action: () => openApp('budget'),
						},
				  ]
				: []),
			{ id: 'sep-tools', label: '', separator: true },
			{
				id: 'dt-open-tool',
				label: t('ctxOpenTool'),
				children: (Object.keys(APPS_CONFIG) as AppID[])
					.filter((appId) => canUseApp(appId))
					.map((appId) => ({
						id: `dt-app-${appId}`,
						label: getAppMeta(appId).title,
						icon: <AppIcon appId={appId} size={14} color={appIconColor(appId, 'menu')} />,
						checked: windows[appId]?.isOpen ?? false,
						action: () => openApp(appId),
					})),
			},
			{
				id: 'dt-arrange-windows',
				label: t('ctxArrangeWindows'),
				children: [
					{
						id: 'dt-tile',
						label: t('ctxTile'),
						shortcut: '⌃⌘T',
						action: () => tileWindows(),
					},
					{
						id: 'dt-minimize-all',
						label: t('ctxMinimizeAll'),
						shortcut: '⌘M',
						action: () => minimizeAll(),
					},
					{
						id: 'dt-close-all',
						label: t('ctxCloseAll'),
						action: () => closeAll(),
					},
				],
			},
			{ id: 'sep-desktop-settings', label: '', separator: true },
			{
				id: 'dt-wallpaper',
				label: t('ctxChangeWallpaper'),
				action: () => openApp('settings', { section: 'wallpaper' }),
			},
			{
				id: 'dt-next-wallpaper',
				label: t('ctxNextWallpaper'),
				action: () => cycleWallpaper(),
			},
			{
				id: 'dt-theme',
				label: isDark ? t('lightMode') : t('darkMode'),
				action: () => toggleTheme(),
			},
			{ id: 'sep-about', label: '', separator: true },
			{
				id: 'dt-about',
				label: t('menuAboutPortal'),
				action: () => setIsAboutModalOpen(true),
			},
		];
	}

	return (
		<div
			ref={ref}
			style={{
				position: 'fixed',
				left: `${pos.x}px`,
				top: `${pos.y}px`,
				zIndex: 999999,
			}}
		>
			<MacOSMenu
				items={items}
				onClose={closeContextMenu}
				style={{ width: '220px', minWidth: '220px' }}
			/>
		</div>
	);
}

export const DesktopContextMenu = GlobalContextMenu;
