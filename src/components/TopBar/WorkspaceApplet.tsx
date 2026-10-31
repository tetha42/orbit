'use client';

import { useRef, useEffect } from 'react';
import { useSession } from '@/core/session';
import { useShell } from '@/core/shell';
import { useWindowActions, useWindows } from '@/core/windows';
import { APPS_CONFIG } from '@/configs/apps.config';
import { AppID, MenuItem } from '@/types/workspace';
import { MacOSMenu } from '@/components/Common/MacOSMenu';
import { Layers } from 'lucide-react';
import { AppIcon } from '@/components/Common/AppIcon';
import { appIconColor } from '@/core/apps/icons';
import { appShortcut } from '@/apps';

export function WorkspaceApplet() {
	const { canUseApp } = useSession();
	const { openApp, tileWindows, minimizeAll, closeAll } = useWindowActions();
	const windows = useWindows();
	const { isWorkspaceAppletOpen, setIsWorkspaceAppletOpen, setIsAboutModalOpen } = useShell();

	const ref = useRef<HTMLDivElement>(null);

	// Close on click outside
	useEffect(() => {
		const handlePointerDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setIsWorkspaceAppletOpen(false);
			}
		};
		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [setIsWorkspaceAppletOpen]);

	const openAppsCount = Object.values(windows || {}).filter((w) => w?.isOpen).length;

	// Build authentic macOS Status Extra Context Menu items
	const menuItems: MenuItem[] = [
		{ id: 'hdr-apps', label: 'Community Management Tools', header: true },
		...(Object.keys(APPS_CONFIG) as AppID[])
			.filter((appId) => canUseApp(appId))
			.map((appId) => {
			const meta = APPS_CONFIG[appId];
			const win = windows?.[appId];
			const isOpen = win?.isOpen ?? false;

			return {
				id: `app-${appId}`,
				label: meta.title,
				icon: <AppIcon appId={appId} size={14} color={appIconColor(appId, 'menu')} />,
				checked: isOpen,
				shortcut: appShortcut(appId),
		
				action: () => {
					openApp(appId);
					setIsWorkspaceAppletOpen(false);
				},
			};
		}),
		{ id: 'sep-quick', label: '', separator: true },
		{
			id: 'quick-actions',
			label: 'Quick Operations',
			children: [
				{
					id: 'act-new-team',
					label: 'Ar-Ge Takımlarını İncele...',
					shortcut: '⇧⌘T',
					action: () => openApp('teams'),
				},
				{
					id: 'act-new-event',
					label: 'Events & QR Attendance...',
					shortcut: '⇧⌘E',
					action: () => openApp('events'),
				},
				{
					id: 'act-new-cert',
					label: 'Sertifikalarım & Rozetler...',
					shortcut: '⇧⌘S',
					action: () => openApp('certificates'),
				},
				{
					id: 'act-new-inventory',
					label: 'Laboratuvar Donanım Talebi...',
					shortcut: '⇧⌘L',
					action: () => openApp('inventory'),
				},
				{
					id: 'act-new-budget',
					label: 'Kasa Hareketi Kaydet (Başkan)...',
					shortcut: '⇧⌘B',
					action: () => openApp('budget'),
				},
			],
		},
		{
			id: 'window-arrangements',
			label: 'Workspace Arrangement',
			children: [
				{
					id: 'tile-all',
					label: 'Tile All Workspace Windows',
					shortcut: '⌃⌘T',
					action: () => tileWindows(),
				},
				{
					id: 'minimize-all',
					label: 'Minimize All Windows',
					shortcut: '⌘M',
					action: () => minimizeAll(),
				},
				{
					id: 'close-all',
					label: 'Close All Windows',
					shortcut: '⌥⌘W',
					action: () => closeAll(),
				},
			],
		},
		{ id: 'sep-bottom', label: '', separator: true },
		{
			id: 'portal-about',
			label: 'About Orbit Community OS...',
			action: () => setIsAboutModalOpen(true),
		},
	];

	return (
		<div ref={ref} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
			{/* Menu Bar Status Icon */}
			<button
				onClick={() => setIsWorkspaceAppletOpen(!isWorkspaceAppletOpen)}
				title="Community Management Suite"
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '4px',
					padding: '2px 7px',
					borderRadius: '4px',
					background: isWorkspaceAppletOpen ? 'var(--fill-strong)' : 'transparent',
					cursor: 'default',
				}}
			>
				<Layers size={14} />
				{openAppsCount > 0 && (
					<span
						style={{
							fontSize: '10px',
							fontWeight: 700,
							background: 'var(--accent-blue)',
							color: '#fff',
							padding: '1px 5px',
							borderRadius: '10px',
							lineHeight: 1.1,
						}}
					>
						{openAppsCount}
					</span>
				)}
			</button>

			{/* Authentic macOS Menu Bar Extra Context Menu */}
			{isWorkspaceAppletOpen && (
				<div
					style={{
						position: 'absolute',
						top: '28px',
						right: 0,
						zIndex: 99999,
					}}
				>
					<MacOSMenu
						items={menuItems}
						onClose={() => setIsWorkspaceAppletOpen(false)}
						style={{ width: '250px' }}
					/>
				</div>
			)}
		</div>
	);
}
