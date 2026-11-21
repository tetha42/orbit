'use client';

import type { AppID, MenuItem } from '@/types/workspace';
import { refreshAllResources, sendAppCommand } from '@/core/commands';
import { openActivityReport } from '@/lib/client/activityReport';
import { translate, type Language } from '@/lib/i18n';

function getStoredMenuLocale(): Language {
	if (typeof window !== 'undefined' && window.localStorage.getItem('orbit_locale') === 'en') {
		return 'en';
	}
	return 'tr';
}
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

function runEditCommand(command: 'undo' | 'redo' | 'cut' | 'copy' | 'paste') {
	return {
		action: () => document.execCommand(command),
		disabled: !isTextEntryFocused(),
	};
}

export interface MenuBarActionDeps {
	activeApp: AppID | 'portal';
	canUseApp: (appId: AppID) => boolean;
	canManageApp: (appId: AppID) => boolean;
	openApp: (appId: AppID) => void;
	closeApp: (appId: AppID) => void;
	minimizeApp: (appId: AppID) => void;
	hideWindows: (exceptAppId?: AppID) => void;
	showAllWindows: () => void;
	toggleMaximize: (appId: AppID) => void;
	tileWindows: () => void;
	resetLayout: () => void;
	setIsAboutModalOpen: (open: boolean) => void;
	cycleWallpaper: () => void;
	setIsDockAutoHide: (updater: (prev: boolean) => boolean) => void;
	showAlert: (message: string, tone: 'warning' | 'danger') => void;
	showDocumentation: () => void;
	showSupport: () => void;
}

export function bindMenuBarItems(items: MenuItem[], deps: MenuBarActionDeps): MenuItem[] {
	const permitted = (item: MenuItem) => {
		if (!item.needs) return true;
		return item.needs.level === 'manage'
			? deps.canManageApp(item.needs.appId)
			: deps.canUseApp(item.needs.appId);
	};

	const allowed = items
		.filter(permitted)
		.filter(
			(item, i, arr) =>
				!item.separator || (i > 0 && i < arr.length - 1 && !arr[i - 1].separator)
		);

	const runCommand = (appId: AppID, name: string) => () => {
		deps.openApp(appId);
		sendAppCommand(appId, name);
	};

	return allowed.map((item) => {
		let action = item.command
			? runCommand(item.command.appId, item.command.name)
			: item.opens
				? () => deps.openApp(item.opens!)
				: item.action;
		let disabled = item.disabled;

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
				action = () => deps.setIsAboutModalOpen(true);
				break;
			case 'preferences':
			case 'event-settings':
				action = () => deps.openApp('settings');
				break;
			case 'hide':
				action = () => deps.hideWindows();
				break;
			case 'hide-others':
				action = () => deps.hideWindows(deps.activeApp !== 'portal' ? deps.activeApp : undefined);
				break;
			case 'bring-all-front':
				action = () => deps.showAllWindows();
				break;
			case 'refresh-data':
				action = () => refreshAllResources();
				break;
			case 'tile-windows':
				action = () => deps.tileWindows();
				break;
			case 'reset-layout':
				action = () => deps.resetLayout();
				break;
			case 'toggle-wallpapers':
				action = () => deps.cycleWallpaper();
				break;
			case 'toggle-dock':
				action = () => deps.setIsDockAutoHide((prev) => !prev);
				break;
			case 'enter-fullscreen':
				action = () => {
					if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
					else document.documentElement.requestFullscreen().catch(() => {});
				};
				break;
			case 'close':
			case 'close-events': {
				const targetApp = deps.activeApp;
				if (targetApp !== 'portal') action = () => deps.closeApp(targetApp);
				break;
			}
			case 'minimize': {
				const targetApp = deps.activeApp;
				if (targetApp !== 'portal') action = () => deps.minimizeApp(targetApp);
				break;
			}
			case 'zoom': {
				const targetApp = deps.activeApp;
				if (targetApp !== 'portal') action = () => deps.toggleMaximize(targetApp);
				break;
			}
			case 'export-report':
				action = async () => {
					const lang = getStoredMenuLocale();
					const r = await openActivityReport();
					if (r === 'popup') {
						deps.showAlert(translate(lang, 'reportPopupBlocked'), 'warning');
					} else if (r === 'error') {
						deps.showAlert(translate(lang, 'reportGenerateError'), 'danger');
					}
				};
				break;
			case 'export-roster':
				action = async () => {
					const lang = getStoredMenuLocale();
					try {
						const res = await fetch('/api/members');
						const data = (await res.json()) as {
							members?: {
								name: string;
								surname: string;
								department: string;
								grade: number;
								roleName?: string | null;
								status: string;
								xp?: number;
							}[];
						};
						if (!res.ok || !data.members) throw new Error();
						downloadCsv(
							'member_list',
							[
								translate(lang, 'rosterColName'),
								translate(lang, 'rosterColSurname'),
								translate(lang, 'rosterColDepartment'),
								translate(lang, 'rosterColGrade'),
								translate(lang, 'rosterColRole'),
								translate(lang, 'rosterColStatus'),
								translate(lang, 'rosterColXp'),
							],
							data.members.map((m) => [
								m.name,
								m.surname,
								m.department,
								m.grade,
								m.roleName ?? '—',
								m.status,
								m.xp ?? 0,
							])
						);
					} catch {
						deps.showAlert(translate(lang, 'rosterExportFailed'), 'danger');
					}
				};
				break;
			case 'documentation':
				action = deps.showDocumentation;
				break;
			case 'support':
				action = deps.showSupport;
				break;
			case 'undo':
			case 'redo':
			case 'cut':
			case 'copy':
			case 'paste': {
				const edit = runEditCommand(item.id as 'undo' | 'redo' | 'cut' | 'copy' | 'paste');
				action = edit.action;
				disabled = edit.disabled;
				break;
			}
		}

		return { ...item, action, disabled };
	});
}
