import type { TestbenchTab } from './testbench/types';
export type { TestbenchTab };

/** Defence tabs plus the test-lab tabs hosted in the same studio. */
export type SocTab = 'radar' | 'firewall' | 'sessions' | 'siem' | 'inspection' | 'audit' | TestbenchTab;

export const isLabTab = (tab: SocTab): tab is TestbenchTab =>
	tab === 'oauth' || tab === 'api' || tab === 'fuzzer' || tab === 'health' || tab === 'session';

/** Lab tabs a SoC user without management rights may open; the rest need SoC "Yönet". */
export const SOC_LAB_TABS: TestbenchTab[] = ['api', 'session'];

export const LAB_SEGMENTS: Array<{ id: TestbenchTab; key: string; tr: string; en: string }> = [
	{ id: 'oauth', key: 'tbTabOAuthShort', tr: 'OAuth', en: 'OAuth' },
	{ id: 'api', key: 'tbTabApiShort', tr: 'API', en: 'API' },
	{ id: 'fuzzer', key: 'tbTabFuzzerShort', tr: 'WAF Fuzzer', en: 'WAF Fuzzer' },
	{ id: 'health', key: 'tbTabHealthShort', tr: 'Sağlık', en: 'Health' },
	{ id: 'session', key: 'tbTabSessionShort', tr: 'Oturum', en: 'Session' },
];

export interface ThreatIntelligence {
	ip?: string;
	provider?: string;
	isDatacenter?: boolean;
	isCloudHosting?: boolean;
	isTor?: boolean;
	isTorExitNode?: boolean;
	isKnownScanner?: boolean;
	riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
	classification?: string;
	label?: string;
}

export interface EmergencyKillSwitches {
	disableRegistrations: boolean;
	disableUploads: boolean;
	passkeyOnly: boolean;
}

export interface WebhookConfig {
	enabled: boolean;
	provider: 'discord' | 'telegram' | 'generic' | 'email';
	webhookUrl?: string;
	botToken?: string;
	chatId?: string;
	emailRecipients?: string;
	alsoSendEmail?: boolean;
	minSeverity: 'CRITICAL' | 'ERROR' | 'WARN';
	notifyOn: {
		lockdown: boolean;
		autoban: boolean;
		honeypot: boolean;
		fim: boolean;
		loginAnomalies: boolean;
	};
}

export interface HourlyAttackPoint {
	hourLabel: string;
	timestamp: number;
	blockedCount: number;
	warningCount: number;
	totalCount: number;
}

export interface IngressDiagnostics {
	detectedClientIp: string;
	isDockerBridgeOrPrivate: boolean;
	detectedEdge: 'cloudflare' | 'traefik' | 'caddy' | 'nginx' | 'direct';
	isContainerEnvironment: boolean;
	recommendation?: string;
}

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

export interface SecurityBlock {
	ip: string;
	status: 'ban' | 'whitelist';
	neden: string;
	tehditPuani: number;
	ihlaller: number;
	olusturanId: string | null;
	expiresAt: number | null;
	olusturma: number;
	guncellenme: number;
	threatIntel?: ThreatIntelligence;
}

export type SocIncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SocIncidentStatus = 'new' | 'triaged' | 'investigating' | 'contained' | 'resolved' | 'false_positive';

