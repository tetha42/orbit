import { NextResponse } from 'next/server';
import { getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/server/databaseAccess';
import { clientAddress } from '@/lib/http';
import { inspectDatabaseSql, maskDatabaseRow, DB_SENSITIVE_COLUMNS } from '@/lib/waf';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { recordSecurityStrike } from '@/db/repositories/security.repo';

function detectDangerousQuery(query: string): { dangerous: boolean; reason?: string; command?: string; table?: string } {
	const cleaned = query.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, '').trim();

	// Check DROP TABLE
	if (/\bDROP\s+TABLE\b/i.test(cleaned)) {
		const m = cleaned.match(/\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?([a-zA-Z0-9_]+)["']?/i);
		return {
			dangerous: true,
			reason: 'Bu sorgu bir veya daha fazla tabloyu tamamen silecektir (DROP TABLE).',
			command: 'DROP TABLE',
			table: m ? m[1] : undefined,
		};
	}

	// Check TRUNCATE
	if (/\bTRUNCATE\s+(?:TABLE\s+)?/i.test(cleaned)) {
		const m = cleaned.match(/\bTRUNCATE\s+(?:TABLE\s+)?["']?([a-zA-Z0-9_]+)["']?/i);
		return {
			dangerous: true,
			reason: 'Bu sorgu tablodaki tüm verileri kalıcı olarak sıfırlayacaktır (TRUNCATE).',
			command: 'TRUNCATE',
			table: m ? m[1] : undefined,
		};
	}

	// Check DELETE without WHERE
	if (/\bDELETE\s+FROM\b/i.test(cleaned) && !/\bWHERE\b/i.test(cleaned)) {
		const m = cleaned.match(/\bDELETE\s+FROM\s+["']?([a-zA-Z0-9_]+)["']?/i);
		return {
			dangerous: true,
			reason: 'Bu sorgu WHERE koşulu içermeyen bir DELETE komutudur ve tablodaki TÜM satırları silecektir.',
			command: 'DELETE (Tüm Tablo)',
			table: m ? m[1] : undefined,
		};
	}

	// Check UPDATE without WHERE
	if (/\bUPDATE\s+["']?[a-zA-Z0-9_]+["']?\s+SET\b/i.test(cleaned) && !/\bWHERE\b/i.test(cleaned)) {
		const m = cleaned.match(/\bUPDATE\s+["']?([a-zA-Z0-9_]+)["']?\s+SET\b/i);
		return {
			dangerous: true,
			reason: 'Bu sorgu WHERE koşulu içermeyen bir UPDATE komutudur ve tablodaki TÜM satırları değiştirecektir.',
			command: 'UPDATE (Tüm Tablo)',
			table: m ? m[1] : undefined,
		};
	}

	return { dangerous: false };
}

export async function POST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const ip = clientAddress(request);
	const body = await request.json().catch(() => ({}));
	const query = String(body.query || '').trim();
	const bypassSafeMode = Boolean(body.bypassSafeMode);
	const isExplain = Boolean(body.explain);

	if (!query) {
		return NextResponse.json({ error: 'SQL sorgusu boş olamaz.' }, { status: 400 });
	}

	// 0. Zero-Trust SQL Guard: forbid OS primitives, protected table mutations, sensitive column projections, and EXPLAIN transaction breakouts
	const sqlGuard = inspectDatabaseSql(query, { isExplain });
	if (!sqlGuard.allowed) {
		await logSystemEvent({
			servis: 'security',
			seviye: 'ERROR',
			mesaj: `Engellenen SQL sorgusu (${sqlGuard.reason || 'Güvenlik politikası'}): ${auth.user.email}`,
			detay: { sorguOzeti: query.slice(0, 200), isExplain },
			userId: auth.user.id,
			ip,
		});
		if (sqlGuard.strikePoints > 0) {
			void recordSecurityStrike({
				ip,
				points: sqlGuard.strikePoints,
				reason: sqlGuard.reason || 'Yasaklı SQL sorgusu denemesi',
				path: '/api/database/query',
				userId: auth.user.id,
			});
		}
		return NextResponse.json(
			{ error: sqlGuard.reason || 'Bu SQL sorgusu güvenlik politikası tarafından engellendi.' },
			{ status: 403 }
		);
	}

	// 1. Safe Mode validation
	if (!bypassSafeMode && !isExplain) {
		const dangerCheck = detectDangerousQuery(query);
		if (dangerCheck.dangerous) {
			return NextResponse.json({
				requiresSafeConfirmation: true,
				safeReason: dangerCheck.reason,
				dangerousCommand: dangerCheck.command,
				targetTable: dangerCheck.table,
			});
		}
	}

	const pool = getPgPool();
	const startTime = performance.now();

	try {
		// 2. Handle EXPLAIN execution inside a strict READ ONLY rolled-back transaction
		if (isExplain) {
			const client = await pool.connect();
			try {
				await client.query('BEGIN TRANSACTION READ ONLY');
				const targetSql = sqlGuard.normalizedExplainTarget || query;
				const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${targetSql}`;
				const result = await client.query(explainSql);
				await client.query('ROLLBACK');
				const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
				const plan = result.rows[0]?.['QUERY PLAN'] || result.rows[0];

				return NextResponse.json({
					success: true,
					isExplain: true,
					command: 'EXPLAIN',
					explainPlan: plan,
					durationMs,
				});
			} finally {
				await client.query('ROLLBACK').catch(() => {});
				client.release();
			}
		}

		// 3. Normal Query execution inside strict READ ONLY transaction with mandatory 8-second statement_timeout
		const client = await pool.connect();
		let result;
		try {
			await client.query('BEGIN TRANSACTION READ ONLY');
			await client.query('SET LOCAL statement_timeout = 8000');
			result = await client.query(query);
			await client.query('COMMIT');
		} catch (qErr) {
			await client.query('ROLLBACK').catch(() => {});
			throw qErr;
		} finally {
			client.release();
		}
		const durationMs = Math.round((performance.now() - startTime) * 10) / 10;

		const fields = (result.fields || []).map((f) => ({
			name: f.name,
			dataTypeID: f.dataTypeID,
		}));

		// Deny-list and mask sensitive columns from query results
		const rows = (result.rows || []).map((r) => {
			if (!r || typeof r !== 'object') return r;
			const clean = { ...(r as Record<string, unknown>) };
			for (const k of Object.keys(clean)) {
				const lower = k.toLowerCase();
				if (DB_SENSITIVE_COLUMNS.has(lower) || DB_SENSITIVE_COLUMNS.has(lower.replace(/_/g, ''))) {
					clean[k] = '[REDACTED]';
				}
			}
			return maskDatabaseRow(clean);
		});

		await logSystemEvent({
			servis: 'database',
			seviye: 'INFO',
			mesaj: 'Özel SQL sorgusu çalıştırıldı',
			detay: {
				komut: result.command,
				etkilenenSatir: result.rowCount,
				sureMs: durationMs,
				sorguOzeti: query.slice(0, 200),
				safeModeBypassed: bypassSafeMode,
			},
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json({
			success: true,
			command: result.command,
			rowCount: result.rowCount ?? rows.length,
			fields,
			rows,
			durationMs,
		});
	} catch (error) {
		const durationMs = Math.round((performance.now() - startTime) * 10) / 10;
		const err = error as Error;

		await logSystemEvent({
			servis: 'database',
			seviye: 'WARN',
			mesaj: 'Özel SQL sorgusu hatayla sonuçlandı',
			detay: {
				hata: err.message,
				sorguOzeti: query.slice(0, 200),
				sureMs: durationMs,
			},
			userId: auth.user.id,
			ip,
		});

		return NextResponse.json(
			{
				error: err.message || 'Sorgu çalıştırılırken bir hata oluştu.',
				durationMs,
			},
			{ status: 400 }
		);
	}
}
