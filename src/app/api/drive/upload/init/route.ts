import { NextResponse } from 'next/server';
import { getSystemSetting } from '@/db/repositories/settings.repo';
import { initChunkedDriveUpload } from '@/domains/drive/service';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const disableUploads = await getSystemSetting('security_disable_uploads');
	if (disableUploads === 'true' || disableUploads === '1') {
		return NextResponse.json(
			{ error: 'Uploads are currently disabled by security policy.' },
			{ status: 403, headers: NO_CACHE }
		);
	}

	const rl = consumeRateLimit(`drive:upload:init:${auth.user.id}`, 40, 60_000);
	if (!rl.allowed) {
		return NextResponse.json(
			{ error: 'Too many uploads. Please wait.' },
			{ status: 429, headers: { ...NO_CACHE, 'Retry-After': String(rl.retryAfter) } }
		);
	}

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const res = await initChunkedDriveUpload({
		userId: auth.user.id,
		fileName: String(body.fileName || ''),
		mimeType: String(body.mimeType || 'application/octet-stream'),
		totalBytes: Number(body.totalBytes || 0),
		folderId: typeof body.folderId === 'string' && body.folderId.trim() ? body.folderId.trim() : null,
	});
	if (!res.ok) {
		return NextResponse.json({ error: res.code, code: res.code }, { status: res.status, headers: NO_CACHE });
	}
	return NextResponse.json(res, { headers: NO_CACHE });
}

export const POST = withAudit(handlePOST, {
	action: 'drive.upload.init',
	target: 'drive.upload',
});
