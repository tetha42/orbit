import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { subscribeToLiveLogs, type SystemLog } from '@/db/repositories/logs.repo';
import { encodeSseComment, encodeSseEvent } from '@/lib/sse/protocol';
import { acquireStreamSlot } from '@/server/sse/streamQuota';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEADERS = {
	'Content-Type': 'text/event-stream; charset=utf-8',
	'Cache-Control': 'no-store, no-transform',
	Connection: 'keep-alive',
	'X-Accel-Buffering': 'no',
};

const MAX_HIGHWATER_BYTES = 512 * 1024;

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'use');
	if (!auth.authorized) {
		return auth.response;
	}

	let isClosed = false;
	let pingTimer: ReturnType<typeof setInterval> | null = null;
	let unsubscribe: (() => void) | null = null;
	let releaseQuota: (() => void) | null = null;
	let closeController: (() => void) | null = null;

	const cleanup = () => {
		if (isClosed) return;
		isClosed = true;
		if (pingTimer) clearInterval(pingTimer);
		pingTimer = null;
		const unsub = unsubscribe;
		unsubscribe = null;
		if (unsub) unsub();
		const rel = releaseQuota;
		releaseQuota = null;
		if (rel) rel();
		if (closeController) closeController();
	};

	const slot = acquireStreamSlot({
		channel: 'soc',
		userId: auth.user.id,
		maxPerUser: 4,
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

			const sendChunk = (bytes: Uint8Array) => {
				if (isClosed) return;
				if (controller.desiredSize !== null && controller.desiredSize < -MAX_HIGHWATER_BYTES) {
					return;
				}
				try {
					controller.enqueue(bytes);
				} catch {
					cleanup();
				}
			};

			sendChunk(encodeSseEvent('connected', { status: 'active', timestamp: Date.now() }));

			unsubscribe = subscribeToLiveLogs((log: SystemLog) => {
				sendChunk(encodeSseEvent('log', log));
			});

			pingTimer = setInterval(() => {
				sendChunk(encodeSseComment(`ping ${Date.now()}`));
			}, 20_000);
			if (typeof pingTimer === 'object' && 'unref' in pingTimer) pingTimer.unref();

			request.signal.addEventListener('abort', cleanup, { once: true });
		},
		cancel() {
			cleanup();
		},
	});

	return new Response(stream, { headers: HEADERS });
}
