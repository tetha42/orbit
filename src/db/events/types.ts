import { Client, type PoolClient } from 'pg';

export const CHANNEL = 'orbit_events';

export type AppEvent =
	| { k: 'permission'; roleId?: string; userId?: string }
	| { k: 'session'; userId: string }
	| { k: 'notification'; userId?: string }
	| { k: 'team_updated'; teamId?: string; userId?: string }
	| { k: 'budget_updated'; userId?: string }
	| { k: 'inventory_updated'; userId?: string }
	| { k: 'news_updated'; userId?: string }
	| { k: 'event_updated'; userId?: string }
	| { k: 'project_updated'; userId?: string }
	| { k: 'decision_updated'; userId?: string }
	| { k: 'note_updated'; userId?: string }
	| { k: 'soc_updated'; userId?: string }
	| { k: 'settings_updated'; key?: string; userId?: string }
	| { k: 'refresh'; userId?: string }
	| { k: 'session_revoked'; userId: string; sessionIds: string[]; reason: string }
	| { k: 'login_approval'; userId: string; approvalId: string; status?: string }
	| {
			k: 'call_ring';
			roomId: string;
			callId: string;
			fromUserId: string;
			fromName: string;
			participantIds: string[];
			userId?: string;
	  }
	| {
			k: 'call_signal';
			roomId: string;
			callId: string;
			fromUserId: string;
			targetUserId: string;
			kind: 'offer' | 'answer' | 'ice' | 'mute_state' | 'hangup';
			payload?: unknown;
			userId?: string;
	  }
	| { k: 'drive_updated'; ownerId: string; itemId?: string; userId?: string };

type Queryable = Pick<PoolClient, 'query'>;

export type EventSubscriber = {
	userId: string;
	send?: (event: AppEvent) => void;
	close?: () => void;
};

/** Maximum concurrent SSE tabs per user; opening a 9th tab closes the oldest. */
export const MAX_CONNECTIONS_PER_USER = 8;

export type BusState = {
	subscribers: Map<string, Set<EventSubscriber>>;
	handlers: Map<string, (event: AppEvent) => void>;
	client: Client | null;
	activeUrl: string | null;
	connecting: Promise<void> | null;
	connectingUrl: string | null;
	retryTimer: ReturnType<typeof setTimeout> | null;
	attemptCount: number;
};

const EVENT_KEY = '__orbit_event_bus_v1__';
export function getBusState(): BusState {
	const g = globalThis as unknown as Record<string, BusState | undefined>;
	if (!g[EVENT_KEY]) {
		g[EVENT_KEY] = {
			subscribers: new Map(),
			handlers: new Map(),
			client: null,
			activeUrl: null,
			connecting: null,
			connectingUrl: null,
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
