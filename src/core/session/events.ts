import { useEffect, useRef } from 'react';

/**
 * What the rest of the desktop has to do when the session changes hands: the
 * screen lock must hide anything readable, signing out must wipe what the
 * workspace saved for the previous identity. The session does not know those
 * parts; they listen.
 *
 *   lock    — the screen was locked (the session goes on)
 *   unlock  — the screen was unlocked
 *   logout  — the member signed out
 */
export type SessionEvent = 'lock' | 'logout' | 'unlock';

const listeners = new Set<(event: SessionEvent) => void>();

export function emitSessionEvent(event: SessionEvent): void {
	for (const listener of listeners) listener(event);
}

export function useSessionEvent(handler: (event: SessionEvent) => void): void {
	const ref = useRef(handler);
	useEffect(() => {
		ref.current = handler;
	});
	useEffect(() => {
		const listener = (event: SessionEvent) => ref.current(event);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);
}
