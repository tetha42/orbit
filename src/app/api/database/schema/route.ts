import { NextResponse } from 'next/server';
import { getPgPool } from '@/db';
import { requireDatabaseAdmin } from '@/server/databaseAccess';
import type { SchemaGraphData, SchemaTableNode, SchemaRelationEdge } from '@/apps/database/types';

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

		// 2. Fetch all columns
		const colsRes = await pool.query<{
			table_name?: string;
			tableName?: string;
			column_name?: string;
			columnName?: string;
			data_type?: string;
			dataType?: string;
			is_nullable?: string;
			isNullable?: string;
		}>(`
			SELECT table_name, column_name, data_type, is_nullable
			FROM information_schema.columns
			WHERE table_schema = 'public'
			ORDER BY table_name ASC, ordinal_position ASC;
		`);

		// 3. Fetch all Primary Keys
		const pksRes = await pool.query<{ table_name?: string; tableName?: string; column_name?: string; columnName?: string }>(`
			SELECT tc.table_name, kcu.column_name
			FROM information_schema.table_constraints tc
			JOIN information_schema.key_column_usage kcu
				ON tc.constraint_name = kcu.constraint_name
				AND tc.table_schema = kcu.table_schema
				AND tc.table_name = kcu.table_name
			WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
		`);

		const pkSet = new Set<string>();
		for (const r of pksRes.rows) {
			const tableName = String(r.tableName ?? r.table_name ?? '');
			const columnName = String(r.columnName ?? r.column_name ?? '');
			if (tableName && columnName) pkSet.add(`${tableName}.${columnName}`);
		}

		// 4. Fetch all Foreign Keys
		const fksRes = await pool.query<{
			table_name?: string;
			tableName?: string;
			column_name?: string;
			columnName?: string;
			foreign_table_name?: string;
			foreignTableName?: string;
			foreign_column_name?: string;
			foreignColumnName?: string;
		}>(`
			SELECT
				tc.table_name,
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
				AND tc.table_schema = 'public';
		`);

		const fkMap = new Map<string, { table: string; column: string }>();
		const relations: SchemaRelationEdge[] = [];

		for (const r of fksRes.rows) {
			const tableName = String(r.tableName ?? r.table_name ?? '');
			const columnName = String(r.columnName ?? r.column_name ?? '');
			const foreignTable = String(r.foreignTableName ?? r.foreign_table_name ?? '');
			const foreignColumn = String(r.foreignColumnName ?? r.foreign_column_name ?? '');
			if (!tableName || !columnName || !foreignTable || !foreignColumn) continue;
			fkMap.set(`${tableName}.${columnName}`, { table: foreignTable, column: foreignColumn });
			relations.push({
				fromTable: tableName,
				fromColumn: columnName,
				toTable: foreignTable,
				toColumn: foreignColumn,
			});
		}

		// Group columns by table
		const tableColsMap = new Map<string, typeof colsRes.rows>();
		for (const c of colsRes.rows) {
			const tableName = String(c.tableName ?? c.table_name ?? '');
			if (!tableName) continue;
			if (!tableColsMap.has(tableName)) tableColsMap.set(tableName, []);
			tableColsMap.get(tableName)!.push(c);
		}

		// 5. Construct table nodes with approximate counts
		const tables: SchemaTableNode[] = [];
		for (const row of tablesRes.rows) {
			const tableName = String(row.tableName ?? row.table_name ?? '').trim();
			if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) continue;

			let rowCount = 0;
			try {
				const cRes = await pool.query(`SELECT COUNT(*)::bigint AS n FROM "${tableName}"`);
				rowCount = Number(cRes.rows[0]?.n || 0);
			} catch {
				rowCount = 0;
			}

			const rawCols = tableColsMap.get(tableName) || [];
			const columns = rawCols
				.map((c) => {
					const columnName = String(c.columnName ?? c.column_name ?? '').trim();
					if (!columnName) return null;
					const isPk = pkSet.has(`${tableName}.${columnName}`);
					const fkTarget = fkMap.get(`${tableName}.${columnName}`);
					return {
						name: columnName,
						type: String(c.dataType ?? c.data_type ?? ''),
						nullable: (c.isNullable ?? c.is_nullable) === 'YES',
						isPk,
						isFk: Boolean(fkTarget),
						fkTarget,
					};
				})
				.filter((c): c is NonNullable<typeof c> => c !== null);

			tables.push({
				name: tableName,
				rowCount,
				columns,
			});
		}

		const data: SchemaGraphData = {
			tables,
			relations,
		};

		return NextResponse.json(data);
	} catch (error) {
		console.error('API /api/database/schema error:', error);
		return NextResponse.json({ error: 'Veritabanı şeması okunamadı.' }, { status: 500 });
	}
}
