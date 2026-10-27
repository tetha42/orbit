'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
	BASE_MODAL_Z,
	isTopModal,
	registerModal,
	subscribeModalStack,
	type ModalHandle,
} from '@/lib/client/modalLock';

export interface SheetStackState {
	zIndex: number;
	bringToFront: () => void;
}

/**
 * Modal behaviour for a sheet / Zenity dialog window: registers in the desktop
 * z-index modal stack (above all mini-app windows), holds the workspace modal
 * lock (so global shortcuts stay quiet), and closes on Escape only when this
 * sheet is at the top of the modal stack.
 */
export function useSheet(
	onClose: () => void,
	pausedRef?: RefObject<boolean>,
	baseZ = BASE_MODAL_Z
): SheetStackState {
	const closeRef = useRef(onClose);
	useEffect(() => {
		closeRef.current = onClose;
	});

	const handleRef = useRef<ModalHandle | null>(null);
	const [zIndex, setZIndex] = useState(baseZ);

	useEffect(() => {
		const handle = registerModal(baseZ);
		handleRef.current = handle;
		setZIndex(handle.zIndex);

		const unsub = subscribeModalStack(() => {
			if (handleRef.current) {
				setZIndex(handleRef.current.zIndex);
			}
		});

		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || pausedRef?.current) return;
			if (!isTopModal(handle.id)) return;
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			closeRef.current();
		};

		window.addEventListener('keydown', onKey, true);
		return () => {
			unsub();
			handle.release();
			handleRef.current = null;
			window.removeEventListener('keydown', onKey, true);
		};
	}, [pausedRef, baseZ]);

	const bringToFront = useCallback(() => {
		if (handleRef.current) {
			setZIndex(handleRef.current.bringToFront());
		}
	}, []);

	return { zIndex, bringToFront };
}

/** The current time, refreshed every `intervalMs` — for "overdue" and "5 min ago" labels. */
export function useNow(intervalMs = 60_000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}
