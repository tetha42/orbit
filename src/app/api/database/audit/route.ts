import { NextResponse } from 'next/server';
import { getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/lib/server/databaseAccess';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import type { AuditRecord } from '@/apps/database/types';

const SENSITIVE_COLUMNS = new Set(['sifrehash', 'totpsecret', 'aktifoturumtoken', 'totprecoverycodes']);

export async function GET(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const pool = getPgPool();

	try {
		const res = await pool.query<AuditRecord>(`
			SELECT
				id,
				zaman,
				"yapanId",
				"yapanAd",
				islem,
				"hedefTur",
				"hedefId",
				"hedefAd",
				onceki,
				sonraki,
				ip
			FROM denetim_kaydi
			WHERE "hedefTur" = 'database_table'
			ORDER BY zaman DESC
			LIMIT 100;
		`);

		return NextResponse.json({ records: res.rows });
	} catch (error) {
		console.error('API /api/database/audit error:', error);
		return NextResponse.json({ records: [] });
	}
}

export async function POST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const body = await request.json().catch(() => ({}));
	const auditId = Number(body.auditId);

	if (!auditId || isNaN(auditId)) {
		return NextResponse.json({ error: 'Geçersiz denetim kaydı ID.' }, { status: 400 });
	}

	const pool = getPgPool();

	try {
		const checkRes = await pool.query<{
			id: number;
			hedefId: string;
			onceki: Record<string, unknown> | null;
		}>(
			`SELECT id, "hedefId", onceki FROM denetim_kaydi WHERE id = $1 AND "hedefTur" = 'database_table'`,
			[auditId]
		);

		if (checkRes.rows.length === 0) {
			return NextResponse.json({ error: 'Geri alınacak denetim kaydı bulunamadı.' }, { status: 404 });
		}

		const rec = checkRes.rows[0];
		const table = rec.hedefId;
		const onceki = rec.onceki || {};

		const pkCol = String(onceki.pkCol || '');
		const pkVal = onceki.pkVal;

		if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
			return NextResponse.json({ error: 'Geçersiz hedef tablo.' }, { status: 400 });
		}

		if (!pkCol || !/^[a-zA-Z0-9_]+$/.test(pkCol) || pkVal === undefined) {
			return NextResponse.json({ error: 'Birincil anahtar bilgisi eksik, geri alınamaz.' }, { status: 400 });
		}

		const setClauses: string[] = [];
		const params: unknown[] = [];

		for (const [key, val] of Object.entries(onceki)) {
			if (key === 'pkCol' || key === 'pkVal') continue;
			if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
			if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue;

			params.push(val);
			setClauses.push(`"${key}" = $${params.length}`);
		}

		if (setClauses.length === 0) {
			return NextResponse.json({ error: 'Geri yüklenecek eski değer bulunamadı.' }, { status: 400 });
		}

		params.push(pkVal);
		const revertSql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE "${pkCol}" = $${params.length}`;
		await pool.query(revertSql, params);

		await logSystemEvent({
			servis: 'database',
			seviye: 'WARN',
			mesaj: `Denetim kaydı geri alındı (#${auditId} on ${table})`,
			detay: { auditId, tablo: table, pkVal },
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			message: `'${table}' tablosundaki kayıt (#${auditId}) başarıyla eski haline döndürüldü.`,
		});
	} catch (error) {
		console.error(`Geri alma hatası (audit #${auditId}):`, error);
		const msg = error instanceof Error ? error.message : 'Geri alma işlemi sırasında bir hata oluştu.';
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
