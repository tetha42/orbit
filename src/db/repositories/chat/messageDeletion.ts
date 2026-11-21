import { getPgPool, ensurePostgresInit } from '@/db';

export async function softDeleteChatMessage(
	messageId: string,
	userId: string,
	isAdmin = false
): Promise<{ ok: boolean; roomId?: string; messageId?: string; deletionDate?: number }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const checkRes = await p.query(
		`SELECT id, room_id AS "roomId", sender_id AS "senderId" FROM chat_messages WHERE id = $1 LIMIT 1`,
		[messageId]
	);
	const msg = checkRes.rows[0];
	if (!msg) return { ok: false };

	if (!isAdmin && msg.senderId !== userId) {
		return { ok: false };
	}

	const now = Date.now();
	await p.query(
		`UPDATE chat_messages SET deleted_at = $1 WHERE id = $2`,
		[now, messageId]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'message_deleted',
					roomId: msg.roomId,
					messageId,
					deletionDate: now,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify delete error]:', e);
	}

	return { ok: true, roomId: msg.roomId, messageId, deletionDate: now };
}

export async function softDeleteChatMessagesBatch(
	roomId: string,
	count = 50,
	isAdmin = false
): Promise<{ ok: boolean; count: number; deletedIds: string[]; deletionDate: number }> {
	await ensurePostgresInit();
	const p = getPgPool();

	if (!isAdmin) {
		return { ok: false, count: 0, deletedIds: [], deletionDate: 0 };
	}

	const limit = Math.max(1, Math.min(count, 200));
	const now = Date.now();

	const selectRes = await p.query(
		`SELECT id FROM chat_messages
		 WHERE room_id = $1 AND deleted_at IS NULL
		 ORDER BY date DESC
		 LIMIT $2`,
		[roomId, limit]
	);

	const deletedIds = selectRes.rows.map((r) => String(r.id));
	if (deletedIds.length === 0) {
		return { ok: true, count: 0, deletedIds: [], deletionDate: now };
	}

	await p.query(
		`UPDATE chat_messages
		 SET deleted_at = $1
		 WHERE id = ANY($2)`,
		[now, deletedIds]
	);

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'messages_cleared',
					roomId,
					deletedIds,
					deletionDate: now,
					count: deletedIds.length,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify clear error]:', e);
	}

	return { ok: true, count: deletedIds.length, deletedIds, deletionDate: now };
}
