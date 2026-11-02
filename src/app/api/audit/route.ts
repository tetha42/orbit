import { NextResponse } from 'next/server';
import { authenticate, can, requireAdmin } from '@/lib/auth/access';
import { listAuditLogs } from '@/db/audit';
import { AUDIT_CSV_LIMIT, suzgecOku } from '@/lib/audit';

/**
 * The audit log — Settings → Roller → Değişiklik geçmişi. Read-only and only
 * for system administrators (the people who manage roles).
 *
 *   GET /api/denetim?kisi=&role=&islem=&from=YYYY-MM-DD&to=YYYY-MM-DD&sayfa=1&boyut=50
 *   GET /api/denetim?…&tum=1   — every matching record, no paging (up to DENETIM_CSV_SINIRI), for the CSV download
 */
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.authorized) return auth.response;
	if (!auth.user.permission.admin && !can(auth.user, 'soc', 'yonet') && !can(auth.user, 'settings', 'yonet')) {
		return NextResponse.json({ error: 'Bu kayıt için yönetim yetkisi gerekir.' }, { status: 403 });
	}

	try {
		const params = new URL(request.url).searchParams;
		const suzgec = suzgecOku(params);
		const tum = params.get('tum') === '1' || params.get('all') === '1';
		const { kayitlar, toplam } = await listAuditLogs(suzgec, tum ? { limit: AUDIT_CSV_LIMIT, offset: 0 } : {});
		const page = tum ? 1 : suzgec.sayfa;
		const pageSize = tum ? AUDIT_CSV_LIMIT : suzgec.boyut;
		return NextResponse.json(
			{
				records: kayitlar,
				total: toplam,
				page,
				pageSize,
				kayitlar,
				toplam,
				sayfa: page,
				boyut: pageSize,
			},
			{ headers: { 'Cache-Control': 'no-store' } }
		);
	} catch (error) {
		console.error('API /api/denetim GET error:', error);
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
			servis: 'security',
			seviye: 'WARN',
			mesaj: `Denetim geçmişi (denetim_kaydi) yönetici tarafından sıfırlandı: ${auth.user.email}`,
			detay: { yapanId: auth.user.id, yapanAd: `${auth.user.ad} ${auth.user.soyad}`.trim() },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({ ok: true, message: 'Değişiklik geçmişi temizlendi.' });
	} catch (error) {
		console.error('API /api/denetim DELETE error:', error);
		return NextResponse.json({ error: 'Değişiklik geçmişi temizlenemedi.' }, { status: 500 });
	}
}
