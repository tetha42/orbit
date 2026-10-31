import { NextResponse } from 'next/server';
import { exportCommunityData } from '@/db';
import { requireAdmin } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

const TABLE_KEYS = [
	'users',
	'teams',
	'teamMembers',
	'projects',
	'events',
	'decisions',
	'committeeMeetings',
	'membershipApplications',
	'legalAcceptances',
] as const;

function csvCell(value: unknown): string {
	const text = value === null || value === undefined ? '' : String(value);
	return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
	if (rows.length === 0) return '';
	const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
	return [
		headers.map(csvCell).join(','),
		...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
	].join('\r\n');
}

/** Full portability bundle, or one table as CSV. Admin-only; no credentials or tokens. */
export async function GET(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	const url = new URL(request.url);
	const table = url.searchParams.get('table');
	const data = await exportCommunityData();
	const date = new Date().toISOString().slice(0, 10);

	if (table) {
		if (!TABLE_KEYS.includes(table as (typeof TABLE_KEYS)[number])) {
			return NextResponse.json({ error: 'Geçersiz tablo.' }, { status: 400 });
		}
		const rows = data[table as (typeof TABLE_KEYS)[number]] as Record<string, unknown>[];
		return new NextResponse(toCsv(rows), {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="orbit-${table}-${date}.csv"`,
				'Cache-Control': 'no-store',
			},
		});
	}

	return NextResponse.json(data, {
		headers: {
			'Content-Disposition': `attachment; filename="orbit-export-${date}.json"`,
			'Cache-Control': 'no-store',
		},
	});
}
