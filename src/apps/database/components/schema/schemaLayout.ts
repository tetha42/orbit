import type { SchemaGraphData } from '../../types';

export const SCHEMA_NODE_WIDTH = 240;
export const SCHEMA_ROW_HEIGHT = 22;
export const SCHEMA_HEADER_HEIGHT = 38;
export const SCHEMA_GAP_X = 80;
export const SCHEMA_COLS_PER_ROW = 4;

export interface SchemaNodePosition {
	x: number;
	y: number;
	width: number;
	height: number;
}

export function computeSchemaNodePositions(
	data: SchemaGraphData | null
): Map<string, SchemaNodePosition> {
	const map = new Map<string, SchemaNodePosition>();
	if (!data) return map;

	data.tables.forEach((table, index) => {
		const colIndex = index % SCHEMA_COLS_PER_ROW;
		const rowIndex = Math.floor(index / SCHEMA_COLS_PER_ROW);
		const height =
			SCHEMA_HEADER_HEIGHT + Math.min(table.columns.length, 12) * SCHEMA_ROW_HEIGHT + 14;
		const x = colIndex * (SCHEMA_NODE_WIDTH + SCHEMA_GAP_X);
		const y = rowIndex * 320;
		map.set(table.name, { x, y, width: SCHEMA_NODE_WIDTH, height });
	});

	return map;
}
