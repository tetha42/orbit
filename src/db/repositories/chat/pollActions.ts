import { randomUUID } from 'crypto';
import { getPgPool, ensurePostgresInit } from '@/db';
import type { ChatPollItem } from '@/apps/chat/types';
import type { ChatMessageRecord, RawPollOption } from './types';
import { getPollDetails } from './pollQueries';

export async function createPollInRoom(
	roomId: string,
	creator: { id: string; name: string; surname: string; profilePhoto?: string | null },
	data: {
		question: string;
		options: string[];
		multipleSelection?: boolean;
		anonymous?: boolean;
		sureSeconds?: number | null;
		endsAt?: number | null;
	}
): Promise<{ ok: boolean; message?: ChatMessageRecord; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const question = (data.question || '').trim();
	const cleanOptions = (data.options || []).map((s) => s.trim()).filter(Boolean);

	if (!question) {
		return { ok: false, error: 'Please enter a poll question.' };
	}
	if (cleanOptions.length < 2) {
		return { ok: false, error: 'You must enter at least 2 options.' };
	}

	const messageId = randomUUID();
	const pollId = `poll_${randomUUID()}`;
	const now = Date.now();
	const endsAt = typeof data.endsAt === 'number'
		? data.endsAt
		: data.sureSeconds
		? now + Number(data.sureSeconds) * 1000
		: null;
	const senderName = `${creator.name} ${creator.surname}`.trim() || 'Administrator';
	const senderPhoto = creator.profilePhoto || null;
	const isAnon = data.anonymous !== false;
	const attachmentsJson = JSON.stringify([{ type: 'poll', pollId, question, anonymous: isAnon }]);

	await p.query(
		`INSERT INTO chat_messages (id, room_id, sender_id, sender_name, sender_avatar, content, attachments, date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		[messageId, roomId, creator.id, senderName, senderPhoto, question, attachmentsJson, now]
	);

	const optionsList: RawPollOption[] = cleanOptions.map((text, idx) => ({
		id: `opt_${randomUUID()}`,
		text,
		sortOrder: idx,
	}));

	await p.query(
		`INSERT INTO chat_polls (id, room_id, created_by, question, allow_multiple, options, votes, ends_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb, '[]'::jsonb, $7, $8)`,
		[
			pollId,
			roomId,
			creator.id,
			question,
			Boolean(data.multipleSelection),
			JSON.stringify(optionsList),
			endsAt,
			now,
		]
	);

	await p.query(
		`INSERT INTO chat_members (room_id, user_id, last_read_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
		[roomId, creator.id, now]
	);

	const pollDetails = await getPollDetails(pollId, creator.id);

	const createdMsg: ChatMessageRecord = {
		id: messageId,
		roomId,
		senderId: creator.id,
		senderName,
		senderPhoto,
		content: question,
		attachments: [{ type: 'poll', pollId, name: 'Poll', url: '' }],
		date: now,
		poll: pollDetails ? { ...pollDetails, messageId } : null,
	};

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[JSON.stringify({ type: 'new_message', roomId, message: createdMsg })]
		);
	} catch (e) {
		console.warn('[Chat notify poll create error]:', e);
	}

	return { ok: true, message: createdMsg };
}

export async function closePoll(
	pollId: string,
	userId: string,
	isAdmin = false
): Promise<{ ok: boolean; poll?: ChatPollItem; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", created_by AS "creatorId" FROM chat_polls WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Poll not found.' };
	}

	const pollRow = pollRes.rows[0];
	const creatorId = String(pollRow.creatorId ?? '');

	if (!isAdmin && creatorId !== userId) {
		return { ok: false, error: 'You are not authorized to close this poll.' };
	}

	await p.query(`UPDATE chat_polls SET ends_at = $2 WHERE id = $1`, [pollId, Date.now() - 1]);

	const updatedPoll = await getPollDetails(pollId, userId);
	if (!updatedPoll) {
		return { ok: false, error: 'Poll could not be updated.' };
	}

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'poll_updated',
					roomId: pollRow.roomId,
					pollId,
					poll: updatedPoll,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify poll close error]:', e);
	}

	return { ok: true, poll: updatedPoll };
}
