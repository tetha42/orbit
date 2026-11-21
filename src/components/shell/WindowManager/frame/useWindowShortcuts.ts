'use client';

import { useEffect } from 'react';
import type React from 'react';
import type { AppID, WindowState } from '@/types/workspace';
import { isEditableElement } from '@/lib/client/dom';
import type { SnapTarget } from './windowGeometry';

interface UseWindowShortcutsDeps {
	appId: AppID;
	win: WindowState | undefined;
	isActive: boolean;
	currentTile: SnapTarget;
	setCurrentTile: React.Dispatch<React.SetStateAction<SnapTarget>>;
	toggleMaximize: (appId: AppID) => void;
	minimizeApp: (appId: AppID) => void;
	updateWindowPos: (appId: AppID, x: number, y: number) => void;
}

export function useWindowShortcuts({
	appId,
	win,
	isActive,
	currentTile,
	setCurrentTile,
	toggleMaximize,
	minimizeApp,
	updateWindowPos,
}: UseWindowShortcutsDeps) {
	useEffect(() => {
		if (!isActive || !win?.isOpen || win?.isMinimized) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (appId === 'terminal' || isEditableElement(document.activeElement)) return;
			if (!((e.metaKey && e.altKey) || (e.ctrlKey && e.altKey))) return;

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile((prev) => (prev === 'left' ? 'none' : 'left'));
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile((prev) => (prev === 'right' ? 'none' : 'right'));
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				setCurrentTile('none');
				if (!win.isMaximized) toggleMaximize(appId);
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				if (win.isMaximized) toggleMaximize(appId);
				else if (currentTile !== 'none') setCurrentTile('none');
				else minimizeApp(appId);
			} else if (e.key?.toLowerCase() === 'c') {
				e.preventDefault();
				if (win.isMaximized) toggleMaximize(appId);
				setCurrentTile('none');
				const targetW = win.size?.width ?? 800;
				const targetH = win.size?.height ?? 520;
				updateWindowPos(
					appId,
					Math.max(20, Math.round((window.innerWidth - targetW) / 2)),
					Math.max(36, Math.round((window.innerHeight - targetH) / 2))
				);
			}
		};
		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [isActive, win?.isOpen, win?.isMinimized, win?.isMaximized, win?.size, currentTile, setCurrentTile, appId, toggleMaximize, minimizeApp, updateWindowPos]);
}
