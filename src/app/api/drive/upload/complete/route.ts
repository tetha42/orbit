import { NextResponse } from 'next/server';
import { completeChunkedDriveUpload } from '@/domains/drive/service';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const uploadId = String(body.uploadId || '').trim();
	if (!uploadId) {
		return NextResponse.json({ error: 'uploadId is required.' }, { status: 400, headers: NO_CACHE });
	}

	const res = await completeChunkedDriveUpload({
		uploadId,
		userId: auth.user.id,
	});
	if (!res.ok) {
		return NextResponse.json({ error: res.code, code: res.code }, { status: res.status, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true, item: res.item }, { status: 201, headers: NO_CACHE });
}

export const POST = withAudit(handlePOST, {
	action: 'drive.upload.complete',
	target: 'drive.item',
});
