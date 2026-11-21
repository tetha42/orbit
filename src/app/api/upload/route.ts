import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { addStoredFile } from '@/db';
import { verifyUploadAccess } from '@/lib/vaultAccess';
import { consumeRateLimit } from '@/lib/rateLimit';
import { MAX_UPLOAD_BYTES, sniffFile, uploadDir } from '@/lib/uploads';
import { PayloadTooLargeError, readBoundedFormData } from '@/lib/httpBodyGuard';
import { getEmergencyKillSwitches } from '@/db/repositories/security.repo';
import mediaviewerContract from '@/apps/mediaviewer/mediaviewer.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';

const ALLOWED_MIME_PATTERNS = mediaviewerContract.limits.allowedMimeTypes
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);

function isMimeAllowed(mime: string): boolean {
	return ALLOWED_MIME_PATTERNS.some((pattern) =>
		pattern.endsWith('/*') ? mime.startsWith(pattern.slice(0, -1)) : mime === pattern
	);
}

/**
 * Receipt upload.
 *
 * Only people who keep a vault (management, project leaders) may upload. What is
 * stored is decided from the file's own bytes — never the client's declared type
 * or file name — and it lands in a private directory that is read back through
 * `GET /api/uploads/[name]`, which applies the same rule as the ledger entry the
 * receipt is attached to.
 */
async function handlePOST(request: Request) {
	try {
		const emergency = await getEmergencyKillSwitches();
		if (emergency.disableUploads) {
			return NextResponse.json(
				{ error: 'File uploads are temporarily suspended by the emergency security protocol (Kill-Switch).' },
				{ status: 503 }
			);
		}

		const access = await verifyUploadAccess(request);
		if (!access.authorized) return access.response;

		const limit = consumeRateLimit(`upload:${access.user.id}`, 20, 60_000);
		if (!limit.allowed) {
			return NextResponse.json(
				{ error: 'Too many uploads. Please try again later.' },
				{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
			);
		}

		const maxBytes = Math.min(MAX_UPLOAD_BYTES, mediaviewerContract.limits.maxFileSizeMb * 1024 * 1024);

		let formData: FormData;
		try {
			formData = await readBoundedFormData(request, maxBytes + 128 * 1024);
		} catch (error) {
			if (error instanceof PayloadTooLargeError) {
				return contractErrorResponse(
					mediaviewerContract,
					'FILE_TOO_LARGE',
					'File size exceeds the maximum allowed limit.'
				);
			}
			return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
		}

		const file = formData.get('file');
		if (!(file instanceof File)) {
			return NextResponse.json({ error: 'Please select a file to upload.' }, { status: 400 });
		}

		if (file.size > maxBytes) {
			return contractErrorResponse(mediaviewerContract, 'FILE_TOO_LARGE', 'File size exceeds the maximum allowed limit.');
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const sniffed = sniffFile(buffer);
		if (buffer.length === 0 || !sniffed || !isMimeAllowed(sniffed.mime)) {
			return contractErrorResponse(mediaviewerContract, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, WEBP, or PDF files are allowed.');
		}

		const name = `${Date.now()}_${randomBytes(9).toString('hex')}${sniffed.ext}`;
		const dir = uploadDir();
		await mkdir(dir, { recursive: true });
		// `wx` refuses to overwrite: a name collision fails instead of replacing a receipt.
		await writeFile(path.join(dir, name), buffer, { flag: 'wx' });
		await addStoredFile({
			name: name,
			uploaderId: access.user.id,
			mime: sniffed.mime,
			size: buffer.length,
		});

		return NextResponse.json({
			success: true,
			url: `/api/uploads/${name}`,
			fileName: name,
			// Display only; it never influences where or how the file is stored.
			originalName: String(file.name).slice(0, 120),
			size: buffer.length,
			mimeType: sniffed.mime,
		});
	} catch (error) {
		console.error('API /api/upload error:', error);
		return NextResponse.json({ error: 'An error occurred while uploading the file.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'upload.create', target: 'upload' });
