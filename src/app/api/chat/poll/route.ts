import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { canUserAccessChatRoom, createPollInRoom, castPollVote, closePoll } from '@/db/repositories/chat.repo';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { clientAddress } from '@/lib/http';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');

	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'create') {
			if (!isAdmin) {
				return NextResponse.json(
					{ error: 'Only administrators can create polls.' },
					{ status: 403, headers: NO_CACHE }
				);
			}

			const { roomId, question, options, multipleSelection, anonymous, endsAt } = body;

			if (!roomId || !question || typeof question !== 'string' || !question.trim()) {
				return NextResponse.json(
					{ error: 'Poll question cannot be empty.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const canAccess = await canUserAccessChatRoom(String(roomId), auth.user.id, isAdmin);
			if (!canAccess) {
				return NextResponse.json(
					{ error: 'You do not have permission to access this chat room.' },
					{ status: 403, headers: NO_CACHE }
				);
			}

			if (!Array.isArray(options) || options.length < 2 || options.length > 12) {
				return NextResponse.json(
					{ error: 'A poll must specify between 2 and 12 options.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await createPollInRoom(
				roomId,
				{
					id: auth.user.id,
					name: auth.user.firstName || auth.user.name || '',
					surname: auth.user.lastName || auth.user.surname || '',
					profilePhoto: auth.user.avatarUrl || auth.user.profilePhoto || null,
				},
				{
					question: question.trim().slice(0, 500),
					options: options.map((s: unknown) => String(s ?? '').slice(0, 200)),
					multipleSelection: Boolean(multipleSelection),
					anonymous: anonymous !== false,
					endsAt: typeof endsAt === 'number' ? endsAt : null,
				}
			);

			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Failed to create poll.' }, { status: 400, headers: NO_CACHE });
			}

			void logSystemEvent({
				service: 'chat',
				level: 'INFO',
				message: `New poll created: "${question.trim().slice(0, 50)}" (${roomId})`,
				detail: { roomId, pollId: res.message?.poll?.id, question: question.trim().slice(0, 120) },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		if (action === 'vote') {
			const { pollId, optionId } = body;
			if (!pollId || !optionId) {
				return NextResponse.json(
					{ error: 'Poll or option ID is missing.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await castPollVote(
				String(pollId),
				String(optionId),
				{
					id: auth.user.id,
					name: auth.user.firstName || auth.user.name || '',
					surname: auth.user.lastName || auth.user.surname || '',
					profilePhoto: auth.user.avatarUrl || auth.user.profilePhoto || null,
				},
				isAdmin
			);

			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Failed to cast vote.' }, { status: 400, headers: NO_CACHE });
			}

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		if (action === 'close') {
			const { pollId } = body;
			if (!pollId) {
				return NextResponse.json(
					{ error: 'Poll ID is missing.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await closePoll(pollId, auth.user.id, isAdmin);
			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Failed to close poll.' }, { status: 400, headers: NO_CACHE });
			}

			void logSystemEvent({
				service: 'chat',
				level: 'INFO',
				message: `Poll closed: ${pollId}`,
				detail: { pollId },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		return NextResponse.json({ error: 'Invalid action.' }, { status: 400, headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat poll POST error]:', err);
		return NextResponse.json({ error: 'An error occurred while processing the request.' }, { status: 500, headers: NO_CACHE });
	}
}
