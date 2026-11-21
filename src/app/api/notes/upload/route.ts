import { NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { addStoredFile, withTransaction } from '@/db';
import { getEmergencyKillSwitches } from '@/db/repositories/security.repo';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';
import { PayloadTooLargeError, readBoundedFormData } from '@/lib/httpBodyGuard';
import { consumeRateLimit } from '@/lib/rateLimit';
import { MAX_UPLOAD_BYTES, sniffImage, uploadDir } from '@/lib/uploads';
import { reserveUserStorageQuota } from '@/server/storage/quota';

export const dynamic = 'force-dynamic';

const ALLOWED_NOTE_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function processNoteImage(
	buffer: Buffer,
	mime: string
): Promise<{ outBuffer: Buffer; outMime: string; outExt: string }> {
	const meta = await sharp(buffer, { animated: true }).metadata();
	if (!meta.width || !meta.height) {
		throw new Error('INVALID_IMAGE');
	}
	if (mime === 'image/gif') {
		const outBuffer = await sharp(buffer, { animated: true }).gif().toBuffer();
		return { outBuffer, outMime: 'image/gif', outExt: '.gif' };
	}
	if (mime === 'image/webp' && (meta.pages ?? 1) > 1) {
		const outBuffer = await sharp(buffer, { animated: true }).webp({ quality: 86 }).toBuffer();
		return { outBuffer, outMime: 'image/webp', outExt: '.webp' };
	}
	if (mime === 'image/png') {
		const outBuffer = await sharp(buffer).rotate().png({ compressionLevel: 9 }).toBuffer();
		return { outBuffer, outMime: 'image/png', outExt: '.png' };
	}
	if (mime === 'image/webp') {
		const outBuffer = await sharp(buffer).rotate().webp({ quality: 86 }).toBuffer();
		return { outBuffer, outMime: 'image/webp', outExt: '.webp' };
	}
	const outBuffer = await sharp(buffer).rotate().jpeg({ quality: 86 }).toBuffer();
	return { outBuffer, outMime: 'image/jpeg', outExt: '.jpg' };
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'notes', 'use');
	if (!auth.authorized) return auth.response;

	const emergency = await getEmergencyKillSwitches();
	if (emergency.disableUploads) {
		return NextResponse.json(
			{ error: 'Uploads are temporarily disabled by the emergency security protocol.' },
			{ status: 503 }
		);
	}

	const limit = consumeRateLimit(`notes:upload:${auth.user.id}`, 30, 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many uploads. Please wait a moment.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	let formData: FormData;
	try {
		formData = await readBoundedFormData(request, MAX_UPLOAD_BYTES + 256 * 1024);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Images must be 10 MB or smaller.' }, { status: 413 });
		}
		return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
	}

	const url = new URL(request.url);
	const noteId = (url.searchParams.get('noteId') ?? String(formData.get('noteId') ?? '')).trim();
	if (!noteId || noteId.length > 120) {
		return NextResponse.json({ error: 'Note ID is required.' }, { status: 400 });
	}

	const file = formData.get('file');
	if (!(file instanceof File)) {
		return NextResponse.json({ error: 'Choose an image file to upload.' }, { status: 400 });
	}
	if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
		return NextResponse.json({ error: 'Images must be 10 MB or smaller.' }, { status: 413 });
	}

	const rawBuffer = Buffer.from(await file.arrayBuffer());
	const sniffed = sniffImage(rawBuffer);
	if (!sniffed || !ALLOWED_NOTE_IMAGE_MIMES.has(sniffed.mime)) {
		return NextResponse.json(
			{ error: 'Only PNG, JPEG, WebP, or GIF images are supported.', code: 'UNSUPPORTED_IMAGE_TYPE' },
			{ status: 415 }
		);
	}

	let processed: { outBuffer: Buffer; outMime: string; outExt: string };
	try {
		processed = await processNoteImage(rawBuffer, sniffed.mime);
	} catch {
		return NextResponse.json({ error: 'Invalid or corrupted image file.' }, { status: 415 });
	}

	const { outBuffer, outMime, outExt } = processed;
	if (outBuffer.length <= 0 || outBuffer.length > MAX_UPLOAD_BYTES) {
		return NextResponse.json({ error: 'Images must be 10 MB or smaller.' }, { status: 413 });
	}

	const storedName = `${Date.now()}_${randomBytes(9).toString('hex')}${outExt}`;
	const dir = uploadDir();
	const targetPath = path.join(dir, storedName);
	let fileWritten = false;

	try {
		const txResult = await withTransaction(async (client) => {
			const ownerRes = await client.query<{ userId: string }>(
				`SELECT user_id AS "userId"
				 FROM user_notes
				 WHERE id = $1 AND folder_id <> '__folder__'`,
				[noteId]
			);
			const noteRow = ownerRes.rows[0];
			if (!noteRow) {
				return { kind: 'not_found' as const };
			}
			if (String(noteRow.userId) !== auth.user.id) {
				return { kind: 'forbidden' as const };
			}

			const quota = await reserveUserStorageQuota(client, auth.user.id, outBuffer.length);
			if (!quota.allowed) {
				return { kind: 'quota' as const, quota };
			}

			await mkdir(dir, { recursive: true });
			await writeFile(targetPath, outBuffer, { flag: 'wx' });
			fileWritten = true;

			await addStoredFile(
				{
					name: storedName,
					uploaderId: auth.user.id,
					mime: outMime,
					size: outBuffer.length,
					sourceApp: 'notes',
					scopeId: noteId,
				},
				client
			);

			return { kind: 'ok' as const };
		});

		if (txResult.kind === 'not_found') {
			return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
		}
		if (txResult.kind === 'forbidden') {
			return NextResponse.json({ error: 'You do not have permission to attach images to this note.' }, { status: 403 });
		}
		if (txResult.kind === 'quota') {
			return NextResponse.json(
				{
					error: 'STORAGE_QUOTA_EXCEEDED',
					usedBytes: txResult.quota.usedBytes,
					quotaBytes: txResult.quota.quotaBytes,
				},
				{ status: 413 }
			);
		}

		return NextResponse.json({
			ok: true,
			name: storedName,
			url: `/api/uploads/${storedName}`,
			mime: outMime,
			size: outBuffer.length,
		});
	} catch (error) {
		if (fileWritten) {
			try {
				await unlink(targetPath);
			} catch {
				// File was not persisted or already removed during rollback cleanup.
			}
		}
		console.error('API /api/notes/upload POST error:', error);
		return NextResponse.json({ error: 'Failed to upload image.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'notes.image.upload', target: 'notes' });
