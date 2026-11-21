import { getPgPool, ensurePostgresInit } from '@/db';
import type { ChatPollItem, ChatPollOptionItem } from '@/apps/chat/types';
import type { ChatMessageRecord, RawPollOption, RawPollVote } from './types';

export async function getPollDetails(pollId: string, currentUserId?: string): Promise<ChatPollItem | null> {
	await ensurePostgresInit();
	const p = getPgPool();

	const pollRes = await p.query(
		`SELECT id, room_id AS "roomId", created_by AS "creatorId", question AS question,
		        allow_multiple AS "multipleSelection", options, votes, ends_at AS "endsAt", created_at AS creation
		 FROM chat_polls
		 WHERE id = $1`,
		[pollId]
	);

	if (pollRes.rows.length === 0) return null;
	const row = pollRes.rows[0];
	const roomId = String(row.roomId ?? '');
	const creatorId = String(row.creatorId ?? '');

	let creatorName = 'Administrator';
	try {
		const uRes = await p.query(
			`SELECT first_name AS name, last_name AS surname FROM users WHERE id = $1`,
			[creatorId]
		);
		if (uRes.rows.length > 0) {
			creatorName = `${uRes.rows[0].name} ${uRes.rows[0].surname}`.trim();
		}
	} catch (err) {
		console.warn('[Chat] Failed to look up poll creator name:', err);
	}

	let messageId = '';
	let isAnon = true;
	try {
		const msgRes = await p.query(
			`SELECT id, attachments FROM chat_messages WHERE room_id = $1 AND attachments LIKE $2 LIMIT 1`,
			[roomId, `%${pollId}%`]
		);
		if (msgRes.rows.length > 0) {
			messageId = String(msgRes.rows[0].id ?? '');
			const rawAtt = msgRes.rows[0].attachments;
			const parsedAtt = Array.isArray(rawAtt)
				? rawAtt
				: typeof rawAtt === 'string'
				? JSON.parse(rawAtt)
				: [];
			const pollAtt = Array.isArray(parsedAtt)
				? parsedAtt.find((a: Record<string, unknown>) => a && (a.pollId === pollId || a.type === 'poll'))
				: null;
			if (pollAtt && typeof pollAtt.anonymous === 'boolean') {
				isAnon = pollAtt.anonymous;
			}
		}
	} catch (err) {
		console.warn('[Chat] Failed to resolve poll message metadata:', err);
	}

	const rawOptions: RawPollOption[] = Array.isArray(row.options)
		? row.options
		: typeof row.options === 'string'
		? JSON.parse(row.options)
		: [];
	const sortedOptions = [...rawOptions].sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));

	const rawVotes: RawPollVote[] = Array.isArray(row.votes)
		? row.votes
		: typeof row.votes === 'string'
		? JSON.parse(row.votes)
		: [];

	const totalVotes = rawVotes.length;
	const userVotes: string[] = [];

	const options: ChatPollOptionItem[] = sortedOptions.map((opt, idx) => {
		const optId = String(opt.id);
		const optVotes = rawVotes.filter((v) => String(v.optionId) === optId);
		const count = optVotes.length;
		const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

		const hasUserVoted = currentUserId
			? optVotes.some((v) => String(v.userId) === currentUserId)
			: false;
		if (hasUserVoted) {
			userVotes.push(optId);
		}

		return {
			id: optId,
			pollId,
			order: Number(opt.sortOrder ?? idx),
			text: String(opt.text ?? ''),
			voteCount: count,
			percent,
			voteGivers: !isAnon
				? optVotes.map((v) => ({
						id: String(v.userId),
						name: String(v.userName ?? 'Member'),
						photo: (v.userAvatar ?? null) as string | null,
				  }))
				: undefined,
		};
	});

	const endsAt = row.endsAt !== null && row.endsAt !== undefined ? Number(row.endsAt) : null;
	const isExpired = endsAt !== null ? Date.now() >= endsAt : false;

	return {
		id: String(row.id),
		messageId,
		roomId,
		creatorId,
		creatorName,
		question: String(row.question ?? ''),
		multipleSelection: Boolean(row.multipleSelection),
		anonymous: isAnon,
		endsAt,
		closed: isExpired,
		creation: Number(row.creation ?? 0),
		options,
		totalVote: totalVotes,
		userVotes,
	};
}

export async function enrichMessagesWithPolls(messages: ChatMessageRecord[], currentUserId?: string): Promise<ChatMessageRecord[]> {
	if (messages.length === 0) return messages;

	const pollMessageMap = new Map<string, string>();
	for (const m of messages) {
		if (Array.isArray(m.attachments)) {
			const addPoll = m.attachments.find((e) => e && (e.type === 'poll' || (e as { pollId?: string }).pollId));
			if (addPoll) {
				const aId = (addPoll as { pollId?: string }).pollId || (addPoll as { id?: string }).id;
				if (aId) pollMessageMap.set(m.id, aId);
			}
		}
	}

	if (pollMessageMap.size === 0) return messages;

	const pollDetailsMap = new Map<string, ChatPollItem>();
	await Promise.all(
		Array.from(pollMessageMap.entries()).map(async ([messageId, pollId]) => {
			const poll = await getPollDetails(pollId, currentUserId);
			if (poll) {
				pollDetailsMap.set(messageId, { ...poll, messageId: poll.messageId || messageId });
			}
		})
	);

	return messages.map((m) => {
		const poll = pollDetailsMap.get(m.id);
		return poll ? { ...m, poll } : m;
	});
}
