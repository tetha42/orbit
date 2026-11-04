import { getUserBySessionToken } from '@/db';
import { subscribe, type AppEvent } from '@/db/events';
import { readSessionToken, verifyAuth } from '@/lib/auth/authGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Interval between SSE `:keepalive` comments so reverse proxies (nginx, Cloudflare, etc.)
 * do not drop an idle connection.
 */
const HEARTBEAT_MS = 25_000;

/**
 * Periodic session token re-verification interval while the stream is open.
 * Even if a `session` NOTIFY were missed, a revoked token is detected within
 * at most this window.
 */
const SESSION_VERIFY_MS = 60_000;

/**
 * GET /api/stream — per-member Server-Sent Events (SSE) stream.
 *
 * Emitted events:
 *   permission-changed  — the member's role, or a role's permissions, changed
 *   session-ended       — the session is over (signed in elsewhere, signed out, account suspended); the stream closes
 *   notification        — a new notification was recorded for this member
 *   team_updated        — team roster, settings, or kanban tasks changed
 *   budget_updated      — budget ledger or balance changed
 *   inventory_updated   — inventory item status, custody, or details changed
 */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const userId = auth.user.id;
	const token = readSessionToken(request) ?? '';
	const encoder = new TextEncoder();

	let unsubscribe: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let verifyTimer: ReturnType<typeof setInterval> | null = null;
	let closed = false;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const write = (line: string) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(line));
				} catch {
					finish();
				}
			};
			const emit = (event: string, data = '{}') => {
				write(`event: ${event}\ndata: ${data}\n\n`);
			};
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
				try {
					controller.close();
				} catch {
					/* already closed */
				}
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
					/* transient DB hiccup: do not drop the session, retry on next tick */
				}
			};

			const send = (event: AppEvent) => {
				if (closed) return;
				if (event.k === 'session') {
					void verifySession();
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
				} else if (event.k === 'refresh') {
					emit('permission-changed');
					emit('notification');
					emit('team_updated');
					emit('budget_updated');
					emit('inventory_updated');
					emit('news_updated');
					emit('event_updated');
					emit('project_updated');
					emit('decision_updated');
					emit('note_updated');
				}
			};

			// Send an initial frame immediately so EventSource fires `open`.
			write('retry: 3000\n:connected\n: baglandi\n\n');

			unsubscribe = subscribe({ userId, send, close: finish });
			heartbeat = setInterval(() => write(':keepalive\n\n'), HEARTBEAT_MS);
			const jitterMs = Math.floor(Math.random() * 10_000) - 5_000;
			verifyTimer = setInterval(() => void verifySession(), SESSION_VERIFY_MS + jitterMs);
			if (typeof heartbeat === 'object' && 'unref' in heartbeat) heartbeat.unref();
			if (typeof verifyTimer === 'object' && 'unref' in verifyTimer) verifyTimer.unref();

			request.signal.addEventListener('abort', finish, { once: true });
		},
		cancel() {
			if (closed) return;
			closed = true;
			if (heartbeat) clearInterval(heartbeat);
			if (verifyTimer) clearInterval(verifyTimer);
			if (unsubscribe) unsubscribe();
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
