import type { ColumnSpec } from '../types';

export interface ParsedImportData {
	sourceColumns: string[];
	rows: Record<string, unknown>[];
	error?: string;
	errorDetail?: string;
}

function isPlainObjectRow(val: unknown): val is Record<string, unknown> {
	return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function splitDelimitedLine(line: string, separator: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	let wasDoubleQuoted = false;

	const pushCell = () => {
		const trimmed = current.trim();
		if (
			!wasDoubleQuoted &&
			trimmed.length >= 2 &&
			trimmed.startsWith("'") &&
			trimmed.endsWith("'")
		) {
			result.push(trimmed.slice(1, -1));
		} else {
			result.push(trimmed);
		}
		current = '';
		wasDoubleQuoted = false;
	};

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
				wasDoubleQuoted = true;
			}
		} else if (ch === separator && !inQuotes) {
			pushCell();
		} else {
			current += ch;
		}
	}
	pushCell();
	return result;
}

export function parseImportText(text: string, isJson: boolean): ParsedImportData {
	try {
		if (isJson) {
			const data: unknown = JSON.parse(text);
			if (!Array.isArray(data) || data.length === 0) {
				return {
					sourceColumns: [],
					rows: [],
					error: 'dbImportJsonEmpty',
				};
			}
			const rows = data.filter(isPlainObjectRow);
			if (rows.length === 0) {
				return {
					sourceColumns: [],
					rows: [],
					error: 'dbImportJsonNoValidRows',
				};
			}
			const colSet = new Set<string>();
			for (const row of rows) {
				for (const key of Object.keys(row)) {
					colSet.add(key);
				}
			}
			return { sourceColumns: Array.from(colSet), rows };
		}

		const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
		if (lines.length < 2) {
			return {
				sourceColumns: [],
				rows: [],
				error: 'dbImportCsvTooShort',
			};
		}

		const separator = lines[0].includes(';') ? ';' : ',';
		const headers = splitDelimitedLine(lines[0], separator);
		const rows: Record<string, unknown>[] = [];

		for (let i = 1; i < lines.length; i++) {
			const parts = splitDelimitedLine(lines[i], separator);
			const rowObj: Record<string, unknown> = {};
			headers.forEach((h, idx) => {
				rowObj[h] = parts[idx] ?? '';
			});
			rows.push(rowObj);
		}

		return { sourceColumns: headers, rows };
	} catch (err) {
		return {
			sourceColumns: [],
			rows: [],
			error: 'dbImportFileReadError',
			errorDetail: err instanceof Error ? err.message : String(err),
		};
	}
}

export function buildAutoMapping(
	targetColumns: ColumnSpec[],
	sourceColumns: string[]
): Record<string, string> {
	const mapping: Record<string, string> = {};
	for (const targetCol of targetColumns) {
		const lowerTarget = targetCol.name.toLowerCase();
		const matched = sourceColumns.find((sc) => sc.toLowerCase() === lowerTarget);
		if (matched) {
			mapping[targetCol.name] = matched;
		}
	}
	return mapping;
}

export function buildMappedRows(
	parsedRows: Record<string, unknown>[],
	mapping: Record<string, string>
): Record<string, unknown>[] {
	const mappedRows: Record<string, unknown>[] = [];
	for (const raw of parsedRows) {
		const row: Record<string, unknown> = {};
		for (const [targetCol, sourceCol] of Object.entries(mapping)) {
			if (sourceCol && raw[sourceCol] !== undefined) {
				row[targetCol] = raw[sourceCol];
			}
		}
		if (Object.keys(row).length > 0) {
			mappedRows.push(row);
		}
	}
	return mappedRows;
}
