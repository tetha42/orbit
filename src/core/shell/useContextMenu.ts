'use client';

import React, { useCallback, useRef } from 'react';
import { useShellActions } from './shell';
import type { MenuItem } from '@/types/workspace';

export interface UseContextMenuOptions {
	items: MenuItem[] | (() => MenuItem[]);
	disabled?: boolean;
}

export function useContextMenu({ items, disabled = false }: UseContextMenuOptions) {
	const { openContextMenu } = useShellActions();
	const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

	const startPosRef = useRef<{ x: number; y: number } | null>(null);

	const isEditableTarget = (target: EventTarget | null): boolean => {
		if (!target || !(target instanceof HTMLElement)) return false;
		const tag = target.tagName.toLowerCase();
		return tag === 'input' || tag === 'textarea' || target.isContentEditable;
	};

	const triggerMenu = useCallback(
		(clientX: number, clientY: number) => {
			if (disabled) return;
			const resolvedItems = typeof items === 'function' ? items() : items;
			if (!resolvedItems || resolvedItems.length === 0) return;

			openContextMenu({
				x: clientX,
				y: clientY,
				mode: 'app',
				customItems: resolvedItems,
			});
		},
		[disabled, items, openContextMenu]
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			if (disabled || isEditableTarget(e.target)) return;
			e.preventDefault();
			e.stopPropagation();
			triggerMenu(e.clientX, e.clientY);
		},
		[disabled, triggerMenu]
	);

	// Touch long-press support with micro-jitter threshold (10px) and editable input protection
	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (disabled || e.touches.length !== 1 || isEditableTarget(e.target)) return;
			const touch = e.touches[0];
			const { clientX, clientY } = touch;
			startPosRef.current = { x: clientX, y: clientY };

			if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
			touchTimerRef.current = setTimeout(() => {
				try {
					if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
						navigator.vibrate(20);
					}
				} catch {
					// Ignore vibration failure
				}
				triggerMenu(clientX, clientY);
			}, 500);
		},
		[disabled, triggerMenu]
	);

	const handleTouchEnd = useCallback(() => {
		if (touchTimerRef.current) {
			clearTimeout(touchTimerRef.current);
			touchTimerRef.current = null;
		}
		startPosRef.current = null;
	}, []);

	const handleTouchMove = useCallback((e: React.TouchEvent) => {
		if (!touchTimerRef.current || !startPosRef.current || e.touches.length !== 1) return;
		const touch = e.touches[0];
		const dx = Math.abs(touch.clientX - startPosRef.current.x);
		const dy = Math.abs(touch.clientY - startPosRef.current.y);

		// If moved more than 10px, it's a scroll/swipe, cancel context menu
		if (dx > 10 || dy > 10) {
			clearTimeout(touchTimerRef.current);
			touchTimerRef.current = null;
			startPosRef.current = null;
		}
	}, []);

	return {
		onContextMenu: handleContextMenu,
		onTouchStart: handleTouchStart,
		onTouchEnd: handleTouchEnd,
		onTouchMove: handleTouchMove,
	};
}
