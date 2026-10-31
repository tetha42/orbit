import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import { addStoredFile } from '@/db';
import { verifyUploadAccess } from '@/lib/kasaAccess';
import { consumeRateLimit } from '@/lib/rateLimit';
import { MAX_UPLOAD_BYTES, sniffFile, uploadDir } from '@/lib/uploads';
import { getEmergencyKillSwitches } from '@/server/db/domains/security.repo';

/**
 * Receipt upload.
 *
 * Only people who keep a kasa (management, project leaders) may upload. What is
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
				{ error: 'Dosya yüklemeleri acil status güvenlik protokolü (Kill-Switch) nedeniyle geçici olarak durdurulmuştur.' },
				{ status: 503 }
			);
		}

		const access = await verifyUploadAccess(request);
		if (!access.authorized) return access.response;

		const limit = consumeRateLimit(`upload:${access.user.id}`, 20, 60_000);
		if (!limit.allowed) {
			return NextResponse.json(
				{ error: 'Çok fazla yükleme yaptınız. Biraz sonra tekrar deneyin.' },
				{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
			);
		}

		let formData: FormData;
		try {
			formData = await request.formData();
		} catch {
			return NextResponse.json({ error: 'Geçersiz yükleme isteği.' }, { status: 400 });
		}

		const file = formData.get('file');
		if (!(file instanceof File)) {
			return NextResponse.json({ error: 'Lütfen yüklenecek bir dosya seçiniz.' }, { status: 400 });
		}

		if (file.size > MAX_UPLOAD_BYTES) {
			return NextResponse.json({ error: 'Dosya boyutu 10MB sınırını aşamaz.' }, { status: 413 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const sniffed = sniffFile(buffer);
		if (buffer.length === 0 || !sniffed) {
			return NextResponse.json(
				{ error: 'Yalnızca JPEG, PNG, WEBP veya PDF formatında belgeler yüklenebilir.' },
				{ status: 415 }
			);
		}

		const name = `${Date.now()}_${randomBytes(9).toString('hex')}${sniffed.ext}`;
		const dir = uploadDir();
		await mkdir(dir, { recursive: true });
		// `wx` refuses to overwrite: a name collision fails instead of replacing a receipt.
		await writeFile(path.join(dir, name), buffer, { flag: 'wx' });
		await addStoredFile({
			ad: name,
			yukleyenId: access.user.id,
			mime: sniffed.mime,
			boyut: buffer.length,
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
		return NextResponse.json({ error: 'Dosya yüklenirken hata oluştu.' }, { status: 500 });
	}
}

export const POST = withAudit(handlePOST, { action: 'upload.create', target: 'upload' });
