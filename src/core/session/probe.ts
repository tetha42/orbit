import type { SessionUser } from '@/types/session';
import { startLiveConnection } from './live';

/**
 * Asks the server who the cookie belongs to (`/api/auth/me`) — the one place
 * that request and its answers are read.
 *
 *   user   — a live session; the server's user object (role, permissions…)
 *   ended  — 401: no or expired session, or another device took it over
 *            (`conflict`); 403: account suspended, rejected or graduated
 *   none   — the server answered, but without a user
 *   failed — the request or its body did not work out (network blip, bad JSON)
 *
 * The callers decide what each answer means for them (the first check, the
 * poll, a manual refresh); this only tells them what the server said.
 */
export type SessionProbe =
	| { kind: 'user'; user: SessionUser }
	| { kind: 'ended'; conflict: boolean }
	| { kind: 'lockdown'; message: string }
	| { kind: 'none' }
	| { kind: 'failed' };

export async function probeSession(): Promise<SessionProbe> {
	try {
		const res = await fetch('/api/auth/me');
		if (res.ok) {
			const data = await res.json();
			return data?.authenticated && data.user ? { kind: 'user', user: data.user } : { kind: 'none' };
		}
		if (res.status === 401 || res.status === 403) {
			const data = await res.json().catch(() => ({}));
			return { kind: 'ended', conflict: !!data.conflict };
		}
		if (res.status === 503) {
			const data = await res.json().catch(() => ({}));
			if (data?.lockdown || data?.code === 'LOCKDOWN_ACTIVE') {
				return { kind: 'lockdown', message: data.error || 'Sistem DEFCON 1 siber kalkan kriz modundadır.' };
			}
		}
		return { kind: 'none' };
	} catch {
		return { kind: 'failed' };
	}
}

/** How often an open workspace asks the server whether the session still stands (and what the role allows) when no live stream is up. */
export const SESSION_POLL_MS = 15000;

/** The same question while the live stream is up — a safety net only, the stream delivers the news. */
export const SESSION_LIVE_POLL_MS = 60000;

/**
 * Keeps the live session current until stopped. The server pushes changes over
 * the live stream (`/api/olaylar`): each role, session or notification event
 * runs `probe` at once. The timer behind it is the safety net — every
 * `SESSION_LIVE_POLL_MS` while the stream is up, every `SESSION_POLL_MS` (the
 * old behaviour: an edited role within 15 s) when it is down or unsupported —
 * and a stream that comes back after a gap probes once, for what it missed.
 */
export function startSessionPolling(probe: () => void): () => void {
	let interval: ReturnType<typeof setInterval> | undefined;
	const every = (ms: number) => {
		clearInterval(interval);
		interval = setInterval(probe, ms);
	};
	every(SESSION_POLL_MS);
	let live = false;
	const stopLive = startLiveConnection({
		onState: (connected, again) => {
			// Only a change of state restarts the timer: a stream that keeps failing to open
			// reports "down" on every retry, which must not keep pushing the next poll away.
			if (connected !== live) {
				live = connected;
				every(connected ? SESSION_LIVE_POLL_MS : SESSION_POLL_MS);
			}
			if (connected && again) probe();
		},
		onEvent: (event) => {
			if (event !== 'bildirim') probe();
		},
	});
	return () => {
		clearInterval(interval);
		stopLive();
	};
}
