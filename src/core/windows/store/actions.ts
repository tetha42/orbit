import { DEFAULT_DOCK_APPS } from '@/configs/apps.config';
import { markUserWindowChange } from './userChange';
import type { AppID, WindowState } from '@/types/workspace';
import {
	purgeAppStorage,
	topWindow,
	visibleActiveApp,
	type WindowGate,
	type WindowsState,
} from './helpers';
import { computeTiledWindows } from './layout';

export interface WindowActionContext {
	getState: () => WindowsState;
	getGate: () => WindowGate;
	set: (patch: Partial<WindowsState> | ((s: WindowsState) => Partial<WindowsState>)) => void;
	setWindow: (id: AppID, patch: Partial<WindowState>) => void;
	visible: () => Record<AppID, WindowState>;
	focusApp: (id: AppID | 'portal') => void;
	unpinApp?: (closedId?: AppID, keepId?: AppID) => void;
}

export function createWindowCollectionActions(ctx: WindowActionContext) {
	const { getState, getGate, set, setWindow, visible, focusApp, unpinApp } = ctx;

	const cycleWindows = (): AppID | null => {
		const gate = getGate();
		const windows = visible();
		const activeApp = visibleActiveApp(getState().activeApp, gate.canOpen);
		const order = [...DEFAULT_DOCK_APPS, ...(Object.keys(windows) as AppID[]).filter((id) => !DEFAULT_DOCK_APPS.includes(id))];
		const ring = order.filter((id) => {
			const win = windows[id];
			return !!win && win.isOpen && !win.isMinimized && gate.canOpen(id);
		});
		if (ring.length < 2) return null;
		const index = activeApp === 'portal' ? -1 : ring.indexOf(activeApp);
		const next = ring[(index + 1) % ring.length];
		focusApp(next);
		return next;
	};

	const closeApp = (id: AppID) => {
		markUserWindowChange();
		unpinApp?.(id);
		purgeAppStorage(id);
		if (typeof window !== 'undefined') {
			try {
				window.dispatchEvent(new CustomEvent('workspace:app-closed', { detail: { appId: id } }));
			} catch {
				// Ignore synthetic event dispatch errors in restricted browsing contexts.
			}
		}
		set((s) => {
			const windows = { ...s.windows, [id]: { ...s.windows[id], isOpen: false, isMinimized: false, isMaximized: false } };
			return { windows, activeApp: topWindow(windows, id) };
		});
	};

	const minimizeApp = (id: AppID) => {
		markUserWindowChange();
		unpinApp?.(id);
		set((s) => {
			const windows = { ...s.windows, [id]: { ...s.windows[id], isMinimized: true } };
			return { windows, activeApp: topWindow(windows, id) };
		});
	};

	const hideWindows = (keep?: AppID) => {
		markUserWindowChange();
		unpinApp?.(undefined, keep);
		set((s) => {
			const updated = { ...s.windows };
			for (const id of Object.keys(s.windows) as AppID[]) {
				if (id !== keep && s.windows[id].isOpen && !s.windows[id].isMinimized) {
					updated[id] = { ...s.windows[id], isMinimized: true };
				}
			}
			return keep ? { windows: updated } : { windows: updated, activeApp: 'portal' };
		});
	};

	const showAllWindows = () => {
		markUserWindowChange();
		set((s) => {
			const updated = { ...s.windows };
			for (const id of Object.keys(s.windows) as AppID[]) {
				if (s.windows[id].isOpen && s.windows[id].isMinimized) updated[id] = { ...s.windows[id], isMinimized: false };
			}
			return { windows: updated };
		});
	};

	const restoreWindows = (ids: AppID[], activeApp?: AppID | 'portal') => {
		markUserWindowChange();
		set((s) => {
			const updated = { ...s.windows };
			for (const id of ids) {
				if (updated[id] && updated[id].isOpen) updated[id] = { ...updated[id], isMinimized: false };
			}
			return { windows: updated, activeApp: activeApp ?? (ids.length > 0 ? ids[ids.length - 1] : s.activeApp) };
		});
	};

	const toggleMaximize = (id: AppID) => {
		markUserWindowChange();
		set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], isMaximized: !s.windows[id].isMaximized } } }));
	};

	const updateWindowPos = (id: AppID, x: number, y: number) => {
		markUserWindowChange();
		const w = getState().windows[id];
		if (w?.position?.x === x && w?.position?.y === y) return;
		setWindow(id, { position: { x, y } });
	};

	const updateWindowSize = (id: AppID, width: number, height: number) => {
		markUserWindowChange();
		const w = getState().windows[id];
		if (w?.size?.width === width && w?.size?.height === height) return;
		setWindow(id, { size: { width, height } });
	};

	const tileWindows = () => {
		markUserWindowChange();
		const windows = visible();
		const openApps = (Object.keys(windows) as AppID[]).filter((k) => windows[k].isOpen);
		if (openApps.length === 0) return;
		set((s) => ({ windows: computeTiledWindows(s.windows, openApps) }));
	};

	const closeAll = () => {
		markUserWindowChange();
		unpinApp?.();
		set((s) => {
			const updated = { ...s.windows };
			(Object.keys(updated) as AppID[]).forEach((id) => {
				updated[id] = { ...s.windows[id], isOpen: false, isMinimized: false, isMaximized: false };
			});
			return { windows: updated, activeApp: 'portal' };
		});
	};

	const setIsWindowCycleEnabled = (enabled: boolean) => {
		set({ isWindowCycleEnabled: enabled });
		try {
			localStorage.setItem('club_window_cycle', enabled ? 'on' : 'off');
		} catch {
			// Storage may be unavailable in private/sandboxed windows; store state remains updated.
		}
	};

	return {
		cycleWindows,
		closeApp,
		minimizeApp,
		hideWindows,
		showAllWindows,
		restoreWindows,
		toggleMaximize,
		updateWindowPos,
		updateWindowSize,
		tileWindows,
		minimizeAll: () => hideWindows(),
		closeAll,
		setIsWindowCycleEnabled,
	};
}
