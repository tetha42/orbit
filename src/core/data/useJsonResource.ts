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

const RESOURCE_CACHE = new Map<string, CacheEntry>();
const IN_FLIGHT = new Map<string, Promise<{ status: number; payload?: unknown; failure?: string }>>();
const SWR_STALE_MS = 25_000; // 25 seconds SWR freshness window

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
 * Fetches a JSON endpoint on mount with high-performance SWR caching.
 *
 * Performance features:
 *  - Instant Cache Hit: Initial state is populated immediately from in-memory cache if available,
 *    eliminating blank loading screens on window reopening or tab switching.
 *  - Stale-While-Revalidate: Revalidates in the background if cache is older than 25s.
 *  - Concurrent Request Deduplication: Multiple simultaneous calls for the same URL share one HTTP request.
 *  - Optimistic Sync: Local `setData` updates propagate directly to the resource cache.
 */
export function useJsonResource<T>(url: string | null): JsonResource<T> {
	const cached = url ? (RESOURCE_CACHE.get(url) as CacheEntry<T> | undefined) : undefined;

	const [data, setDataInternal] = useState<T | null>(() => (cached ? cached.data : null));
	const [error, setError] = useState<string | null>(null);
	const [httpStatus, setHttpStatus] = useState<number | null>(() => (cached ? cached.status : null));
	const [failure, setFailure] = useState<string | null>(() => (cached ? cached.failure : null));
	const inFlightRef = useRef<AbortController | null>(null);

	const setData: Dispatch<SetStateAction<T | null>> = useCallback(
		(action: SetStateAction<T | null>) => {
			setDataInternal((prev) => {
				const next = typeof action === 'function' ? (action as (p: T | null) => T | null)(prev) : action;
				if (url && next !== null) {
					RESOURCE_CACHE.set(url, {
						data: next,
						timestamp: Date.now(),
						status: httpStatus ?? 200,
						failure: null,
					});
				}
				return next;
			});
		},
		[url, httpStatus]
	);

	useEffect(() => {
		if (url === null) return;

		// Check if we have fresh cached data
		const currentCached = RESOURCE_CACHE.get(url) as CacheEntry<T> | undefined;
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
					RESOURCE_CACHE.set(url, {
						data: payload,
						timestamp: Date.now(),
						status,
						failure: text ?? null,
					});
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
	}, [url]);

	const refetch = useCallback(async () => {
		if (url === null) return;
		inFlightRef.current?.abort();
		const controller = new AbortController();
		inFlightRef.current = controller;

		// Force invalidate cache entry for explicit refetch
		RESOURCE_CACHE.delete(url);

		try {
			const { status, payload, failure: text } = await fetchJsonDeduplicated<T>(url);
			if (controller.signal.aborted) return;
			setHttpStatus(status);
			setFailure(text ?? null);
			if (payload !== undefined) {
				setDataInternal(payload);
				setError(null);
				RESOURCE_CACHE.set(url, {
					data: payload,
					timestamp: Date.now(),
					status,
					failure: text ?? null,
				});
			} else if (text || status >= 400) {
				setError(text ?? (status === 403 ? 'Erişim yetkiniz yok.' : 'Veriler yüklenemedi.'));
			}
		} catch (err) {
			if (!isAbort(err) && !controller.signal.aborted) {
				console.error(`Failed to refetch ${url}:`, err);
				setError(errorMessage(err, 'Veriler yüklenemedi.'));
			}
		}
	}, [url]);

	// The menu's "refresh all data" reaches every mounted view through this event.
	useEffect(() => {
		if (url === null) return;
		const onRefresh = () => {
			RESOURCE_CACHE.clear();
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
