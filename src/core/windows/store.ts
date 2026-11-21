import type { AppID, FocusTargetInput, WindowState } from '@/types/workspace';
import {
	INITIAL_WINDOWS,
	nextZ,
	purgeAppStorage,
	readCycleSetting,
	topWindow,
	visibleActiveApp,
	visibleWindows,
	type WindowGate,
	type WindowsState,
} from './store/helpers';
import { notifyRevokedWindows } from './store/layout';
import { createWindowCollectionActions } from './store/actions';
import { markUserWindowChange } from './store/userChange';

export { INITIAL_WINDOWS, visibleWindows, visibleActiveApp };
export type { WindowsState, WindowGate };

let focusNonce = 0;

export function createWindowStore() {
	let state: WindowsState = {
		windows: INITIAL_WINDOWS,
		activeApp: 'teams',
		focusTarget: null,
		isWindowCycleEnabled: readCycleSetting(),
	};
	let gate: WindowGate = { canOpen: () => false, onDenied: () => {} };
	let focusTimer: ReturnType<typeof setTimeout> | null = null;
	let pinnedApp: AppID | null = null;
	const listeners = new Set<() => void>();

	const getState = () => state;
	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	};
	const set = (patch: Partial<WindowsState> | ((s: WindowsState) => Partial<WindowsState>)) => {
		const next = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
		if (Object.keys(next).every((k) => next[k as keyof WindowsState] === state[k as keyof WindowsState])) return;
		state = next;
		listeners.forEach((listener) => listener());
	};
	const setWindow = (id: AppID, patch: Partial<WindowState>) =>
		set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], ...patch } } }));
	const visible = () => visibleWindows(state.windows, gate.canOpen);

	const focusApp = (id: AppID | 'portal') => {
		if (id !== 'portal' && !gate.canOpen(id)) return;
		set((s) => {
			if (id === 'portal') return s.activeApp === 'portal' ? s : { activeApp: id };
			const currentWin = s.windows[id];
			if (!currentWin) return s.activeApp === id ? s : { activeApp: id };
			const maxZ = Math.max(15, ...Object.values(s.windows).map((w) => w.zIndex || 0));
			if (s.activeApp === id && !currentWin.isMinimized && currentWin.zIndex === maxZ) return s;
			return {
				activeApp: id,
				windows: { ...s.windows, [id]: { ...currentWin, zIndex: nextZ(s.windows), isMinimized: false } },
			};
		});
	};

	const clearFocusTarget = (nonce: number) => {
		set((s) => (s.focusTarget && s.focusTarget.nonce === nonce ? { focusTarget: null } : {}));
	};

	const openApp = (id: AppID, target?: FocusTargetInput) => {
		if (!gate.canOpen(id)) {
			gate.onDenied();
			return;
		}
		let focusTarget = state.focusTarget;
		if (target) {
			pinnedApp = id;
			const nonce = ++focusNonce;
			focusTarget = { ...target, appId: id, nonce };
			if (focusTimer) clearTimeout(focusTimer);
			focusTimer = setTimeout(() => clearFocusTarget(nonce), 8000);
		} else if (pinnedApp && pinnedApp !== id) {
			pinnedApp = null;
		}
		markUserWindowChange();
		set((s) => ({
			focusTarget,
			activeApp: id,
			windows: { ...s.windows, [id]: { ...s.windows[id], isOpen: true, isMinimized: false, zIndex: nextZ(s.windows) } },
		}));
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('clubpanel:open-mobile-app', { detail: { appId: id, target } }));
		}
	};

	const reset = () => {
		pinnedApp = null;
		markUserWindowChange();
		set({ windows: INITIAL_WINDOWS, activeApp: 'events' });
	};

	const collectionActions = createWindowCollectionActions({
		getState,
		getGate: () => gate,
		set,
		setWindow,
		visible,
		focusApp,
		unpinApp: (closedId?: AppID, keepId?: AppID) => {
			if (!pinnedApp) return;
			if (closedId !== undefined) {
				if (pinnedApp === closedId) pinnedApp = null;
			} else if (keepId !== undefined) {
				if (pinnedApp !== keepId) pinnedApp = null;
			} else {
				pinnedApp = null;
			}
		},
	});

	return {
		getState,
		subscribe,
		getVisible: () => ({ windows: visible(), activeApp: visibleActiveApp(state.activeApp, gate.canOpen) }),
		configure: (next: WindowGate) => {
			if (pinnedApp && !next.canOpen(pinnedApp)) pinnedApp = null;
			const revoked = (Object.keys(state.windows) as AppID[]).filter((id) => state.windows[id].isOpen && !next.canOpen(id));
			const disallowed = (Object.keys(state.windows) as AppID[]).filter((id) => !next.canOpen(id));
			for (const id of disallowed) purgeAppStorage(id);
			if (revoked.length > 0) {
				notifyRevokedWindows(revoked);
				set((s) => {
					const updated = { ...s.windows };
					for (const id of revoked) {
						updated[id] = { ...updated[id], isOpen: false, isMinimized: false, isMaximized: false };
					}
					return {
						windows: updated,
						activeApp: topWindow(updated, s.activeApp === 'portal' ? ('portal' as AppID) : s.activeApp),
					};
				});
			}
			gate = next;
		},
		reset,
		actions: {
			focusApp,
			openApp,
			resetLayout: reset,
			clearFocusTarget,
			...collectionActions,
		},
	};
}

export type WindowStore = ReturnType<typeof createWindowStore>;
export type WindowActions = WindowStore['actions'];
