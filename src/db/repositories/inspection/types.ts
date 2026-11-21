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

export interface FimDiffResult {
	path: string;
	type: 'added' | 'modified' | 'deleted';
	diff: string;
	oldContent?: string;
	newContent?: string;
}
