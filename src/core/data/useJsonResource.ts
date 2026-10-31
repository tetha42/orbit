'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { errorMessage } from '@/lib/errors';

export interface JsonResource<T> {
	data: T | null;
	/** For optimistic updates and local edits between refetches. */
	setData: Dispatch<SetStateAction<T | null>>;
	/** Re-runs the request; safe to call from event handlers. */
	refetch: () => Promise<void>;
	error: string | null;
	/** No data yet and no failure — i.e. the first request is still in flight. */
	isLoading: boolean;
	/**
	 * HTTP status of the last completed request, `null` until one has finished.
	 *
	 * 401/403 are not turned into `error` (the shell handles an ended session), so
	 * without this a screen could not tell "not allowed" from "still loading" —
	 * `isLoading` stays true for a refused request, and the user stared at a
	 * spinner forever. Screens that care check `httpStatus === 403`.
	 */
	httpStatus: number | null;
	/** The server's own `error` text of the last failed request (e.g. a Turkish reason from the mail server), else null. */
	failure: string | null;
}

/**
 * Plain request helper: fetches JSON and returns it.
 *
 * Kept free of state so the effect below can `await` it and only then update
 * state — React 19's `set-state-in-effect` rule flags effects that reach a
 * state update synchronously, which is exactly what the old
 * `useEffect(() => setLoading(true))` shape did.
 */
interface CacheEntry<T = unknown> {
	data: T;
	timestamp: number;
	status: number;
	failure: string | null;
}

export interface UseJsonResourceOptions {
	/**
	 * Persist cache entry into sessionStorage across page reloads.
	 * Default: true for semi-static endpoints (/api/roles, /api/registration-config, /api/form-fields), false otherwise.
	 */
	persistSession?: boolean;
}

const RESOURCE_CACHE = new Map<string, CacheEntry>();
const IN_FLIGHT = new Map<string, Promise<{ status: number; payload?: unknown; failure?: string }>>();
const SWR_STALE_MS = 25_000; // 25 seconds SWR freshness window

const SESSION_CACHE_PREFIX = 'orbit_cache:';
const DEFAULT_SESSION_ROUTES = ['/api/roles', '/api/registration-config', '/api/form-fields'];

function shouldPersist(url: string | null, persistSession?: boolean): boolean {
	if (!url) return false;
	if (persistSession !== undefined) return persistSession;
	return DEFAULT_SESSION_ROUTES.some((route) => url.startsWith(route));
}

function getSessionCache<T>(url: string): CacheEntry<T> | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.sessionStorage.getItem(SESSION_CACHE_PREFIX + url);
		if (!raw) return null;
		return JSON.parse(raw) as CacheEntry<T>;
	} catch {
		return null;
	}
}

function setSessionCache<T>(url: string, entry: CacheEntry<T>): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(SESSION_CACHE_PREFIX + url, JSON.stringify(entry));
	} catch {
		// Ignore quota exceeded or storage disabled
	}
}

function removeSessionCache(url: string): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + url);
	} catch {
		// Ignore
	}
}

function clearSessionCacheByPattern(pattern: string | RegExp): void {
	if (typeof window === 'undefined') return;
	try {
		const keysToRemove: string[] = [];
		for (let i = 0; i < window.sessionStorage.length; i++) {
			const key = window.sessionStorage.key(i);
			if (key && key.startsWith(SESSION_CACHE_PREFIX)) {
				const url = key.slice(SESSION_CACHE_PREFIX.length);
				const matches = typeof pattern === 'string' ? url.startsWith(pattern) : pattern.test(url);
				if (matches) {
					keysToRemove.push(key);
				}
			}
		}
		for (const key of keysToRemove) {
			window.sessionStorage.removeItem(key);
		}
	} catch {
		// Ignore
	}
}

type InvalidationListener = (pattern: RegExp | string) => void;
type MutationListener = (url: string, data: unknown) => void;

const invalidationListeners = new Set<InvalidationListener>();
const mutationListeners = new Set<MutationListener>();

/**
 * Invalidate cached resources matching a pattern and trigger active hooks to refetch.
 */
