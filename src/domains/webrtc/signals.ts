import crypto from 'node:crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import { publishEvent } from '@/db/events';
import { canUserAccessChatRoom } from '@/db/repositories/chat.repo';
import { mapCallRow, notifyChatCallEvent } from './service';
import type { CallSignalKind, CallSignalRecord } from './types';

export async function enqueueCallSignal(params: {
	callId: string;
	fromUserId: string;
	toUserId: string;
	kind: CallSignalKind;
	payload: unknown;
	isAdmin: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; code: string; status: number }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const callRes = await pool.query('SELECT * FROM chat_calls WHERE id = $1 LIMIT 1', [params.callId]);
	if (callRes.rows.length === 0) return { ok: false, code: 'CALL_NOT_FOUND', status: 404 };
	const call = mapCallRow(callRes.rows[0] as Record<string, unknown>);
	if (call.status !== 'ringing' && call.status !== 'active') {
		return { ok: false, code: 'CALL_ENDED', status: 410 };
	}
	const hasAccess = await canUserAccessChatRoom(call.roomId, params.fromUserId, params.isAdmin);
	if (!hasAccess) return { ok: false, code: 'ROOM_ACCESS_DENIED', status: 403 };

	const id = `sig_${crypto.randomUUID()}`;
	const now = Date.now();
	await pool.query(
		`INSERT INTO chat_call_signals (id, call_id, from_user_id, to_user_id, kind, payload, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
		[id, call.id, params.fromUserId, params.toUserId, params.kind, JSON.stringify(params.payload ?? {}), now]
	);

	void publishEvent(pool, {
		k: 'call_signal',
		roomId: call.roomId,
		callId: call.id,
		fromUserId: params.fromUserId,
		targetUserId: params.toUserId,
		kind: params.kind,
		userId: params.toUserId,
	});
	await notifyChatCallEvent({
		type: 'call_signal',
		roomId: call.roomId,
		callId: call.id,
		signalId: id,
		fromUserId: params.fromUserId,
		targetUserId: params.toUserId,
		kind: params.kind,
	});
	return { ok: true, id };
}

export async function pollCallSignals(params: {
	callId: string;
	toUserId: string;
	since: number;
}): Promise<CallSignalRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT id, call_id AS "callId", from_user_id AS "fromUserId",
		        to_user_id AS "toUserId", kind, payload, created_at AS "createdAt"
		 FROM chat_call_signals
		 WHERE call_id = $1 AND to_user_id = $2 AND created_at > $3
		 ORDER BY created_at ASC LIMIT 100`,
		[params.callId, params.toUserId, params.since]
	);
	return res.rows.map((r) => {
		const row = r as Record<string, unknown>;
		return {
			id: String(row.id ?? ''),
			callId: String(row.callId ?? params.callId),
			fromUserId: String(row.fromUserId ?? ''),
			toUserId: String(row.toUserId ?? params.toUserId),
			kind: (row.kind as CallSignalKind) || 'ice',
			payload: row.payload,
			createdAt: Number(row.createdAt ?? 0),
		};
	});
}
