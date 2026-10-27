import { NextResponse } from 'next/server';
import { getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/lib/server/databaseAccess';
import { DB_SENSITIVE_COLUMNS, maskDatabaseRow } from '@/lib/waf';

export async function GET(request: Request) {
	const auth = await requireDatabaseAdmin(request);
	if (!auth.authorized) return auth.response;

	const { searchParams } = new URL(request.url);
	const table = (searchParams.get('table') || '').trim();
	const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
	const limit = Math.min(500, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
	const search = (searchParams.get('search') || '').trim();
	const sortCol = (searchParams.get('sort') || '').trim();
	const sortOrder = (searchParams.get('order') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
	const rawFilters = searchParams.get('filters');

	if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
		return NextResponse.json({ error: 'Geçersiz tablo adı.' }, { status: 400 });
	}

	const pool = getPgPool();

	try {
		// 1. Fetch column specifications
		const colRes = await pool.query<{
			column_name: string;
			data_type: string;
			is_nullable: string;
			column_default: string | null;
		}>(
			`
			SELECT
				column_name,
				data_type,
				is_nullable,
				column_default
			FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1
			ORDER BY ordinal_position ASC;
		`,
			[table]
		);

		if (colRes.rows.length === 0) {
			return NextResponse.json({ error: 'Tablo bulunamadı.' }, { status: 404 });
		}

		// 1b. Fetch primary key mappings for this table
		const pkRes = await pool.query<{ column_name: string }>(
			`
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
		`,
			[table]
		);

		const primaryKeys = pkRes.rows.map((r) => r.column_name);
		const pkSet = new Set(primaryKeys);

		// 1c. Fetch foreign key mappings for this table
		const fkRes = await pool.query<{
			column_name: string;
			foreign_table_name: string;
			foreign_column_name: string;
		}>(
			`
			SELECT
				kcu.column_name,
				ccu.table_name AS foreign_table_name,
				ccu.column_name AS foreign_column_name
			FROM information_schema.table_constraints AS tc
			JOIN information_schema.key_column_usage AS kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
			JOIN information_schema.constraint_column_usage AS ccu
				ON ccu.constraint_name = tc.constraint_name
				AND ccu.table_schema = tc.table_schema
			WHERE tc.constraint_type = 'FOREIGN KEY'
				AND tc.table_schema = 'public'
				AND tc.table_name = $1;
		`,
			[table]
		);

		const foreignKeys: Record<string, { table: string; column: string }> = {};
		for (const r of fkRes.rows) {
			foreignKeys[r.column_name] = {
				table: r.foreign_table_name,
				column: r.foreign_column_name,
			};
		}

		const columns = colRes.rows.map((c) => ({
			name: c.column_name,
			type: c.data_type,
			nullable: c.is_nullable === 'YES',
			hasDefault: c.column_default !== null,
			isSensitive: DB_SENSITIVE_COLUMNS.has(c.column_name.toLowerCase()),
			isPrimaryKey: pkSet.has(c.column_name),
			isForeignKey: Boolean(foreignKeys[c.column_name]),
			foreignKeyTarget: foreignKeys[c.column_name],
		}));

		const validColNames = new Set(columns.map((c) => c.name));
		const primaryKey = primaryKeys[0] || (validColNames.has('id') ? 'id' : columns[0]?.name || 'id');

		// 2. Build where filter for search & multi-column filters
		const whereClauses: string[] = [];
		const params: unknown[] = [];

		if (search) {
			const textCols = columns.filter((c) =>
				['text', 'character varying', 'character', 'uuid', 'json', 'jsonb'].includes(c.type)
			);
			if (textCols.length > 0) {
				params.push(`%${search}%`);
				const idx = params.length;
				const orParts = textCols.map((c) => `CAST("${c.name}" AS TEXT) ILIKE $${idx}`);
				whereClauses.push(`(${orParts.join(' OR ')})`);
			}
		}

		// Process dynamic multi-column filters
		if (rawFilters) {
			try {
				const parsed = JSON.parse(rawFilters);
				if (Array.isArray(parsed)) {
					for (const f of parsed) {
						if (!f || typeof f !== 'object') continue;
						const col = String(f.column || '');
						if (!validColNames.has(col)) continue;
						const op = String(f.op || '=');
						const val = f.value !== undefined ? String(f.value) : '';

						if (op === 'is_null') {
							whereClauses.push(`"${col}" IS NULL`);
						} else if (op === 'is_not_null') {
							whereClauses.push(`"${col}" IS NOT NULL`);
						} else if (op === 'like') {
							params.push(`%${val}%`);
							whereClauses.push(`CAST("${col}" AS TEXT) LIKE $${params.length}`);
						} else if (op === 'ilike') {
							params.push(`%${val}%`);
							whereClauses.push(`CAST("${col}" AS TEXT) ILIKE $${params.length}`);
						} else if (['=', '!=', '>', '<', '>=', '<='].includes(op)) {
							params.push(val);
							whereClauses.push(`"${col}" ${op} $${params.length}`);
						}
					}
				}
			} catch {
				// ignore malformed filter payloads
			}
		}

		const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

		// 3. Count total matching rows
		const countQuery = `SELECT COUNT(*)::bigint AS n FROM "${table}" ${whereSql}`;
		const countRes = await pool.query(countQuery, params);
		const totalRows = Number(countRes.rows[0]?.n || 0);

		// 4. Determine ordering
		let orderSql = '';
		if (sortCol && validColNames.has(sortCol)) {
			orderSql = `ORDER BY "${sortCol}" ${sortOrder}`;
		} else {
			const defaultSort = validColNames.has('id') ? 'id' : columns[0].name;
			orderSql = `ORDER BY "${defaultSort}" ${sortOrder}`;
		}

		// 5. Query data with pagination
		const offset = (page - 1) * limit;
		const dataQuery = `SELECT * FROM "${table}" ${whereSql} ${orderSql} LIMIT ${limit} OFFSET ${offset}`;
		const dataRes = await pool.query(dataQuery, params);

		// Mask sensitive fields by column name, value prefix, and sistem_ayarlari row key
		const rows = dataRes.rows.map((r) => maskDatabaseRow(r as Record<string, unknown>));

		return NextResponse.json({
			table,
			primaryKey,
			primaryKeys,
			columns,
			foreignKeys,
			rows,
			totalRows,
			page,
			limit,
			totalPages: Math.max(1, Math.ceil(totalRows / limit)),
		});
	} catch (error) {
		console.error(`API /api/database/data?table=${table} error:`, error);
		return NextResponse.json({ error: 'Tablo verileri okunamadı.' }, { status: 500 });
	}
}
