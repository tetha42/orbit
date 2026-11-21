import { NextResponse } from 'next/server';
import { writeDriveUploadChunk } from '@/domains/drive/service';
import { DRIVE_CHUNK_BYTES } from '@/domains/drive/validators';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

// audit:exempt: drive-chunk-stream
export async function PUT(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const uploadId = (searchParams.get('uploadId') || '').trim();
	const chunkIndex = Number(searchParams.get('index') || '0');

	const arrayBuf = await request.arrayBuffer().catch(() => null);
	if (!arrayBuf || arrayBuf.byteLength > DRIVE_CHUNK_BYTES + 1024) {
		return NextResponse.json({ error: 'Invalid chunk size.' }, { status: 413, headers: NO_CACHE });
	}

	const res = await writeDriveUploadChunk({
		uploadId,
		userId: auth.user.id,
		chunkIndex,
		bytes: Buffer.from(arrayBuf),
	});
	if (!res.ok) {
		return NextResponse.json({ error: res.code, code: res.code }, { status: res.status, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}
