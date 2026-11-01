/**
 * Live event bus — PostgreSQL LISTEN/NOTIFY + Server-Sent Events (SSE) bridge.
 *
 * Any database change (role/permission update, member role assignment, session revocation,
 * new notification) sends a NOTIFY on `orbit_events`; every server process holds
 * a single persistent PG connection (`LISTEN orbit_events`) and fans the event out to:
 *   - its in-memory caches (e.g., role permission cache), and
 *   - the open `/api/stream` streams of its own members.
 *
 * Result: zero polling traffic while idle; when a change happens, open browser
 * tabs learn about it within milliseconds; works across multiple server processes.
 */
import { Client, type PoolClient } from 'pg';

const CHANNEL = 'orbit_events';

export type AppEvent =
	/** Role permissions changed, or a member's role was reassigned. */
	| { k: 'permission'; roleId?: string; userId?: string }
	/** Session revoked / replaced / account suspended: re-verify immediately. */
	| { k: 'session' | 'oturum'; userId: string }
	/** New notification; if `userId` is omitted, broadcast to all connected members. */
	| { k: 'notification' | 'bildirim'; userId?: string }
	/** Team roster, settings, or kanban tasks changed; if `userId` is omitted, broadcast to all. */
	| { k: 'team_updated' | 'takim_guncellendi'; teamId?: string; userId?: string }
	/** Budget ledger or balance changed. */
	| { k: 'budget_updated' | 'butce_guncellendi'; userId?: string }
	/** Inventory item status, custody, or details changed. */
	| { k: 'inventory_updated' | 'envanter_guncellendi'; userId?: string }
	/** News / announcement created, updated, or deleted. */
	| { k: 'news_updated' | 'haber_guncellendi'; userId?: string }
	/** Event created, updated, deleted, or RSVP changed. */
	| { k: 'event_updated' | 'etkinlik_guncellendi'; userId?: string }
	/** Project created, updated, or deleted. */
	| { k: 'project_updated' | 'proje_guncellendi'; userId?: string }
	/** Decision / poll created, voted, or closed. */
	| { k: 'decision_updated' | 'karar_guncellendi'; userId?: string }
	/** Personal note created, updated, or deleted. */
	| { k: 'note_updated' | 'not_guncellendi'; userId?: string }
	/** General system/member refresh (member list, stats, settings). */
	| { k: 'refresh' | 'yenile'; userId?: string };

type Queryable = Pick<PoolClient, 'query'>;

export type EventSubscriber = {
	userId: string;
	send?: (event: AppEvent) => void;
	close?: () => void;
	ilet?: (event: AppEvent) => void;
	kapat?: () => void;
};

/** Maximum concurrent SSE tabs per user; opening a 9th tab closes the oldest. */
export const MAX_CONNECTIONS_PER_USER = 8;

type State = {
	subscribers: Map<string, Set<EventSubscriber>>;
	handlers: Map<string, (event: AppEvent) => void>;
	client: Client | null;
	connecting: Promise<void> | null;
	retryTimer: ReturnType<typeof setTimeout> | null;
	attemptCount: number;
};

const EVENT_KEY = '__orbit_event_bus_v1__';
function getState(): State {
	const g = globalThis as unknown as Record<string, State | undefined>;
	if (!g[EVENT_KEY]) {
		g[EVENT_KEY] = {
			subscribers: new Map(),
			handlers: new Map(),
			client: null,
			connecting: null,
			retryTimer: null,
			attemptCount: 0,
		};
	}
	return g[EVENT_KEY]!;
}

/**
 * Queues a `pg_notify` inside a transaction or directly on the pool.
 * Calling on a `PoolClient` inside a transaction ensures PG holds the event
 * until `COMMIT`.
 */
export async function publishEvent(db: Queryable, events: AppEvent | AppEvent[]): Promise<void> {
	const list = Array.isArray(events) ? events : [events];
	for (const event of list) {
		await db.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(event)]);
	}
}

/** Fire-and-forget wrapper for callers outside a transaction; logs and swallows errors. */
export async function publishEventQuiet(db: Queryable, events: AppEvent | AppEvent[]): Promise<void> {
	try {
		await publishEvent(db, events);
	} catch (err) {
		console.error('[events] Failed to send NOTIFY:', err instanceof Error ? err.message : err);
	}
}

/**
 * Helper for notification writers: deduplicates recipient IDs; if no recipients
 * are specified, produces a single broadcast event.
 */
export function notificationEvents(userIds?: Iterable<string | null | undefined>): AppEvent[] {
	if (!userIds) return [{ k: 'notification' }];
	const unique = Array.from(new Set(Array.from(userIds).filter((x): x is string => Boolean(x))));
	return unique.map((userId) => ({ k: 'notification', userId }));
}

function dispatch(event: AppEvent): void {
	const s = getState();
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
			else if (sub.ilet) sub.ilet(event);
		} catch (err) {
			console.error('[events] Subscriber error:', err);
		}
	};
	if (event.userId) {
		const group = s.subscribers.get(event.userId);
		if (group) for (const sub of group) deliver(sub);
	} else {
		for (const group of s.subscribers.values()) {
			for (const sub of group) deliver(sub);
		}
	}
}

function disconnectAndRetry(s: State): void {
	const old = s.client;
	s.client = null;
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

/**
 * Ensures the process-wide single `LISTEN orbit_events` connection is active.
 * Idempotent; reconnects with exponential backoff on connection drops.
 */
export function startListener(): void {
	const s = getState();
	if (s.client || s.connecting) return;
	const connectionString = (process.env.DATABASE_URL || '').trim();
	if (!connectionString) return;

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
			const wasReconnecting = s.attemptCount > 0;
			s.attemptCount = 0;
			if (wasReconnecting) dispatch({ k: 'refresh' });
		} catch (err) {
			console.error('[events] Failed to start LISTEN:', err instanceof Error ? err.message : err);
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
		}
	})();
}

/** Registers an in-process listener (e.g., `roles.ts` cache invalidation). */
export function registerEventHandler(
	nameOrHandler: string | ((event: AppEvent) => void),
	maybeHandler?: (event: AppEvent) => void
): () => void {
	const s = getState();
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
	const s = getState();
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
			else if (oldest.kapat) oldest.kapat();
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
export const aboneOl = subscribe;

/** Diagnostic helper for health checks / tests: active subscriber count & LISTEN state. */
export function eventStatus(): { subscriberCount: number; listening: boolean; aboneSayisi: number; dinliyor: boolean } {
	const s = getState();
	let subscriberCount = 0;
	for (const g of s.subscribers.values()) subscriberCount += g.size;
	const listening = s.client !== null;
	return { subscriberCount, listening, aboneSayisi: subscriberCount, dinliyor: listening };
}
