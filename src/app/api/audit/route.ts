import { NextResponse } from 'next/server';
import { authenticate, can, requireAdmin } from '@/lib/auth/access';
import { listAuditLogs } from '@/db/audit';
import { AUDIT_CSV_LIMIT, parseAuditFilter } from '@/lib/audit';

/**
 * The audit log — Settings → Roller → Değişiklik geçmişi. Read-only and only
 * for system administrators (the people who manage roles).
 *
 *   GET /api/audit?user=&role=&action=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&pageSize=50
 *   GET /api/audit?…&all=1   — every matching record, no paging (up to AUDIT_CSV_LIMIT), for the CSV download
 */
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;
	if (!auth.user.permission.admin && !can(auth.user, 'soc', 'manage') && !can(auth.user, 'settings', 'manage')) {
		return NextResponse.json({ error: 'Bu kayıt için yönetim yetkisi gerekir.' }, { status: 403 });
	}

	try {
		const params = new URL(request.url).searchParams;
		const filter = parseAuditFilter(params);
		const all = params.get('all') === '1';
		const { records, total } = await listAuditLogs(filter, all ? { limit: AUDIT_CSV_LIMIT, offset: 0 } : {});
		const page = all ? 1 : filter.page;
		const pageSize = all ? AUDIT_CSV_LIMIT : filter.pageSize;
		return NextResponse.json(
			{
				records,
				total,
				page,
				pageSize,
			},
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('API /api/audit GET error:', error);
		return NextResponse.json({ error: 'Değişiklik geçmişi okunamadı.' }, { status: 500 });
	}
}

export async function POST() {
	return NextResponse.json({ error: 'Bu kayıt salt okunurdur.' }, { status: 405 });
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	try {
		const { resetAuditLogs } = await import('@/db/audit');
		const { clientAddress } = await import('@/lib/http');
		const { logSystemEvent } = await import('@/db/repositories/logs.repo');
		const ip = clientAddress(request);

		await resetAuditLogs();
		await logSystemEvent({
			service: 'security',
			level: 'WARN',
			message: `Denetim geçmişi (audit_logs) yönetici tarafından sıfırlandı: ${auth.user.email}`,
			detail: { actorId: auth.user.id, actorName: `${auth.user.name} ${auth.user.surname}`.trim() },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({ ok: true, message: 'Değişiklik geçmişi temizlendi.' });
	} catch (error) {
		console.error('API /api/audit DELETE error:', error);
		return NextResponse.json({ error: 'Değişiklik geçmişi temizlenemedi.' }, { status: 500 });
	}
}
