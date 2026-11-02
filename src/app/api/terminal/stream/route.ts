import { getTerminalSession, getRecentlyClosedSession } from '@/server/terminalManager';
import { authorizeTerminal } from '@/server/terminalAccess';

export const dynamic = 'force-dynamic';

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

	const stream = new ReadableStream({
		start(controller) {
			// Send buffered output
			for (const chunk of session.outputBuffer) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
			}

			const listener = (data: string) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
				} catch {
					// Controller might be closed
				}
			};

			const closeListener = (code: number | null) => {
				clearInterval(heartbeat);
				try {
					controller.enqueue(encoder.encode(`event: exit\ndata: ${JSON.stringify({ code })}\n\n`));
					controller.close();
				} catch {}
			};

			session.listeners.add(listener);
			session.closeListeners.add(closeListener);

			// Keepalive heartbeat every 15s to prevent proxy/browser timeout
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: ping\n\n`));
				} catch {
					clearInterval(heartbeat);
				}
			}, 15000);

			request.signal.addEventListener('abort', () => {
				clearInterval(heartbeat);
				session.listeners.delete(listener);
				session.closeListeners.delete(closeListener);
				try {
					controller.close();
				} catch {}
			});
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
