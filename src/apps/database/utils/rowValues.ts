import type { ColumnSpec, TableDataResponse } from '../types';

export function toCamelCase(key: string): string {
	return key.includes('_')
		? key.toLowerCase().replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase())
		: key;
}

export function getCellValue(row: Record<string, unknown>, colName: string): unknown {
	if (row[colName] !== undefined) return row[colName];
	const camel = toCamelCase(colName);
	if (row[camel] !== undefined) return row[camel];
	return undefined;
}

export function getEffectivePk(data: TableDataResponse | null, primaryKey: string): string {
	const candidate = data?.primaryKey || primaryKey || 'id';
	if (!data || data.rows.length === 0) return candidate;

	const firstRow = data.rows[0];
	if (firstRow[candidate] !== undefined || firstRow[toCamelCase(candidate)] !== undefined) {
		return candidate;
	}

	const lowerTarget = candidate.toLowerCase();
	const matchedKey = Object.keys(firstRow).find((k) => k.toLowerCase() === lowerTarget);
	if (matchedKey && firstRow[matchedKey] !== undefined) return matchedKey;

	if (firstRow.id !== undefined) return 'id';

	if (data.columns && data.columns.length > 0 && getCellValue(firstRow, data.columns[0].name) !== undefined) {
		return data.columns[0].name;
	}

	return candidate;
}

export function getRowPk(
	row: Record<string, unknown>,
	index: number,
	effectivePk: string,
	primaryKeys?: string[]
): unknown {
	const direct = getCellValue(row, effectivePk);
	if (direct !== undefined && direct !== null) {
		return direct;
	}
	const lowerTarget = effectivePk.toLowerCase();
	const matchedKey = Object.keys(row).find((k) => k.toLowerCase() === lowerTarget);
	if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
		return row[matchedKey];
	}
	if (row.id !== undefined && row.id !== null) {
		return row.id;
	}
	if (primaryKeys && primaryKeys.length > 1) {
		const composite = primaryKeys.map((k) => String(getCellValue(row, k) ?? '')).join('_');
		if (composite && composite.replace(/_/g, '').length > 0) return composite;
	}
	return `row_${index}`;
}

function parseStrictIntegerValue(raw: string): number | string {
	const trimmed = raw.trim();
	if (!/^-?\d+$/.test(trimmed)) return trimmed;
	const parsed = Number(trimmed);
	return Number.isSafeInteger(parsed) ? parsed : trimmed;
}

export function parseEditedCellValue(raw: string, col: ColumnSpec): unknown {
	if (col.type === 'integer' || col.type === 'bigint' || col.type === 'smallint') {
		return raw.trim() === '' ? null : parseStrictIntegerValue(raw);
	}
	if (col.type === 'boolean') {
		return raw === 'true' || raw === '1';
	}
	if (raw.trim() === '' && col.nullable) {
		return null;
	}
	return raw;
}

export function formatNewRowValues(
	newRowData: Record<string, string>,
	columns: ColumnSpec[]
): Record<string, unknown> {
	const formatted: Record<string, unknown> = {};
	for (const col of columns) {
		const val = newRowData[col.name];
		if (val !== undefined && val !== '') {
			if (col.type === 'integer' || col.type === 'bigint' || col.type === 'smallint') {
				if (val.trim() !== '') {
					formatted[col.name] = parseStrictIntegerValue(val);
				}
			} else if (col.type === 'boolean') {
				formatted[col.name] = val === 'true';
			} else {
				formatted[col.name] = val;
			}
		}
	}
	return formatted;
}

export function buildInitialRowValues(
	row: Record<string, unknown> | null,
	columns: ColumnSpec[]
): Record<string, unknown> {
	if (!row) return {};
	const initial: Record<string, unknown> = { ...row };
	for (const col of columns) {
		if (initial[col.name] === undefined) {
			initial[col.name] = getCellValue(row, col.name);
		}
	}
	return initial;
}
