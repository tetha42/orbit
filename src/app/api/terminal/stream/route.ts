import { NextResponse } from 'next/server';
import { getTerminalSession, getRecentlyClosedSession } from '@/server/terminalManager';
import { authorizeTerminal } from '@/server/terminalAccess';
import { acquireStreamSlot } from '@/server/sse/streamQuota';

export const dynamic = 'force-dynamic';

const MAX_HIGHWATER_BYTES = 512 * 1024;

export async function GET(request: Request) {
	// EventSource sends the session cookie on same-origin requests, so no token
	// ever has to travel in the URL (where it would end up in access logs).
	const auth = await authorizeTerminal(request);
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const sessionId = searchParams.get('sessionId');
	if (!sessionId) {
		return new Response('Session ID required', { status: 400 });
	}

	const session = getTerminalSession(sessionId);
	if (!session || session.userId !== auth.user.id) {
		const recentlyClosed = getRecentlyClosedSession(sessionId);
		if (recentlyClosed && recentlyClosed.userId === auth.user.id) {
			return new Response(`event: exit\ndata: ${JSON.stringify({ code: recentlyClosed.exitCode ?? 0 })}\n\n`, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache, no-transform, no-store',
					Connection: 'close',
				},
			});
		}
		return new Response('Session not found', { status: 404 });
	}

	if (session.isClosed) {
		return new Response(`event: exit\ndata: ${JSON.stringify({ code: 0 })}\n\n`, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform, no-store',
				Connection: 'close',
			},
		});
	}

	const encoder = new TextEncoder();
	let closed = false;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let releaseQuota: (() => void) | null = null;
	let listenerRef: ((data: string) => void) | null = null;
	let closeListenerRef: ((code: number | null) => void) | null = null;
	let closeController: (() => void) | null = null;

	const cleanup = () => {
		if (closed) return;
		closed = true;
		if (heartbeat) clearInterval(heartbeat);
		heartbeat = null;
		if (listenerRef) session.listeners.delete(listenerRef);
		if (closeListenerRef) session.closeListeners.delete(closeListenerRef);
		listenerRef = null;
		closeListenerRef = null;
		const rel = releaseQuota;
		releaseQuota = null;
		if (rel) rel();
		if (closeController) closeController();
	};

	const slot = acquireStreamSlot({
		channel: 'terminal',
		userId: auth.user.id,
		maxPerUser: 6,
		maxGlobal: 64,
		onEvict: cleanup,
	});
	if (!slot.ok) {
		return NextResponse.json(
			{ error: slot.reason },
			{ status: 429, headers: { 'Retry-After': String(slot.retryAfter) } }
		);
	}
	releaseQuota = slot.release;

	const stream = new ReadableStream({
		start(controller) {
			closeController = () => {
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};
			if (request.signal.aborted) {
				cleanup();
				return;
			}

			const enqueueSafe = (bytes: Uint8Array) => {
				if (closed) return;
				if (
					controller.desiredSize !== null &&
					controller.desiredSize < -MAX_HIGHWATER_BYTES
				) {
					return;
				}
				try {
					controller.enqueue(bytes);
				} catch {
					cleanup();
				}
			};

			// Send buffered output
			for (const chunk of session.outputBuffer) {
				enqueueSafe(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
			}

			listenerRef = (data: string) => {
				enqueueSafe(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			};

			closeListenerRef = (code: number | null) => {
				if (closed) return;
				enqueueSafe(encoder.encode(`event: exit\ndata: ${JSON.stringify({ code })}\n\n`));
				cleanup();
			};

			session.listeners.add(listenerRef);
			session.closeListeners.add(closeListenerRef);

			// Keepalive heartbeat every 15s to prevent proxy/browser timeout
			heartbeat = setInterval(() => {
				enqueueSafe(encoder.encode(`: ping\n\n`));
			}, 15_000);
			heartbeat.unref?.();

			request.signal.addEventListener('abort', cleanup, { once: true });
		},
		cancel() {
			cleanup();
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
		},
	});
}
