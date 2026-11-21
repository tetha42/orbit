'use client';

import type React from 'react';
import type { useTestbench } from '../testbench/hooks/useTestbench';
import type {
	SocTab,
	TestbenchTab,
	SocOverviewData,
	SecurityBlock,
	ActiveSessionInfo,
	SystemLog,
	IngressDiagnostics,
	WebhookConfig,
	TimeRangePreset,
	HistogramBucket,
	SiemFilterSnapshot,
	SiemSearchOp,
	SiemSearchField,
	EmergencyKillSwitches,
	FimScanResult,
	AppSecSummary,
	SocIncident,
	SocIncidentSeverity,
	SocIncidentStatus,
	InspectorEntity,
	ContextMenuState,
	SoarPlaybookId,
	SoarPlaybookExecutionResult,
} from '../types';

export interface SocContextType {
	activeTab: SocTab;
	setActiveTab: (tab: SocTab) => void;
	openLabTab: (requested: TestbenchTab) => void;
	overview: SocOverviewData | null;
	bans: SecurityBlock[];
	sessions: ActiveSessionInfo[];
	incidents: SocIncident[];
	handleUpdateIncidentStatus: (id: string, status: SocIncidentStatus, analystNotes?: string) => Promise<boolean>;
	handleCreateIncident: (data: { title: string; severity: SocIncidentSeverity; sourceIp?: string; service?: string; analystNotes?: string }) => Promise<void>;
	siemLogs: SystemLog[];
	currentUserId: string;
	callerIp: string;
	ingressDiagnostics: IngressDiagnostics | null;
	liveTail: boolean;
	setLiveTail: React.Dispatch<React.SetStateAction<boolean>>;
	isLoading: boolean;
	isSubmitting: boolean;
	autoRefresh: boolean;
	setAutoRefresh: React.Dispatch<React.SetStateAction<boolean>>;
	banner: { type: 'ok' | 'err'; text: string } | null;
	setBanner: React.Dispatch<React.SetStateAction<{ type: 'ok' | 'err'; text: string } | null>>;
	showNotice: (type: 'ok' | 'err', text: string) => void;
	canView: boolean;
	canManage: boolean;
	language: 'tr' | 'en';

	// Firewall states
	fwIp: string;
	setFwIp: (v: string) => void;
	fwMode: 'ban' | 'whitelist';
	setFwMode: (v: 'ban' | 'whitelist') => void;
	fwDuration: string;
	setFwDuration: (v: string) => void;
	fwReason: string;
	setFwReason: (v: string) => void;
	fwFilter: 'all' | 'ban' | 'whitelist';
	setFwFilter: (v: 'all' | 'ban' | 'whitelist') => void;
	handleFirewallSubmit: (e: React.FormEvent) => Promise<void>;
	handleQuickBan: (ip: string, reason: string) => Promise<void>;
	handleUnban: (ip: string) => Promise<void>;
	handleClearRateLimit: (key: string) => Promise<void>;

	// Sessions states
	handleKillSession: (session: ActiveSessionInfo) => Promise<void>;
	handleKillAllOtherSessions: () => Promise<void>;
	handleRevokeAnomalousSessions: () => Promise<void>;
	handleSuspendUser: (session: ActiveSessionInfo) => Promise<void>;

	// SIEM states
	siemService: string;
	setSiemService: (v: string) => void;
	siemServiceOp: 'eq' | 'neq';
	setSiemServiceOp: (v: 'eq' | 'neq') => void;
	siemLevel: string;
	setSiemLevel: (v: string) => void;
	siemLevelOp: 'eq' | 'neq';
	setSiemLevelOp: (v: 'eq' | 'neq') => void;
	siemIp: string;
	setSiemIp: (v: string) => void;
	siemIpOp: 'eq' | 'neq' | 'contains' | 'not_contains';
	setSiemIpOp: (v: 'eq' | 'neq' | 'contains' | 'not_contains') => void;
	siemSearch: string;
	setSiemSearch: (v: string) => void;
	siemSearchOp: SiemSearchOp;
	setSiemSearchOp: (v: SiemSearchOp) => void;
	siemSearchField: SiemSearchField;
	setSiemSearchField: (v: SiemSearchField) => void;
	expandedLogIds: Set<number>;
	setExpandedLogIds: React.Dispatch<React.SetStateAction<Set<number>>>;
	toggleLogDetail: (id: number) => void;
	siemTimeRange: TimeRangePreset;
	setSiemTimeRange: (v: TimeRangePreset) => void;
	siemStartTime: number | null;
	setSiemStartTime: (v: number | null) => void;
	siemEndTime: number | null;
	setSiemEndTime: (v: number | null) => void;
	siemPage: number;
	setSiemPage: (v: number) => void;
	siemLimit: number;
	setSiemLimit: (v: number) => void;
	siemTotalCount: number;
	siemTotalPages: number;
	siemHistogram: HistogramBucket[];
	pageJump: string;
	setPageJump: (v: string) => void;
	selectedBucket: number | null;
	setSelectedBucket: (v: number | null) => void;
	fetchSiemFiltered: (overrides?: Partial<SiemFilterSnapshot>, silent?: boolean) => Promise<void>;
	handleQuickExcludeLevel: (level: string) => void;
	handleQuickExcludeService: (service: string) => void;
	handleQuickExcludeIp: (ipVal: string) => void;
	handleResetAllFilters: () => void;
	handleSelectTimeRange: (range: TimeRangePreset) => void;
	handleZoomBucket: (bucket: HistogramBucket) => void;
	handleApplyCustomDate: () => void;
	handlePivotFilter: (field: string, value: string, op: 'eq' | 'neq') => void;
	handlePageChange: (newPage: number) => void;
	handleLimitChange: (newLimit: number) => void;
	handlePageJumpSubmit: () => void;
	handleExportSiem: (format: 'csv' | 'json') => void;

