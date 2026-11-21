import { getUserBySessionToken } from '@/db';
import { subscribe, type AppEvent } from '@/db/events';
import { readSessionToken, verifyAuth } from '@/lib/auth/authGuard';
import { encodeSseComment, encodeSseEvent } from '@/lib/sse/protocol';
import { acquireStreamSlot } from '@/server/sse/streamQuota';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 25_000;
const SESSION_VERIFY_MS = 60_000;
const MAX_HIGHWATER_BYTES = 512 * 1024;

export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const userId = auth.user.id;
	const token = readSessionToken(request) ?? '';

	let closed = false;
	let unsubscribe: (() => void) | null = null;
	let releaseQuota: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let verifyTimer: ReturnType<typeof setInterval> | null = null;
	let closeController: (() => void) | null = null;

	const finish = () => {
		if (closed) return;
		closed = true;
		if (heartbeat) clearInterval(heartbeat);
		if (verifyTimer) clearInterval(verifyTimer);
		heartbeat = null;
		verifyTimer = null;
		const unsub = unsubscribe;
		unsubscribe = null;
		if (unsub) unsub();
		const rel = releaseQuota;
		releaseQuota = null;
		if (rel) rel();
		if (closeController) closeController();
	};

	const slot = acquireStreamSlot({
		channel: 'system',
		userId,
		maxPerUser: 8,
		maxGlobal: 512,
		onEvict: finish,
	});
	if (!slot.ok) {
		return NextResponse.json(
			{ error: slot.reason },
			{ status: 429, headers: { 'Retry-After': String(slot.retryAfter) } }
		);
	}
	releaseQuota = slot.release;

	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			closeController = () => {
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};
			if (request.signal.aborted) {
				finish();
				return;
			}
			const writeRaw = (bytes: Uint8Array) => {
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
					finish();
				}
			};
			const emit = (event: string, data: Record<string, unknown> = {}) => {
				writeRaw(encodeSseEvent(event, { ts: Date.now(), ...data }));
			};

			const verifySession = async () => {
				if (closed) return;
				try {
					const active = await getUserBySessionToken(token).catch(() => undefined);
					if (active === undefined) return;
					if (!active || (active.status !== 'active' && active.status !== 'alumni')) {
						emit('session-ended');
						finish();
					}
				} catch {
					/* transient DB hiccup */
				}
			};

			const send = (event: AppEvent) => {
				if (closed) return;
				if (event.k === 'session' || event.k === 'session_revoked') {
					void verifySession();
				} else if (event.k === 'login_approval') {
					emit('login_approval', {
						approvalId: event.approvalId,
						status: event.status,
					});
				} else if (event.k === 'drive_updated') {
					emit('drive_updated', { itemId: event.itemId });
				} else if (event.k === 'call_ring' || event.k === 'call_signal') {
					emit(event.k, { ...event });
				} else if (event.k === 'permission') {
					emit('permission-changed');
				} else if (event.k === 'notification') {
					emit('notification');
				} else if (event.k === 'team_updated') {
					emit('team_updated');
				} else if (event.k === 'budget_updated') {
					emit('budget_updated');
				} else if (event.k === 'inventory_updated') {
					emit('inventory_updated');
				} else if (event.k === 'news_updated') {
					emit('news_updated');
				} else if (event.k === 'event_updated') {
					emit('event_updated');
				} else if (event.k === 'project_updated') {
					emit('project_updated');
				} else if (event.k === 'decision_updated') {
					emit('decision_updated');
				} else if (event.k === 'note_updated') {
					emit('note_updated');
				} else if (event.k === 'soc_updated') {
					emit('soc_updated');
				} else if (event.k === 'refresh') {
					for (const ev of [
						'permission-changed',
						'notification',
						'team_updated',
						'budget_updated',
						'inventory_updated',
						'news_updated',
						'event_updated',
						'project_updated',
						'decision_updated',
						'note_updated',
						'soc_updated',
					]) {
						emit(ev);
					}
				}
			};

			writeRaw(encoder.encode('retry: 3000\n:connected\n: ready\n\n'));
			unsubscribe = subscribe({ userId, send, close: finish });
			heartbeat = setInterval(() => writeRaw(encodeSseComment('keepalive')), HEARTBEAT_MS);
			const jitterMs = Math.floor(Math.random() * 10_000) - 5_000;
			verifyTimer = setInterval(() => void verifySession(), SESSION_VERIFY_MS + jitterMs);
			if (typeof heartbeat === 'object' && 'unref' in heartbeat) heartbeat.unref();
			if (typeof verifyTimer === 'object' && 'unref' in verifyTimer) verifyTimer.unref();

			request.signal.addEventListener('abort', finish, { once: true });
		},
		cancel() {
			finish();
		},
	});

	return new Response(stream, {
		status: 200,
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-store, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	});
}
