import { DEFAULT_DOCK_APPS } from '@/configs/apps.config';
import { ALL_WINDOW_MANIFESTS, INTERNAL_WINDOW_MANIFESTS } from '@/apps';
import type { AppID, FocusTarget, FocusTargetInput, WindowState } from '@/types/workspace';

/**
 * The window manager's state: which windows are open, minimised or maximised,
 * their stacking order, position and size, which one has focus, and the focus
 * target ("open the app at this record"). Plain TypeScript, no React — read it
 * through the hooks in ./hooks.ts, which subscribe to exactly the slice they
 * show, so changing one window re-renders that window and nothing else.
 *
 * Whether an app may open at all is not decided here: the provider hands the
 * store `canOpen` (the member's permissions) and `onDenied` through `configure`.
 */

export const INITIAL_WINDOWS = Object.fromEntries(
	ALL_WINDOW_MANIFESTS.map((m): [AppID, WindowState] => [
		m.id as AppID,
		{
			isOpen: !!m.window.open,
			isMinimized: false,
			isMaximized: false,
			position: { x: m.window.x, y: m.window.y },
			size: { width: m.window.width, height: m.window.height },
			zIndex: m.window.z ?? 10,
		},
	])
) as Record<AppID, WindowState>;

export interface WindowsState {
	/** As stored. What the member sees is `visibleWindows`: a window whose app the role does not open is closed. */
	windows: Record<AppID, WindowState>;
	activeApp: AppID | 'portal';
	focusTarget: FocusTarget | null;
	isWindowCycleEnabled: boolean;
}

export interface WindowGate {
	canOpen: (id: AppID) => boolean;
	onDenied: () => void;
}

/**
 * The windows as the member sees them: one of an app their role does not open is
 * closed — whether it came from the defaults, from the saved workspace, or the
 * permission was taken away while it was open. Derived, never written back, so
 * the rule holds on the very render the permissions change.
 */
export function visibleWindows(windows: Record<AppID, WindowState>, canOpen: (id: AppID) => boolean): Record<AppID, WindowState> {
	let changed = false;
	const out = { ...windows };
	for (const id of Object.keys(out) as AppID[]) {
		if (out[id].isOpen && !canOpen(id)) {
			out[id] = { ...out[id], isOpen: false, isMinimized: false };
			changed = true;
		}
	}
	return changed ? out : windows;
}

/** The active app as the member sees it: the portal when their role no longer opens it. */
export function visibleActiveApp(activeApp: AppID | 'portal', canOpen: (id: AppID) => boolean): AppID | 'portal' {
	return activeApp !== 'portal' && !canOpen(activeApp) ? 'portal' : activeApp;
}

// Numbers focus targets. Module state, incremented from event handlers.
let focusNonce = 0;

const readCycleSetting = () => {
	if (typeof window === 'undefined') return true;
	try {
		return localStorage.getItem('kulup_window_cycle') !== 'off';
	} catch {
		return true;
	}
};

const INTERNAL_WINDOW_IDS = new Set(INTERNAL_WINDOW_MANIFESTS.map((m) => m.id));

const nextZ = (windows: Record<AppID, WindowState>) => Math.max(15, ...Object.values(windows).map((w) => w.zIndex || 0)) + 1;

/** The open window with the highest z-index other than `except` (the one to focus when it goes away), or the portal. */
function topWindow(windows: Record<AppID, WindowState>, except: AppID): AppID | 'portal' {
	const remainingOpen = (Object.keys(windows) as AppID[]).filter((k) => k !== except && windows[k].isOpen && !windows[k].isMinimized);
	return remainingOpen.length > 0 ? remainingOpen.reduce((max, a) => (windows[a].zIndex > windows[max].zIndex ? a : max)) : 'portal';
}

