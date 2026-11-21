import { Client } from 'pg';
import { CONFIG } from '@/server/config';
import {
	CHANNEL,
	MAX_CONNECTIONS_PER_USER,
	getBusState,
	type AppEvent,
	type BusState,
	type EventSubscriber,
} from './types';

function formatListenError(err: unknown): string {
	if (err instanceof AggregateError) {
		const code = (err as AggregateError & { code?: string }).code;
		const nested = err.errors?.[0];
		const detail = nested instanceof Error ? nested.message || (nested as Error & { code?: string }).code : '';
		return [code, detail].filter(Boolean).join(': ') || 'AggregateError';
	}
	if (err instanceof Error) return err.message || err.name;
	return String(err);
}

function dispatch(event: AppEvent): void {
	const s = getBusState();
	for (const fn of s.handlers.values()) {
		try {
			fn(event);
		} catch (err) {
			console.error('[events] Handler error:', err);
		}
	}
	const deliver = (sub: EventSubscriber) => {
		try {
			if (sub.send) sub.send(event);
		} catch (err) {
			console.error('[events] Subscriber error:', err);
		}
	};
	const deliverToUser = (uid?: string) => {
		if (!uid) return;
		const group = s.subscribers.get(uid);
		if (group) for (const sub of group) deliver(sub);
	};
	if (event.userId) {
		deliverToUser(event.userId);
	} else if (event.k === 'call_signal') {
		deliverToUser(event.targetUserId);
	} else if (event.k === 'call_ring' && Array.isArray(event.participantIds)) {
		for (const pid of event.participantIds) deliverToUser(pid);
	} else if (event.k === 'drive_updated') {
		deliverToUser(event.ownerId);
	} else {
		for (const group of s.subscribers.values()) {
			for (const sub of group) deliver(sub);
		}
	}
}

function disconnectAndRetry(s: BusState): void {
	const old = s.client;
	s.client = null;
	s.activeUrl = null;
	if (old) {
		old.removeAllListeners('notification');
		old.removeAllListeners('error');
		old.removeAllListeners('end');
		try {
			old.end().catch(() => {});
		} catch {
			/* ignore */
		}
	}
	if (s.retryTimer) return;
	const delay = Math.min(30_000, 500 * Math.pow(2, Math.min(s.attemptCount, 6)));
	s.attemptCount += 1;
	s.retryTimer = setTimeout(() => {
		s.retryTimer = null;
		startListener();
	}, delay);
	if (typeof s.retryTimer === 'object' && 'unref' in s.retryTimer) s.retryTimer.unref();
}

export function startListener(): void {
	const s = getBusState();
	const connectionString = (process.env.DATABASE_URL || CONFIG.database.url || '').trim();
	if (!connectionString) return;
	if (s.connecting) {
		if (s.connectingUrl !== connectionString) {
			void s.connecting.finally(() => startListener());
		}
		return;
	}
	if (s.client) {
		if (s.activeUrl === connectionString) return;
		const old = s.client;
		s.client = null;
		s.activeUrl = null;
		old.removeAllListeners();
		old.end().catch(() => {});
	}

	s.connectingUrl = connectionString;
	s.connecting = (async () => {
		let client: Client | null = null;
		try {
			client = new Client({ connectionString });
			client.on('notification', (msg) => {
				if (msg.channel !== CHANNEL || !msg.payload) return;
				try {
					const data = JSON.parse(msg.payload) as AppEvent;
					dispatch(data);
				} catch {
					/* ignore malformed payload */
				}
			});
			client.on('error', (err) => {
				console.error('[events] LISTEN connection error:', err.message);
				disconnectAndRetry(s);
			});
			client.on('end', () => {
				disconnectAndRetry(s);
			});
			await client.connect();
			await client.query(`LISTEN ${CHANNEL}`);
			s.client = client;
			s.activeUrl = connectionString;
			const wasReconnecting = s.attemptCount > 0;
			s.attemptCount = 0;
			if (wasReconnecting) dispatch({ k: 'refresh' });
		} catch (err) {
			if (s.attemptCount === 0 || s.attemptCount % 5 === 0) {
				console.error('[events] Failed to start LISTEN:', formatListenError(err));
			}
			if (client) {
				try {
					client.end().catch(() => {});
				} catch {
					/* ignore */
				}
			}
			disconnectAndRetry(s);
		} finally {
			s.connecting = null;
			s.connectingUrl = null;
		}
	})();
}

/** Registers an in-process listener (e.g., `roles.ts` cache invalidation). */
export function registerEventHandler(
	nameOrHandler: string | ((event: AppEvent) => void),
	maybeHandler?: (event: AppEvent) => void
): () => void {
	const s = getBusState();
	const key = typeof nameOrHandler === 'string' ? nameOrHandler : Math.random().toString(36);
	const handler = typeof nameOrHandler === 'function' ? nameOrHandler : maybeHandler!;
	s.handlers.set(key, handler);
	startListener();
	return () => {
		s.handlers.delete(key);
	};
}

/** Registers an `/api/stream` SSE connection; returns an unsubscribe function. */
export function subscribe(subscriber: EventSubscriber): () => void {
	const s = getBusState();
	startListener();
	let group = s.subscribers.get(subscriber.userId);
	if (!group) {
		group = new Set();
		s.subscribers.set(subscriber.userId, group);
	}
	while (group.size >= MAX_CONNECTIONS_PER_USER) {
		const oldest = group.values().next().value;
		if (!oldest) break;
		group.delete(oldest);
		try {
			if (oldest.close) oldest.close();
		} catch {
			/* ignore */
		}
	}
	group.add(subscriber);
	return () => {
		const g = s.subscribers.get(subscriber.userId);
		if (!g) return;
		g.delete(subscriber);
		if (g.size === 0) s.subscribers.delete(subscriber.userId);
	};
}

/** Dispatches an event to all registered in-process handlers and SSE subscribers. */
export function dispatchLocalEvent(event: AppEvent): void {
	dispatch(event);
}

/** Closes the active LISTEN client and cancels any pending reconnect timer. */
export async function stopListener(): Promise<void> {
	const s = getBusState();
	if (s.connecting) {
		try {
			await s.connecting;
		} catch {
			/* ignore */
		}
	}
	if (s.retryTimer) {
		clearTimeout(s.retryTimer);
		s.retryTimer = null;
	}
	const client = s.client;
	s.client = null;
	s.activeUrl = null;
	if (client) {
		client.removeAllListeners();
		await client.end().catch(() => {});
	}
}

/** Diagnostic helper for health checks / tests: active subscriber count & LISTEN state. */
export function eventStatus(): { subscriberCount: number; listening: boolean } {
	const s = getBusState();
	let subscriberCount = 0;
	for (const g of s.subscribers.values()) subscriberCount += g.size;
	const listening = s.client !== null;
	return { subscriberCount, listening };
}