export interface SocIncident {
	id: string;
	title: string;
	severity: SocIncidentSeverity;
	status: SocIncidentStatus;
	sourceIp: string | null;
	service: string | null;
	details: Record<string, unknown> | null;
	analystNotes: string | null;
	assignedTo: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface ActiveSessionInfo {
	id: string;
	ad: string;
	soyad: string;
	email: string;
	roleId: string | null;
	rolAd: string;
	admin: boolean;
	status: string;
	totpEnabled: boolean;
	sonGirisTarihi: number | null;
	oturumBitis: number | null;
	sonGirisIp: string | null;
	sonAktifIp: string | null;
	sonAktifTarihi: number | null;
	sonGirisUserAgent: string | null;
	ipDegisti: boolean;
	impossibleTravel?: {
		detected: boolean;
		speedKmh?: number;
		deltaMinutes?: number;
		fromIp?: string;
		toIp?: string;
		reason?: string;
	};
}

export interface TopAttackerItem {
	ip: string;
	eventCount: number;
	tehditPuani: number;
	sonGorulme: number;
	sonMesaj: string;
	status: 'ban' | 'whitelist' | 'izleniyor';
	threatIntel?: ThreatIntelligence;
}

export interface ActiveRateLimit {
	key: string;
	count: number;
	limit?: number;
	resetAt: number;
	retryAfter: number;
}

export interface SocOverviewData {
	defcon: 1 | 2 | 3 | 4 | 5;
	lockdown: {
		active: boolean;
		reason: string;
		updatedAt: number | null;
	};
	emergencySwitches?: EmergencyKillSwitches;
	webhookConfig?: WebhookConfig;
	metrics: {
		activeBansCount: number;
		whitelistedCount: number;
		securityEvents24h: number;
		authFailures24h: number;
		csrfAndIdor24h: number;
		sessionAnomalies24h: number;
		activeSessionsCount: number;
		activeRateLimits?: ActiveRateLimit[];
		activeRateLimitsCount?: number;
	};
	hourlyTimeline: Array<{
		hourLabel: string;
		timestamp: number;
		warnCount: number;
		errorCount: number;
	}>;
	hourlyDistribution?: HourlyAttackPoint[];
	topAttackers: TopAttackerItem[];
	defconResetAt?: number;
	systemTelemetry?: {
		pgPool: {
			totalCount: number;
			idleCount: number;
			waitingCount: number;
			max: number;
		};
		memory: {
			processRss: number;
			processHeapUsed: number;
			processHeapTotal: number;
			osTotal: number;
			osFree: number;
			osUsed: number;
		};
		cpu: {
			loadAvg: number[];
			uptime: number;
		};
	};
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
	zaman: number;
	seviye: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
	servis: string;
	mesaj: string;
	detay: Record<string, unknown> | null;
	userId: string | null;
	ip: string;
}

export type SiemAramaOp = 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with';
export type SiemAramaAlani = 'all' | 'mesaj' | 'ip' | 'servis' | 'userId' | 'detay';

export interface SiemFilterSnapshot {
	servis: string;
	servisOp: 'eq' | 'neq';
	seviye: string;
	seviyeOp: 'eq' | 'neq';
	ip: string;
	ipOp: 'eq' | 'neq' | 'contains' | 'not_contains';
	arama: string;
	aramaOp: SiemAramaOp;
	aramaAlani: SiemAramaAlani;
	timeRange?: TimeRangePreset;
	startTime?: number;
	endTime?: number;
	page?: number;
	limit?: number;
}

export function formatDateTime(ts: number | null | undefined, lang: 'tr' | 'en'): string {
	if (!ts) return '—';
	try {
		return new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'tr-TR', {
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	} catch {
		return '—';
	}
}

export function summarizeUa(ua: string | null | undefined): string {
	if (!ua) return '—';
	if (ua.length <= 48) return ua;
	return `${ua.slice(0, 45)}…`;
}

// -------------------------------------------------------------
// 3-Pane Inspector Drawer & SOAR Types
// -------------------------------------------------------------

export type InspectorEntityType = 'event' | 'ip' | 'incident' | 'session' | 'fim';

export interface InspectorIpData {
	ip: string;
	threatIntel?: ThreatIntelligence;
	banInfo?: SecurityBlock;
	attackerInfo?: TopAttackerItem;
	activeSessionsCount?: number;
}

export interface InspectorFimData {
	file: string;
	match?: FimSuspiciousMatch;
	anomaly?: FimAnomaly;
	diff?: string;
	sha256?: string;
	oldHash?: string;
	newHash?: string;
}

export type InspectorEntity =
	| { type: 'event'; data: SystemLog }
	| { type: 'ip'; data: InspectorIpData }
	| { type: 'incident'; data: SocIncident }
	| { type: 'session'; data: ActiveSessionInfo }
	| { type: 'fim'; data: InspectorFimData };

export interface ContextMenuState {
	x: number;
	y: number;
	type: 'ip' | 'user' | 'service' | 'hash';
	value: string;
	meta?: Record<string, unknown>;
}

export type SoarPlaybookId =
	| 'brute-force-containment'
	| 'compromised-account-isolation'
	| 'webshell-quarantine';

export interface SoarPlaybookDefinition {
	id: SoarPlaybookId;
	title: string;
	titleTr: string;
	description: string;
	descriptionTr: string;
	blastRadius: string;
	blastRadiusTr: string;
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface SoarPlaybookExecutionResult {
	success: boolean;
	playbookId: SoarPlaybookId;
	actionsTaken: string[];
	evidenceSha256?: string;
	timestamp: number;
	error?: string;
}

export interface ForensicCaseDossier {
	incidentId: string;
	title: string;
	severity: string;
	status: string;
	generatedAt: number;
	generatedBy: string;
	evidenceSha256: string;
	timeline: Array<{ time: number; event: string; detail?: string }>;
	relatedSiemLogs: SystemLog[];
	networkIntelligence: {
		sourceIp: string | null;
		threatIntel?: ThreatIntelligence;
		banStatus?: string;
	};
	fimDiffSummary?: {
		path: string;
		hash?: string;
		diffSnippet?: string;
	};
	analystNotes: string;
}
