export interface TableSummary {
	name: string;
	rowCount: number;
	primaryKeys: string[];
	primaryKey: string;
}

export interface ColumnSpec {
	name: string;
	type: string;
	nullable: boolean;
	hasDefault: boolean;
	isSensitive: boolean;
	isPrimaryKey?: boolean;
	isForeignKey?: boolean;
	foreignKeyTarget?: { table: string; column: string };
}

export interface ForeignKeyInfo {
	column: string;
	foreignTable: string;
	foreignColumn: string;
}

export interface FilterRule {
	id: string;
	column: string;
	op: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'ilike' | 'is_null' | 'is_not_null';
	value: string;
}

export interface TableDataResponse {
	table: string;
	primaryKey?: string;
	primaryKeys?: string[];
	columns: ColumnSpec[];
	foreignKeys?: Record<string, { table: string; column: string }>;
	rows: Record<string, unknown>[];
	totalRows: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface PendingCellChange {
	rowPkVal: unknown;
	rowPkCol: string;
	columnName: string;
	originalValue: unknown;
	newValue: unknown;
}

export interface QueryResult {
	success: boolean;
	command?: string;
	rowCount?: number;
	fields?: { name: string; dataTypeID: number }[];
	rows?: Record<string, unknown>[];
	durationMs?: number;
	error?: string;
	isExplain?: boolean;
	explainPlan?: unknown;
	requiresSafeConfirmation?: boolean;
	safeReason?: string;
	dangerousCommand?: string;
}

export interface SchemaTableColumn {
	name: string;
	type: string;
	nullable: boolean;
	isPk: boolean;
	isFk: boolean;
	fkTarget?: { table: string; column: string };
}

export interface SchemaTableNode {
	name: string;
	rowCount: number;
	columns: SchemaTableColumn[];
}

export interface SchemaRelationEdge {
	fromTable: string;
	fromColumn: string;
	toTable: string;
	toColumn: string;
}

export interface SchemaGraphData {
	tables: SchemaTableNode[];
	relations: SchemaRelationEdge[];
}

export interface AuditRecord {
	id: number;
	zaman: number;
	yapanId: string;
	yapanAd: string;
	islem: string;
	hedefTur: string;
	hedefId: string;
	hedefAd: string;
	onceki: Record<string, unknown> | null;
	sonraki: Record<string, unknown> | null;
	ip: string;
}

export interface CreateTableColumnInput {
	name: string;
	type: string;
	nullable: boolean;
	isPrimaryKey: boolean;
	defaultValue?: string;
}
