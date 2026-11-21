import { EventEmitter } from 'events';
import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { requireApp } from '@/lib/auth/access';
import { encodeSseComment, encodeSseEvent } from '@/lib/sse/protocol';
import { audienceIncludes, getChatAudience, peekChatAudience } from '@/server/chat/chatAudience';
import { acquireStreamSlot } from '@/server/sse/streamQuota';

export const dynamic = 'force-dynamic';

class ChatEventBus extends EventEmitter {}

interface ChatBusEvent {
	roomId: string;
	targetUserId?: string;
	bytes: Uint8Array;
}

const MAX_PENDING_FRAMES = 64;
const MAX_HIGHWATER_BYTES = 512 * 1024;

const globalStore = globalThis as typeof globalThis & {
	__chatBus?: ChatEventBus;
	__chatPgListening?: boolean;
	__chatPgClient?: Client;
};

if (!globalStore.__chatBus) {
	globalStore.__chatBus = new ChatEventBus();
	globalStore.__chatBus.setMaxListeners(1000);
}

const chatBus = globalStore.__chatBus;

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
			const payload = (data && typeof data === 'object' ? data : null) as {
				roomId?: unknown;
				targetUserId?: unknown;
			} | null;
			const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
			const targetUserId = typeof payload?.targetUserId === 'string' ? payload.targetUserId : undefined;
			const event: ChatBusEvent = {
				roomId,
				targetUserId,
				bytes: encodeSseEvent('chat', data),
			};
			chatBus.emit('event', event);
		} catch {
			// Drop malformed notification
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
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const userId = auth.user.id;
	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
	void ensurePgListener();

	let closed = false;
	let pendingFrames = 0;
	let onEvent: ((event: ChatBusEvent) => void) | null = null;
	let heartbeatInterval: NodeJS.Timeout | null = null;
	let releaseQuota: (() => void) | null = null;
	let closeController: (() => void) | null = null;

	const cleanup = () => {
		if (closed) return;
		closed = true;
		if (onEvent) chatBus.off('event', onEvent);
		onEvent = null;
		if (heartbeatInterval) clearInterval(heartbeatInterval);
		heartbeatInterval = null;
		const rel = releaseQuota;
		releaseQuota = null;
		if (rel) rel();
		if (closeController) closeController();
	};

	const slot = acquireStreamSlot({
		channel: 'chat',
		userId,
		maxPerUser: 6,
		maxGlobal: 512,
		onEvict: cleanup,
	});
	if (!slot.ok) {
		return NextResponse.json(
			{ error: slot.reason },
			{ status: 429, headers: { 'Retry-After': String(slot.retryAfter) } }
		);
	}
	releaseQuota = slot.release;

	let deliveryChain: Promise<void> = Promise.resolve();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			closeController = () => {
				try {
					controller.close();
				} catch {
					// already closed
				}
			};
			if (request.signal.aborted) {
				cleanup();
				return;
			}
			controller.enqueue(encodeSseEvent('connected', { ok: true }));

			onEvent = (event: ChatBusEvent) => {
				if (closed || pendingFrames >= MAX_PENDING_FRAMES) return;
				pendingFrames++;
				deliveryChain = deliveryChain
					.then(async () => {
						if (closed) return;
						if (
							controller.desiredSize !== null &&
							controller.desiredSize < -MAX_HIGHWATER_BYTES
						) {
							return;
						}
						if (event.targetUserId && event.targetUserId !== userId) {
							return;
						}
						if (event.roomId) {
							const audience = peekChatAudience(event.roomId) ?? (await getChatAudience(event.roomId));
							if (!audience || !audienceIncludes(audience, userId, isAdmin)) return;
						}
						controller.enqueue(event.bytes);
					})
					.catch(() => {
						cleanup();
					})
					.finally(() => {
						pendingFrames = Math.max(0, pendingFrames - 1);
					});
			};

			chatBus.on('event', onEvent);

			heartbeatInterval = setInterval(() => {
				if (closed) return;
				if (
					controller.desiredSize !== null &&
					controller.desiredSize < -MAX_HIGHWATER_BYTES
				) {
					return;
				}
				try {
					controller.enqueue(encodeSseComment('ping'));
				} catch {
					cleanup();
				}
			}, 25_000);
			heartbeatInterval.unref?.();

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
			'X-Accel-Buffering': 'no',
		},
	});
}
