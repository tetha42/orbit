'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveApp, useWindowActions } from '@/core/windows';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { useShellActions } from '@/core/shell';
import { getGlobalMenus } from '@/configs/menus.config';
import { MenuDropdown } from './MenuDropdown';
import { MenuItem } from '@/types/workspace';
import { Orbit } from 'lucide-react';
import { useDialog } from '@/components/Common/DialogProvider';
import { useHelpDialogs } from '@/components/Common/HelpDialogs';
import { refreshAllResources, sendAppCommand } from '@/core/commands';
import { openActivityReport } from '@/lib/client/activityReport';
import type { AppID } from '@/types/workspace';
import { downloadCsv } from '@/core/data/download';

/** True when the user is typing, i.e. when an edit command has a target. */
function isTextEntryFocused(): boolean {
	if (typeof document === 'undefined') return false;
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName;
	return (
		tag === 'INPUT' ||
		tag === 'TEXTAREA' ||
		tag === 'SELECT' ||
		(el as HTMLElement).isContentEditable
	);
}

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

	// Get active menu categories
	const categories = getGlobalMenus(activeApp, language);

	// Close menu on click outside
	useEffect(() => {
		const handlePointerDown = (e: MouseEvent) => {
			if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
				setOpenMenuId(null);
			}
		};
		window.addEventListener('pointerdown', handlePointerDown);
		return () => window.removeEventListener('pointerdown', handlePointerDown);
	}, []);

	// Attach real executable actions to menu items
	/**
	 * Runs a browser editing command against the focused field.
	 *
	 * These are the menu equivalents of ⌘C/⌘V; outside a text field there is
	 * nothing to act on, so the item is disabled unless an input has focus.
	 */
	const runEditCommand = (command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste') => ({
		action: () => document.execCommand(command),
		disabled: !isTextEntryFocused(),
	});

	/**
	 * Items with no behaviour behind them.
	 *
	 * They are marked disabled rather than left as silent no-ops: a menu entry
	 * that highlights on hover and does nothing is worse than one that visibly
	 * cannot be used.
	 */
	const NOT_IMPLEMENTED = new Set<string>([]);

	/** Opens the app (if needed) and hands it the command; the app does the rest. */
	const command = (appId: AppID, name: string) => () => {
		openApp(appId);
		sendAppCommand(appId, name);
	};

	/** An item that needs a level in some app is shown only to roles that hold it (the dock and search follow the same rule). */
	const izinli = (item: MenuItem) => {
		if (!item.needs) return true;
		return item.needs.level === 'yonet' ? canManageApp(item.needs.appId) : canUseApp(item.needs.appId);
	};

	/** Drops items the role does not allow, then any separator left leading, trailing or doubled. */
	const allowedItems = (items: MenuItem[]): MenuItem[] =>
		items
			.filter(izinli)
			.filter((item, i, arr) => !item.separator || (i > 0 && i < arr.length - 1 && !arr[i - 1].separator));

	const bindActions = (items: MenuItem[]): MenuItem[] => {
		return allowedItems(items).map((item) => {
			// "New X" opens the app that owns that workflow and hands it the command;
			// each app's own create affordance takes over from there. Declared by the
			// item (an app's manifest), not listed here.
			let action = item.command ? command(item.command.appId, item.command.name) : item.opens ? () => openApp(item.opens!) : item.action;
			let disabled = item.disabled;

			if (NOT_IMPLEMENTED.has(item.id)) {
				return { ...item, action: undefined, disabled: true };
			}

			switch (item.id) {
				case 'about-portal':
				case 'about-events':
				case 'about-members':
				case 'about-budget':
				case 'about-calendar':
				case 'about-notices':
				case 'about-notes':
				case 'about-settings':
				case 'about-soc':
					action = () => setIsAboutModalOpen(true);
					break;
				case 'preferences':
				case 'event-settings':
					action = () => openApp('settings');
					break;
				case 'hide':
					action = () => hideWindows();
					break;
				case 'hide-others':
					action = () => hideWindows(activeApp !== 'portal' ? activeApp : undefined);
					break;
				case 'bring-all-front':
					action = () => showAllWindows();
					break;
				case 'refresh-data':
					action = () => refreshAllResources();
					break;
				case 'tile-windows':
					action = () => tileWindows();
					break;
				case 'reset-layout':
					action = () => resetLayout();
					break;
				case 'toggle-wallpapers':
					action = () => cycleWallpaper();
					break;
				case 'toggle-dock':
					action = () => setIsDockAutoHide((prev) => !prev);
					break;
				case 'enter-fullscreen':
					action = () => {
						if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
						else document.documentElement.requestFullscreen().catch(() => {});
					};
					break;
				case 'close':
				case 'close-events':
					if (activeApp !== 'portal') action = () => closeApp(activeApp);
					break;
				case 'minimize':
					if (activeApp !== 'portal') action = () => minimizeApp(activeApp);
					break;
				case 'zoom':
					if (activeApp !== 'portal') action = () => toggleMaximize(activeApp);
					break;
				case 'export-report':
					action = async () => {
						const r = await openActivityReport();
						if (r === 'popup') void dialog.alert({ message: 'Tarayıcı açılır pencereyi engelledi; bu site için izin verin.', tone: 'warning' });
						else if (r === 'error') void dialog.alert({ message: 'Rapor hazırlanamadı.', tone: 'danger' });
					};
					break;
				case 'export-roster':
					action = async () => {
						try {
							const res = await fetch('/api/members');
							const data = (await res.json()) as { members?: { ad: string; soyad: string; bolum: string; sinif: number; rolAd?: string | null; status: string; xp?: number }[] };
							if (!res.ok || !data.members) throw new Error();
							// toCsv quotes commas and neutralises cells Excel would run as formulas;
							// the old hand-joined line broke on "Bilgisayar Mühendisliği, Çift Anadal".
							downloadCsv(
								'uye_listesi',
								['Ad', 'Soyad', 'Bölüm', 'Sınıf', 'Role', 'Durum', 'XP'],
								data.members.map((m) => [m.ad, m.soyad, m.bolum, m.sinif, m.rolAd ?? '—', m.status, m.xp ?? 0])
							);
						} catch {
							void dialog.alert({ message: 'Üye listesi indirilemedi.', tone: 'danger' });
						}
					};
					break;
				case 'documentation':
					action = showDocumentation;
					break;
				case 'support':
					action = showSupport;
					break;
				case 'undo':
				case 'redo':
				case 'cut':
				case 'copy':
				case 'paste': {
					const { action: editAction, disabled: editDisabled } = runEditCommand(
						item.id as 'undo' | 'redo' | 'cut' | 'copy' | 'paste'
					);
					action = editAction;
					disabled = editDisabled;
					break;
				}
			}

			return { ...item, action, disabled };
		});
	};

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
			{/* Apple Logo Menu */}
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

			{/* Dynamic App Categories */}
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
