import { EventEmitter } from 'events';
import { Client } from 'pg';
import { requireApp } from '@/lib/auth/access';
import { audienceIncludes, getChatAudience, peekChatAudience } from '@/server/chat/chatAudience';

export const dynamic = 'force-dynamic';

class ChatEventBus extends EventEmitter {}

interface ChatBusEvent {
	odaId: string;
	/** Pre-encoded `event: chat` frame, reused by all recipients. */
	bytes: Uint8Array;
}

const globalStore = globalThis as typeof globalThis & {
	__chatBus?: ChatEventBus;
	__chatPgListening?: boolean;
	__chatPgClient?: Client;
};

if (!globalStore.__chatBus) {
	globalStore.__chatBus = new ChatEventBus();
	// One listener per open chat stream. 150 members with a couple of tabs each
	// must not trip EventEmitter's default warning.
	globalStore.__chatBus.setMaxListeners(1000);
}

const chatBus = globalStore.__chatBus;
const encoder = new TextEncoder();

/**
 * One dedicated LISTEN connection for the whole process.
 *
 * This deliberately does not borrow a client from the query pool: the listener
 * lives for the process lifetime, and taking one of the pool's slots away from
 * request traffic was unnecessary. `db/olaylar.ts` uses the same pattern.
 */
async function ensurePgListener() {
	if (globalStore.__chatPgListening) return;
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) return;
	globalStore.__chatPgListening = true;

	const client = new Client({ connectionString });
	globalStore.__chatPgClient = client;
	let retryScheduled = false;

	const scheduleRetry = (delayMs: number) => {
		if (retryScheduled) return;
		retryScheduled = true;
		globalStore.__chatPgListening = false;
		if (globalStore.__chatPgClient === client) globalStore.__chatPgClient = undefined;
		client.removeAllListeners();
		client.on('error', () => {});
		client.end().catch(() => {});
		const timer = setTimeout(() => {
			void ensurePgListener();
		}, delayMs);
		timer.unref?.();
	};

	client.on('notification', (msg) => {
		if (msg.channel !== 'club_chat_events' || !msg.payload) return;
		try {
			const data = JSON.parse(msg.payload);
			const payload = (data && typeof data === 'object' ? data : null) as { odaId?: unknown } | null;
			const odaId = typeof payload?.odaId === 'string' ? payload.odaId : '';
			const event: ChatBusEvent = {
				odaId,
				bytes: encoder.encode(`event: chat\ndata: ${JSON.stringify(data)}\n\n`),
			};
			chatBus.emit('event', event);
		} catch {
			// A malformed notification is dropped; it must not kill the listener.
		}
	});
	client.on('error', () => scheduleRetry(3000));
	client.on('end', () => scheduleRetry(3000));

	try {
		await client.connect();
		await client.query('LISTEN club_chat_events');
	} catch {
		scheduleRetry(5000);
	}
}

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	const userId = auth.user.id;
	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');

	void ensurePgListener();

	let onEvent: ((event: ChatBusEvent) => void) | null = null;
	let heartbeatInterval: NodeJS.Timeout | null = null;
	// Per-stream delivery chain: the audience lookup is async on a cache miss,
	// and chat messages must reach the client in the order they were written.
	let deliveryChain: Promise<void> = Promise.resolve();

	const stream = new ReadableStream({
		start(controller) {
			// Initial connected event
			controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`));

			onEvent = (event: ChatBusEvent) => {
				deliveryChain = deliveryChain
					.then(async () => {
						if (event.odaId) {
							const audience = peekChatAudience(event.odaId) ?? (await getChatAudience(event.odaId));
							if (!audience || !audienceIncludes(audience, userId, isAdmin)) return;
						}
						controller.enqueue(event.bytes);
					})
					.catch(() => {
						// Controller closed or the audience lookup failed: drop this frame.
					});
			};

			chatBus.on('event', onEvent);

			// Heartbeat every 25 seconds to keep HTTP/SSE connection alive behind Caddy/Cloudflare
			heartbeatInterval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: ping\n\n`));
				} catch {
					if (heartbeatInterval) clearInterval(heartbeatInterval);
				}
			}, 25000);
		},
		cancel() {
			if (onEvent) chatBus.off('event', onEvent);
			if (heartbeatInterval) clearInterval(heartbeatInterval);
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	});
}
