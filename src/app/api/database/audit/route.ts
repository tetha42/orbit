import { NextResponse } from 'next/server';
import { getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/server/databaseAccess';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import type { AuditRecord } from '@/apps/database/types';

const SENSITIVE_COLUMNS = new Set([
	'password_hash',
	'passwordhash',
	'sifrehash',
	'totp_secret',
	'totpsecret',
	'session_token',
	'sessiontoken',
	'aktifoturumtoken',
	'totp_recovery_codes',
	'totprecoverycodes',
	'secret_hash',
	'secrethash',
	'smtp_pass',
]);

export async function GET(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const pool = getPgPool();

	try {
		const res = await pool.query<AuditRecord>(`
			SELECT
				id,
				timestamp AS timestamp,
				actor_id AS "actorId",
				actor_name AS "actorName",
				action AS action,
				target_type AS "targetType",
				target_id AS "targetId",
				target_name AS "targetName",
				before_state AS before,
				after_state AS after,
				ip
			FROM audit_logs
			WHERE target_type = 'database_table'
			ORDER BY timestamp DESC
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
	const auditId = String(body.auditId ?? '').trim();

	if (!auditId) {
		return NextResponse.json({ error: 'Geçersiz denetim kaydı ID.' }, { status: 400 });
	}

	const pool = getPgPool();

	try {
		const checkRes = await pool.query<{
			id: string;
			targetId: string;
			before: Record<string, unknown> | string | null;
		}>(
			`SELECT id, target_id AS "targetId", before_state AS before FROM audit_logs WHERE id = $1 AND target_type = 'database_table'`,
			[auditId]
		);

		if (checkRes.rows.length === 0) {
			return NextResponse.json({ error: 'Geri alınacak denetim kaydı bulunamadı.' }, { status: 404 });
		}

		const rec = checkRes.rows[0];
		const table = rec.targetId;
		const previous = (typeof rec.before === 'string' ? JSON.parse(rec.before) : rec.before) || {};

		const pkCol = String(previous.pkCol || '');
		const pkVal = previous.pkVal;

		if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
			return NextResponse.json({ error: 'Geçersiz hedef tablo.' }, { status: 400 });
		}

		if (!pkCol || !/^[a-zA-Z0-9_]+$/.test(pkCol) || pkVal === undefined) {
			return NextResponse.json({ error: 'Birincil anahtar bilgisi eksik, geri alınamaz.' }, { status: 400 });
		}

		const setClauses: string[] = [];
		const params: unknown[] = [];

		for (const [key, val] of Object.entries(previous)) {
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
