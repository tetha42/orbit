import type { MutableRefObject } from 'react';
import type { Terminal as XTerm } from '@xterm/xterm';

interface ConnectStreamOptions {
	sessionId: string;
	currentInit: number;
	initCounterRef: MutableRefObject<number>;
	eventSourceRef: MutableRefObject<EventSource | null>;
	sessionIdRef: MutableRefObject<string | null>;
	hasConnectedRef: MutableRefObject<boolean>;
	term: XTerm;
	onConnected: () => void;
	onDisconnected: () => void;
	onCloseWindow: () => void;
	onActivity: () => void;
}

export function connectTerminalStream({
	sessionId,
	currentInit,
	initCounterRef,
	eventSourceRef,
	sessionIdRef,
	hasConnectedRef,
	term,
	onConnected,
	onDisconnected,
	onCloseWindow,
	onActivity,
}: ConnectStreamOptions): (data: string) => void {
	const es = new EventSource(`/api/terminal/stream?sessionId=${sessionId}`);
	eventSourceRef.current = es;

	es.onopen = () => {
		if (currentInit !== initCounterRef.current) {
			try {
				es.close();
			} catch {
				// Ignore close errors on superseded EventSource.
			}
			return;
		}
		hasConnectedRef.current = true;
		onConnected();
	};

	es.onmessage = (event) => {
		if (currentInit !== initCounterRef.current) return;
		try {
			const chunk = JSON.parse(event.data);
			term.write(chunk);
		} catch {
			term.write(event.data);
		}
	};

	es.addEventListener('exit', () => {
		try {
			es.close();
		} catch {
			// EventSource may already be closed when the exit event fires.
		}
		if (eventSourceRef.current === es) eventSourceRef.current = null;
		onCloseWindow();
	});

	es.onerror = () => {
		try {
			es.close();
		} catch {
			// EventSource may already be closed when stream errors occur.
		}
		if (eventSourceRef.current === es) eventSourceRef.current = null;
		if (hasConnectedRef.current) {
			onCloseWindow();
		} else {
			onDisconnected();
		}
	};

	const inputQueue: string[] = [];
	let isFlushing = false;

	const flushQueue = async () => {
		if (isFlushing || inputQueue.length === 0 || !sessionIdRef.current) return;
		isFlushing = true;
		const currentSid = sessionIdRef.current;
		const data = inputQueue.join('');
		inputQueue.length = 0;

		try {
			const res = await fetch('/api/terminal/input', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: currentSid, data }),
			});
			if (res.status === 404) {
				onCloseWindow();
				return;
			}
		} catch (err) {
			console.error('Failed to send keystroke to terminal:', err);
		} finally {
			isFlushing = false;
			if (inputQueue.length > 0 && sessionIdRef.current) {
				void flushQueue();
			}
		}
	};

	return (data: string) => {
		if (!sessionIdRef.current) return;
		onActivity();
		inputQueue.push(data);
		void flushQueue();
	};
}
