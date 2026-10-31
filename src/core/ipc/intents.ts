'use client';

import { useEffect, useRef } from 'react';

export interface IntentMap {
	'compose_mail': { to: string; subject?: string; body?: string };
	'open_chat': { userId?: string; roomId?: string };
	'open_profile': { userId: string };
	'view_transaction': { recordId: string };
	'open_event': { eventId: string };
	'open_task': { taskId: string; teamId?: string };
	[customAction: string]: unknown;
}

export type IntentAction = keyof IntentMap;
export type IntentHandler<T = unknown> = (payload: T) => boolean | Promise<boolean> | void;

const intentHandlers = new Map<string, Set<IntentHandler<unknown>>>();

/**
 * Registers a handler for a specific application intent (e.g. 'compose_mail', 'open_chat').
 * Returns an unsubscribe callback for cleanup.
 */
export function registerIntentHandler<A extends string>(
	action: A,
	handler: IntentHandler<A extends IntentAction ? IntentMap[A] : unknown>
): () => void {
	let handlers = intentHandlers.get(action);
	if (!handlers) {
		handlers = new Set();
		intentHandlers.set(action, handlers);
	}
	handlers.add(handler as IntentHandler<unknown>);

	return () => {
		const current = intentHandlers.get(action);
		if (current) {
			current.delete(handler as IntentHandler<unknown>);
			if (current.size === 0) {
				intentHandlers.delete(action);
			}
		}
	};
}

/**
 * Dispatches an intent request across the desktop shell to open or navigate
 * to a specific resource in another mini-app.
 */
export async function requestIntent<A extends string>(
	action: A,
	payload: A extends IntentAction ? IntentMap[A] : unknown
): Promise<boolean> {
	const handlers = intentHandlers.get(action);
	if (!handlers || handlers.size === 0) {
		console.warn(`[intents] No registered handler for action "${action}"`);
		return false;
	}

	for (const handler of Array.from(handlers)) {
		try {
			const res = await handler(payload);
			if (res !== false) {
				return true;
			}
		} catch (err) {
			console.error(`[intents] Error executing intent handler for "${action}":`, err);
		}
	}

	return false;
}

/**
 * React hook to register an intent handler with automatic cleanup on unmount.
 */
export function useIntentHandler<A extends string>(
	action: A,
	handler: IntentHandler<A extends IntentAction ? IntentMap[A] : unknown>
): void {
	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	}, [handler]);

	useEffect(() => {
		const listener: IntentHandler<unknown> = (payload) => {
			return handlerRef.current(payload as A extends IntentAction ? IntentMap[A] : unknown);
		};
		return registerIntentHandler(action, listener as IntentHandler<A extends IntentAction ? IntentMap[A] : unknown>);
	}, [action]);
}
