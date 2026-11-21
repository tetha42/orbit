'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { errorMessage } from '@/lib/errors';
import type { CacheEntry, JsonResource, UseJsonResourceOptions } from './jsonResource/types';
import {
	clearSessionCacheByPattern,
	getSessionCache,
	removeSessionCache,
	setSessionCache,
	shouldPersist,
} from './jsonResource/sessionCache';
import {
	fetchJsonDeduplicated,
	IN_FLIGHT,
	invalidationListeners,
	invalidateResource,
	isAbort,
	mutationListeners,
	mutateResource,
	RESOURCE_CACHE,
	SWR_STALE_MS,
	type InvalidationListener,
	type MutationListener,
} from './jsonResource/cacheStore';

export type { JsonResource, UseJsonResourceOptions } from './jsonResource/types';
export { invalidateResource, mutateResource };

/** Fetches a JSON endpoint on mount with SWR caching and reactive invalidation. */
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
						const entry = { data: next, timestamp: Date.now(), status: httpStatus ?? 200, failure: null };
						RESOURCE_CACHE.set(url, entry);
						if (isPersistent) setSessionCache(url, entry);
					} else {
						RESOURCE_CACHE.delete(url);
						if (isPersistent) removeSessionCache(url);
					}
				}
				return next;
			});
		},
		[url, httpStatus, isPersistent]
	);

	useEffect(() => {
		if (url === null) return;
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
		if (isFresh) return;

		const controller = new AbortController();
		inFlightRef.current = controller;

		(async () => {
			try {
				const { status, payload, failure: text } = await fetchJsonDeduplicated<T>(url, controller.signal);
				if (controller.signal.aborted) return;
				setHttpStatus(status);
				setFailure(text ?? null);
				if (payload !== undefined) {
					setDataInternal(payload);
					setError(null);
					const entry = { data: payload, timestamp: Date.now(), status, failure: text ?? null };
					RESOURCE_CACHE.set(url, entry);
					if (isPersistent) setSessionCache(url, entry);
				} else if (text || status >= 400) {
					setError(text ?? (status === 403 ? 'Access denied.' : 'Failed to load data.'));
				}
			} catch (err) {
				if (!isAbort(err) && !controller.signal.aborted) {
					console.error(`Failed to fetch ${url}:`, err);
					setError(errorMessage(err, 'Failed to load data.'));
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

		RESOURCE_CACHE.delete(url);
		const existingInFlight = IN_FLIGHT.get(url);
		if (existingInFlight) {
			existingInFlight.controller.abort();
			IN_FLIGHT.delete(url);
		}
		if (isPersistent) removeSessionCache(url);

		try {
			const { status, payload, failure: text } = await fetchJsonDeduplicated<T>(url, controller.signal);
			if (controller.signal.aborted) return;
			setHttpStatus(status);
			setFailure(text ?? null);
			if (payload !== undefined) {
				setDataInternal(payload);
				setError(null);
				const entry = { data: payload, timestamp: Date.now(), status, failure: text ?? null };
				RESOURCE_CACHE.set(url, entry);
				if (isPersistent) setSessionCache(url, entry);
			} else if (text || status >= 400) {
				setError(text ?? (status === 403 ? 'Access denied.' : 'Failed to load data.'));
			}
		} catch (err) {
			if (!isAbort(err) && !controller.signal.aborted) {
				console.error(`Failed to refetch ${url}:`, err);
				setError(errorMessage(err, 'Failed to load data.'));
			}
		}
	}, [url, isPersistent]);

	useEffect(() => {
		if (url === null) return;
		const handleInvalidation: InvalidationListener = (pattern) => {
			const matches = typeof pattern === 'string' ? url.startsWith(pattern) : pattern.test(url);
			if (matches) void refetch();
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

const LIVE_EVENT_RESOURCE_MAP: Record<string, string> = {
	'permission-changed': '/api/roles',
	team_updated: '/api/teams',
	budget_updated: '/api/budget',
	inventory_updated: '/api/inventory',
	news_updated: '/api/news',
	event_updated: '/api/events',
	project_updated: '/api/projects',
	decision_updated: '/api/decisions',
	note_updated: '/api/notes',
};

if (typeof window !== 'undefined') {
	window.addEventListener('orbit:resource-invalidate', ((event: Event) => {
		const custom = event as CustomEvent<{ kind?: string }>;
		const kind = custom.detail?.kind;
		if (kind && LIVE_EVENT_RESOURCE_MAP[kind]) {
			invalidateResource(LIVE_EVENT_RESOURCE_MAP[kind]);
		}
	}) as EventListener);
}
