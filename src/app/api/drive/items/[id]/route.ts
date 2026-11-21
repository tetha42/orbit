import { NextResponse } from 'next/server';
import { deleteDriveItemPermanently, updateDriveItem } from '@/domains/drive/repo';
import { sanitizeDriveName } from '@/domains/drive/validators';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

async function handlePATCH(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { id } = await context.params;
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const patch: {
		displayName?: string;
		folderId?: string | null;
		isStarred?: boolean;
		isTrashed?: boolean;
	} = {};

	if (body.displayName !== undefined) {
		const clean = sanitizeDriveName(body.displayName);
		if (!clean) {
			return NextResponse.json({ error: 'Invalid file name.' }, { status: 400, headers: NO_CACHE });
		}
		patch.displayName = clean;
	}
	if (body.folderId !== undefined) {
		patch.folderId = typeof body.folderId === 'string' && body.folderId.trim() ? body.folderId.trim() : null;
	}
	if (typeof body.isStarred === 'boolean') patch.isStarred = body.isStarred;
	if (typeof body.isTrashed === 'boolean') patch.isTrashed = body.isTrashed;

	const item = await updateDriveItem(id, auth.user.id, auth.user.roleId ?? '', patch);
	if (!item) {
		return NextResponse.json({ error: 'Item not found.' }, { status: 404, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true, item }, { headers: NO_CACHE });
}

async function handleDELETE(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { id } = await context.params;
	const ok = await deleteDriveItemPermanently(id, auth.user.id);
	if (!ok) {
		return NextResponse.json({ error: 'Item not found.' }, { status: 404, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}

export const PATCH = withAudit(handlePATCH, {
	action: 'drive.item.update',
	target: 'drive.item',
});

export const DELETE = withAudit(handleDELETE, {
	action: 'drive.item.delete',
	target: 'drive.item',
});
