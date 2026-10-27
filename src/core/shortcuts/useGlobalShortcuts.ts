'use client';

import { useEffect, useRef } from 'react';
import { WINDOW_MANIFESTS } from '@/apps';
import type { AppID } from '@/types/workspace';
import { useSession } from '@/core/session';
import { useWindowStore } from '@/core/windows';
import { isModalLocked } from '@/lib/client/modalLock';
import { flashWindowFrame, isEditableElement } from '@/lib/client/dom';

/** What the shortcuts need to know about the desktop's panels, and how to close them. */
export interface ShortcutPanels {
	isWorkspaceAppletOpen: boolean;
	isAboutModalOpen: boolean;
	isSpotlightOpen: boolean;
	isNotificationCenterOpen: boolean;
	isCalendarOpen: boolean;
	setIsWorkspaceAppletOpen: (open: boolean) => void;
	setIsAboutModalOpen: (open: boolean) => void;
	setIsSpotlightOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
	setIsNotificationCenterOpen: (open: boolean) => void;
	setIsCalendarOpen: (open: boolean) => void;
	/** Closes the dock and desktop context menus. */
	closeContextMenus: () => void;
	toggleDockAutoHide: () => void;
}

/**
 * The desktop's keyboard shortcuts: Esc closes panels, Shift/⌘/Ctrl+Space opens
 * Spotlight, Shift+Tab switches windows, ⌘/Ctrl/Shift+<number> opens an app (each
 * app's `hotkey` in its manifest), M minimises, W closes, T tiles, D hides the dock.
 *
 * Registered once; the handler reads the latest panel state and window state when
 * a key is pressed, so opening a window does not re-register it.
 */
export function useGlobalShortcuts(panels: ShortcutPanels): void {
	const store = useWindowStore();
	const { isAuthenticated, isLocked } = useSession();

	const latest = useRef({ panels, isAuthenticated, isLocked });
	useEffect(() => {
		latest.current = { panels, isAuthenticated, isLocked };
	});

	useEffect(() => {
		const handleGlobalClick = () => latest.current.panels.closeContextMenus();

		const handleKeyDown = (e: KeyboardEvent) => {
			const { panels: p, isAuthenticated, isLocked } = latest.current;
			const { activeApp } = store.getVisible();
			const { isWindowCycleEnabled } = store.getState();
			const actions = store.actions;

			// While a dialog owns the keyboard, Esc must close only that dialog and the
			// global shortcuts (Spotlight, opening apps, window switching…) stand down.
			if (isModalLocked()) return;

			// When terminal is focused or active, or when user is typing, stand down from all shortcuts
			// so that tmux, bash, and shell sessions receive all keystrokes unmodified.
			const isTerminalFocused = activeApp === 'terminal' || isEditableElement(document.activeElement);
			if (isTerminalFocused) {
				if (e.key === 'Escape') {
					if (p.isWorkspaceAppletOpen || p.isAboutModalOpen || p.isSpotlightOpen || p.isNotificationCenterOpen || p.isCalendarOpen) {
						p.closeContextMenus();
						p.setIsWorkspaceAppletOpen(false);
						p.setIsAboutModalOpen(false);
						p.setIsSpotlightOpen(false);
						p.setIsNotificationCenterOpen(false);
						p.setIsCalendarOpen(false);
					}
				}
				return;
			}

			// Escape closes any open context menus or applet dropdowns
			if (e.key === 'Escape') {
				p.closeContextMenus();
				p.setIsWorkspaceAppletOpen(false);
				p.setIsAboutModalOpen(false);
				p.setIsSpotlightOpen(false);
				p.setIsNotificationCenterOpen(false);
				p.setIsCalendarOpen(false);
				return;
			}

			// Global Spotlight toggle: Shift+Space, ⌘+Space or Ctrl+Space
			if (((e.metaKey || e.ctrlKey || e.shiftKey) && (e.code === 'Space' || e.key === ' ')) && !e.altKey) {
				e.preventDefault();
				p.setIsSpotlightOpen((prev) => !prev);
				return;
			}

			// Shift+Tab switches between open windows. It stands down whenever something
			// else should own Tab: a dialog (handled by the modal lock above), the login
			// screen, the lock screen, Spotlight and the panels that trap focus.
			if (e.key === 'Tab' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
				if (
					!isWindowCycleEnabled ||
					!isAuthenticated ||
					isLocked ||
					p.isSpotlightOpen ||
					p.isAboutModalOpen ||
					p.isNotificationCenterOpen ||
					e.repeat ||
					e.isComposing
				) {
					return;
				}
				const next = actions.cycleWindows();
				if (next) {
					e.preventDefault();
					// Keyboard focus would otherwise stay on a control inside the previous window.
					(document.activeElement as HTMLElement | null)?.blur?.();
					flashWindowFrame(next, 700);
				}
				return;
			}

			// Shortcuts with Shift (browser-conflict-free) or Meta (⌘) / Ctrl
			const isModifier = (e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) || e.metaKey || e.ctrlKey;
			if (isModifier) {
				// Chrome fires keydown without a `key` when it autofills a saved password.
				const key = e.key ?? '';
				const lowerKey = key.toLowerCase();
				// Support digits across keyboard layouts (including Shift+digit on various keyboards)
				const isDigit = (d: string) => e.code === `Digit${d}` || e.code === `Numpad${d}` || key === d;
				const opens = (hotkey: string) =>
					hotkey === ',' ? key === ',' || (e.shiftKey && (e.code === 'Comma' || key === '<')) : isDigit(hotkey);

				const app = WINDOW_MANIFESTS.find((m) => m.hotkey && opens(m.hotkey));
				if (app) {
					e.preventDefault();
					actions.openApp(app.id as AppID);
				} else if ((lowerKey === 'm' || e.code === 'KeyM') && activeApp !== 'portal') {
					e.preventDefault();
					actions.minimizeApp(activeApp);
				} else if ((lowerKey === 'w' || e.code === 'KeyW') && activeApp !== 'portal') {
					e.preventDefault();
					actions.closeApp(activeApp);
				} else if ((lowerKey === 't' || e.code === 'KeyT') && (e.shiftKey || e.ctrlKey || e.altKey)) {
					e.preventDefault();
					actions.tileWindows();
				} else if ((lowerKey === 'd' || e.code === 'KeyD') && (e.shiftKey || e.altKey || e.ctrlKey || (e.metaKey && e.altKey))) {
					e.preventDefault();
					p.toggleDockAutoHide();
				}
			}
		};

		window.addEventListener('click', handleGlobalClick);
		// Capture phase on purpose. The prebuilt 3D wallpaper (public/_astro/App.*.js) listens for
		// keydown on `document` and calls stopPropagation() on every key, so a bubble-phase
		// listener on `window` never sees a key while the scene is attached — which is the
		// default wallpaper. Capture runs before it.
		window.addEventListener('keydown', handleKeyDown, true);
		return () => {
			window.removeEventListener('click', handleGlobalClick);
			window.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [store]);
}