export function invalidateResource(pattern: string | RegExp): void {
	for (const key of RESOURCE_CACHE.keys()) {
		const matches = typeof pattern === 'string' ? key.startsWith(pattern) : pattern.test(key);
		if (matches) {
			RESOURCE_CACHE.delete(key);
			removeSessionCache(key);
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

/**
 * Optimistically mutate a cached resource and notify active hooks immediately.
 */
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
		if (shouldPersist(url)) {
			setSessionCache(url, entry);
		}
	}

	mutationListeners.forEach((listener) => {
		try {
			listener(url, nextData);
		} catch (err) {
			console.error('[useJsonResource] mutation listener error:', err);
		}
	});
}

/** Plain request helper: fetches JSON and returns it. Deduplicated across concurrent callers. */
async function fetchJsonDeduplicated<T>(
	url: string
): Promise<{ status: number; payload?: T; failure?: string }> {
	const existing = IN_FLIGHT.get(url);
	if (existing) {
		return existing as Promise<{ status: number; payload?: T; failure?: string }>;
	}

	const promise = (async () => {
		try {
			const res = await fetch(url);
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

	IN_FLIGHT.set(url, promise);
	return promise;
}

function isAbort(err: unknown): boolean {
	return (err as { name?: string } | null)?.name === 'AbortError';
}

/**
 * Fetches a JSON endpoint on mount with high-performance SWR caching and reactive invalidation.
 *
 * Performance features:
 *  - Instant Cache Hit: Initial state is populated immediately from in-memory cache or sessionStorage if available.
 *  - Stale-While-Revalidate: Revalidates in the background if cache is older than 25s.
 *  - Concurrent Request Deduplication: Multiple simultaneous calls for the same URL share one HTTP request.
 *  - Pub/Sub Invalidation & Mutation: Reactive updates via `invalidateResource` and `mutateResource`.
 *  - Optional Session Persistence: Semi-static configuration survives page reloads.
 */
export function useJsonResource<T>(
	url: string | null,
	options?: UseJsonResourceOptions
): JsonResource<T> {
	const isPersistent = shouldPersist(url, options?.persistSession);
	const getCached = (targetUrl: string | null): CacheEntry<T> | undefined => {
		if (!targetUrl) return undefined;
		const mem = RESOURCE_CACHE.get(targetUrl) as CacheEntry<T> | undefined;
		if (mem) return mem;
		if (shouldPersist(targetUrl, options?.persistSession)) {
			const session = getSessionCache<T>(targetUrl);
			if (session) {
				RESOURCE_CACHE.set(targetUrl, session);
				return session;
			}
		}
		return undefined;
	};

	const [prevUrl, setPrevUrl] = useState(url);
	const initialCached = getCached(url);

	const [data, setDataInternal] = useState<T | null>(() => (initialCached ? initialCached.data : null));
	const [error, setError] = useState<string | null>(null);
	const [httpStatus, setHttpStatus] = useState<number | null>(() => (initialCached ? initialCached.status : null));
	const [failure, setFailure] = useState<string | null>(() => (initialCached ? initialCached.failure : null));
	const inFlightRef = useRef<AbortController | null>(null);

	// Synchronize state immediately during render when url changes
	if (prevUrl !== url) {
		setPrevUrl(url);
		const cachedForNew = getCached(url);
		setDataInternal(cachedForNew ? cachedForNew.data : null);
		setHttpStatus(cachedForNew ? cachedForNew.status : null);
		setFailure(cachedForNew ? cachedForNew.failure : null);
		setError(null);
	}

	const setData: Dispatch<SetStateAction<T | null>> = useCallback(
		(action: SetStateAction<T | null>) => {
			setDataInternal((prev) => {
				const next = typeof action === 'function' ? (action as (p: T | null) => T | null)(prev) : action;
				if (url) {
					if (next !== null) {
						const entry = {
							data: next,
							timestamp: Date.now(),
							status: httpStatus ?? 200,
							failure: null,
						};
						RESOURCE_CACHE.set(url, entry);
						if (isPersistent) {
							setSessionCache(url, entry);
						}
					} else {
						RESOURCE_CACHE.delete(url);
						if (isPersistent) {
							removeSessionCache(url);
						}
					}
				}
				return next;
			});
		},
		[url, httpStatus, isPersistent]
	);

	useEffect(() => {
		if (url === null) return;

		// Check if we have fresh cached data
		let currentCached = RESOURCE_CACHE.get(url) as CacheEntry<T> | undefined;
		if (!currentCached && isPersistent) {
			const sessionData = getSessionCache<T>(url);
			if (sessionData) {
				RESOURCE_CACHE.set(url, sessionData);
				currentCached = sessionData;
			}
		}

		const isFresh = currentCached && Date.now() - currentCached.timestamp < SWR_STALE_MS;

		if (currentCached && currentCached.data !== undefined) {
			setDataInternal(currentCached.data);
			setHttpStatus(currentCached.status);
			setFailure(currentCached.failure);
			setError(null);
		}

		if (isFresh) {
			// Cache is fresh, skip network roundtrip
			return;
		}

		const controller = new AbortController();
		inFlightRef.current = controller;

		(async () => {
			try {
				const { status, payload, failure: text } = await fetchJsonDeduplicated<T>(url);
				if (controller.signal.aborted) return;
				setHttpStatus(status);
				setFailure(text ?? null);
				if (payload !== undefined) {
					setDataInternal(payload);
					setError(null);
					const entry = {
						data: payload,
						timestamp: Date.now(),
						status,
						failure: text ?? null,
					};
					RESOURCE_CACHE.set(url, entry);
					if (isPersistent) {
						setSessionCache(url, entry);
					}
				} else if (text || status >= 400) {
					setError(text ?? (status === 403 ? 'Erişim yetkiniz yok.' : 'Veriler yüklenemedi.'));
				}
			} catch (err) {
				if (!isAbort(err) && !controller.signal.aborted) {
					console.error(`Failed to fetch ${url}:`, err);
					setError(errorMessage(err, 'Veriler yüklenemedi.'));
				}
			}
		})();

		return () => {
			controller.abort();
			if (inFlightRef.current === controller) inFlightRef.current = null;
		};
	}, [url, isPersistent]);

	const refetch = useCallback(async () => {
		if (url === null) return;
		inFlightRef.current?.abort();
		const controller = new AbortController();
		inFlightRef.current = controller;

		// Force invalidate cache entry for explicit refetch
		RESOURCE_CACHE.delete(url);
		if (isPersistent) {
			removeSessionCache(url);
		}

		try {
			const { status, payload, failure: text } = await fetchJsonDeduplicated<T>(url);
			if (controller.signal.aborted) return;
			setHttpStatus(status);
			setFailure(text ?? null);
			if (payload !== undefined) {
				setDataInternal(payload);
				setError(null);
				const entry = {
					data: payload,
					timestamp: Date.now(),
					status,
					failure: text ?? null,
				};
				RESOURCE_CACHE.set(url, entry);
				if (isPersistent) {
					setSessionCache(url, entry);
				}
			} else if (text || status >= 400) {
				setError(text ?? (status === 403 ? 'Erişim yetkiniz yok.' : 'Veriler yüklenemedi.'));
			}
		} catch (err) {
			if (!isAbort(err) && !controller.signal.aborted) {
				console.error(`Failed to refetch ${url}:`, err);
				setError(errorMessage(err, 'Veriler yüklenemedi.'));
			}
		}
	}, [url, isPersistent]);

	// Reactive pub/sub invalidation and mutation subscribers
	useEffect(() => {
		if (url === null) return;
		const handleInvalidation: InvalidationListener = (pattern) => {
			const matches = typeof pattern === 'string' ? url.startsWith(pattern) : pattern.test(url);
			if (matches) {
				void refetch();
			}
		};
		const handleMutation: MutationListener = (mutatedUrl, nextData) => {
			if (mutatedUrl === url) {
				setDataInternal(nextData as T | null);
				if (nextData !== null) {
					setError(null);
					setHttpStatus(200);
				}
			}
		};
		invalidationListeners.add(handleInvalidation);
		mutationListeners.add(handleMutation);
		return () => {
			invalidationListeners.delete(handleInvalidation);
			mutationListeners.delete(handleMutation);
		};
	}, [url, refetch]);

	// The menu's "refresh all data" reaches every mounted view through this event.
	useEffect(() => {
		if (url === null) return;
		const onRefresh = () => {
			RESOURCE_CACHE.clear();
			clearSessionCacheByPattern('');
			void refetch();
		};
		window.addEventListener('workspace:refresh', onRefresh);
		return () => window.removeEventListener('workspace:refresh', onRefresh);
	}, [url, refetch]);

	return {
		data,
		setData,
		refetch,
		error,
		isLoading: url !== null && data === null && error === null && httpStatus === null,
		httpStatus,
		failure,
	};
}
