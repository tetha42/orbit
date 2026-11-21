import { getPgPool, ensurePostgresInit } from '@/db';
import type { ChatPollItem } from '@/apps/chat/types';
import type { RawPollOption, RawPollVote } from './types';
import { getPollDetails } from './pollQueries';
import { canUserAccessChatRoom } from './rooms';

export async function castPollVote(
	pollId: string,
	optionId: string,
	user: { id: string; name: string; surname: string; profilePhoto?: string | null },
	isAdmin = false
): Promise<{ ok: boolean; poll?: ChatPollItem; error?: string }> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", allow_multiple AS "multipleSelection", options, votes, ends_at AS "endsAt"
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) {
		return { ok: false, error: 'Poll not found.' };
	}

	const pollRow = pollRes.rows[0];
	const pollRoomId = String(pollRow.roomId ?? '');
	const hasAccess = await canUserAccessChatRoom(pollRoomId, user.id, isAdmin);
	if (!hasAccess) {
		return { ok: false, error: 'You are not authorized to access the poll in this room.' };
	}

	const endsAt = pollRow.endsAt;
	if (endsAt !== null && endsAt !== undefined && Date.now() >= Number(endsAt)) {
		return { ok: false, error: 'This poll is closed for voting.' };
	}

	const rawOptions: RawPollOption[] = Array.isArray(pollRow.options)
		? pollRow.options
		: typeof pollRow.options === 'string'
		? JSON.parse(pollRow.options)
		: [];
	if (!rawOptions.some((o) => String(o.id) === optionId)) {
		return { ok: false, error: 'Invalid poll option.' };
	}

	const isMulti = Boolean(pollRow.multipleSelection);
	const userFirstName = `${user.name} ${user.surname}`.trim() || 'Member';
	const userAvatar = user.profilePhoto || null;

	const rawVotes: RawPollVote[] = Array.isArray(pollRow.votes)
		? pollRow.votes
		: typeof pollRow.votes === 'string'
		? JSON.parse(pollRow.votes)
		: [];

	const alreadyVoted = rawVotes.some(
		(v) => String(v.optionId) === optionId && String(v.userId) === user.id
	);

	let nextVotes: RawPollVote[];
	if (alreadyVoted) {
		nextVotes = rawVotes.filter(
			(v) => !(String(v.optionId) === optionId && String(v.userId) === user.id)
		);
	} else {
		const baseVotes = isMulti
			? rawVotes
			: rawVotes.filter((v) => String(v.userId) !== user.id);
		nextVotes = [
			...baseVotes,
			{
				optionId,
				userId: user.id,
				userName: userFirstName,
				userAvatar,
				votedAt: Date.now(),
			},
		];
	}

	await p.query(
		`UPDATE chat_polls SET votes = $2::jsonb WHERE id = $1`,
		[pollId, JSON.stringify(nextVotes)]
	);

	const updatedPoll = await getPollDetails(pollId, user.id);
	if (!updatedPoll) {
		return { ok: false, error: 'Poll information could not be retrieved.' };
	}

	try {
		await p.query(
			`SELECT pg_notify('club_chat_events', $1)`,
			[
				JSON.stringify({
					type: 'poll_updated',
					roomId: pollRoomId,
					pollId,
					poll: updatedPoll,
				}),
			]
		);
	} catch (e) {
		console.warn('[Chat notify poll vote error]:', e);
	}

	return { ok: true, poll: updatedPoll };
}
