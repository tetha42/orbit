import type { CreateTableColumnInput } from '../types';

export const POSTGRES_DATA_TYPES = [
	{ labelKey: 'dbTypeText', label: 'TEXT (free text)', value: 'TEXT' },
	{ labelKey: 'dbTypeVarchar50', label: 'VARCHAR(50) (short text / ID)', value: 'VARCHAR(50)' },
	{ labelKey: 'dbTypeVarchar255', label: 'VARCHAR(255) (short text)', value: 'VARCHAR(255)' },
	{ labelKey: 'dbTypeInteger', label: 'INTEGER (whole number)', value: 'INTEGER' },
	{ labelKey: 'dbTypeBigint', label: 'BIGINT (large number)', value: 'BIGINT' },
	{ labelKey: 'dbTypeBoolean', label: 'BOOLEAN (yes/no)', value: 'BOOLEAN' },
	{ labelKey: 'dbTypeTimestamptz', label: 'TIMESTAMPTZ (timestamp)', value: 'TIMESTAMPTZ' },
	{ labelKey: 'dbTypeJsonb', label: 'JSONB (structured data)', value: 'JSONB' },
	{ labelKey: 'dbTypeNumeric', label: 'NUMERIC (decimal)', value: 'NUMERIC' },
	{ labelKey: 'dbTypeUuid', label: 'UUID (universal ID)', value: 'UUID' },
] as const;

export function buildCreateTableSql(
	tableName: string,
	columns: CreateTableColumnInput[]
): string {
	const safeTable = tableName.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'new_table';
	const colDefs: string[] = [];
	const pks: string[] = [];

	for (const c of columns) {
		const name = c.name.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'column';
		const nullClause = c.nullable ? '' : 'NOT NULL';
		const defaultClause = c.defaultValue?.trim() ? `DEFAULT ${c.defaultValue.trim()}` : '';
		colDefs.push(`  "${name}" ${c.type} ${nullClause} ${defaultClause}`.trim());
		if (c.isPrimaryKey) {
			pks.push(`"${name}"`);
		}
	}

	if (pks.length > 0) {
		colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
	}

	return `CREATE TABLE "${safeTable}" (\n${colDefs.join(',\n')}\n);`;
}

export function validateCreateTableInput(
	tableName: string,
	columns: CreateTableColumnInput[]
): { cleanName: string; error: string | null; errorKey: string | null } {
	const cleanName = tableName.trim().toLowerCase();
	if (!cleanName || !/^[a-zA-Z0-9_]+$/.test(cleanName)) {
		return {
			cleanName,
			error: 'Enter a valid table name (letters, digits and underscores only).',
			errorKey: 'dbInvalidTableName',
		};
	}

	for (const c of columns) {
		if (!c.name.trim() || !/^[a-zA-Z0-9_]+$/.test(c.name.trim())) {
			return {
				cleanName,
				error: `Invalid column name: "${c.name}". Column names cannot be empty.`,
				errorKey: 'dbInvalidColumnName',
			};
		}
	}

	return { cleanName, error: null, errorKey: null };
}
