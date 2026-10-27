import { requireApp } from '@/lib/auth/access';
import { subscribeToLiveLogs, type SystemLog } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEADERS = {
	'Content-Type': 'text/event-stream; charset=utf-8',
	'Cache-Control': 'no-store, no-transform',
	Connection: 'keep-alive',
	'X-Accel-Buffering': 'no',
};

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'kullan');
	if (!auth.authorized) {
		return auth.response;
	}

	const enc = new TextEncoder();
	let cleanup: () => void = () => {};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let isClosed = false;

			const sendChunk = (text: string) => {
				if (isClosed) return;
				try {
					controller.enqueue(enc.encode(text));
				} catch {
					cleanup();
				}
			};

			// 1. Initial Handshake
			sendChunk(`event: connected\ndata: {"status":"active","zaman":${Date.now()}}\n\n`);

			// 2. Subscribe to real-time logs
			const unsubscribe = subscribeToLiveLogs((log: SystemLog) => {
				sendChunk(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
			});

			// 3. Heartbeat keepalive every 20 seconds
			const pingTimer = setInterval(() => {
				sendChunk(`: ping ${Date.now()}\n\n`);
			}, 20_000);

			cleanup = () => {
				if (isClosed) return;
				isClosed = true;
				clearInterval(pingTimer);
				unsubscribe();
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			request.signal.addEventListener('abort', cleanup);
		},
		cancel() {
			cleanup();
		},
	});

	return new Response(stream, { headers: HEADERS });
}
