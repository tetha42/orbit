import { NextResponse } from 'next/server';
import {
	getOrganizationStorageOverview,
	removeStorageQuotaOverride,
	upsertStorageQuota,
} from '@/domains/drive/quotasRepo';
import { normalizeQuotaScope } from '@/domains/drive/validators';
import { withAudit } from '@/lib/audit/withAudit';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
	const auth = await requireApp(request, 'drive', 'manage');
	if (!auth.authorized) return auth.response;

	const overview = await getOrganizationStorageOverview();
	return NextResponse.json({ ok: true, ...overview }, { headers: NO_CACHE });
}

async function handlePUT(request: Request) {
	const auth = await requireApp(request, 'drive', 'manage');
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const scopeType = normalizeQuotaScope(body.scopeType);
	const scopeId = typeof body.scopeId === 'string' ? body.scopeId.trim() : '';
	const quotaBytes = Number(body.quotaBytes);

	if (!scopeType || (scopeType !== 'global' && !scopeId)) {
		return NextResponse.json({ error: 'Invalid quota scope.' }, { status: 400, headers: NO_CACHE });
	}
	if (!Number.isFinite(quotaBytes) || (quotaBytes < 0 && quotaBytes !== -1)) {
		return NextResponse.json({ error: 'Invalid quotaBytes value.' }, { status: 400, headers: NO_CACHE });
	}

	const quota = await upsertStorageQuota({
		scopeType,
		scopeId,
		quotaBytes: Math.trunc(quotaBytes),
		updatedBy: auth.user.id,
	});
	return NextResponse.json({ ok: true, quota }, { headers: NO_CACHE });
}

async function handleDELETE(request: Request) {
	const auth = await requireApp(request, 'drive', 'manage');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const scopeType = normalizeQuotaScope(searchParams.get('scopeType'));
	const scopeId = searchParams.get('scopeId')?.trim() || '';
	if (!scopeType || (scopeType !== 'global' && !scopeId)) {
		return NextResponse.json({ error: 'Invalid quota scope.' }, { status: 400, headers: NO_CACHE });
	}
	const removed = await removeStorageQuotaOverride(scopeType, scopeId);
	return NextResponse.json({ ok: true, removed }, { headers: NO_CACHE });
}

export const PUT = withAudit(handlePUT, {
	action: 'drive.quota.update',
	target: 'drive.quota',
});

export const DELETE = withAudit(handleDELETE, {
	action: 'drive.quota.delete',
	target: 'drive.quota',
});
