import type { Dispatch, SetStateAction } from 'react';

export interface JsonResource<T> {
	data: T | null;
	/** For optimistic updates and local edits between refetches. */
	setData: Dispatch<SetStateAction<T | null>>;
	/** Re-runs the request; safe to call from event handlers. */
	refetch: () => Promise<void>;
	error: string | null;
	/** No data yet and no failure — i.e. the first request is still in flight. */
	isLoading: boolean;
	/** HTTP status of the last completed request, `null` until one has finished. */
	httpStatus: number | null;
	/** The server's own `error` text of the last failed request, else null. */
	failure: string | null;
}

export interface CacheEntry<T = unknown> {
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

export interface InFlightEntry {
	promise: Promise<{ status: number; payload?: unknown; failure?: string }>;
	controller: AbortController;
	signals: Set<AbortSignal>;
	untrackedCount: number;
}
