export interface FimSuspiciousMatch {
	path: string;
	matchedRule: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
	line: number;
	snippet: string;
}

export interface FimAnomaly {
	path: string;
	type: 'added' | 'modified' | 'deleted';
	oldHash?: string;
	newHash?: string;
}

export interface FimScanResult {
	targetDir: string;
	targetKey: string;
	scannedFiles: number;
	durationMs: number;
	timestamp: number;
	suspiciousFiles: FimSuspiciousMatch[];
	anomalies: FimAnomaly[];
	baselineSaved: boolean;
	errors: string[];
}

export interface RouteSecurityReport {
	endpoint: string;
	category: 'auth' | 'public' | 'data' | 'terminal' | 'soc' | 'core';
	isPublicExpected: boolean;
	unauthStatus: number;
	authGuarded: boolean;
	wafIntercepted: boolean;
	wafStatus: number;
	hasSecurityHeaders: boolean;
	headers: {
		xContentTypeOptions: boolean;
		xFrameOptions: boolean;
		csp: boolean;
	};
	status: 'PASS' | 'WARN' | 'FAIL';
	latencyMs: number;
	message: string;
}

export interface AppSecSummary {
	totalTested: number;
	passed: number;
	warned: number;
	failed: number;
	score: number;
	grade: 'A+' | 'A' | 'B' | 'C' | 'F';
	wafActiveCount: number;
	durationMs: number;
	timestamp: number;
	routes: RouteSecurityReport[];
}

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

export type SiemSearchOp = 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with';
export type SiemSearchField = 'all' | 'message' | 'ip' | 'service' | 'userId' | 'detail';

export interface SiemFilterSnapshot {
	service: string;
	serviceOp: 'eq' | 'neq';
	level: string;
	levelOp: 'eq' | 'neq';
	ip: string;
	ipOp: 'eq' | 'neq' | 'contains' | 'not_contains';
	search: string;
	searchOp: SiemSearchOp;
	searchField: SiemSearchField;
	timeRange?: TimeRangePreset;
	startTime?: number;
	endTime?: number;
	page?: number;
	limit?: number;
}
