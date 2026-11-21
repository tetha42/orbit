import { NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { addStoredFile, deleteStoredFile, getStoredFile, updateUserProfile, getEmergencyKillSwitches } from '@/db';
import { auditContext } from '@/db/audit';
import { verifyAuth } from '@/lib/auth/authGuard';
import { consumeRateLimit } from '@/lib/rateLimit';
import { UPLOAD_NAME_RE, sniffFile, uploadDir } from '@/lib/uploads';
import { PROFILE_PHOTO_MAX_BYTES } from '@/lib/profile';
import { PayloadTooLargeError, readBoundedFormData } from '@/lib/httpBodyGuard';

export const dynamic = 'force-dynamic';

const PREFIX = '/api/uploads/';

/** Deletes the member's previous photo, if it is one of ours and theirs. */
async function removeOld(current: string | null | undefined, userId: string) {
	if (!current?.startsWith(PREFIX)) return;
	const name = current.slice(PREFIX.length);
	if (!UPLOAD_NAME_RE.test(name)) return;
	const file = await getStoredFile(name);
	if (!file || file.uploaderId !== userId) return;
	await unlink(path.join(uploadDir(), name)).catch(() => {});
	await deleteStoredFile(name);
}

/**
 * Sets the member's profile photo. Same storage as receipts — bytes sniffed,
 * private directory, served through /api/uploads — but marked readable by every
 * member, since photos appear in the directory and on team cards.
 */
export async function POST(request: Request) {
	const emergency = await getEmergencyKillSwitches();
	if (emergency.disableUploads) {
		return NextResponse.json(
			{ error: 'File uploads are temporarily suspended by the emergency security protocol (Kill-Switch).' },
			{ status: 503 }
		);
	}

	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts have read-only access.' }, { status: 403 });
	}
	const limit = consumeRateLimit(`avatar:${auth.user.id}`, 10, 60 * 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many photo updates. Please try again later.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}
	let file: FormDataEntryValue | null;
	try {
		file = (await readBoundedFormData(request, PROFILE_PHOTO_MAX_BYTES + 128 * 1024)).get('file');
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Photo cannot exceed 2 MB.' }, { status: 413 });
		}
		return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
	}
	if (!(file instanceof File)) return NextResponse.json({ error: 'Select a photo.' }, { status: 400 });
	if (file.size > PROFILE_PHOTO_MAX_BYTES) return NextResponse.json({ error: 'Photo cannot exceed 2 MB.' }, { status: 413 });
	const buffer = Buffer.from(await file.arrayBuffer());
	const sniffed = sniffFile(buffer);
	if (!sniffed || sniffed.mime === 'application/pdf') {
		return NextResponse.json({ error: 'Only JPEG, PNG, or WEBP photos can be uploaded.' }, { status: 415 });
	}
	const name = `${Date.now()}_${randomBytes(9).toString('hex')}${sniffed.ext}`;
	await mkdir(uploadDir(), { recursive: true });
	await writeFile(path.join(uploadDir(), name), buffer, { flag: 'wx' });
	await addStoredFile({ name: name, uploaderId: auth.user.id, mime: sniffed.mime, size: buffer.length, everyoneOpen: true });
	await updateUserProfile(auth.user.id, { profilePhoto: `${PREFIX}${name}` }, auditContext(request, auth.user));
	await removeOld(auth.user.profilePhoto, auth.user.id);
	return NextResponse.json({ success: true, profilePhoto: `${PREFIX}${name}` });
}

export async function DELETE(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	await updateUserProfile(auth.user.id, { profilePhoto: null }, auditContext(request, auth.user));
	await removeOld(auth.user.profilePhoto, auth.user.id);
	return NextResponse.json({ success: true });
}
