import { NextResponse } from 'next/server';
import { getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/lib/server/databaseAccess';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import type { CreateTableColumnInput } from '@/apps/database/types';

const ALLOWED_DATA_TYPES = new Set([
	'text',
	'varchar(255)',
	'varchar(100)',
	'varchar(500)',
	'integer',
	'bigint',
	'boolean',
	'timestamp with time zone',
	'timestamptz',
	'timestamp',
	'jsonb',
	'json',
	'numeric',
	'uuid',
	'date',
]);

function sanitizeDataType(raw: string): string {
	const cleaned = raw.toLowerCase().trim().replace(/\s+/g, ' ');
	if (ALLOWED_DATA_TYPES.has(cleaned)) return cleaned.toUpperCase();
	// Default safe fallback
	return 'TEXT';
}

export async function GET(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const pool = getPgPool();

	try {
		// 1. Fetch public base tables
		const tablesRes = await pool.query<{ table_name?: string; tableName?: string }>(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
			ORDER BY table_name ASC;
		`);

		// 2. Fetch primary key mappings
		const pkRes = await pool.query<{ table_name?: string; tableName?: string; column_name?: string; columnName?: string }>(`
			SELECT
				kcu.table_name,
				kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
			ORDER BY kcu.ordinal_position ASC;
		`);

		const pkMap: Record<string, string[]> = {};
		for (const r of pkRes.rows) {
			const tableName = String(r.tableName ?? r.table_name ?? '').trim();
			const columnName = String(r.columnName ?? r.column_name ?? '').trim();
			if (!tableName || !columnName) continue;
			if (!pkMap[tableName]) pkMap[tableName] = [];
			pkMap[tableName].push(columnName);
		}

		// 3. Count rows for each table safely
		const tables = [];
		for (const row of tablesRes.rows) {
			const tableName = String(row.tableName ?? row.table_name ?? '').trim();
			if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) continue;

			let rowCount = 0;
			try {
				const countRes = await pool.query(`SELECT COUNT(*)::bigint AS n FROM "${tableName}"`);
				rowCount = Number(countRes.rows[0]?.n || 0);
			} catch {
				rowCount = 0;
			}

			tables.push({
				name: tableName,
				rowCount,
				primaryKeys: pkMap[tableName] || [],
				primaryKey: pkMap[tableName]?.[0] || 'id',
			});
		}

		return NextResponse.json({ tables });
	} catch (error) {
		console.error('API /api/database/tables error:', error);
		return NextResponse.json({ error: 'Tablo listesi alınamadı.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const body = await request.json().catch(() => ({}));
	const action = String(body.action || '').trim();
	const tableName = String(body.tableName || '').trim();

	if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
		return NextResponse.json({ error: 'Geçersiz tablo adı.' }, { status: 400 });
	}

	const pool = getPgPool();

	try {
		if (action === 'create_table') {
			const columns = (Array.isArray(body.columns) ? body.columns : []) as CreateTableColumnInput[];
			if (columns.length === 0) {
				return NextResponse.json({ error: 'En az bir sütun tanımlamalısınız.' }, { status: 400 });
			}

			const colDefs: string[] = [];
			const pks: string[] = [];

			for (const c of columns) {
				const colName = String(c.name || '').trim();
				if (!colName || !/^[a-zA-Z0-9_]+$/.test(colName)) {
					return NextResponse.json({ error: `Geçersiz sütun adı: ${colName}` }, { status: 400 });
				}

				const sqlType = sanitizeDataType(c.type || 'text');
				const nullClause = c.nullable ? '' : 'NOT NULL';
				const defaultClause = c.defaultValue ? `DEFAULT ${c.defaultValue}` : '';

				colDefs.push(`"${colName}" ${sqlType} ${nullClause} ${defaultClause}`.trim());

				if (c.isPrimaryKey) {
					pks.push(`"${colName}"`);
				}
			}

			if (pks.length > 0) {
				colDefs.push(`PRIMARY KEY (${pks.join(', ')})`);
			}

			const createSql = `CREATE TABLE "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
			await pool.query(createSql);

			await logSystemEvent({
				servis: 'database',
				seviye: 'WARN',
				mesaj: `Yeni tablo oluşturuldu: ${tableName}`,
				detay: { tablo: tableName, sutunSayisi: columns.length },
				userId: auth.user.id,
			});

			return NextResponse.json({
				success: true,
				message: `Tablo '${tableName}' başarıyla oluşturuldu.`,
			});
		}

		if (action === 'add_column') {
			const col = (body.column || {}) as CreateTableColumnInput;
			const colName = String(col.name || '').trim();
			if (!colName || !/^[a-zA-Z0-9_]+$/.test(colName)) {
				return NextResponse.json({ error: 'Geçersiz sütun adı.' }, { status: 400 });
			}

			const sqlType = sanitizeDataType(col.type || 'text');
			const nullClause = col.nullable ? '' : 'NOT NULL';
			const defaultClause = col.defaultValue ? `DEFAULT ${col.defaultValue}` : '';

			const alterSql = `ALTER TABLE "${tableName}" ADD COLUMN "${colName}" ${sqlType} ${nullClause} ${defaultClause}`.trim();
			await pool.query(alterSql);

			await logSystemEvent({
				servis: 'database',
				seviye: 'WARN',
				mesaj: `Tabloya yeni sütun eklendi: ${tableName}.${colName}`,
				detay: { tablo: tableName, sutun: colName, tip: sqlType },
				userId: auth.user.id,
			});

			return NextResponse.json({
				success: true,
				message: `'${tableName}' tablosuna '${colName}' sütunu eklendi.`,
			});
		}

		return NextResponse.json({ error: 'Geçersiz DDL aksiyonu.' }, { status: 400 });
	} catch (error) {
		console.error(`DDL işlemi başarısız (${action} on ${tableName}):`, error);
		const msg = error instanceof Error ? error.message : 'DDL işlemi gerçekleştirilemedi.';
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
