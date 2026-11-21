import { NextResponse } from 'next/server';
import { listDriveFolders, listDriveItems } from '@/domains/drive/repo';
import { normalizeDriveView } from '@/domains/drive/validators';
import { requireApp } from '@/lib/auth/access';
import { getUserStorageBreakdown } from '@/server/storage/quota';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const view = normalizeDriveView(searchParams.get('view'));
	const folderId = searchParams.get('folderId')?.trim() || null;
	const q = searchParams.get('q')?.trim() || '';

	const [items, folders, storage] = await Promise.all([
		listDriveItems({
			userId: auth.user.id,
			roleId: auth.user.roleId ?? '',
			view,
			folderId,
			q,
		}),
		view === 'my' && !q
			? listDriveFolders(auth.user.id, folderId, false)
			: view === 'trash' && !q
			? listDriveFolders(auth.user.id, null, true)
			: Promise.resolve([]),
		getUserStorageBreakdown(auth.user.id),
	]);

	return NextResponse.json(
		{
			ok: true,
			view,
			folderId,
			folders,
			items,
			storage,
		},
		{ headers: NO_CACHE }
	);
}
