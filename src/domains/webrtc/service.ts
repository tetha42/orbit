import crypto from 'node:crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import { publishEvent } from '@/db/events';
import { canUserAccessChatRoom, createChatMessage } from '@/db/repositories/chat.repo';
import { getSystemSetting } from '@/db/repositories/settings.repo';
import type { CallParticipant, ChatCallRecord } from './types';
import {
	CALL_ACTIVE_MAX_DURATION_MS,
	CALL_RING_TIMEOUT_MS,
	sweepStaleCallsAndSignals,
} from './reaper';

export const MAX_CALL_PARTICIPANTS = 6;
export { CALL_RING_TIMEOUT_MS };

function parseParticipants(raw: unknown): CallParticipant[] {
	if (Array.isArray(raw)) return raw as CallParticipant[];
	if (typeof raw === 'string') {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as CallParticipant[]) : [];
		} catch {
			return [];
		}
	}
	return [];
}

export function mapCallRow(row: Record<string, unknown>): ChatCallRecord {
	return {
		id: String(row.id ?? ''),
		roomId: String(row.roomId ?? row.room_id ?? ''),
		initiatorId: String(row.initiatorId ?? row.initiator_id ?? ''),
		status: (row.status as ChatCallRecord['status']) || 'ended',
		participants: parseParticipants(row.participants),
		startedAt: Number(row.startedAt ?? row.started_at ?? 0),
		answeredAt: row.answeredAt || row.answered_at ? Number(row.answeredAt ?? row.answered_at) : null,
		endedAt: row.endedAt || row.ended_at ? Number(row.endedAt ?? row.ended_at) : null,
	};
}

export async function notifyChatCallEvent(payload: Record<string, unknown>): Promise<void> {
	try {
		await getPgPool().query('SELECT pg_notify($1, $2)', [
			'club_chat_events',
			JSON.stringify(payload),
		]);
	} catch (err) {
		console.warn('[WebRTC] pg_notify failed:', err instanceof Error ? err.message : String(err));
	}
}

async function listRoomMemberIds(roomId: string): Promise<string[]> {
	const pool = getPgPool();
	const res = await pool.query<{ userId?: string; user_id?: string }>(
		'SELECT user_id AS "userId" FROM chat_members WHERE room_id = $1',
		[roomId]
	);
	return res.rows.map((r) => String(r.userId ?? r.user_id ?? '')).filter(Boolean);
}

export async function getActiveCallForRoom(roomId: string): Promise<ChatCallRecord | null> {
	await ensurePostgresInit();
	void sweepStaleCallsAndSignals().catch((err) => {
		console.warn('[WebRTC] Reaper skipped:', err instanceof Error ? err.message : String(err));
	});
	const pool = getPgPool();
	const res = await pool.query(
		`SELECT * FROM chat_calls
		 WHERE room_id = $1 AND status IN ('ringing', 'active')
		 ORDER BY started_at DESC LIMIT 1`,
		[roomId]
	);
	if (res.rows.length === 0) return null;
	const call = mapCallRow(res.rows[0] as Record<string, unknown>);
	const now = Date.now();
	if (call.status === 'ringing' && now - call.startedAt > CALL_RING_TIMEOUT_MS) {
		await pool.query(`UPDATE chat_calls SET status = 'missed', ended_at = $2 WHERE id = $1`, [call.id, now]);
		await pool.query('DELETE FROM chat_call_signals WHERE call_id = $1', [call.id]);
		await notifyChatCallEvent({ type: 'call_ended', roomId: call.roomId, callId: call.id, status: 'missed' });
		return null;
	}
	const activeSince = call.answeredAt ?? call.startedAt;
	if (call.status === 'active' && now - activeSince > CALL_ACTIVE_MAX_DURATION_MS) {
		await pool.query(
			`UPDATE chat_calls SET status = 'ended', participants = '[]'::jsonb, ended_at = $2 WHERE id = $1`,
			[call.id, now]
		);
		await pool.query('DELETE FROM chat_call_signals WHERE call_id = $1', [call.id]);
		await notifyChatCallEvent({ type: 'call_ended', roomId: call.roomId, callId: call.id, status: 'ended' });
		return null;
	}
	return call;
}

export async function startVoiceCall(params: {
	roomId: string;
	userId: string;
	userName: string;
	isAdmin: boolean;
}): Promise<{ ok: true; call: ChatCallRecord } | { ok: false; code: string; status: number }> {
	await ensurePostgresInit();
	if (!params.isAdmin) {
		const lockdown = await getSystemSetting('security_lockdown_mode');
		if (lockdown === 'true' || lockdown === '1') {
			return { ok: false, code: 'CALL_LOCKDOWN', status: 423 };
		}
	}
	const hasAccess = await canUserAccessChatRoom(params.roomId, params.userId, params.isAdmin);
	if (!hasAccess) return { ok: false, code: 'ROOM_ACCESS_DENIED', status: 403 };

	const existing = await getActiveCallForRoom(params.roomId);
	if (existing) return { ok: true, call: existing };

	const now = Date.now();
	const callId = `call_${crypto.randomUUID()}`;
	const initialParticipants: CallParticipant[] = [
		{ userId: params.userId, name: params.userName, joinedAt: now, muted: false },
	];
	const pool = getPgPool();
	const res = await pool.query(
		`INSERT INTO chat_calls (id, room_id, initiator_id, status, participants, started_at)
		 VALUES ($1, $2, $3, 'ringing', $4::jsonb, $5)
		 RETURNING *`,
		[callId, params.roomId, params.userId, JSON.stringify(initialParticipants), now]
	);
	const call = mapCallRow(res.rows[0] as Record<string, unknown>);
	const memberIds = await listRoomMemberIds(params.roomId);
	const recipients = memberIds.filter((id) => id !== params.userId);

	for (const uid of recipients) {
		void publishEvent(pool, {
			k: 'call_ring',
			roomId: params.roomId,
			callId: call.id,
			fromUserId: params.userId,
			fromName: params.userName,
			participantIds: recipients,
			userId: uid,
		});
	}
	await notifyChatCallEvent({ type: 'call_state', roomId: params.roomId, call });
	return { ok: true, call };
}

