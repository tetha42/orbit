import { NextResponse } from 'next/server';
import { withTransaction, getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/lib/server/databaseAccess';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

const SENSITIVE_COLUMNS = new Set([
	'sifrehash',
	'totpsecret',
	'aktifoturumtoken',
	'totprecoverycodes',
	'secrethash',
	'smtp_pass',
]);

const PROTECTED_TABLES = new Set(['sistem_loglari', 'denetim_kaydi', 'guvenlik_engelleri']);
const PROTECTED_SETTINGS_KEYS = new Set(['smtp_pass', 'soc_lockdown_mode', 'soc_lockdown_reason']);

interface ImportBody {
	table?: string;
	rows?: Record<string, unknown>[];
	conflictStrategy?: 'error' | 'upsert' | 'skip';
}

export async function POST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => ({}))) as ImportBody;
	const table = String(body.table || '').trim();
	const rows = Array.isArray(body.rows) ? body.rows : [];
	const conflictStrategy = body.conflictStrategy || 'error';

	if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
		return NextResponse.json({ error: 'Geçersiz tablo adı.' }, { status: 400 });
	}

	const lowerTable = table.toLowerCase();
	if (PROTECTED_TABLES.has(lowerTable)) {
		return NextResponse.json(
			{ error: 'Güvenlik ve denetim tablolarına toplu veri aktarılamaz.' },
			{ status: 403 }
		);
	}

	if (rows.length === 0) {
		return NextResponse.json({ error: 'İçe aktarılacak veri bulunamadı.' }, { status: 400 });
	}

	if (rows.length > 2000) {
		return NextResponse.json({ error: 'Tek seferde en fazla 2000 satır içe aktarılabilir.' }, { status: 400 });
	}

	const pool = getPgPool();

	try {
		// 1. Get column list and primary keys
		const colRes = await pool.query<{ column_name: string }>(`
			SELECT column_name
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1;
		`, [table]);

		if (colRes.rows.length === 0) {
			return NextResponse.json({ error: 'Hedef tablo bulunamadı.' }, { status: 404 });
		}

		const validCols = new Set(colRes.rows.map((r) => r.column_name));

		const pkRes = await pool.query<{ column_name: string }>(`
			SELECT kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			WHERE tc.constraint_type = 'PRIMARY KEY'
				AND tc.table_schema = 'public'
				AND tc.table_name = $1
			ORDER BY kcu.ordinal_position ASC;
		`, [table]);

		const primaryKeys = pkRes.rows.map((r) => r.column_name);
		const pkCol = primaryKeys[0];

		// 2. Perform batch insert inside a single transaction
		let affectedCount = 0;

		await withTransaction(async (client) => {
			for (const r of rows) {
				if (lowerTable === 'sistem_ayarlari' && PROTECTED_SETTINGS_KEYS.has(String(r.anahtar ?? '').toLowerCase())) {
					continue;
				}
				const cols: string[] = [];
				const placeholders: string[] = [];
				const params: unknown[] = [];

				for (const [key, val] of Object.entries(r)) {
					if (!validCols.has(key)) continue;
					if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue;
					if (val === undefined) continue;

					cols.push(`"${key}"`);
					params.push(val);
					placeholders.push(`$${params.length}`);
				}

				if (cols.length === 0) continue;

				let sql = `INSERT INTO "${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;

				if (pkCol && conflictStrategy === 'skip') {
					sql += ` ON CONFLICT ("${pkCol}") DO NOTHING`;
				} else if (pkCol && conflictStrategy === 'upsert') {
					const updateParts = cols
						.filter((c) => c !== `"${pkCol}"`)
						.map((c) => `${c} = EXCLUDED.${c}`);
					if (updateParts.length > 0) {
						sql += ` ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateParts.join(', ')}`;
					} else {
						sql += ` ON CONFLICT ("${pkCol}") DO NOTHING`;
					}
				}

				const res = await client.query(sql, params);
				affectedCount += (res.rowCount || 0);
			}
		});

		await logSystemEvent({
			servis: 'database',
			seviye: 'WARN',
			mesaj: `Toplu veri içe aktarıldı: ${table}`,
			detay: {
				tablo: table,
				satirSayisi: rows.length,
				etkilenen: affectedCount,
				strateji: conflictStrategy,
			},
			userId: auth.user.id,
		});

		return NextResponse.json({
			success: true,
			message: `${affectedCount} satır başarıyla işlendi (${table}).`,
			affectedCount,
		});
	} catch (error) {
		console.error(`İçe aktarma hatası (${table}):`, error);
		const msg = error instanceof Error ? error.message : 'İçe aktarma sırasında bir veritabanı hatası oluştu.';
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
