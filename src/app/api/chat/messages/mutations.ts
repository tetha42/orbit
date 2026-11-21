import { NextResponse } from 'next/server';
import {
	getChatMessageById,
	createChatMessage,
	softDeleteChatMessage,
	softDeleteChatMessagesBatch,
	editChatMessage,
} from '@/db/repositories/chat.repo';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { clientAddress } from '@/lib/http';
import chatContract from '@/apps/chat/chat.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import type { ChatAuthUser } from './forward';

const NO_CACHE = { 'Cache-Control': 'no-store' };
const MAX_CHAT_MESSAGE_LENGTH = chatContract.limits.maxMessageLength;
const MAX_BATCH_DELETE = chatContract.limits.maxBatchDelete;

export async function handleClearCommand(
	request: Request,
	roomId: string,
	trimmedContent: string,
	user: ChatAuthUser,
	isAdmin: boolean
): Promise<NextResponse> {
	if (!isAdmin) {
		return NextResponse.json(
			{ error: 'Only administrators can use the /clear command.' },
			{ status: 403, headers: NO_CACHE }
		);
	}

	const parts = trimmedContent.split(/\s+/);
	let count = 50;
	if (parts.length > 1) {
		const parsed = parseInt(parts[1], 10);
		if (!isNaN(parsed) && parsed > 0) {
			if (parsed > MAX_BATCH_DELETE) {
				return NextResponse.json(
					{ error: `Maximum batch clear count is ${MAX_BATCH_DELETE} messages.` },
					{ status: 400, headers: NO_CACHE }
				);
			}
			count = parsed;
		}
	}

	const clearRes = await softDeleteChatMessagesBatch(roomId, count, true);

	const sysMsg = await createChatMessage(
		roomId,
		{
			id: 'system',
			name: 'System',
			surname: '',
			profilePhoto: null,
		},
		`🧹 Cleared ${clearRes.count} messages.`
	);

	void logSystemEvent({
		service: 'chat',
		level: 'WARN',
		message: `/clear command executed: ${roomId} (${clearRes.count} messages)`,
		detail: { roomId, count: clearRes.count, deletedIds: clearRes.deletedIds },
		userId: user.id,
		ip: clientAddress(request),
	});

	return NextResponse.json(
		{
			ok: true,
			cleared: true,
			clearedCount: clearRes.count,
			deletedIds: clearRes.deletedIds,
			message: sysMsg,
		},
		{ headers: NO_CACHE }
	);
}

export async function handlePatchMessage(request: Request, user: ChatAuthUser): Promise<NextResponse> {
	try {
		const body = await request.json();
		const { id, messageId, content } = body;
		const targetId = String(id || messageId || '');

		if (!targetId || typeof content !== 'string' || !content.trim()) {
			return NextResponse.json({ error: 'Invalid message edit payload.' }, { status: 400, headers: NO_CACHE });
		}

		const trimmedContent = content.trim();
		if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
			return NextResponse.json(
				{ error: `Message content cannot exceed ${MAX_CHAT_MESSAGE_LENGTH} characters.` },
				{ status: 400, headers: NO_CACHE }
			);
		}

		const res = await editChatMessage(targetId, trimmedContent, user.id);
		if (!res.ok || !res.message) {
			const existing = await getChatMessageById(targetId);
			if (!existing) {
				const resErr = contractErrorResponse(chatContract, 'MESSAGE_NOT_FOUND', 'Message not found.');
				resErr.headers.set('Cache-Control', 'no-store');
				return resErr;
			}
			return NextResponse.json(
				{ error: 'Could not edit message or insufficient permissions.' },
				{ status: 403, headers: NO_CACHE }
			);
		}

		void logSystemEvent({
			service: 'chat',
			level: 'INFO',
			message: `Chat message edited: ${targetId}`,
			detail: { messageId: targetId },
			userId: user.id,
			ip: clientAddress(request),
		});

		return NextResponse.json({ ok: true, message: res.message }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages PATCH error]:', err);
		return NextResponse.json({ error: 'Failed to edit message.' }, { status: 500, headers: NO_CACHE });
	}
}

export async function handleDeleteMessage(request: Request, user: ChatAuthUser): Promise<NextResponse> {
	try {
		const { searchParams } = new URL(request.url);
		let targetId = searchParams.get('id') || searchParams.get('messageId');

		if (!targetId) {
			try {
				const body = await request.json();
				targetId = body.id || body.messageId;
			} catch {
				// Empty or non-JSON DELETE body falls through to the missing-ID 400 response.
			}
		}

		if (!targetId) {
			return NextResponse.json({ error: 'Message ID to delete is required.' }, { status: 400, headers: NO_CACHE });
		}

		const isAdmin = Boolean(user.permission?.admin || user.roleId === 'admin');
		const res = await softDeleteChatMessage(targetId, user.id, isAdmin);

		if (!res.ok) {
			const existing = await getChatMessageById(targetId);
			if (!existing) {
				const resErr = contractErrorResponse(chatContract, 'MESSAGE_NOT_FOUND', 'Message not found.');
				resErr.headers.set('Cache-Control', 'no-store');
				return resErr;
			}
			return NextResponse.json(
				{ error: 'Could not delete message or insufficient permissions.' },
				{ status: 403, headers: NO_CACHE }
			);
		}

		void logSystemEvent({
			service: 'chat',
			level: 'WARN',
			message: `Chat message deleted: ${targetId}`,
			detail: { messageId: targetId, roomId: res.roomId },
			userId: user.id,
			ip: clientAddress(request),
		});

		return NextResponse.json({ ok: true, messageId: targetId, deletionDate: res.deletionDate }, { headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat messages DELETE error]:', err);
		return NextResponse.json({ error: 'Failed to delete message.' }, { status: 500, headers: NO_CACHE });
	}
}
