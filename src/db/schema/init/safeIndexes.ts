import type { PoolClient } from 'pg';

export interface SchemaIndexDef {
	name: string;
	table: string;
	definition: string;
	unique?: boolean;
}

const VALID_IDENT_RE = /^[a-z_][a-z0-9_]*$/;
const LARGE_TABLE_ROWS = 10_000;
const LARGE_TABLE_BYTES = 1_048_576;

function pgErrorCode(err: unknown): string | undefined {
	if (typeof err === 'object' && err !== null && 'code' in err) {
		const code = (err as { code?: unknown }).code;
		return typeof code === 'string' ? code : undefined;
	}
	return undefined;
}

async function isInsideTransactionBlock(client: PoolClient): Promise<boolean> {
	try {
		await client.query('SAVEPOINT orbit_tx_probe');
		await client.query('RELEASE SAVEPOINT orbit_tx_probe');
		return true;
	} catch (err) {
		if (pgErrorCode(err) === '25P01') {
			// 25P01 (no_active_sql_transaction): caller is in autocommit mode, safe for CONCURRENTLY.
			return false;
		}
		throw err;
	}
}

/**
 * Creates missing indexes with CREATE INDEX CONCURRENTLY when outside a
 * transaction so production boots avoid SHARE write locks on populated tables,
 * warns when building on large tables, and heals INVALID concurrent indexes.
 */
export async function ensureIndexesSafely(
	client: PoolClient,
	indexes: readonly SchemaIndexDef[]
): Promise<void> {
	if (indexes.length === 0) return;

	const indexNames = indexes.map((idx) => idx.name);
	const existingRes = await client.query<{ index_name: string; is_valid: boolean }>(
		`SELECT c.relname AS index_name, i.indisvalid AS is_valid
		 FROM pg_class c
		 JOIN pg_index i ON i.indexrelid = c.oid
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE n.nspname = current_schema()
		   AND c.relkind = 'i'
		   AND c.relname = ANY($1::text[])`,
		[indexNames]
	);

	const indexState = new Map<string, boolean>();
	for (const row of existingRes.rows) {
		const r = row as unknown as {
			indexName?: string;
			index_name?: string;
			isValid?: boolean;
			is_valid?: boolean;
		};
		const name = String(r.indexName ?? r.index_name ?? '');
		const isValid = Boolean(r.isValid ?? r.is_valid ?? false);
		if (name) indexState.set(name, isValid);
	}

	const pending = indexes.filter((idx) => indexState.get(idx.name) !== true);
	if (pending.length === 0) return;

	const inTx = await isInsideTransactionBlock(client);
	if (inTx) {
		console.warn(
			`[Schema] Creating ${pending.length} index(es) inside active transaction; CONCURRENTLY skipped.`
		);
	}

	const tableNames = Array.from(new Set(pending.map((idx) => idx.table)));
	const statsRes = await client.query(
		`SELECT c.relname AS table_name,
		        GREATEST(c.reltuples::bigint, 0) AS est_rows,
		        pg_relation_size(c.oid)::bigint AS table_bytes
		 FROM pg_class c
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE n.nspname = current_schema()
		   AND c.relkind = 'r'
		   AND c.relname = ANY($1::text[])`,
		[tableNames]
	);

	const statsByTable = new Map<string, { estRows: number; tableBytes: number }>();
	for (const row of statsRes.rows) {
		const r = row as unknown as {
			tableName?: string;
			table_name?: string;
			estRows?: number;
			est_rows?: number;
			tableBytes?: number;
			table_bytes?: number;
		};
		const tableName = String(r.tableName ?? r.table_name ?? '');
		if (!tableName) continue;
		statsByTable.set(tableName, {
			estRows: Number(r.estRows ?? r.est_rows ?? 0),
			tableBytes: Number(r.tableBytes ?? r.table_bytes ?? 0),
		});
	}

	for (const idx of pending) {
		if (!VALID_IDENT_RE.test(idx.name)) {
			throw new Error(`Invalid schema index identifier: ${idx.name}`);
		}

		if (indexState.get(idx.name) === false) {
			console.warn(`[Schema] Dropping invalid index ${idx.name} before recreating.`);
			await client.query(
				inTx ? `DROP INDEX IF EXISTS ${idx.name}` : `DROP INDEX CONCURRENTLY IF EXISTS ${idx.name}`
			);
		}

		const stats = statsByTable.get(idx.table);
		if (stats && (stats.estRows >= LARGE_TABLE_ROWS || stats.tableBytes >= LARGE_TABLE_BYTES)) {
			const sizeMb = (stats.tableBytes / (1024 * 1024)).toFixed(1);
			console.warn(
				`[Schema] Building index ${idx.name} on populated table ${idx.table} ` +
					`(~${stats.estRows} rows, ${sizeMb} MiB)${inTx ? '' : ' with CONCURRENTLY'}`
			);
		}

		const uniqueSql = idx.unique ? 'UNIQUE ' : '';
		const sql = inTx
			? `CREATE ${uniqueSql}INDEX IF NOT EXISTS ${idx.name} ${idx.definition}`
			: `CREATE ${uniqueSql}INDEX CONCURRENTLY IF NOT EXISTS ${idx.name} ${idx.definition}`;
		await client.query(sql);
	}
}
