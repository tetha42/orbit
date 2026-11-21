export interface ThreatIntelligence {
	ip?: string;
	provider?: string;
	isDatacenter?: boolean;
	isCloudHosting?: boolean;
	isTor?: boolean;
	isTorExitNode?: boolean;
	isTorExit?: boolean;
	autonomousSystemOrg?: string;
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

export interface SecurityBlock {
	ip: string;
	status: 'ban' | 'whitelist';
	reason: string;
	threatScore: number;
	violations: number;
	creatorId: string | null;
	expiresAt: number | null;
	creation: number;
	update: number;
	threatIntel?: ThreatIntelligence;
}

export interface ActiveSessionInfo {
	id: string;
	userId?: string;
	sessionId?: string;
	name: string;
	surname: string;
	email: string;
	roleId: string | null;
	roleName: string;
	admin: boolean;
	status: string;
	totpEnabled: boolean;
	lastLoginDate: number | null;
	sessionEnd: number | null;
	lastLoginIp: string | null;
	lastActiveIp: string | null;
	lastActiveDate: number | null;
	lastLoginUserAgent: string | null;
	ipChanged: boolean;
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
	threatScore: number;
	lastSeen: number;
	lastMessage: string;
	status: 'ban' | 'whitelist' | 'monitoring';
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
