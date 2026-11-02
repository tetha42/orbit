import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { getSystemLogs, type FilterOperator, type FilterColumn, type TimeRangePreset } from '@/db/repositories/logs.repo';

function escapeCsvField(val: unknown): string {
	if (val === null || val === undefined) return '';
	let str = String(val);
	// OWASP CSV Injection defense: neutralize spreadsheet formula execution
	if (/^[=+\-@\t\r]/.test(str)) {
		str = `'${str}`;
	}
	if (/[",\r\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export async function GET(request: Request) {
	const auth = await requireApp(request, 'soc', 'kullan');
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const format = (searchParams.get('format') || 'csv').trim().toLowerCase();
	const servis = searchParams.get('servis') || undefined;
	const servisOp = (searchParams.get('servisOp') as 'eq' | 'neq') || undefined;
	const seviye = searchParams.get('seviye') || undefined;
	const seviyeOp = (searchParams.get('seviyeOp') as 'eq' | 'neq') || undefined;
	const ip = searchParams.get('ip') || undefined;
	const ipOp = (searchParams.get('ipOp') as 'eq' | 'neq' | 'contains' | 'not_contains') || undefined;
	const arama = searchParams.get('arama') || undefined;
	const aramaOp = (searchParams.get('aramaOp') as FilterOperator) || undefined;
	const aramaAlani = (searchParams.get('aramaAlani') as FilterColumn) || undefined;
	const timeRange = (searchParams.get('timeRange') as TimeRangePreset | null) || undefined;
	const startTime = searchParams.get('startTime') ? Number(searchParams.get('startTime')) : undefined;
	const endTime = searchParams.get('endTime') ? Number(searchParams.get('endTime')) : undefined;
	const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '1000', 10)));

	try {
		const logs = await getSystemLogs({
			servis,
			servisOp,
			seviye,
			seviyeOp,
			ip,
			ipOp,
			arama,
			aramaOp,
			aramaAlani,
			timeRange,
			startTime,
			endTime,
			limit,
		});

		if (format === 'json') {
			return new NextResponse(JSON.stringify(logs, null, 2), {
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Content-Disposition': `attachment; filename="soc-audit-logs-${Date.now()}.json"`,
					'Cache-Control': 'no-store',
				},
			});
		}

		// Default: RFC 4180 CSV
		const header = 'id,zaman,seviye,servis,mesaj,ip,kullanici_id\r\n';
		const rows = logs.map((log) => {
			const zamanStr = new Date(log.zaman).toISOString();
			return [
				escapeCsvField(log.id),
				escapeCsvField(zamanStr),
				escapeCsvField(log.seviye),
				escapeCsvField(log.servis),
				escapeCsvField(log.mesaj),
				escapeCsvField(log.ip),
				escapeCsvField(log.userId ?? ''),
			].join(',');
		});

		const csvContent = header + rows.join('\r\n');

		return new NextResponse(csvContent, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="soc-audit-logs-${Date.now()}.csv"`,
				'Cache-Control': 'no-store',
			},
		});
	} catch (error) {
		console.error('API /api/soc/export error:', error);
		return NextResponse.json({ error: 'Adli kayıtlar dışa aktarılamadı.' }, { status: 500 });
	}
}
