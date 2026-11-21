import crypto from 'node:crypto';
import { getPgPool, isDatabaseConfigured } from '@/db/core/pool';
import { ensurePostgresInit } from '@/db/core/init';
import { buildVapidAuthorizationHeader, encryptWebPushPayload } from './webPushCrypto';

export interface PushSubscriptionInput {
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
}

/**
 * Returns whether Web Push VAPID keys are configured for background push delivery.
 * When VAPID env vars (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`) are unset,
 * Orbit automatically falls back to live SSE (`login_approval` events) paired with
 * Service Worker notifications for active sessions.
 */
export function isVapidConfigured(): boolean {
	return Boolean(
		process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
		process.env.VAPID_PRIVATE_KEY?.trim()
	);
}

export async function saveUserPushSubscription(params: {
	userId: string;
	sessionId: string | null;
	subscription: PushSubscriptionInput;
}): Promise<{ id: string }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	let sessionId = params.sessionId;
	if (!sessionId) {
		const fallback = await pool.query<{ id: string }>(
			`SELECT id FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY last_active_at DESC LIMIT 1`,
			[params.userId]
		);
		sessionId = fallback.rows[0]?.id ?? null;
	}
	if (!sessionId) {
		throw new Error('Active device session required before saving push subscription.');
	}
	const id = `push_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
	const now = Date.now();
	await pool.query(
		`INSERT INTO push_subscriptions (id, user_id, session_id, endpoint, p256dh, auth, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (endpoint) DO UPDATE
		 SET user_id = EXCLUDED.user_id,
		     session_id = EXCLUDED.session_id,
		     p256dh = EXCLUDED.p256dh,
		     auth = EXCLUDED.auth,
		     created_at = EXCLUDED.created_at`,
		[
			id,
			params.userId,
			sessionId,
			params.subscription.endpoint,
			params.subscription.keys.p256dh,
			params.subscription.keys.auth,
			now,
		]
	);
	return { id };
}

export async function listUserPushSubscriptions(userId: string): Promise<
	Array<{
		id: string;
		endpoint: string;
		p256dh: string;
		auth: string;
	}>
> {
	if (!userId || !isDatabaseConfigured()) return [];
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, endpoint, p256dh, auth
		 FROM push_subscriptions
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		[userId]
	);
	return res.rows.map((r) => ({
		id: String(r.id ?? ''),
		endpoint: String(r.endpoint ?? ''),
		p256dh: String(r.p256dh ?? ''),
		auth: String(r.auth ?? ''),
	}));
}

export async function deleteUserPushSubscription(endpoint: string): Promise<void> {
	if (!endpoint || !isDatabaseConfigured()) return;
	await ensurePostgresInit();
	await getPgPool().query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

export interface WebPushDispatchResult {
	attempted: number;
	delivered: number;
	pruned: number;
}

export async function dispatchWebPushToUser(
	userId: string,
	payload: { title: string; body: string; data?: Record<string, unknown> },
	options?: {
		fetchImpl?: typeof fetch;
		ttlSeconds?: number;
		allowInsecureEndpointForTest?: boolean;
	}
): Promise<WebPushDispatchResult> {
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || '';
	const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || '';
	if (!publicKey || !privateKey || !userId || !isDatabaseConfigured()) {
		return { attempted: 0, delivered: 0, pruned: 0 };
	}

	const subs = await listUserPushSubscriptions(userId);
	if (subs.length === 0) return { attempted: 0, delivered: 0, pruned: 0 };

	const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:security@orbit.local';
	const fetchFn = options?.fetchImpl ?? fetch;
	const serialized = JSON.stringify(payload);
	const ttlHeader = String(options?.ttlSeconds ?? 120);

	let delivered = 0;
	let pruned = 0;
	for (const sub of subs) {
		try {
			const target = new URL(sub.endpoint);
			if (target.protocol !== 'https:' && !options?.allowInsecureEndpointForTest) {
				continue;
			}
			const ciphertext = encryptWebPushPayload(serialized, sub.p256dh, sub.auth);
			const authorization = buildVapidAuthorizationHeader(
				sub.endpoint,
				subject,
				publicKey,
				privateKey
			);
			const res = await fetchFn(sub.endpoint, {
				method: 'POST',
				headers: {
					'Content-Encoding': 'aes128gcm',
					'Content-Type': 'application/octet-stream',
					TTL: ttlHeader,
					Urgency: 'high',
					Authorization: authorization,
				},
				body: new Uint8Array(ciphertext),
				signal: AbortSignal.timeout(5000),
			});
			if (res.status === 404 || res.status === 410) {
				await deleteUserPushSubscription(sub.endpoint);
				pruned += 1;
			} else if (res.ok) {
				delivered += 1;
			}
		} catch (err) {
			console.warn('[WebPush] Delivery skipped:', err instanceof Error ? err.message : String(err));
		}
	}

	return { attempted: subs.length, delivered, pruned };
}

export async function notifyMobileApprovalPush(
	userId: string,
	params: { approvalId: string; mode: string; desktopLabel: string; challengeNumber: number }
): Promise<void> {
	if (!isVapidConfigured()) return;
	await dispatchWebPushToUser(userId, {
		title: 'Orbit Login Approval',
		body: `New desktop sign-in (${params.desktopLabel}) awaits your approval`,
		data: {
			type: 'login_approval',
			approvalId: params.approvalId,
			mode: params.mode,
			challengeNumber: params.challengeNumber,
		},
	});
}
