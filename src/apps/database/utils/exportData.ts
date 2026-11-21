import { downloadBlob, downloadCsv } from '@/core/data/download';
import { getCellValue } from './rowValues';

export function exportGridRowsCsv(
	tableName: string,
	columnNames: string[],
	rows: Record<string, unknown>[]
): void {
	if (rows.length === 0) return;
	const rowData = rows.map((row) =>
		columnNames.map((col) => {
			const val = getCellValue(row, col);
			if (val === null || val === undefined) return '';
			if (typeof val === 'object') return JSON.stringify(val);
			return typeof val === 'number' ? val : String(val);
		})
	);
	downloadCsv(`${tableName}_export`, columnNames, rowData);
}

export function exportGridRowsJson(tableName: string, rows: Record<string, unknown>[]): void {
	if (rows.length === 0) return;
	const jsonString = JSON.stringify(rows, null, 2);
	const blob = new Blob([jsonString], { type: 'application/json' });
	downloadBlob(blob, `${tableName}_export_${new Date().toISOString().slice(0, 10)}.json`);
}

export function exportQueryRowsCsv(
	headers: string[],
	rows: Record<string, unknown>[]
): void {
	if (rows.length === 0) return;
	const dataRows = rows.map((row) =>
		headers.map((header) => {
			const v = getCellValue(row, header);
			return v === null || v === undefined
				? ''
				: typeof v === 'object'
					? JSON.stringify(v)
					: String(v);
		})
	);
	downloadCsv('sql_result', headers, dataRows);
}

export function exportQueryRowsJson(rows: Record<string, unknown>[]): void {
	if (rows.length === 0) return;
	const jsonStr = JSON.stringify(rows, null, 2);
	downloadBlob(
		new Blob([jsonStr], { type: 'application/json;charset=utf-8' }),
		`sql_result_${new Date().toISOString().slice(0, 10)}.json`
	);
}