export async function updateVoiceCallState(params: {
	callId: string;
	userId: string;
	userName: string;
	isAdmin: boolean;
	action: 'accept' | 'reject' | 'hangup' | 'mute_state';
	muted?: boolean;
}): Promise<{ ok: true; call: ChatCallRecord | null } | { ok: false; code: string; status: number }> {
	await ensurePostgresInit();
	const pool = getPgPool();
	const res = await pool.query('SELECT * FROM chat_calls WHERE id = $1 LIMIT 1', [params.callId]);
	if (res.rows.length === 0) return { ok: false, code: 'CALL_NOT_FOUND', status: 404 };
	const call = mapCallRow(res.rows[0] as Record<string, unknown>);

	const hasAccess = await canUserAccessChatRoom(call.roomId, params.userId, params.isAdmin);
	if (!hasAccess) return { ok: false, code: 'ROOM_ACCESS_DENIED', status: 403 };
	if (call.status === 'ended' || call.status === 'missed') return { ok: true, call };

	const now = Date.now();
	let participants = [...call.participants];

	if (params.action === 'accept') {
		const alreadyIn = participants.some((p) => p.userId === params.userId);
		if (!alreadyIn && participants.length >= MAX_CALL_PARTICIPANTS) {
			return { ok: false, code: 'CALL_FULL', status: 409 };
		}
		if (!alreadyIn) {
			participants.push({ userId: params.userId, name: params.userName, joinedAt: now, muted: false });
		}
		const updatedRes = await pool.query(
			`UPDATE chat_calls
			 SET status = 'active', answered_at = COALESCE(answered_at, $2), participants = $3::jsonb
			 WHERE id = $1 RETURNING *`,
			[call.id, now, JSON.stringify(participants)]
		);
		const updated = mapCallRow(updatedRes.rows[0] as Record<string, unknown>);
		await notifyChatCallEvent({ type: 'call_state', roomId: call.roomId, call: updated });
		return { ok: true, call: updated };
	}

	if (params.action === 'mute_state') {
		participants = participants.map((p) =>
			p.userId === params.userId ? { ...p, muted: Boolean(params.muted) } : p
		);
		const updatedRes = await pool.query(
			'UPDATE chat_calls SET participants = $2::jsonb WHERE id = $1 RETURNING *',
			[call.id, JSON.stringify(participants)]
		);
		const updated = mapCallRow(updatedRes.rows[0] as Record<string, unknown>);
		await notifyChatCallEvent({ type: 'call_state', roomId: call.roomId, call: updated });
		return { ok: true, call: updated };
	}

	participants = participants.filter((p) => p.userId !== params.userId);
	const shouldEnd =
		participants.length === 0 ||
		(call.status === 'ringing' && params.userId === call.initiatorId) ||
		(call.status === 'ringing' && params.action === 'reject' && participants.length <= 1);

	if (shouldEnd) {
		const finalStatus = call.status === 'ringing' ? 'missed' : 'ended';
		const updatedRes = await pool.query(
			`UPDATE chat_calls SET status = $2, participants = '[]'::jsonb, ended_at = $3 WHERE id = $1 RETURNING *`,
			[call.id, finalStatus, now]
		);
		await pool.query('DELETE FROM chat_call_signals WHERE call_id = $1', [call.id]);
		const updated = mapCallRow(updatedRes.rows[0] as Record<string, unknown>);
		const durationSec = updated.answeredAt ? Math.max(1, Math.round((now - updated.answeredAt) / 1000)) : 0;
		const summaryText =
			finalStatus === 'ended'
				? `Voice call ended (${durationSec}s)`
				: `Missed voice call from ${params.userName}`;
		await createChatMessage(
			call.roomId,
			{ id: params.userId, name: params.userName, surname: '' },
			summaryText
		).catch((err) => {
			console.warn('[WebRTC] Call summary message skipped:', err instanceof Error ? err.message : String(err));
		});
		await notifyChatCallEvent({ type: 'call_ended', roomId: call.roomId, callId: call.id, status: finalStatus });
		return { ok: true, call: updated };
	}

	const updatedRes = await pool.query(
		'UPDATE chat_calls SET participants = $2::jsonb WHERE id = $1 RETURNING *',
		[call.id, JSON.stringify(participants)]
	);
	const updated = mapCallRow(updatedRes.rows[0] as Record<string, unknown>);
	await notifyChatCallEvent({ type: 'call_state', roomId: call.roomId, call: updated });
	return { ok: true, call: updated };
}
