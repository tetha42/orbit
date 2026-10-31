import { NextResponse } from 'next/server';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { addStoredFile, deleteStoredFile, getStoredFile, updateUserProfile, getEmergencyKillSwitches } from '@/db';
import { auditContext } from '@/db/audit';
import { verifyAuth } from '@/lib/auth/authGuard';
import { consumeRateLimit } from '@/lib/rateLimit';
import { UPLOAD_NAME_RE, sniffFile, uploadDir } from '@/lib/uploads';
import { PROFIL_FOTO_MAX_BYTES } from '@/lib/profile';

export const dynamic = 'force-dynamic';

const PREFIX = '/api/uploads/';

/** Deletes the member's previous photo, if it is one of ours and theirs. */
async function removeOld(current: string | null | undefined, userId: string) {
	if (!current?.startsWith(PREFIX)) return;
	const name = current.slice(PREFIX.length);
	if (!UPLOAD_NAME_RE.test(name)) return;
	const dosya = await getStoredFile(name);
	if (!dosya || dosya.yukleyenId !== userId) return;
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
			{ error: 'Dosya yüklemeleri acil status güvenlik protokolü (Kill-Switch) nedeniyle geçici olarak durdurulmuştur.' },
			{ status: 503 }
		);
	}

	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}
	const limit = consumeRateLimit(`avatar:${auth.user.id}`, 10, 60 * 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Çok sık fotoğraf değiştirdiniz. Biraz sonra tekrar deneyin.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}
	let file: FormDataEntryValue | null;
	try {
		file = (await request.formData()).get('file');
	} catch {
		return NextResponse.json({ error: 'Geçersiz yükleme isteği.' }, { status: 400 });
	}
	if (!(file instanceof File)) return NextResponse.json({ error: 'Bir fotoğraf seçin.' }, { status: 400 });
	if (file.size > PROFIL_FOTO_MAX_BYTES) return NextResponse.json({ error: 'Fotoğraf 2 MB sınırını aşamaz.' }, { status: 413 });
	const buffer = Buffer.from(await file.arrayBuffer());
	const sniffed = sniffFile(buffer);
	if (!sniffed || sniffed.mime === 'application/pdf') {
		return NextResponse.json({ error: 'Yalnızca JPEG, PNG veya WEBP fotoğraf yüklenebilir.' }, { status: 415 });
	}
	const name = `${Date.now()}_${randomBytes(9).toString('hex')}${sniffed.ext}`;
	await mkdir(uploadDir(), { recursive: true });
	await writeFile(path.join(uploadDir(), name), buffer, { flag: 'wx' });
	await addStoredFile({ ad: name, yukleyenId: auth.user.id, mime: sniffed.mime, boyut: buffer.length, herkeseAcik: true });
	await updateUserProfile(auth.user.id, { profilFoto: `${PREFIX}${name}` }, auditContext(request, auth.user));
	await removeOld(auth.user.profilFoto, auth.user.id);
	return NextResponse.json({ success: true, profilFoto: `${PREFIX}${name}` });
}

export async function DELETE(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	await updateUserProfile(auth.user.id, { profilFoto: null }, auditContext(request, auth.user));
	await removeOld(auth.user.profilFoto, auth.user.id);
	return NextResponse.json({ success: true });
}
