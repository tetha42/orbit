import type { PoolClient } from 'pg';

const VALID_IDENT_RE = /^[a-z_][a-z0-9_]*$/;
const SQL_STRING_LITERAL_RE = /^'(?:[^']|'')*'$/;
const SQL_NUMBER_LITERAL_RE = /^-?\d+(?:\.\d+)?$/;
const SQL_KEYWORD_LITERAL_RE = /^(?:true|false|null)$/i;

function assertValidIdent(ident: string): void {
	if (!VALID_IDENT_RE.test(ident)) {
		throw new Error(`Invalid SQL identifier: ${ident}`);
	}
}

function assertValidDefaultLiteral(defaultLiteral: string): string {
	const trimmed = typeof defaultLiteral === 'string' ? defaultLiteral.trim() : '';
	if (!trimmed || trimmed.includes('$$')) {
		throw new Error(`Invalid SQL default literal: ${defaultLiteral}`);
	}
	if (SQL_STRING_LITERAL_RE.test(trimmed) || SQL_NUMBER_LITERAL_RE.test(trimmed)) {
		return trimmed;
	}
	if (SQL_KEYWORD_LITERAL_RE.test(trimmed)) {
		return trimmed.toLowerCase();
	}
	throw new Error(
		`Invalid SQL default literal: ${defaultLiteral} (expected single-quoted string, number, boolean, or null)`
	);
}

function assertValidColumnDefSql(columnDefSql: string): string {
	const trimmed = typeof columnDefSql === 'string' ? columnDefSql.trim() : '';
	if (!trimmed || /[;]|(\$\$)|--|\/\*/.test(trimmed)) {
		throw new Error(`Invalid SQL column definition: ${columnDefSql}`);
	}
	return trimmed;
}

/**
 * Idempotently adds `column` to `table` in the active schema only when missing
 * from `pg_attribute`, taking zero table locks when the column already exists.
 */
export async function ensureColumnExists(
	client: PoolClient,
	table: string,
	column: string,
	columnDefSql: string
): Promise<void> {
	assertValidIdent(table);
	assertValidIdent(column);
	const safeDefSql = assertValidColumnDefSql(columnDefSql);
	await client.query(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_attribute a
				JOIN pg_class t ON t.oid = a.attrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema()
				  AND t.relname = '${table}'
				  AND a.attname = '${column}'
				  AND a.attnum > 0
				  AND NOT a.attisdropped
			) THEN
				ALTER TABLE ${table} ADD COLUMN ${column} ${safeDefSql};
			END IF;
		END $$;
	`);
}

/**
 * Idempotently aligns `table.column` default to `defaultLiteral` only when
 * `pg_attribute`/`pg_attrdef` differs, taking zero table locks when already set.
 */
export async function ensureColumnDefault(
	client: PoolClient,
	table: string,
	column: string,
	defaultLiteral: string
): Promise<void> {
	assertValidIdent(table);
	assertValidIdent(column);
	const safeLiteral = assertValidDefaultLiteral(defaultLiteral);
	const escapedLiteral = safeLiteral.replace(/'/g, "''");
	const mismatchCondition =
		safeLiteral === 'null'
			? 'v_current_default IS NOT NULL'
			: `v_current_default IS NULL OR v_current_default NOT IN (
				'${escapedLiteral}',
				'${escapedLiteral}::' || v_type_name,
				'''' || '${escapedLiteral}' || '''::' || v_type_name,
				'''' || '${escapedLiteral}' || '''::integer'
			)`;
	await client.query(`
		DO $$
		DECLARE
			v_col_exists BOOLEAN;
			v_current_default TEXT;
			v_type_name TEXT;
		BEGIN
			SELECT TRUE,
			       pg_get_expr(d.adbin, d.adrelid),
			       format_type(a.atttypid, -1)
			INTO v_col_exists, v_current_default, v_type_name
			FROM pg_attribute a
			JOIN pg_class t ON t.oid = a.attrelid
			JOIN pg_namespace n ON n.oid = t.relnamespace
			LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
			WHERE n.nspname = current_schema()
			  AND t.relname = '${table}'
			  AND a.attname = '${column}'
			  AND a.attnum > 0
			  AND NOT a.attisdropped;

			IF v_col_exists IS NOT TRUE THEN
				RAISE EXCEPTION 'Column %.% does not exist in current schema', '${table}', '${column}';
			END IF;

			IF ${mismatchCondition} THEN
				ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${safeLiteral};
			END IF;
		END $$;
	`);
}

/**
 * Idempotently adds UNIQUE (`column`) to `table` in the active schema if no
 * matching PK/UNIQUE constraint or non-partial unique index already exists,
 * skipping safely with a warning if existing duplicate non-null values exist.
 */
export async function ensureUniqueColumnConstraint(
	client: PoolClient,
	table: string,
	column: string
): Promise<void> {
	assertValidIdent(table);
	assertValidIdent(column);
	await client.query(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint c
				JOIN pg_class t ON t.oid = c.conrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema()
				  AND t.relname = '${table}'
				  AND c.contype IN ('p', 'u')
				  AND pg_get_constraintdef(c.oid) ~ '\\(${column}\\)'
			) AND NOT EXISTS (
				SELECT 1 FROM pg_index i
				JOIN pg_class t ON t.oid = i.indrelid
				JOIN pg_namespace n ON n.oid = t.relnamespace
				WHERE n.nspname = current_schema()
				  AND t.relname = '${table}'
				  AND i.indisunique AND i.indisvalid AND i.indpred IS NULL
				  AND pg_get_indexdef(i.indexrelid) ~ '\\(${column}\\)$'
			) THEN
				IF NOT EXISTS (
					SELECT 1 FROM ${table}
					WHERE ${column} IS NOT NULL
					GROUP BY ${column}
					HAVING COUNT(*) > 1
				) THEN
					ALTER TABLE ${table} ADD UNIQUE (${column});
				ELSE
					RAISE WARNING '[Schema] Skipped UNIQUE (%) on % due to duplicate values.', '${column}', '${table}';
				END IF;
			END IF;
		END $$;
	`);
}
