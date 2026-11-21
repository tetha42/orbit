import { getPgPool } from '@/db/core/pool';
import { ensurePostgresInit } from '@/db/core/init';

export const CALL_RING_TIMEOUT_MS = 45_000;
export const CALL_ACTIVE_MAX_DURATION_MS = 2 * 60 * 60_000;
export const CALL_SIGNAL_TTL_MS = 5 * 60_000;
export const CALL_REAPER_THROTTLE_MS = 60_000;

let lastReapAt = 0;

async function notifyEndedCalls(
	rows: Array<{ id?: unknown; roomId?: unknown }>,
	status: 'missed' | 'ended'
): Promise<void> {
	if (rows.length === 0) return;
	const pool = getPgPool();
	for (const row of rows) {
		const callId = String(row.id ?? '');
		const roomId = String(row.roomId ?? '');
		if (!callId || !roomId) continue;
		try {
			await pool.query('SELECT pg_notify($1, $2)', [
				'club_chat_events',
				JSON.stringify({ type: 'call_ended', roomId, callId, status }),
			]);
		} catch (err) {
			console.warn('[WebRTC] Reaper notify skipped:', err instanceof Error ? err.message : String(err));
		}
	}
}

/**
 * Expires stale ringing/active WebRTC calls and removes obsolete signaling rows.
 */
export async function sweepStaleCallsAndSignals(options?: {
	force?: boolean;
	now?: number;
	ringTimeoutMs?: number;
	activeMaxMs?: number;
	signalTtlMs?: number;
}): Promise<{ expiredRinging: number; expiredActive: number; purgedSignals: number }> {
	const now = options?.now ?? Date.now();
	if (!options?.force && now - lastReapAt < CALL_REAPER_THROTTLE_MS) {
		return { expiredRinging: 0, expiredActive: 0, purgedSignals: 0 };
	}
	lastReapAt = now;

	await ensurePostgresInit();
	const pool = getPgPool();
	const ringCutoff = now - (options?.ringTimeoutMs ?? CALL_RING_TIMEOUT_MS);
	const activeCutoff = now - (options?.activeMaxMs ?? CALL_ACTIVE_MAX_DURATION_MS);
	const signalCutoff = now - (options?.signalTtlMs ?? CALL_SIGNAL_TTL_MS);

	const ringingRes = await pool.query<{ id: string; roomId: string }>(
		`UPDATE chat_calls
		 SET status = 'missed', participants = '[]'::jsonb, ended_at = $1
		 WHERE status = 'ringing' AND started_at < $2
		 RETURNING id, room_id AS "roomId"`,
		[now, ringCutoff]
	);

	const activeRes = await pool.query<{ id: string; roomId: string }>(
		`UPDATE chat_calls
		 SET status = 'ended', participants = '[]'::jsonb, ended_at = $1
		 WHERE status = 'active' AND COALESCE(answered_at, started_at) < $2
		 RETURNING id, room_id AS "roomId"`,
		[now, activeCutoff]
	);

	const sigRes = await pool.query(
		`DELETE FROM chat_call_signals
		 WHERE created_at < $1
		    OR call_id IN (SELECT id FROM chat_calls WHERE status IN ('ended', 'missed'))`,
		[signalCutoff]
	);

	await notifyEndedCalls(ringingRes.rows, 'missed');
	await notifyEndedCalls(activeRes.rows, 'ended');

	return {
		expiredRinging: ringingRes.rowCount ?? ringingRes.rows.length,
		expiredActive: activeRes.rowCount ?? activeRes.rows.length,
		purgedSignals: sigRes.rowCount ?? 0,
	};
}
