import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { addStoredFile, withTransaction } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { canUserAccessChatRoom } from '@/db/repositories/chat.repo';
import { consumeRateLimit } from '@/lib/rateLimit';
import { MAX_ATTACHMENT_BYTES, sniffMedia } from '@/lib/media';
import { PayloadTooLargeError, readBoundedFormData } from '@/lib/httpBodyGuard';
import { uploadDir } from '@/lib/uploads';
import { getEmergencyKillSwitches } from '@/db/repositories/security.repo';
import { reserveUserStorageQuota } from '@/server/storage/quota';

export const dynamic = 'force-dynamic';

/**
 * Chat attachment upload.
 *
 * The room is verified before a byte is written, so a member cannot upload into
 * a private room they cannot read. Storage quota is reserved atomically inside
 * `withTransaction`, and the stored MIME type comes from the bytes.
 */
async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'chat', 'use');
	if (!auth.authorized) return auth.response;

	const emergency = await getEmergencyKillSwitches();
	if (emergency.disableUploads) {
		return NextResponse.json(
			{ error: 'Uploads are temporarily disabled by the emergency security protocol.' },
			{ status: 503 }
		);
	}

	const limit = consumeRateLimit(`chat:upload:${auth.user.id}`, 30, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many uploads. Please wait a moment.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	let formData: FormData;
	try {
		formData = await readBoundedFormData(request, MAX_ATTACHMENT_BYTES + 128 * 1024);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json(
				{ error: `Attachments must be smaller than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.` },
				{ status: 413 }
			);
		}
		return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
	}

	const roomId = String(formData.get('roomId') ?? '').trim();
	if (!roomId) return NextResponse.json({ error: 'Room id is required.' }, { status: 400 });

	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');
	if (!(await canUserAccessChatRoom(roomId, auth.user.id, isAdmin))) {
		return NextResponse.json({ error: 'You cannot attach files to this room.' }, { status: 403 });
	}

	const file = formData.get('file');
	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
	}
	if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
		return NextResponse.json(
			{ error: `Attachments must be smaller than ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.` },
			{ status: 413 }
		);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const media = sniffMedia(buffer, file.name);
	if (!media) {
		return NextResponse.json(
			{
				error: 'Unsupported file type. Images, video, audio, PDF, Markdown/text, and office documents are accepted.',
				code: 'UNSUPPORTED_FILE_TYPE',
			},
			{ status: 415 }
		);
	}

	const name = `${Date.now()}_${randomBytes(9).toString('hex')}${media.ext}`;
	const dir = uploadDir();
	const targetPath = path.join(dir, name);
	let fileWritten = false;

	try {
		const txResult = await withTransaction(async (client) => {
			const quota = await reserveUserStorageQuota(client, auth.user.id, buffer.length);
			if (!quota.allowed) {
				return { allowed: false as const, quota };
			}
			await mkdir(dir, { recursive: true });
			await writeFile(targetPath, buffer, { flag: 'wx' });
			fileWritten = true;
			await addStoredFile(
				{
					name,
					uploaderId: auth.user.id,
					mime: media.mime,
					size: buffer.length,
					chatRoomId: roomId,
					sourceApp: 'chat',
					scopeId: roomId,
				},
				client
			);
			return { allowed: true as const };
		});

		if (!txResult.allowed) {
			return NextResponse.json(
				{
					error: 'Storage quota exceeded.',
					code: 'STORAGE_QUOTA_EXCEEDED',
					usedBytes: txResult.quota.usedBytes,
					quotaBytes: txResult.quota.quotaBytes,
					remainingBytes: txResult.quota.remainingBytes,
				},
				{ status: 413 }
			);
		}
	} catch (err) {
		if (fileWritten) {
			await unlink(targetPath).catch((cleanupErr) => {
				console.warn('[chat/upload] Failed to remove orphan file after rollback:', cleanupErr);
			});
		}
		throw err;
	}

	// Display-only: never used to decide the stored type or path.
	const originalName =
		String(file.name || 'attachment')
			.replace(/[\r\n\0]+/g, ' ')
			.trim()
			.slice(0, 140) || 'attachment';

	return NextResponse.json({
		ok: true,
		attachment: {
			name: originalName,
			url: `/api/uploads/${name}`,
			size: buffer.length,
			type: media.mime,
		},
	});
}

export const POST = withAudit(handlePOST, { action: 'chat.upload.create', target: 'chat.upload' });
