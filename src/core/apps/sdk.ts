import type { ComponentType } from 'react';

/**
 * Standard props provided to any Orbit mini-app by the Window Manager / Compositor.
 */
export interface MiniAppProps<TTarget = unknown> {
	/** Unique application identifier (e.g. 'chat', 'teams', 'kasa') */
	appId: string;
	/** Unique window instance identifier */
	instanceId: string;
	/** Optional deep link or initial context payload (e.g. { eventId: '123' }) */
	target?: TTarget;
	/** True if this window currently has foreground input focus */
	isForeground: boolean;
	/** Request the window manager to close this window */
	close: () => void;
	/** Request the window manager to minimize this window */
	minimize: () => void;
	/** Request the window manager to toggle maximize on this window */
	maximize: () => void;
	/** Dynamically update the title displayed in the window header */
	setTitle?: (title: string) => void;
	/** Dynamically update the badge count or text on the dock/taskbar icon */
	setBadge?: (count: number) => void;
}

/**
 * Type definition for a compliant Orbit Mini-App component.
 */
export type MiniApp<TTarget = unknown> = ComponentType<MiniAppProps<TTarget>>;
