import { ALL_WINDOW_MANIFESTS, INTERNAL_WINDOW_MANIFESTS } from '@/apps';
import type { AppID, FocusTarget, WindowState } from '@/types/workspace';

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

export const INTERNAL_WINDOW_IDS = new Set(INTERNAL_WINDOW_MANIFESTS.map((m) => m.id));

export const nextZ = (windows: Record<AppID, WindowState>) =>
	Math.max(15, ...Object.values(windows).map((w) => w.zIndex || 0)) + 1;

/** The windows as the member sees them: disallowed apps are derived closed without mutating stored layout. */
export function visibleWindows(
	windows: Record<AppID, WindowState>,
	canOpen: (id: AppID) => boolean
): Record<AppID, WindowState> {
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

export function readCycleSetting(): boolean {
	if (typeof window === 'undefined') return true;
	try {
		return localStorage.getItem('club_window_cycle') !== 'off';
	} catch {
		return true;
	}
}

/** The open window with the highest z-index other than `except`, or the portal. */
export function topWindow(windows: Record<AppID, WindowState>, except: AppID): AppID | 'portal' {
	const remainingOpen = (Object.keys(windows) as AppID[]).filter(
		(k) => k !== except && windows[k].isOpen && !windows[k].isMinimized
	);
	return remainingOpen.length > 0
		? remainingOpen.reduce((max, a) => (windows[a].zIndex > windows[max].zIndex ? a : max))
		: 'portal';
}

export function purgeAppStorage(id: AppID): void {
	if (typeof window === 'undefined') return;
	try {
		const prefix = `club_${id}`;
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
	} catch {
		/* ignore */
	}
}
