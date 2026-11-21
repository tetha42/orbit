'use client';

import { useState, useEffect, useRef } from 'react';
import { Orbit } from 'lucide-react';
import { useActiveApp, useWindowActions } from '@/core/windows';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { useShellActions } from '@/core/shell';
import { getGlobalMenus } from '@/configs/menus.config';
import type { MenuItem } from '@/types/workspace';
import { useDialog } from '@/components/Common/DialogProvider';
import { useHelpDialogs } from '@/components/Common/HelpDialogs';
import { MenuDropdown } from './MenuDropdown';
import { bindMenuBarItems } from './menuBarActions';

export function MenuBar() {
	const { canUseApp, canManageApp, logout, lockWorkspace } = useSession();
	const { language, t } = useI18n();
	const { openApp, closeApp, minimizeApp, hideWindows, showAllWindows, toggleMaximize, tileWindows, resetLayout } = useWindowActions();
	const activeApp = useActiveApp();
	const { setIsAboutModalOpen, cycleWallpaper, setIsDockAutoHide } = useShellActions();
	const dialog = useDialog();
	const { showDocumentation, showSupport } = useHelpDialogs();

	const [openMenuId, setOpenMenuId] = useState<string | null>(null);
	const menuBarRef = useRef<HTMLDivElement>(null);

	const categories = getGlobalMenus(activeApp, language);

	useEffect(() => {
		if (!openMenuId) return;
		const handlePointerDown = (e: MouseEvent) => {
			if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
				setOpenMenuId(null);
			}
		};
		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, [openMenuId]);

	const bindActions = (items: MenuItem[]) =>
		bindMenuBarItems(items, {
			activeApp,
			canUseApp,
			canManageApp,
			openApp,
			closeApp,
			minimizeApp,
			hideWindows,
			showAllWindows,
			toggleMaximize,
			tileWindows,
			resetLayout,
			setIsAboutModalOpen,
			cycleWallpaper,
			setIsDockAutoHide,
			showAlert: (message, tone) => void dialog.alert({ message, tone }),
			showDocumentation,
			showSupport,
		});

	const appleMenuItems: MenuItem[] = [
		{ id: 'about-portal', label: t('menuAboutPortal'), action: () => setIsAboutModalOpen(true) },
		{ id: 'sep1', label: '', separator: true },
		{ id: 'preferences', label: t('menuPreferences'), action: () => openApp('settings') },
		{ id: 'sep3', label: '', separator: true },
		{ id: 'sleep', label: t('menuLockScreen'), action: () => lockWorkspace() },
		{ id: 'restart', label: t('menuRestart'), action: () => window.location.reload() },
		{ id: 'logout', label: t('menuLogout'), action: () => logout() },
	];

	return (
		<div
			ref={menuBarRef}
			style={{
				display: 'flex',
				alignItems: 'center',
				height: '100%',
				gap: '2px',
				fontSize: '13px',
			}}
		>
			<div style={{ position: 'relative' }}>
				<button
					data-menubar-category="apple"
					onClick={() => setOpenMenuId(openMenuId === 'apple' ? null : 'apple')}
					onMouseEnter={() => openMenuId && setOpenMenuId('apple')}
					title={t('menuAboutPortal')}
					style={{
						padding: '4px 8px',
						borderRadius: '4px',
						background: openMenuId === 'apple' ? 'var(--fill-strong)' : 'transparent',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'default',
						color: openMenuId === 'apple' ? 'var(--accent)' : 'inherit',
						transition: 'color 120ms ease, background 120ms ease',
					}}
				>
					<Orbit size={16} strokeWidth={2.2} style={{ display: 'block' }} />
				</button>

				{openMenuId === 'apple' && (
					<MenuDropdown items={appleMenuItems} onClose={() => setOpenMenuId(null)} />
				)}
			</div>

			{categories.map((cat, idx) => {
				const isDefault = cat.id === 'default';
				const isOpen = openMenuId === cat.id;

				return (
					<div key={cat.id || idx} style={{ position: 'relative' }}>
						<button
							data-menubar-category={cat.id}
							onClick={() => setOpenMenuId(isOpen ? null : cat.id)}
							onMouseEnter={() => openMenuId && setOpenMenuId(cat.id)}
							style={{
								padding: '2px 9px',
								borderRadius: '4px',
								fontWeight: isDefault ? 700 : 500,
								fontSize: '13px',
								background: isOpen ? 'var(--fill-strong)' : 'transparent',
								cursor: 'default',
								letterSpacing: '0.01em',
							}}
						>
							{cat.title}
						</button>

						{isOpen && (
							<MenuDropdown items={bindActions(cat.items)} onClose={() => setOpenMenuId(null)} />
						)}
					</div>
				);
			})}
		</div>
	);
}
