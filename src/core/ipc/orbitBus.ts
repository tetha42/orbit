'use client';

import { useEffect, useRef } from 'react';

export interface OrbitEventMap {
	'budget:record_created': { recordId: string; amount: number; type: 'gelir' | 'gider'; teamId?: string };
	'team:member_added': { teamId: string; userId: string; role: string };
	'chat:unread_count_changed': { roomId: string; unreadCount: number };
	'events:attendance_taken': { eventId: string; userId: string };
	'inventory:item_borrowed': { itemId: string; userId: string };
	[customEvent: string]: unknown;
}

export type OrbitEventName = keyof OrbitEventMap;
export type OrbitEventHandler<T = unknown> = (payload: T) => void;

class OrbitEventBus {
	private listeners = new Map<string, Set<OrbitEventHandler<unknown>>>();

	/**
	 * Subscribes to an IPC event across mini-apps.
	 * Returns an unsubscribe callback for cleanup.
	 */
	on<E extends string>(
		event: E,
		handler: OrbitEventHandler<E extends OrbitEventName ? OrbitEventMap[E] : unknown>
	): () => void {
		let handlers = this.listeners.get(event);
		if (!handlers) {
			handlers = new Set();
			this.listeners.set(event, handlers);
		}
		handlers.add(handler as OrbitEventHandler<unknown>);

		return () => {
			const current = this.listeners.get(event);
			if (current) {
				current.delete(handler as OrbitEventHandler<unknown>);
				if (current.size === 0) {
					this.listeners.delete(event);
				}
			}
		};
	}

	/**
	 * Subscribes to a single occurrence of an event.
	 */
	once<E extends string>(
		event: E,
		handler: OrbitEventHandler<E extends OrbitEventName ? OrbitEventMap[E] : unknown>
	): () => void {
		const unsub = this.on(event, (payload) => {
			unsub();
			handler(payload);
		});
		return unsub;
	}

	/**
	 * Broadcasts an IPC event to all listening mini-apps in real-time.
	 */
	emit<E extends string>(
		event: E,
		payload: E extends OrbitEventName ? OrbitEventMap[E] : unknown
	): void {
		const handlers = this.listeners.get(event);
		if (!handlers || handlers.size === 0) return;

		for (const handler of Array.from(handlers)) {
			try {
				handler(payload);
			} catch (err) {
				console.error(`[orbitBus] Error in event listener for "${event}":`, err);
			}
		}
	}
}

export const orbitBus = new OrbitEventBus();

/**
 * React hook to subscribe to Orbit IPC events with automatic cleanup on unmount.
 */
export function useOrbitEvent<E extends string>(
	event: E,
	handler: OrbitEventHandler<E extends OrbitEventName ? OrbitEventMap[E] : unknown>
): void {
	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	}, [handler]);

	useEffect(() => {
		const listener: OrbitEventHandler<unknown> = (payload) => {
			handlerRef.current(payload as E extends OrbitEventName ? OrbitEventMap[E] : unknown);
		};
		return orbitBus.on(event, listener as OrbitEventHandler<E extends OrbitEventName ? OrbitEventMap[E] : unknown>);
	}, [event]);
}
