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
	const service = searchParams.get('service') || undefined;
	const serviceOp = (searchParams.get('serviceOp') as 'eq' | 'neq') || undefined;
	const level = searchParams.get('level') || undefined;
	const levelOp = (searchParams.get('levelOp') as 'eq' | 'neq') || undefined;
	const ip = searchParams.get('ip') || undefined;
	const ipOp = (searchParams.get('ipOp') as 'eq' | 'neq' | 'contains' | 'not_contains') || undefined;
	const search = searchParams.get('search') || undefined;
	const searchOp = (searchParams.get('searchOp') as FilterOperator) || undefined;
	const searchField = (searchParams.get('searchField') as FilterColumn) || undefined;
	const timeRange = (searchParams.get('timeRange') as TimeRangePreset | null) || undefined;
	const startTime = searchParams.get('startTime') ? Number(searchParams.get('startTime')) : undefined;
	const endTime = searchParams.get('endTime') ? Number(searchParams.get('endTime')) : undefined;
	const limit = Math.min(5000, Math.max(1, parseInt(searchParams.get('limit') || '1000', 10)));

	try {
		const logs = await getSystemLogs({
			service,
			serviceOp,
			level,
			levelOp,
			ip,
			ipOp,
			search,
			searchOp,
			searchField,
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
			const timeStr = new Date(log.time).toISOString();
			return [
				escapeCsvField(log.id),
				escapeCsvField(timeStr),
				escapeCsvField(log.level),
				escapeCsvField(log.service),
				escapeCsvField(log.message),
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
