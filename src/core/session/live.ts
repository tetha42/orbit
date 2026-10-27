import { useEffect, useRef } from 'react';
import { refreshAllResources } from '@/core/commands';

/**
 * The live connection to `/api/olaylar` (Server-Sent Events): the server tells
 * the open workspace the moment something changed, instead of the workspace
 * asking every 15 s.
 *
 *   permission-degisti       — a role (or this member's role) changed
 *   oturum-sonlandi     — the session is over (signed in elsewhere, suspended…)
 *   bildirim            — something new for the notification feed
 *   takim_guncellendi   — team roster, settings, or kanban tasks changed
 *   butce_guncellendi   — budget ledger or balance changed
 *   envanter_guncellendi — inventory item status, custody, or details changed
 */
export type LiveEvent =
	| 'permission-degisti'
	| 'oturum-sonlandi'
	| 'bildirim'
	| 'takim_guncellendi'
	| 'butce_guncellendi'
	| 'envanter_guncellendi'
	| 'haber_guncellendi'
	| 'etkinlik_guncellendi'
	| 'proje_guncellendi'
	| 'karar_guncellendi'
	| 'not_guncellendi';

const LIVE_EVENTS: readonly LiveEvent[] = [
	'permission-degisti',
	'oturum-sonlandi',
	'bildirim',
	'takim_guncellendi',
	'butce_guncellendi',
	'envanter_guncellendi',
	'haber_guncellendi',
	'etkinlik_guncellendi',
	'proje_guncellendi',
	'karar_guncellendi',
	'not_guncellendi',
];

const listeners = new Set<(event: LiveEvent) => void>();

/** Hands an event to everything that listens through `useLiveEvent` (and `startLiveConnection`'s own callback). */
function emitLiveEvent(event: LiveEvent): void {
	for (const listener of listeners) listener(event);
}

/** Calls `handler` for each event the live stream delivers; nothing is called while the stream is down. */
export function useLiveEvent(handler: (event: LiveEvent) => void): void {
	const ref = useRef(handler);
	useEffect(() => {
		ref.current = handler;
	});
	useEffect(() => {
		const listener = (event: LiveEvent) => ref.current(event);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);
}

/** Reconnect waits: 1 s, 2 s, 4 s … up to this. */
const MAX_BACKOFF_MS = 30_000;

export interface LiveConnectionHandlers {
	/** The stream opened (`true`) or went away (`false`). `again` is true for a reconnection. */
	onState: (connected: boolean, again: boolean) => void;
	onEvent: (event: LiveEvent) => void;
}

/**
 * Keeps one `EventSource` open until stopped: reconnects with exponential
 * backoff, and at once when the tab becomes visible again. A refused stream
 * (401/403 — the session is over) is retried with the growing wait until the
 * probe ends the session and stops this. Every tab owns its own connection. Returns the stop function.
 */
export function startLiveConnection({ onState, onEvent }: LiveConnectionHandlers): () => void {
	if (typeof EventSource === 'undefined') return () => {};
	let source: EventSource | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let attempt = 0;
	let stopped = false;
	let everOpened = false;

	const close = () => {
		source?.close();
		source = null;
	};

	const connect = () => {
		if (stopped || source) return;
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		let es: EventSource;
		try {
			es = new EventSource('/api/olaylar');
		} catch {
			schedule();
			return;
		}
		source = es;
		es.onopen = () => {
			const again = everOpened;
			everOpened = true;
			attempt = 0;
			onState(true, again);
		};
		for (const name of LIVE_EVENTS) {
			es.addEventListener(name, () => {
				if (name === 'oturum-sonlandi') {
					// The server closes the stream next; do not reconnect into a dead session.
					stopped = true;
					close();
					onState(false, true);
				}
				if (
					name === 'takim_guncellendi' ||
					name === 'butce_guncellendi' ||
					name === 'envanter_guncellendi' ||
					name === 'haber_guncellendi' ||
					name === 'etkinlik_guncellendi' ||
					name === 'proje_guncellendi' ||
					name === 'karar_guncellendi' ||
					name === 'not_guncellendi'
				) {
					refreshAllResources();
				}
				onEvent(name);
				emitLiveEvent(name);
			});
		}
		es.onerror = () => {
			// Handled here rather than by the browser's own retry, so the wait grows.
			close();
			if (!stopped) onState(false, true);
			schedule();
		};
	};

	const schedule = () => {
		if (stopped || timer) return;
		timer = setTimeout(() => {
			timer = null;
			connect();
		}, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt));
		attempt += 1;
	};

	// A tab coming back to the front should not wait out a long backoff.
	const onVisible = () => {
		if (document.hidden || stopped || source) return;
		attempt = 0;
		connect();
	};
	document.addEventListener('visibilitychange', onVisible);
	connect();

	return () => {
		stopped = true;
		document.removeEventListener('visibilitychange', onVisible);
		if (timer) clearTimeout(timer);
		close();
	};
}
