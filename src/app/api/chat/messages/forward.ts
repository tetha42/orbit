import { NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import type { requireApp } from '@/lib/auth/access';
import {
	canUserAccessChatRoom,
	getChatMessageById,
	createChatMessage,
} from '@/db/repositories/chat.repo';
import { addStoredFile } from '@/db';
import { UPLOAD_NAME_RE, mimeForName, uploadDir } from '@/lib/uploads';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { clientAddress } from '@/lib/http';
import chatContract from '@/apps/chat/chat.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

export type ChatAuthUser = Extract<Awaited<ReturnType<typeof requireApp>>, { authorized: true }>['user'];

const NO_CACHE = { 'Cache-Control': 'no-store' };

/**
 * Forwarding an attachment must not link the target room to a file that only
 * source-room members may read. The bytes are copied and registered under the
 * target room, so forwarded media is exactly as private as its new message.
 */
async function cloneAttachmentsForRoom(
	attachments: Array<{ name: string; url: string; size?: number; type?: string }>,
	roomId: string,
	userId: string
): Promise<Array<{ name: string; url: string; size?: number; type?: string }>> {
	const cloned: Array<{ name: string; url: string; size?: number; type?: string }> = [];
	const dir = uploadDir();
	await mkdir(dir, { recursive: true });
	for (const attachment of attachments) {
		const sourceName = attachment.url.replace('/api/uploads/', '');
		if (!UPLOAD_NAME_RE.test(sourceName)) continue;
		try {
			const buffer = await readFile(path.join(dir, sourceName));
			const extension = sourceName.slice(sourceName.lastIndexOf('.'));
			const name = `${Date.now()}_${randomBytes(9).toString('hex')}${extension}`;
			await writeFile(path.join(dir, name), buffer, { flag: 'wx' });
			const mime = attachment.type || mimeForName(name);
			await addStoredFile({
				name,
				uploaderId: userId,
				mime,
				size: buffer.length,
				chatRoomId: roomId,
			});
			cloned.push({
				name: attachment.name,
				url: `/api/uploads/${name}`,
				size: buffer.length,
				type: mime,
			});
		} catch {
			// A missing source file is skipped rather than breaking the forward.
		}
	}
	return cloned;
}

export async function handleForwardAction(
	request: Request,
	body: Record<string, unknown>,
	user: ChatAuthUser,
	isAdmin: boolean
): Promise<NextResponse> {
	const { messageId, targetRoomIds } = body;
	if (!messageId || !Array.isArray(targetRoomIds) || targetRoomIds.length === 0) {
		return NextResponse.json(
			{ error: 'Source message and target rooms are required.' },
			{ status: 400, headers: NO_CACHE }
		);
	}

	if (targetRoomIds.length > 10) {
		return NextResponse.json(
			{ error: 'Messages can be forwarded to at most 10 rooms at a time.' },
			{ status: 400, headers: NO_CACHE }
		);
	}

	const sourceMsg = await getChatMessageById(String(messageId));
	if (!sourceMsg) {
		const res = contractErrorResponse(chatContract, 'MESSAGE_NOT_FOUND', 'Message to forward was not found.');
		res.headers.set('Cache-Control', 'no-store');
		return res;
	}

	const hasSourceAccess = await canUserAccessChatRoom(sourceMsg.roomId, user.id, isAdmin);
	if (!hasSourceAccess) {
		const res = contractErrorResponse(chatContract, 'ROOM_ACCESS_DENIED', 'You do not have access to the source room.');
		res.headers.set('Cache-Control', 'no-store');
		return res;
	}

	const forwardedMessages = [];
	for (const targetRoomId of targetRoomIds) {
		const canSend = await canUserAccessChatRoom(String(targetRoomId), user.id, isAdmin);
		if (canSend) {
			const copiedAttachments = await cloneAttachmentsForRoom(
				sourceMsg.attachments,
				String(targetRoomId),
				user.id
			);
			const fMsg = await createChatMessage(
				String(targetRoomId),
				{
					id: user.id,
					name: user.firstName || user.name || '',
					surname: user.lastName || user.surname || '',
					profilePhoto: user.avatarUrl || user.profilePhoto,
				},
				sourceMsg.content,
				copiedAttachments,
				{ isDelivered: true }
			);
			forwardedMessages.push(fMsg);
		}
	}

	void logSystemEvent({
		service: 'chat',
		level: 'INFO',
		message: `Chat message forwarded: ${String(messageId)} -> ${forwardedMessages.length} rooms`,
		detail: { sourceMessageId: messageId, targetRoomIds, forwardedCount: forwardedMessages.length },
		userId: user.id,
		ip: clientAddress(request),
	});

	return NextResponse.json(
		{ ok: true, forwardedCount: forwardedMessages.length, messages: forwardedMessages },
		{ headers: NO_CACHE }
	);
}
