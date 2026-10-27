'use client';

import { useEffect, useState } from 'react';
import type { SearchHit, SearchResponse } from '@/types/search';

/** The same bounds `/api/search` enforces; anything outside them is not sent. */
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 64;

const DEBOUNCE_MS = 120;

export type SearchFailure = 'rate' | 'failed';

interface Settled {
	/** The (trimmed) query these results answer. */
	query: string;
	hits: SearchHit[];
	failure: SearchFailure | null;
}

export interface ServerSearch {
	hits: SearchHit[];
	/** True from the keystroke until its answer is in; `hits` may still be the previous query's meanwhile. */
	loading: boolean;
	failure: SearchFailure | null;
}

const IDLE: ServerSearch = { hits: [], loading: false, failure: null };

/**
 * Record search against `GET /api/search`, for the Spotlight.
 *
 * Waits for a short pause in typing, and a newer keystroke aborts the request still
 * in flight, so a slow answer to "we" can never overwrite the answer to "web". While
 * the next answer is on its way the previous hits stay put (`loading` tells the UI to
 * dim them) — clearing them on every keystroke would make the list flicker.
 */
export function useServerSearch(rawQuery: string): ServerSearch {
	const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
	const active = query.length >= MIN_QUERY_LENGTH;
	const [settled, setSettled] = useState<Settled | null>(null);
	const [wasActive, setWasActive] = useState(active);

	// Going back below the minimum forgets the old answer, so typing something new
	// later does not briefly show hits for a query from minutes ago. (Adjusting state
	// while rendering is React's documented way to reset state from a changed value.)
	if (wasActive !== active) {
		setWasActive(active);
		if (!active) setSettled(null);
	}

	useEffect(() => {
		if (!active) return;
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
					signal: controller.signal,
					cache: 'no-store',
				});
				if (!res.ok) {
					setSettled({ query, hits: [], failure: res.status === 429 ? 'rate' : 'failed' });
					return;
				}
				const data = (await res.json()) as SearchResponse;
				setSettled({ query, hits: data.hits, failure: null });
			} catch (error) {
				if ((error as { name?: string })?.name === 'AbortError') return;
				setSettled({ query, hits: [], failure: 'failed' });
			}
		}, DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [active, query]);

	if (!active) return IDLE;
	const answered = settled?.query === query;
	return {
		hits: settled?.hits ?? [],
		loading: !answered,
		failure: answered ? settled.failure : null,
	};
}
