'use client';

import { useSyncExternalStore } from 'react';

/** A store that never changes — the value only differs between server and client. */
const neverChanges = () => () => {};

/**
 * Reads a value that only exists in the browser, without a mount effect.
 *
 * The old pattern was `useEffect(() => setMounted(true), [])`, which renders
 * once with the server value and then again after hydration — a cascading render
 * that React 19's `set-state-in-effect` rule flags. `useSyncExternalStore` is the
 * sanctioned replacement: it reads the server snapshot during SSR and the client
 * snapshot on hydration, in a single pass.
 *
 * The value must be referentially stable (a boolean, string or number), since
 * React compares snapshots with `Object.is`.
 *
 * @param compute       evaluated in the browser; must return a stable value
 * @param serverValue   what to render during server rendering
 */
export function useClientValue<T extends string | number | boolean | null>(
	compute: () => T,
	serverValue: T
): T {
	return useSyncExternalStore(neverChanges, compute, () => serverValue);
}

/**
 * True once running in the browser.
 *
 * Use this to defer rendering anything that would not match the server output —
 * `Date.now()`, `window` reads, browser-only APIs.
 */
export function useIsMounted(): boolean {
	return useClientValue(() => true, false);
}

function subscribeResize(callback: () => void) {
	window.addEventListener('resize', callback);
	return () => window.removeEventListener('resize', callback);
}

/**
 * Returns true when the viewport is narrower than breakpoint (default 768px).
 * Uses useSyncExternalStore to avoid React 19 hydration mismatch and cascading set-state-in-effect warnings.
 */
export function useIsMobile(breakpoint = 768): boolean {
	return useSyncExternalStore(
		subscribeResize,
		() => (typeof window !== 'undefined' ? window.innerWidth < breakpoint : false),
		() => false
	);
}
