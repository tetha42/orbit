export interface SystemLog {
	id: number;
	time: number;
	level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
	service: string;
	message: string;
	detail: Record<string, unknown> | null;
	userId: string | null;
	ip: string;
}

export type FilterOperator =
	| 'contains'
	| 'not_contains'
	| 'equals'
	| 'not_equals'
	| 'starts_with'
	| 'ends_with';

export type FilterColumn = 'all' | 'message' | 'ip' | 'service' | 'userId' | 'detail';

export type TimeRangePreset = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom' | 'all';

export interface HistogramBucket {
	bucket: number;
	start: number;
	end: number;
	label: string;
	count: number;
	critical: number;
	error: number;
	warn: number;
	info: number;
}

export interface SiemLogsResponse {
	logs: SystemLog[];
	totalCount: number;
	page: number;
	limit: number;
	totalPages: number;
	histogram: HistogramBucket[];
}

export interface SystemLogFilter {
	service?: string;
	serviceOp?: 'eq' | 'neq';
	level?: string;
	levelOp?: 'eq' | 'neq';
	ip?: string;
	ipOp?: 'eq' | 'neq' | 'contains' | 'not_contains';
	search?: string;
	searchOp?: FilterOperator;
	searchField?: FilterColumn;
	timeRange?: TimeRangePreset;
	startTime?: number;
	endTime?: number;
	page?: number;
	limit?: number;
}

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_SERVICE_LEN = 40;
export const MAX_DETAIL_JSON_LEN = 8192;
export const DEFAULT_RETENTION_DAYS = 90;