	// Inspection states
	inspectionSubTab: 'api' | 'fim';
	setInspectionSubTab: (v: 'api' | 'fim') => void;
	fimTarget: string;
	setFimTarget: (v: string) => void;
	handleTargetChange: (newTarget: string) => void;
	fimResult: FimScanResult | null;
	appSecResult: AppSecSummary | null;
	inspectionLoading: boolean;
	inspectionError: string | null;
	setInspectionError: (v: string | null) => void;
	apiFilterCategory: string;
	setApiFilterCategory: (v: string) => void;
	apiSearch: string;
	setApiSearch: (v: string) => void;
	probingEndpoint: string | null;
	reportLoading: boolean;
	fetchInspectionData: (target?: string, force?: boolean) => Promise<void>;
	handleTriggerFimScan: () => Promise<void>;
	handleTriggerApiScan: () => Promise<void>;
	handleCreateBaseline: () => Promise<void>;
	handleProbeSingleRoute: (endpoint: string) => Promise<void>;
	handleDownloadAuditReport: () => Promise<void>;

	// Defcon & Lockdown
	isResettingDefcon: boolean;
	handleResetDefcon: () => Promise<void>;
	handleToggleLockdown: () => Promise<void>;
	showLockdownModal: boolean;
	setShowLockdownModal: (v: boolean) => void;
	confirmLockdownToggle: () => Promise<void>;

	// Killswitches & Webhooks
	handleToggleKillSwitch: (key: keyof EmergencyKillSwitches, value: boolean) => Promise<void>;
	showWebhookModal: boolean;
	setShowWebhookModal: (v: boolean) => void;
	webhookConfig: WebhookConfig;
	setWebhookConfig: React.Dispatch<React.SetStateAction<WebhookConfig>>;
	isTestingWebhook: boolean;
	handleSaveWebhook: (overrideConfig?: WebhookConfig) => Promise<void>;
	handleTestWebhook: (overrideConfig?: WebhookConfig) => Promise<void>;
	handleToggleNotifyOn: (key: 'lockdown' | 'autoban' | 'honeypot' | 'fim' | 'loginAnomalies', val: boolean) => void;

	// Modals
	forensicLog: SystemLog | null;
	setForensicLog: React.Dispatch<React.SetStateAction<SystemLog | null>>;
	handleOpenForensicLog: (log: SystemLog) => void;
	handleCopyForensic: () => void;
	forensicCopied: boolean;
	showCustomDateModal: boolean;
	setShowCustomDateModal: (v: boolean) => void;
	customDateStart: string;
	setCustomDateStart: (v: string) => void;
	customDateEnd: string;
	setCustomDateEnd: (v: string) => void;

	// Actions runner
	fetchAll: (silent?: boolean) => Promise<void>;
	runSocAction: (payload: Record<string, unknown>, successMsg: string) => Promise<boolean>;

	// Testbench hook
	tb: ReturnType<typeof useTestbench>;

	// Text selection
	handleSelectDataOnDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
	handleDataContainerDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;

	// Global Studio Search
	globalSearch: string;
	setGlobalSearch: (v: string) => void;

	// 3-Pane Inspector Drawer
	inspectorEntity: InspectorEntity | null;
	isInspectorOpen: boolean;
	openInspector: (entity: InspectorEntity) => void;
	closeInspector: () => void;
	toggleInspector: () => void;

	// Universal Right-Click Context Menu
	contextMenu: ContextMenuState | null;
	setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState | null>>;
	openContextMenu: (e: React.MouseEvent, type: 'ip' | 'user' | 'service' | 'hash', value: string, meta?: Record<string, unknown>) => void;
	closeContextMenu: () => void;

	// SOAR Playbooks & OS Integration
	handleExecutePlaybook: (playbookId: SoarPlaybookId, target: { ip?: string; userId?: string; path?: string; incidentId?: string }) => Promise<SoarPlaybookExecutionResult>;
	handleKillUserTerminals: (userId: string) => Promise<boolean>;
	handleExportCaseDossier: (incidentId: string) => Promise<void>;
}
