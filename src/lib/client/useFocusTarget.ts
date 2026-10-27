'use client';

import { useEffect, useRef } from 'react';
import { useWindowFocusTarget } from '@/core/windows';
import type { AppID, FocusTarget } from '@/types/workspace';
import { attrValue, flashClass, flashWindowFrame, scrollWithin } from './dom';

export interface FocusTargetOptions {
	/**
	 * True once the app can show the target — normally "my data has loaded".
	 * Until then the target waits; the store drops it after a few seconds if
	 * nothing ever consumes it.
	 */
	ready: boolean;
	/**
	 * Puts the app on the section and selection the target names (switch tab,
	 * clear a filter, select a row). Called once per target, and may be called
	 * twice under React Strict Mode, so it must be safe to repeat.
	 */
	apply: (target: FocusTarget) => void;
	/** Reloads the app's data once if the record is not found: an open app may hold a stale list. */
	refetch?: () => Promise<unknown> | void;
}

/** Lets the window finish opening before anything flashes — the frame animates in over ~200 ms. */
const SETTLE_MS = 260;
const REFETCH_AFTER_MS = 1200;
const GIVE_UP_MS = 3000;
const FLASH_MS = 1000;

/**
 * Consumes the workspace's focus target for one app.
 *
 * Search and the notification center open apps with a target
 * (`openApp(id, { section, kind, itemId })`). The app cannot act on it right
 * away — it may just have mounted and not loaded its data — so it calls this
 * hook. When the target is for this app and `ready` is true it:
 *
 *  1. calls `apply`, so the app switches to the right tab and selection;
 *  2. waits for the element `[data-focus-id="kind:id"]` (or
 *     `[data-focus-section="section"]`) to appear inside the app's window;
 *  3. scrolls it into view, inside the window only;
 *  4. flashes a frame around it for one second;
 *  5. clears the target.
 *
 * If the element never appears, the window's frame flashes instead, so a stale
 * or deleted record still gives feedback rather than nothing.
 *
 * Returns the pending target while one exists. Apps use it to hold back their own
 * auto-select behaviour (selecting the first row on load) that would otherwise
 * overwrite the record the user asked for.
 */
export function useFocusTarget(appId: AppID, { ready, apply, refetch }: FocusTargetOptions): FocusTarget | null {
	const { focusTarget, clearFocusTarget } = useWindowFocusTarget();
	const pending = focusTarget && focusTarget.appId === appId ? focusTarget : null;
	const nonce = pending?.nonce ?? null;

	// The latest callbacks, without re-running the effect when a parent recreates them.
	const applyRef = useRef(apply);
	const refetchRef = useRef(refetch);
	useEffect(() => {
		applyRef.current = apply;
		refetchRef.current = refetch;
	});

	useEffect(() => {
		if (nonce === null || !pending || !ready) return;
		const target = pending;

		let cancelled = false;
		let done = false;
		let observer: MutationObserver | null = null;
		const timers: ReturnType<typeof setTimeout>[] = [];

		const frame = () =>
			document.querySelector<HTMLElement>(`.mini-app-frame[data-app-id="${attrValue(appId)}"]`);
		const selector =
			target.kind && target.itemId
				? `[data-focus-id="${attrValue(`${target.kind}:${target.itemId}`)}"]`
				: target.section
					? `[data-focus-section="${attrValue(target.section)}"]`
					: null;
		const find = () => (selector ? (frame()?.querySelector<HTMLElement>(selector) ?? null) : null);

		const finish = (el: HTMLElement | null) => {
			if (done || cancelled) return;
			done = true;
			observer?.disconnect();
			const root = frame();
			if (el && root) {
				scrollWithin(el, root);
				flashClass(el, 'focus-flash', FLASH_MS);
			} else {
				flashWindowFrame(appId, FLASH_MS);
			}
			clearFocusTarget(target.nonce);
		};

		applyRef.current(target);

		timers.push(
			setTimeout(() => {
				if (!selector) return finish(null);
				const found = find();
				if (found) return finish(found);

				const root = frame();
				if (root) {
					observer = new MutationObserver(() => {
						const el = find();
						if (el) finish(el);
					});
					observer.observe(root, { childList: true, subtree: true });
				}
				timers.push(setTimeout(() => !done && refetchRef.current?.(), REFETCH_AFTER_MS - SETTLE_MS));
				timers.push(setTimeout(() => finish(find()), GIVE_UP_MS - SETTLE_MS));
			}, SETTLE_MS)
		);

		return () => {
			// Not cancelling an in-flight flash: it removes its own class after
			// FLASH_MS, and cancelling here would cut it short — clearing the
			// target re-runs this cleanup a moment after the flash starts.
			cancelled = true;
			observer?.disconnect();
			timers.forEach(clearTimeout);
		};
		// `pending` is stable for a given nonce; `ready` re-arms the wait once data arrives.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [nonce, ready, appId, clearFocusTarget]);

	return pending;
}
