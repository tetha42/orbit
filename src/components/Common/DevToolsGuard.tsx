'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { isEditableElement } from '@/lib/client/dom';
import { DevToolsAlertModal } from './devToolsGuard/DevToolsAlertModal';

export function DevToolsGuard() {
	const [alertOpen, setAlertOpen] = useState(false);
	const [blockedShortcut, setBlockedShortcut] = useState<string>('');
	const [shake, setShake] = useState(false);

	const triggerBlock = useCallback((shortcutLabel: string) => {
		setBlockedShortcut(shortcutLabel);
		setAlertOpen(true);
		setShake(true);
		setTimeout(() => setShake(false), 400);
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (isEditableElement(document.activeElement) || (e.target as Element)?.closest?.('.xterm')) return;
			// Chrome fires keydown without a `key` when it autofills a saved password.
			const key = (e.key ?? '').toUpperCase();
			const isCmdOrCtrl = e.metaKey || e.ctrlKey;

			if (e.key === 'F12') {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('F12 (Developer Tools)');
				return;
			}
			if ((isCmdOrCtrl && e.shiftKey && key === 'I') || (isCmdOrCtrl && e.altKey && key === 'I')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌥⌘I / Ctrl+Shift+I (Inspect Element)');
				return;
			}
			if ((isCmdOrCtrl && e.shiftKey && key === 'J') || (isCmdOrCtrl && e.altKey && key === 'J')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌥⌘J / Ctrl+Shift+J (Console)');
				return;
			}
			if ((isCmdOrCtrl && e.shiftKey && key === 'C') || (isCmdOrCtrl && e.altKey && key === 'C')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌥⌘C / Ctrl+Shift+C (Inspect Selector)');
				return;
			}
			if ((isCmdOrCtrl && key === 'U') || (isCmdOrCtrl && e.altKey && key === 'U')) {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('⌘U / Ctrl+U (View Source)');
				return;
			}
			if (isCmdOrCtrl && e.shiftKey && key === 'K') {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('Ctrl+Shift+K (Web Console)');
				return;
			}
			if (isCmdOrCtrl && e.shiftKey && key === 'E') {
				e.preventDefault();
				e.stopPropagation();
				triggerBlock('Ctrl+Shift+E (Extensions & Network)');
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => window.removeEventListener('keydown', handleKeyDown, true);
	}, [triggerBlock]);

	useEffect(() => {
		if (!alertOpen) return;
		const handleDismissKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' || e.key === 'Enter') {
				e.preventDefault();
				setAlertOpen(false);
			}
		};
		window.addEventListener('keydown', handleDismissKey, true);
		return () => window.removeEventListener('keydown', handleDismissKey, true);
	}, [alertOpen]);

	if (!alertOpen) return null;

	return (
		<DevToolsAlertModal
			blockedShortcut={blockedShortcut}
			shake={shake}
			onClose={() => setAlertOpen(false)}
		/>
	);
}
