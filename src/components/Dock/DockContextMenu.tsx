'use client';

import { useRef, useEffect } from 'react';
import { useWindowActions, useWindows } from '@/core/windows';
import { useI18n } from '@/core/i18n';
import { useShell } from '@/core/shell';
import { MenuItem } from '@/types/workspace';
import { useSession } from '@/core/session';
import { MacOSMenu } from '@/components/Common/MacOSMenu';

export function DockContextMenu() {
	const { language, getAppMeta } = useI18n();
	const { openApp, closeApp, minimizeApp } = useWindowActions();
	const windows = useWindows();
	const { dockContextMenu, closeDockContextMenu, isDockAutoHide, toggleDockAutoHide } = useShell();
	const { canManageApp } = useSession();

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				closeDockContextMenu();
			}
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	}, [closeDockContextMenu]);

	if (!dockContextMenu.isOpen || !dockContextMenu.appId) return null;

	const appId = dockContextMenu.appId;
	const meta = getAppMeta(appId);
	const win = windows[appId];
	const isOpen = win.isOpen;

	// Build authentic macOS Dock context menu items
	const items: MenuItem[] = [
		{
			id: 'primary-action',
			label: isOpen
				? (language === 'tr' ? 'Öne Getir' : 'Bring to Front')
				: (language === 'tr' ? 'Uygulamayı Aç' : 'Open'),
			shortcut: isOpen ? '⏎' : '⌘O',
			action: () => {
				openApp(appId);
				closeDockContextMenu();
			},
		},
	];

	// App-specific quick shortcuts. "New …" ones only for those who manage that app, as on the desktop menu.
	if (appId === 'events' && canManageApp('events')) {
		items.push({
			id: 'dock-new-event',
			label: 'New University Event...',
			shortcut: '⇧⌘E',
			action: () => {
				openApp('events');
				closeDockContextMenu();
			},
		});
	} else if (appId === 'members' && canManageApp('members')) {
		items.push({
			id: 'dock-new-member',
			label: 'Register Club Member...',
			shortcut: '⇧⌘M',
			action: () => {
				openApp('members');
				closeDockContextMenu();
			},
		});
	} else if (appId === 'budget' && canManageApp('budget')) {
		items.push({
			id: 'dock-new-budget',
			label: 'Record Financial Transaction...',
			shortcut: '⇧⌘B',
			action: () => {
				openApp('budget');
				closeDockContextMenu();
			},
		});
	} else if (appId === 'notes') {
		items.push({
			id: 'dock-new-note',
			label: 'New Executive Scratchpad',
			shortcut: '⇧⌘N',
			action: () => {
				openApp('notes');
				closeDockContextMenu();
			},
		});
	}

	items.push(
		{ id: 'sep-options', label: '', separator: true },
		{
			id: 'dock-options',
			label: language === 'tr' ? 'Seçenekler' : 'Options',
			children: [
				{
					id: 'opt-keep-in-dock',
					label: language === 'tr' ? 'Dock’ta Tut' : 'Keep in Dock',
					checked: true,
					action: () => closeDockContextMenu(),
				},
				{
					id: 'opt-open-at-login',
					label: language === 'tr' ? 'Girişte Aç' : 'Open at Login',
					checked: false,
					action: () => closeDockContextMenu(),
				},
				{ id: 'sep-sub-opt', label: '', separator: true },
				{
					id: 'opt-dock-autohide',
					label: isDockAutoHide
						? (language === 'tr' ? 'Gizlemeyi Kapat' : 'Turn Hiding Off')
						: (language === 'tr' ? 'Otomatik Gizlemeyi Aç' : 'Turn Hiding On'),
					shortcut: '⌥⌘D',
					checked: isDockAutoHide,
					action: () => {
						toggleDockAutoHide();
						closeDockContextMenu();
					},
				},
			],
		},
		{
			id: 'dock-show-windows',
			label: language === 'tr' ? 'Tüm Pencereleri Göster' : 'Show All Windows',
			action: () => {
				openApp(appId);
				closeDockContextMenu();
			},
		}
	);

	if (isOpen) {
		items.push(
			{ id: 'sep-window-ctrl', label: '', separator: true },
			{
				id: 'dock-hide',
				label: language === 'tr' ? 'Gizle' : 'Hide',
				shortcut: '⌘H',
				action: () => {
					minimizeApp(appId);
					closeDockContextMenu();
				},
			},
			{
				id: 'dock-quit',
				label: language === 'tr' ? `Kapat: ${meta.shortTitle}` : `Quit ${meta.shortTitle}`,
				shortcut: '⌘Q',
				action: () => {
					closeApp(appId);
					closeDockContextMenu();
				},
			}
		);
	}

	return (
		<div
			ref={ref}
			style={{
				position: 'fixed',
				left: `${dockContextMenu.x}px`,
				// Just above the dock (`y` is the top of the bar or the lifted icon, whichever is
				// higher). A fixed 72 px left the menu's lower edge over the dock bar and its icons.
				bottom: `${Math.max(0, window.innerHeight - dockContextMenu.y + 8)}px`,
				zIndex: 999999,
				transform: 'translateX(-50%)',
			}}
		>
			<MacOSMenu
				items={items}
				onClose={closeDockContextMenu}
				style={{ width: '200px' }}
			/>
		</div>
	);
}