export function createWindowStore() {
	let state: WindowsState = { windows: INITIAL_WINDOWS, activeApp: 'teams', focusTarget: null, isWindowCycleEnabled: readCycleSetting() };
	let gate: WindowGate = { canOpen: () => false, onDenied: () => {} };
	let focusTimer: ReturnType<typeof setTimeout> | null = null;
	const listeners = new Set<() => void>();

	const getState = () => state;
	const subscribe = (listener: () => void) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	};
	/** Replaces the state with `patch` applied; nothing is notified when nothing changed. */
	const set = (patch: Partial<WindowsState> | ((s: WindowsState) => Partial<WindowsState>)) => {
		const next = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
		if (Object.keys(next).every((k) => next[k as keyof WindowsState] === state[k as keyof WindowsState])) return;
		state = next;
		listeners.forEach((listener) => listener());
	};
	const setWindow = (id: AppID, patch: Partial<WindowState>) => set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], ...patch } } }));
	const visible = () => visibleWindows(state.windows, gate.canOpen);

	const focusApp = (id: AppID | 'portal') => {
		if (id !== 'portal' && !gate.canOpen(id)) return;
		set((s) => {
			if (id === 'portal') {
				if (s.activeApp === 'portal') return s;
				return { activeApp: id };
			}
			const currentWin = s.windows[id];
			if (!currentWin) {
				if (s.activeApp === id) return s;
				return { activeApp: id };
			}
			const maxZ = Math.max(15, ...Object.values(s.windows).map((w) => w.zIndex || 0));
			if (s.activeApp === id && !currentWin.isMinimized && currentWin.zIndex === maxZ) {
				return s;
			}
			return { activeApp: id, windows: { ...s.windows, [id]: { ...currentWin, zIndex: nextZ(s.windows), isMinimized: false } } };
		});
	};

	const openApp = (id: AppID, target?: FocusTargetInput) => {
		if (!gate.canOpen(id)) {
			gate.onDenied();
			return;
		}
		let focusTarget = state.focusTarget;
		if (target) {
			const nonce = ++focusNonce;
			focusTarget = { ...target, appId: id, nonce };
			// A target nobody consumed (the app never mounted, the record is gone) must not
			// fire later, when the user reopens the app for an unrelated reason.
			if (focusTimer) clearTimeout(focusTimer);
			focusTimer = setTimeout(() => clearFocusTarget(nonce), 8000);
		}
		set((s) => ({
			focusTarget,
			activeApp: id,
			windows: { ...s.windows, [id]: { ...s.windows[id], isOpen: true, isMinimized: false, zIndex: nextZ(s.windows) } },
		}));
		if (typeof window !== 'undefined') {
			window.dispatchEvent(
				new CustomEvent('clubpanel:open-mobile-app', { detail: { appId: id, target } })
			);
		}
	};

	const clearFocusTarget = (nonce: number) => {
		set((s) => (s.focusTarget && s.focusTarget.nonce === nonce ? { focusTarget: null } : {}));
	};

	/**
	 * Shift+Tab: focuses the next open window.
	 *
	 * The ring is the dock order, not the stacking order. Cycling by z-index would
	 * only ever swap the top two windows, because focusing one puts it on top.
	 * Minimized windows are skipped — bringing one back would remount it, and
	 * closing or minimizing the terminal ends its shell session.
	 */
	const cycleWindows = (): AppID | null => {
		const windows = visible();
		const activeApp = visibleActiveApp(state.activeApp, gate.canOpen);
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
		// Clean up browser storage / cache for the app
		if (typeof window !== 'undefined') {
			try {
				// Clear any session/local storage keys prefixed for this app
				const prefix = `kulup_${id}`;
				Object.keys(localStorage).forEach((key) => {
					if (key.startsWith(prefix) || key.startsWith(`app:${id}:`)) {
						localStorage.removeItem(key);
					}
				});
				Object.keys(sessionStorage).forEach((key) => {
					if (key.startsWith(prefix) || key.includes(id) || key.startsWith(`app:${id}:`)) {
						sessionStorage.removeItem(key);
					}
				});
				// Notify the app so it can clear any internal caches or connections
				window.dispatchEvent(new CustomEvent('workspace:app-closed', { detail: { appId: id } }));
			} catch {}
		}

		set((s) => {
			const windows = { ...s.windows, [id]: { ...s.windows[id], isOpen: false, isMinimized: false, isMaximized: false } };
			return { windows, activeApp: topWindow(windows, id) };
		});
	};

	const minimizeApp = (id: AppID) => {
		set((s) => {
			const windows = { ...s.windows, [id]: { ...s.windows[id], isMinimized: true } };
			return { windows, activeApp: topWindow(windows, id) };
		});
	};

	/**
	 * Minimises every open window except `keep` ("Diğerlerini Gizle"); with no
	 * `keep`, all of them ("Gizle": show the desktop).
	 */
	const hideWindows = (keep?: AppID) => {
		set((s) => {
			const updated = { ...s.windows };
			for (const id of Object.keys(s.windows) as AppID[]) {
				if (id !== keep && s.windows[id].isOpen && !s.windows[id].isMinimized) updated[id] = { ...s.windows[id], isMinimized: true };
			}
			return keep ? { windows: updated } : { windows: updated, activeApp: 'portal' };
		});
	};

	/** Restores every minimised window ("Tümünü Öne Getir"). */
	const showAllWindows = () => {
		set((s) => {
			const updated = { ...s.windows };
			for (const id of Object.keys(s.windows) as AppID[]) {
				if (s.windows[id].isOpen && s.windows[id].isMinimized) updated[id] = { ...s.windows[id], isMinimized: false };
			}
			return { windows: updated };
		});
	};

	/** Restores specific windows that were minimized (e.g. before screen lock). */
	const restoreWindows = (ids: AppID[], activeApp?: AppID | 'portal') => {
		set((s) => {
			const updated = { ...s.windows };
			for (const id of ids) {
				if (updated[id] && updated[id].isOpen) {
					updated[id] = { ...updated[id], isMinimized: false };
				}
			}
			return {
				windows: updated,
				activeApp: activeApp ?? (ids.length > 0 ? ids[ids.length - 1] : s.activeApp),
			};
		});
	};

	const toggleMaximize = (id: AppID) => {
		set((s) => ({ windows: { ...s.windows, [id]: { ...s.windows[id], isMaximized: !s.windows[id].isMaximized } } }));
	};

	const updateWindowPos = (id: AppID, x: number, y: number) => {
		const w = state.windows[id];
		if (w?.position?.x === x && w?.position?.y === y) return;
		setWindow(id, { position: { x, y } });
	};

	const updateWindowSize = (id: AppID, width: number, height: number) => {
		const w = state.windows[id];
		if (w?.size?.width === width && w?.size?.height === height) return;
		setWindow(id, { size: { width, height } });
	};

	const tileWindows = () => {
		const windows = visible();
		const openApps = (Object.keys(windows) as AppID[]).filter((k) => windows[k].isOpen);
		if (openApps.length === 0) return;

		const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
		const screenH = typeof window !== 'undefined' ? window.innerHeight - 120 : 800;

		const cols = openApps.length <= 2 ? openApps.length : Math.ceil(Math.sqrt(openApps.length));
		const rows = Math.ceil(openApps.length / cols);

		const cellW = Math.floor(screenW / cols);
		const cellH = Math.floor(screenH / rows);

		set((s) => {
			const updated = { ...s.windows };
			openApps.forEach((id, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				updated[id] = {
					...updated[id],
					isMinimized: false,
					isMaximized: false,
					position: { x: col * cellW + 15, y: row * cellH + 40 },
					size: { width: cellW - 30, height: cellH - 30 },
				};
			});
			return { windows: updated };
		});
	};

	const closeAll = () => {
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
			localStorage.setItem('kulup_window_cycle', enabled ? 'on' : 'off');
		} catch {
			// Private mode: the choice just doesn't persist.
		}
	};

	return {
		getState,
		subscribe,
		/** The windows and the active app as the member sees them. */
		getVisible: () => ({ windows: visible(), activeApp: visibleActiveApp(state.activeApp, gate.canOpen) }),
		/** Hands the store the member's permissions and what to do when an app is refused. */
		configure: (next: WindowGate) => {
			const revoked = (Object.keys(state.windows) as AppID[]).filter(
				(id) => state.windows[id].isOpen && !next.canOpen(id)
			);
			if (revoked.length > 0) {
				for (const id of revoked) {
					const manifest = ALL_WINDOW_MANIFESTS.find((m) => m.id === id);
					const title = manifest?.title ?? id;
					if (typeof window !== 'undefined') {
						window.dispatchEvent(
							new CustomEvent('orbit:toast', {
								detail: {
									message: `Erişim yetkiniz güncellendiği için "${title}" penceresi kapatıldı.`,
									tone: 'error',
								},
							})
						);
						try {
							window.dispatchEvent(new CustomEvent('workspace:app-closed', { detail: { appId: id } }));
						} catch {
							/* ignore */
						}
					}
				}
				set((s) => {
					const updated = { ...s.windows };
					for (const id of revoked) {
						updated[id] = { ...updated[id], isOpen: false, isMinimized: false, isMaximized: false };
					}
					return {
						windows: updated,
						activeApp: topWindow(updated, s.activeApp === 'portal' ? 'portal' as AppID : s.activeApp),
					};
				});
			}
			gate = next;
		},
		/** Puts back a saved workspace (windows and active app) — see core/persistence. */
		restore: (saved: { windows?: Record<AppID, WindowState>; activeApp?: AppID | 'portal' }) => {
			if (!saved.windows) {
				if (saved.activeApp) set({ activeApp: saved.activeApp });
				return;
			}
			const screenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
			const screenH = typeof window !== 'undefined' ? window.innerHeight : 900;
			const sanitized: Record<AppID, WindowState> = { ...INITIAL_WINDOWS };

			for (const id of Object.keys(sanitized) as AppID[]) {
				if (INTERNAL_WINDOW_IDS.has(id)) continue;
				const src = saved.windows[id];
				if (!src) continue;
				const def = INITIAL_WINDOWS[id];
				const posX = typeof src.position?.x === 'number' && src.position.x >= -100 && src.position.x < screenW - 100
					? src.position.x : def.position.x;
				const posY = typeof src.position?.y === 'number' && src.position.y >= 24 && src.position.y < screenH - 60
					? src.position.y : def.position.y;
				const sizeW = typeof src.size?.width === 'number' && src.size.width >= 320 && src.size.width <= screenW
					? src.size.width : def.size.width;
				const sizeH = typeof src.size?.height === 'number' && src.size.height >= 240 && src.size.height <= screenH
					? src.size.height : def.size.height;

				sanitized[id] = {
					isOpen: !!src.isOpen,
					isMinimized: !!src.isMinimized,
					isMaximized: !!src.isMaximized,
					position: { x: posX, y: posY },
					size: { width: sizeW, height: sizeH },
					zIndex: typeof src.zIndex === 'number' ? src.zIndex : def.zIndex,
				};
			}

			set({
				windows: sanitized,
				...(saved.activeApp ? { activeApp: saved.activeApp } : {}),
			});
		},
		/** Back to a fresh desktop ("reset workspace"). */
		reset: () => {
			if (typeof window !== 'undefined') {
				try {
					localStorage.removeItem('beu_workspace_layout_v1');
				} catch {}
			}
			set({ windows: INITIAL_WINDOWS, activeApp: 'events' });
		},
		actions: {
			focusApp,
			openApp,
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
			resetLayout: () => {
				if (typeof window !== 'undefined') {
					try {
						localStorage.removeItem('beu_workspace_layout_v1');
					} catch {}
				}
				set({ windows: INITIAL_WINDOWS, activeApp: 'events' });
			},
			minimizeAll: () => hideWindows(),
			closeAll,
			clearFocusTarget,
			setIsWindowCycleEnabled,
		},
	};
}

export type WindowStore = ReturnType<typeof createWindowStore>;
export type WindowActions = WindowStore['actions'];
