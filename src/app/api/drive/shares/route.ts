import { NextResponse } from 'next/server';
import { addDriveShare, deleteDriveShare, listDriveShares } from '@/domains/drive/sharesRepo';
import { normalizeSharePermission } from '@/domains/drive/validators';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const itemId = searchParams.get('itemId')?.trim() || null;
	const folderId = searchParams.get('folderId')?.trim() || null;
	const shares = await listDriveShares(auth.user.id, itemId, folderId);
	return NextResponse.json({ ok: true, shares }, { headers: NO_CACHE });
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const itemId = typeof body.itemId === 'string' && body.itemId.trim() ? body.itemId.trim() : null;
	const folderId = typeof body.folderId === 'string' && body.folderId.trim() ? body.folderId.trim() : null;
	const targetUserId =
		typeof body.targetUserId === 'string' && body.targetUserId.trim() ? body.targetUserId.trim() : null;
	const targetRoleId =
		typeof body.targetRoleId === 'string' && body.targetRoleId.trim() ? body.targetRoleId.trim() : null;

	if ((!itemId && !folderId) || (!targetUserId && !targetRoleId)) {
		return NextResponse.json({ error: 'Share target and item/folder are required.' }, { status: 400, headers: NO_CACHE });
	}
	const permission = normalizeSharePermission(body.permission);
	const id = await addDriveShare({
		ownerId: auth.user.id,
		itemId,
		folderId,
		targetUserId,
		targetRoleId,
		permission,
	});
	return NextResponse.json({ ok: true, id }, { status: 201, headers: NO_CACHE });
}

async function handleDELETE(request: Request) {
	const auth = await requireApp(request, 'drive', 'use');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const shareId = searchParams.get('id')?.trim() || '';
	if (!shareId) {
		return NextResponse.json({ error: 'id is required.' }, { status: 400, headers: NO_CACHE });
	}
	const ok = await deleteDriveShare(shareId, auth.user.id);
	if (!ok) {
		return NextResponse.json({ error: 'Share not found.' }, { status: 404, headers: NO_CACHE });
	}
	return NextResponse.json({ ok: true }, { headers: NO_CACHE });
}

export const POST = withAudit(handlePOST, {
	action: 'drive.share.create',
	target: 'drive.share',
});

export const DELETE = withAudit(handleDELETE, {
	action: 'drive.share.delete',
	target: 'drive.share',
});
