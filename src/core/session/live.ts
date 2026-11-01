'use client';

import { useEffect, useRef } from 'react';

/**
 * The live connection to `/api/stream` (Server-Sent Events): the server tells
 * the browser as soon as something changed on the database via PostgreSQL
 * NOTIFY, so nothing polls while the stream is open.
 *
 * Events:
 *   permission-changed  — a role (or this member's role) changed
 *   session-ended       — the session is over (signed in elsewhere, suspended…)
 *   notification        — a notification was recorded for this member
 *   team_updated        — team roster, settings, or kanban tasks changed
 *   budget_updated      — budget ledger or balance changed
 *   inventory_updated   — inventory item status, custody, or details changed
 */
export type LiveEvent =
	| 'permission-changed'
	| 'session-ended'
	| 'notification'
	| 'team_updated'
	| 'budget_updated'
	| 'inventory_updated'
	| 'news_updated'
	| 'event_updated'
	| 'project_updated'
	| 'decision_updated'
	| 'note_updated';

const LIVE_EVENTS: readonly LiveEvent[] = [
	'permission-changed',
	'session-ended',
	'notification',
	'team_updated',
	'budget_updated',
	'inventory_updated',
	'news_updated',
	'event_updated',
	'project_updated',
	'decision_updated',
	'note_updated',
];

/** Hands an event to everything that listens through `useLiveEvent` (and `startLiveConnection`'s own callback). */
const listeners = new Set<(event: LiveEvent) => void>();

/**
 * Calls `handler` whenever the server pushes a live event on the open stream.
 */
export function useLiveEvent(handler: (event: LiveEvent) => void): void {
	const ref = useRef(handler);
	useEffect(() => {
		ref.current = handler;
	});
	useEffect(() => {
		const forward = (e: LiveEvent) => ref.current(e);
		listeners.add(forward);
		return () => {
			listeners.delete(forward);
		};
	}, []);
}

function broadcast(event: LiveEvent): void {
	for (const fn of listeners) {
		try {
			fn(event);
		} catch {
			// A broken listener must not silence the rest.
		}
	}
}

export type LiveConnectionState = 'live' | 'reconnecting' | 'offline';

export interface LiveConnectionHandlers {
	/** The stream opened (`true`) or went away (`false`). `again` is true for a reconnection. */
	onState: (connected: boolean, again: boolean) => void;
	onEvent: (event: LiveEvent) => void;
	onConnectionState?: (state: LiveConnectionState) => void;
}

export type LiveConnectionOptions = LiveConnectionHandlers;

/**
 * Keeps an `EventSource('/api/stream')` open while the session is alive, and
 * reconnects with exponential backoff when it drops.
 */
export function startLiveConnection({ onState, onEvent, onConnectionState }: LiveConnectionHandlers): () => void {
	if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
		onState(false, false);
		onConnectionState?.('offline');
		return () => {};
	}

	let stopped = false;
	let es: EventSource | null = null;
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let attempt = 0;
	let everOpened = false;

	const clearRetry = () => {
		if (retryTimer !== null) {
			clearTimeout(retryTimer);
			retryTimer = null;
		}
	};

	const connect = () => {
		if (stopped) return;
		clearRetry();
		if (attempt > 0) {
			onConnectionState?.('reconnecting');
		}
		try {
			es = new EventSource('/api/stream');
		} catch {
			scheduleReconnect();
			return;
		}

		es.addEventListener('open', () => {
			if (stopped) return;
			attempt = 0;
			const again = everOpened;
			everOpened = true;
			onConnectionState?.('live');
			onState(true, again);
		});

		for (const name of LIVE_EVENTS) {
			es.addEventListener(name, () => {
				if (stopped) return;
				if (name === 'session-ended') {
					stopped = true;
					try {
						es?.close();
					} catch {
						/* ignore */
					}
					es = null;
					onConnectionState?.('offline');
					onState(false, true);
				} else if (
					name === 'team_updated' ||
					name === 'budget_updated' ||
					name === 'inventory_updated' ||
					name === 'news_updated' ||
					name === 'event_updated' ||
					name === 'project_updated' ||
					name === 'decision_updated' ||
					name === 'note_updated'
				) {
					window.dispatchEvent(new CustomEvent('orbit:resource-invalidate', { detail: { kind: name } }));
				}
				onEvent(name);
				broadcast(name);
			});
		}

		es.addEventListener('error', () => {
			if (stopped) return;
			try {
				es?.close();
			} catch {
				/* ignore */
			}
			es = null;
			onConnectionState?.('reconnecting');
			onState(false, true);
			scheduleReconnect();
		});
	};

	const scheduleReconnect = () => {
		if (stopped || retryTimer !== null) return;
		onConnectionState?.('reconnecting');
		const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(attempt, 5)));
		attempt += 1;
		retryTimer = setTimeout(() => {
			retryTimer = null;
			connect();
		}, delay);
	};

	// When the tab wakes or the network comes back, try right away instead of waiting out the backoff.
	const retryNow = () => {
		if (stopped || es !== null) return;
		attempt = 0;
		connect();
	};
	const onVisibility = () => {
		if (!document.hidden) retryNow();
	};
	const onOffline = () => {
		onConnectionState?.('offline');
	};
	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('online', retryNow);
	window.addEventListener('offline', onOffline);

	connect();

	return () => {
		stopped = true;
		clearRetry();
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('online', retryNow);
		window.removeEventListener('offline', onOffline);
		onConnectionState?.('offline');
		if (es) {
			try {
				es.close();
			} catch {
				/* ignore */
			}
			es = null;
		}
	};
}
