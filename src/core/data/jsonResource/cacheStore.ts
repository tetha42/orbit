import type { CacheEntry, InFlightEntry } from './types';
import {
	clearSessionCacheByPattern,
	getSessionCache,
	removeSessionCache,
	setSessionCache,
	shouldPersist,
} from './sessionCache';

export const RESOURCE_CACHE = new Map<string, CacheEntry>();
export const IN_FLIGHT = new Map<string, InFlightEntry>();
export const SWR_STALE_MS = 25_000;

export type InvalidationListener = (pattern: RegExp | string) => void;
export type MutationListener = (url: string, data: unknown) => void;

export const invalidationListeners = new Set<InvalidationListener>();
export const mutationListeners = new Set<MutationListener>();

/** Invalidate cached resources matching a pattern and trigger active hooks to refetch. */
export function invalidateResource(pattern: string | RegExp): void {
	for (const key of RESOURCE_CACHE.keys()) {
		const matches = typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key);
		if (matches) {
			RESOURCE_CACHE.delete(key);
			removeSessionCache(key);
		}
	}
	for (const key of IN_FLIGHT.keys()) {
		const matches = typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key);
		if (matches) {
			const entry = IN_FLIGHT.get(key);
			entry?.controller.abort();
			IN_FLIGHT.delete(key);
		}
	}
	clearSessionCacheByPattern(pattern);

	invalidationListeners.forEach((listener) => {
		try {
			listener(pattern);
		} catch (err) {
			console.error('[useJsonResource] invalidation listener error:', err);
		}
	});
}

/** Optimistically mutate a cached resource and notify active hooks immediately. */
export function mutateResource<T = unknown>(
	url: string,
	updater: T | ((prev: T | null) => T | null)
): void {
	let currentCached = RESOURCE_CACHE.get(url);
	if (!currentCached && shouldPersist(url)) {
		const fromSession = getSessionCache(url);
		if (fromSession) {
			currentCached = fromSession;
			RESOURCE_CACHE.set(url, fromSession);
		}
	}
	const prevData = (currentCached?.data as T) ?? null;
	const nextData =
		typeof updater === 'function'
			? (updater as (prev: T | null) => T | null)(prevData)
			: updater;

	if (nextData === null) {
		RESOURCE_CACHE.delete(url);
		removeSessionCache(url);
	} else {
		const entry: CacheEntry<unknown> = {
			data: nextData,
			timestamp: Date.now(),
			status: currentCached?.status ?? 200,
			failure: null,
		};
		RESOURCE_CACHE.set(url, entry);
		if (shouldPersist(url)) setSessionCache(url, entry);
	}

	mutationListeners.forEach((listener) => {
		try {
			listener(url, nextData);
		} catch (err) {
			console.error('[useJsonResource] mutation listener error:', err);
		}
	});
}

/** Plain request helper: fetches JSON and deduplicates concurrent callers. */
export async function fetchJsonDeduplicated<T>(
	url: string,
	signal?: AbortSignal
): Promise<{ status: number; payload?: T; failure?: string }> {
	if (signal?.aborted) {
		const err = new Error('Aborted');
		err.name = 'AbortError';
		throw err;
	}

	const existing = IN_FLIGHT.get(url);
	if (existing) {
		if (signal) {
			existing.signals.add(signal);
			const onAbort = () => {
				existing.signals.delete(signal);
				if (existing.signals.size === 0 && existing.untrackedCount === 0) {
					existing.controller.abort();
					IN_FLIGHT.delete(url);
				}
			};
			signal.addEventListener('abort', onAbort, { once: true });
		} else {
			existing.untrackedCount += 1;
		}
		return existing.promise as Promise<{ status: number; payload?: T; failure?: string }>;
	}

	const fetchController = new AbortController();
	const signals = new Set<AbortSignal>();
	let untrackedCount = 0;
	if (signal) {
		signals.add(signal);
		const onAbort = () => {
			signals.delete(signal);
			const current = IN_FLIGHT.get(url);
			if (signals.size === 0 && (current?.untrackedCount ?? 0) === 0) {
				fetchController.abort();
				IN_FLIGHT.delete(url);
			}
		};
		signal.addEventListener('abort', onAbort, { once: true });
	} else {
		untrackedCount = 1;
	}

	const promise = (async () => {
		try {
			const res = await fetch(url, { signal: fetchController.signal });
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
				return { status: res.status, failure: typeof body?.error === 'string' ? body.error : undefined };
			}
			const payload = (await res.json()) as T;
			return { status: res.status, payload };
		} finally {
			IN_FLIGHT.delete(url);
		}
	})();

	IN_FLIGHT.set(url, { promise, controller: fetchController, signals, untrackedCount });
	return promise;
}

export function isAbort(err: unknown): boolean {
	return (err as { name?: string } | null)?.name === 'AbortError';
}
