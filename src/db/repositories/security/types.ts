import type { ThreatIntelligence } from '@/server/security/threatIntelligence';
import type { WebhookConfig } from '@/server/security/securityWebhook';
import type { ActiveRateLimit } from '@/lib/rateLimit';

export interface HostAndPoolTelemetry {
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
	userId?: string;
	sessionId?: string;
	firstName?: string;
	lastName?: string;
	roleName?: string;
	lastLoginAt?: number | null;
	sessionExpiresAt?: number | null;
	lastLoginIp?: string | null;
	lastActiveIp?: string | null;
	lastActiveAt?: number | null;
	lastLoginUserAgent?: string | null;
	name: string;
	surname: string;
	email: string;
	roleId: string | null;
	admin: boolean;
	status: string;
	totpEnabled: boolean;
	lastLoginDate: number | null;
	sessionEnd: number | null;
	lastActiveDate: number | null;
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

export interface LockdownState {
	active: boolean;
	reason: string;
	updatedAt: number | null;
}

export interface EmergencyKillSwitches {
	disableRegistrations: boolean;
	disableUploads: boolean;
	passkeyOnly: boolean;
}

export interface HourlyAttackPoint {
	hourLabel: string;
	timestamp: number;
	blockedCount: number;
	warningCount: number;
	totalCount: number;
}

export interface SocOverviewData {
	defcon: 1 | 2 | 3 | 4 | 5;
	lockdown: LockdownState;
	emergencySwitches: EmergencyKillSwitches;
	webhookConfig: WebhookConfig;
	metrics: {
		activeBansCount: number;
		whitelistedCount: number;
		securityEvents24h: number;
		authFailures24h: number;
		csrfAndIdor24h: number;
		sessionAnomalies24h: number;
		activeSessionsCount: number;
		activeRateLimits: ActiveRateLimit[];
		activeRateLimitsCount: number;
	};
	hourlyTimeline?: Array<{
		hourLabel: string;
		timestamp: number;
		warnCount: number;
		errorCount: number;
	}>;
	hourlyDistribution?: HourlyAttackPoint[];
	topAttackers: TopAttackerItem[];
	systemTelemetry: HostAndPoolTelemetry;
	defconResetAt: number;
}
