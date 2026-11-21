import { NextResponse } from 'next/server';
import {
	createDriveFolder,
	listAllUserFolders,
	listDriveFolders,
} from '@/domains/drive/repo';
import { sanitizeDriveName } from '@/domains/drive/validators';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	if (searchParams.get('all') === '1') {
		const folders = await listAllUserFolders(auth.user.id);
		return NextResponse.json({ ok: true, folders }, { headers: NO_CACHE });
	}
	const parentId = searchParams.get('parentId')?.trim() || null;
	const includeTrashed = searchParams.get('trash') === '1';
	const folders = await listDriveFolders(auth.user.id, parentId, includeTrashed);
	return NextResponse.json({ ok: true, folders }, { headers: NO_CACHE });
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const name = sanitizeDriveName(body.name);
	if (!name) {
		return NextResponse.json({ error: 'Folder name is required.' }, { status: 400, headers: NO_CACHE });
	}
	const parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null;
	const folder = await createDriveFolder({ ownerId: auth.user.id, parentId, name });
	return NextResponse.json({ ok: true, folder }, { status: 201, headers: NO_CACHE });
}

export const POST = withAudit(handlePOST, {
	action: 'drive.folder.create',
	target: 'drive.folder',
});
