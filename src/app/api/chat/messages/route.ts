import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import {
	canUserAccessChatRoom,
	getChatRoomMessages,
	createChatMessage,
} from '@/db/repositories/chat.repo';
import { getStoredFile } from '@/db';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import chatContract from '@/apps/chat/chat.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import { handleForwardAction } from './forward';
import { handleClearCommand, handleDeleteMessage, handlePatchMessage } from './mutations';
import { getChatMessagesAroundId } from '@/domains/chatSearch/around';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };
const MAX_CHAT_MESSAGE_LENGTH = chatContract.limits.maxMessageLength;

export async function GET(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const roomId = searchParams.get('roomId');
	const rawLimit = Number(searchParams.get('limit') || '50');
	const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 100)) : 50;
	const beforeDate = Number(searchParams.get('before'));
	const beforeId = searchParams.get('beforeId');
	const before =
		Number.isFinite(beforeDate) && beforeDate > 0 && beforeId
			? { date: beforeDate, id: beforeId }
			: null;

	if (!roomId) {
		return NextResponse.json({ error: 'Room ID is required.' }, { status: 400, headers: NO_CACHE });
	}

	try {
		const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
		const hasAccess = await canUserAccessChatRoom(roomId, auth.user.id, isAdmin);
		if (!hasAccess) {
			const ip = clientAddress(request);
			void logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `Unauthorized chat room read attempt (IDOR: ${roomId}): ${auth.user.email}`,
				detail: { roomId },
				userId: auth.user.id,
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: 25,
				reason: `Private chat IDOR read attempt (${roomId})`,
				path: '/api/chat/messages',
				userId: auth.user.id,
			});
			const res = contractErrorResponse(chatContract, 'ROOM_ACCESS_DENIED');
			res.headers.set('Cache-Control', 'no-store');
			return res;
		}
		const aroundId = searchParams.get('aroundId')?.trim() || '';
		if (aroundId) {
			const around = await getChatMessagesAroundId(roomId, aroundId, auth.user.id);
			return NextResponse.json({ ok: true, ...around }, { headers: NO_CACHE });
		}
		// Ask for one extra row to know whether older messages remain without a
		// second query. The repo returns the window oldest -> newest, so the extra
		// (oldest) row is dropped and the next page starts before the first
		// returned message.
		const page = await getChatRoomMessages(roomId, limit + 1, isAdmin, auth.user.id, before);
		const hasMore = page.length > limit;
		const messages = hasMore ? page.slice(1) : page;
		return NextResponse.json({ ok: true, messages, hasMore }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages GET error]:', err);
		return NextResponse.json({ error: 'Failed to load messages.' }, { status: 500, headers: NO_CACHE });
	}
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const msgLimit = consumeRateLimit(`chat:msg:${auth.user.id}`, 40, 60_000);
	if (!msgLimit.allowed) {
		return NextResponse.json(
			{ error: 'Sending messages too fast. Please wait a moment.' },
			{ status: 429, headers: { ...NO_CACHE, 'Retry-After': String(msgLimit.retryAfter) } }
		);
	}

	try {
		const body = await request.json();
		const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');

		if (body.action === 'forward') {
			return handleForwardAction(request, body, auth.user, isAdmin);
		}

		const { roomId, content, attachments: rawAttachments, repliedMessageId, repliedMessage, isDelivered } = body;

		// Attachments-only messages are valid; the text may be empty.
		const attachments = (Array.isArray(rawAttachments) ? rawAttachments : [])
			.slice(0, 10)
			.filter(
				(item): item is { name: unknown; url: string; size?: unknown; type?: unknown } =>
					Boolean(item) &&
					typeof item === 'object' &&
					typeof (item as { url?: unknown }).url === 'string' &&
					String((item as { url?: unknown }).url).startsWith('/api/uploads/')
			)
			.map((item) => ({
				name: String(item.name ?? 'attachment').slice(0, 140),
				url: String(item.url),
				...(typeof item.size === 'number' ? { size: item.size } : {}),
				...(typeof item.type === 'string' ? { type: item.type.slice(0, 120) } : {}),
			}));

		if (typeof content !== 'string' || (!content.trim() && attachments.length === 0)) {
			return NextResponse.json({ error: 'Message content cannot be empty.' }, { status: 400, headers: NO_CACHE });
		}
		if (!roomId) {
			return NextResponse.json({ error: 'Room ID is required.' }, { status: 400, headers: NO_CACHE });
		}

		const trimmedContent = content.trim();
		if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
			return NextResponse.json(
				{ error: `Message content cannot exceed ${MAX_CHAT_MESSAGE_LENGTH} characters.` },
				{ status: 400, headers: NO_CACHE }
			);
		}

		const hasAccess = await canUserAccessChatRoom(String(roomId), auth.user.id, isAdmin);
		if (!hasAccess) {
			const ip = clientAddress(request);
			void logSystemEvent({
				service: 'security',
				level: 'WARN',
				message: `Unauthorized chat room send attempt (IDOR: ${roomId}): ${auth.user.email}`,
				detail: { roomId },
				userId: auth.user.id,
				ip,
			});
			void recordSecurityStrike({
				ip,
				points: 25,
				reason: `Private chat IDOR write attempt (${roomId})`,
				path: '/api/chat/messages',
				userId: auth.user.id,
			});
			const res = contractErrorResponse(chatContract, 'ROOM_ACCESS_DENIED');
			res.headers.set('Cache-Control', 'no-store');
			return res;
		}

		// Only attachments that belong to this room may travel with the message.
		const safeAttachments = (
			await Promise.all(
				attachments.map(async (attachment) => {
					const name = attachment.url.replace('/api/uploads/', '');
					const file = await getStoredFile(name);
					if (!file) return null;
					if (file.chatRoomId === String(roomId)) return attachment;
					return null;
				})
			)
		).filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null);

		if (!trimmedContent && safeAttachments.length === 0) {
			return NextResponse.json(
				{ error: 'Message content or attachment is required.' },
				{ status: 400, headers: NO_CACHE }
			);
		}

		if (trimmedContent.startsWith('/clear')) {
			return handleClearCommand(request, String(roomId), trimmedContent, auth.user, isAdmin);
		}

		const message = await createChatMessage(
			roomId,
			{
				id: auth.user.id,
				name: auth.user.firstName || auth.user.name || '',
				surname: auth.user.lastName || auth.user.surname || '',
				profilePhoto: auth.user.avatarUrl || auth.user.profilePhoto,
			},
			trimmedContent,
			safeAttachments,
			{
				repliedMessageId: repliedMessageId ? String(repliedMessageId) : null,
				repliedMessage: repliedMessage && typeof repliedMessage === 'object' ? repliedMessage : null,
				isDelivered: Boolean(isDelivered),
			}
		);

		// Keep a heartbeat entry per room per minute instead of logging every message.
		if (consumeRateLimit(`chat:log:${roomId}`, 1, 60_000).allowed) {
			void logSystemEvent({
				service: 'chat',
				level: 'INFO',
				message: `Chat message sent: ${roomId}`,
				detail: { roomId, messageId: message.id },
				userId: auth.user.id,
				ip: clientAddress(request),
			});
		}

		return NextResponse.json({ ok: true, message }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages POST error]:', err);
		return NextResponse.json({ error: 'Failed to send message.' }, { status: 500, headers: NO_CACHE });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;
	return handlePatchMessage(request, auth.user);
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;
	return handleDeleteMessage(request, auth.user);
}
