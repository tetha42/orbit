import type { ActiveSessionInfo, SecurityBlock, ThreatIntelligence, TopAttackerItem } from './telemetry';
import type { FimAnomaly, FimSuspiciousMatch, SystemLog } from './inspection';

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
