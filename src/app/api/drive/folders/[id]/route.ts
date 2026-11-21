import { NextResponse } from 'next/server';
import { deleteDriveFolderPermanently, updateDriveFolder } from '@/domains/drive/repo';
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
	const patch: { name?: string; parentId?: string | null; isTrashed?: boolean } = {};
	if (body.name !== undefined) {
		const clean = sanitizeDriveName(body.name);
		if (!clean) {
			return NextResponse.json({ error: 'Invalid folder name.' }, { status: 400, headers: NO_CACHE });
		}
		patch.name = clean;
	}
	if (body.parentId !== undefined) {
		patch.parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null;
	}
	if (typeof body.isTrashed === 'boolean') {
		patch.isTrashed = body.isTrashed;
	}

	const folder = await updateDriveFolder(id, auth.user.id, patch);
	if (!folder) {
		return NextResponse.json({ error: 'Folder not found.' }, { status: 404, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true, folder }, { headers: NO_CACHE });
}

async function handleDELETE(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { id } = await context.params;
	const ok = await deleteDriveFolderPermanently(id, auth.user.id);
	if (!ok) {
		return NextResponse.json({ error: 'Folder not found.' }, { status: 404, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}

export const PATCH = withAudit(handlePATCH, {
	action: 'drive.folder.update',
	target: 'drive.folder',
});

export const DELETE = withAudit(handleDELETE, {
	action: 'drive.folder.delete',
	target: 'drive.folder',
});
