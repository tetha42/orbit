'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useSession } from '@/core/session';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useWindowFocusTarget } from '@/core/windows';
import { useTestbench } from '../testbench/hooks/useTestbench';
import { compileForensicDossier, downloadDossierFile } from '../utils/dossier';
import type {
	SocTab,
	TestbenchTab,
	SocOverviewData,
	SecurityBlock,
	AktifOturumBilgisi,
	SystemLog,
	IngressDiagnostics,
	WebhookConfig,
	TimeRangePreset,
	HistogramBucket,
	SiemFilterSnapshot,
	SiemAramaOp,
	SiemAramaAlani,
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
import { LAB_KULLAN_TABS } from '../types';

interface SocContextType {
	activeTab: SocTab;
	setActiveTab: (tab: SocTab) => void;
	openLabTab: (requested: TestbenchTab) => void;
	overview: SocOverviewData | null;
	bans: SecurityBlock[];
	sessions: AktifOturumBilgisi[];
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
	isEn: boolean;
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
	handleKillSession: (session: AktifOturumBilgisi) => Promise<void>;
	handleKillAllOtherSessions: () => Promise<void>;
	handleRevokeAnomalousSessions: () => Promise<void>;
	handleSuspendUser: (session: AktifOturumBilgisi) => Promise<void>;

	// SIEM states
	siemServis: string;
	setSiemServis: (v: string) => void;
	siemServisOp: 'eq' | 'neq';
	setSiemServisOp: (v: 'eq' | 'neq') => void;
	siemSeviye: string;
	setSiemSeviye: (v: string) => void;
	siemSeviyeOp: 'eq' | 'neq';
	setSiemSeviyeOp: (v: 'eq' | 'neq') => void;
	siemIp: string;
	setSiemIp: (v: string) => void;
	siemIpOp: 'eq' | 'neq' | 'contains' | 'not_contains';
	setSiemIpOp: (v: 'eq' | 'neq' | 'contains' | 'not_contains') => void;
	siemArama: string;
	setSiemArama: (v: string) => void;
	siemAramaOp: SiemAramaOp;
	setSiemAramaOp: (v: SiemAramaOp) => void;
	siemAramaAlani: SiemAramaAlani;
	setSiemAramaAlani: (v: SiemAramaAlani) => void;
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
	handleQuickExcludeSeviye: (level: string) => void;
	handleQuickExcludeServis: (service: string) => void;
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

	// 24h Timeline Filter Linkage
	selectedHourFilter: { hourLabel: string; start: number; end: number } | null;
	setSelectedHourFilter: React.Dispatch<React.SetStateAction<{ hourLabel: string; start: number; end: number } | null>>;

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

const SocContext = createContext<SocContextType | null>(null);

export function SocProvider({ children }: { children: ReactNode }) {
	const { isAdmin, canUseApp, canManageApp } = useSession();
	const { language } = useI18n();
	const dialog = useDialog();

	const isEn = language === 'en';
	const canView = isAdmin || canUseApp('soc');
	const canManage = isAdmin || canManageApp('soc');
	const tb = useTestbench(canManage);

	const [activeTab, setActiveTabState] = useState<SocTab>('radar');
	const [globalSearch, setGlobalSearch] = useState<string>('');
	const [overview, setOverview] = useState<SocOverviewData | null>(null);
	const [bans, setBans] = useState<SecurityBlock[]>([]);
	const [sessions, setSessions] = useState<AktifOturumBilgisi[]>([]);
	const [incidents, setIncidents] = useState<SocIncident[]>([]);
	const [siemLogs, setSiemLogs] = useState<SystemLog[]>([]);
	const [currentUserId, setCurrentUserId] = useState<string>('');
	const [callerIp, setCallerIp] = useState<string>('');

	// Ingress & Container Diagnostics
	const [ingressDiagnostics, setIngressDiagnostics] = useState<IngressDiagnostics | null>(null);

	// Real-time Live Tail SSE Stream
	const [liveTail, setLiveTail] = useState<boolean>(false);

	// Forensic Payload Inspector Modal
	const [forensicLog, setForensicLog] = useState<SystemLog | null>(null);
	const [forensicCopied, setForensicCopied] = useState<boolean>(false);

	// Webhook Configuration Modal
	const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);
	const showWebhookModalRef = useRef<boolean>(false);

	const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
		enabled: false,
		provider: 'discord',
		webhookUrl: '',
		botToken: '',
		chatId: '',
		emailRecipients: '',
		alsoSendEmail: false,
		minSeverity: 'WARN',
		notifyOn: {
			lockdown: true,
			autoban: true,
			honeypot: true,
			fim: true,
			loginAnomalies: false,
		},
	});
	const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);

	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
	const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

	// Firewall manual form state
	const [fwIp, setFwIp] = useState('');
	const [fwMode, setFwMode] = useState<'ban' | 'whitelist'>('ban');
	const [fwDuration, setFwDuration] = useState<string>('120');
	const [fwReason, setFwReason] = useState('');
	const [fwFilter, setFwFilter] = useState<'all' | 'ban' | 'whitelist'>('all');

	// SIEM Filter State
	const [siemServis, setSiemServis] = useState<string>('all');
	const [siemServisOp, setSiemServisOp] = useState<'eq' | 'neq'>('eq');
	const [siemSeviye, setSiemSeviye] = useState<string>('all');
	const [siemSeviyeOp, setSiemSeviyeOp] = useState<'eq' | 'neq'>('eq');
	const [siemIp, setSiemIp] = useState<string>('');
	const [siemIpOp, setSiemIpOp] = useState<'eq' | 'neq' | 'contains' | 'not_contains'>('eq');
	const [siemArama, setSiemArama] = useState<string>('');
	const [siemAramaOp, setSiemAramaOp] = useState<SiemAramaOp>('contains');
	const [siemAramaAlani, setSiemAramaAlani] = useState<SiemAramaAlani>('all');
	const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());

	// SIEM Time Range & Pagination State
	const [siemTimeRange, setSiemTimeRange] = useState<TimeRangePreset>('24h');
	const [siemStartTime, setSiemStartTime] = useState<number | null>(null);
	const [siemEndTime, setSiemEndTime] = useState<number | null>(null);
	const [siemPage, setSiemPage] = useState<number>(1);
	const [siemLimit, setSiemLimit] = useState<number>(50);
	const [siemTotalCount, setSiemTotalCount] = useState<number>(0);
	const [siemTotalPages, setSiemTotalPages] = useState<number>(1);
	const [siemHistogram, setSiemHistogram] = useState<HistogramBucket[]>([]);
	const [pageJump, setPageJump] = useState<string>('');
	const [showCustomDateModal, setShowCustomDateModal] = useState<boolean>(false);
	const [customDateStart, setCustomDateStart] = useState<string>('');
	const [customDateEnd, setCustomDateEnd] = useState<string>('');
	const [isResettingDefcon, setIsResettingDefcon] = useState<boolean>(false);
	const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
	const [showLockdownModal, setShowLockdownModal] = useState<boolean>(false);

	// 3-Pane Inspector Drawer State
	const [inspectorEntity, setInspectorEntity] = useState<InspectorEntity | null>(null);
	const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

	const openInspector = useCallback((entity: InspectorEntity) => {
		setInspectorEntity(entity);
		setIsInspectorOpen(true);
	}, []);

	const closeInspector = useCallback(() => {
		setIsInspectorOpen(false);
	}, []);

	const toggleInspector = useCallback(() => {
		setIsInspectorOpen((prev) => !prev);
	}, []);

	// 24h Timeline Hour Filter Linkage
	const [selectedHourFilter, setSelectedHourFilter] = useState<{ hourLabel: string; start: number; end: number } | null>(null);

	// Universal Right-Click Context Menu
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

	const openContextMenu = useCallback(
		(e: React.MouseEvent, type: 'ip' | 'user' | 'service' | 'hash', value: string, meta?: Record<string, unknown>) => {
			e.preventDefault();
			e.stopPropagation();
			setContextMenu({ x: e.clientX, y: e.clientY, type, value, meta });
		},
		[]
	);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	const siemFilterRef = useRef<SiemFilterSnapshot>({
		servis: 'all',
		servisOp: 'eq',
		seviye: 'all',
		seviyeOp: 'eq',
		ip: '',
		ipOp: 'eq',
		arama: '',
		aramaOp: 'contains',
		aramaAlani: 'all',
		timeRange: '24h',
		page: 1,
		limit: 50,
	});

	// Mavi Takım Teftiş State
	const [inspectionSubTab, setInspectionSubTab] = useState<'api' | 'fim'>('api');
	const [fimTarget, setFimTarget] = useState<string>('repo');
	const [fimResult, setFimResult] = useState<FimScanResult | null>(null);
	const [appSecResult, setAppSecResult] = useState<AppSecSummary | null>(null);
	const [inspectionLoading, setInspectionLoading] = useState<boolean>(false);
	const [inspectionError, setInspectionError] = useState<string | null>(null);
	const [apiFilterCategory, setApiFilterCategory] = useState<string>('all');
	const [apiSearch, setApiSearch] = useState<string>('');
	const [probingEndpoint, setProbingEndpoint] = useState<string | null>(null);
	const [reportLoading, setReportLoading] = useState<boolean>(false);

	// Race condition guards
	const inspectionAbortRef = useRef<AbortController | null>(null);
	const inspectionRequestIdRef = useRef<number>(0);

	useEffect(() => {
		siemFilterRef.current = {
			servis: siemServis,
			servisOp: siemServisOp,
			seviye: siemSeviye,
			seviyeOp: siemSeviyeOp,
			ip: siemIp,
			ipOp: siemIpOp,
			arama: siemArama,
			aramaOp: siemAramaOp,
			aramaAlani: siemAramaAlani,
			timeRange: siemTimeRange,
			startTime: siemStartTime ?? undefined,
			endTime: siemEndTime ?? undefined,
			page: siemPage,
			limit: siemLimit,
		};
	}, [
		siemServis,
		siemServisOp,
		siemSeviye,
		siemSeviyeOp,
		siemIp,
		siemIpOp,
		siemArama,
		siemAramaOp,
		siemAramaAlani,
		siemTimeRange,
		siemStartTime,
		siemEndTime,
		siemPage,
		siemLimit,
	]);

	useEffect(() => {
		showWebhookModalRef.current = showWebhookModal;
	}, [showWebhookModal]);

	const showNotice = useCallback((type: 'ok' | 'err', text: string) => {
		setBanner({ type, text });
	}, []);

	const buildSiemQueryParams = useCallback(
		(overrides?: Partial<SiemFilterSnapshot>): URLSearchParams => {
			const current: SiemFilterSnapshot = { ...siemFilterRef.current, ...overrides };
			const params = new URLSearchParams();

			if (current.servis && current.servis !== 'all') {
				params.set('servis', current.servis);
				if (current.servisOp === 'neq') params.set('servisOp', 'neq');
			}
			if (current.seviye && current.seviye !== 'all') {
				params.set('seviye', current.seviye);
				if (current.seviyeOp === 'neq') params.set('seviyeOp', 'neq');
			}
			if (current.ip && current.ip.trim()) {
				params.set('ip', current.ip.trim());
				if (current.ipOp !== 'eq') params.set('ipOp', current.ipOp);
			}
			if (current.arama && current.arama.trim()) {
				params.set('arama', current.arama.trim());
				if (current.aramaOp !== 'contains') params.set('aramaOp', current.aramaOp);
				if (current.aramaAlani !== 'all') params.set('aramaAlani', current.aramaAlani);
			}
			if (current.timeRange && current.timeRange !== 'all') {
				params.set('timeRange', current.timeRange);
			}
			if (current.startTime) {
				params.set('startTime', String(current.startTime));
			}
			if (current.endTime) {
				params.set('endTime', String(current.endTime));
			}
			params.set('page', String(current.page || 1));
			params.set('limit', String(current.limit || 50));

			return params;
		},
		[]
	);

	const fetchAll = useCallback(
		async (silent = false) => {
			if (!canView) return;
			if (!silent) setIsLoading(true);
			try {
				const params = buildSiemQueryParams();
				params.set('action', 'all');

				const res = await fetch(`/api/soc?${params.toString()}`, { cache: 'no-store' });
				if (!res.ok) {
					const errData = await res.json().catch(() => ({}));
					if (!silent) {
						showNotice('err', errData.error || (isEn ? 'Failed to load SoC telemetry.' : 'SoC telemetrisi yüklenemedi.'));
					}
					return;
				}
				const data = await res.json();
				if (data.overview) {
					setOverview(data.overview);
					if (data.overview.webhookConfig && !showWebhookModalRef.current) {
						setWebhookConfig((prev) => ({
							...prev,
							...data.overview.webhookConfig,
							emailRecipients: data.overview.webhookConfig.emailRecipients ?? prev.emailRecipients ?? '',
							alsoSendEmail: Boolean(data.overview.webhookConfig.alsoSendEmail ?? prev.alsoSendEmail),
							notifyOn: {
								lockdown: true,
								autoban: true,
								honeypot: true,
								fim: true,
								loginAnomalies: false,
								...(prev.notifyOn || {}),
								...(data.overview.webhookConfig?.notifyOn || {}),
							},
						}));
					}
				}
				if (data.ingressDiagnostics) setIngressDiagnostics(data.ingressDiagnostics);
				if (Array.isArray(data.bans)) setBans(data.bans);
				if (Array.isArray(data.sessions)) setSessions(data.sessions);
				if (Array.isArray(data.incidents)) setIncidents(data.incidents);
				if (Array.isArray(data.siem)) setSiemLogs(data.siem);
				if (data.siemMeta) {
					if (typeof data.siemMeta.totalCount === 'number') setSiemTotalCount(data.siemMeta.totalCount);
					if (typeof data.siemMeta.page === 'number') setSiemPage(data.siemMeta.page);
					if (typeof data.siemMeta.totalPages === 'number') setSiemTotalPages(data.siemMeta.totalPages);
					if (Array.isArray(data.siemMeta.histogram)) setSiemHistogram(data.siemMeta.histogram);
				}
				if (data.currentUserId) setCurrentUserId(data.currentUserId);
				if (data.callerIp) setCallerIp(data.callerIp);
			} catch {
				if (!silent) {
					showNotice('err', isEn ? 'Network error while fetching SoC data.' : 'SoC verileri alınırken ağ hatası oluştu.');
				}
			} finally {
				if (!silent) setIsLoading(false);
			}
		},
		[canView, isEn, showNotice, buildSiemQueryParams]
	);

	const fetchSiemFiltered = useCallback(
		async (overrides?: Partial<SiemFilterSnapshot>, silent = false) => {
			if (!canView) return;
			if (!silent) setIsLoading(true);
			try {
				const params = buildSiemQueryParams(overrides);
				params.set('action', 'siem');

				const res = await fetch(`/api/soc?${params.toString()}`, { cache: 'no-store' });
				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data.siem)) {
						setSiemLogs(data.siem);
					}
					if (typeof data.totalCount === 'number') setSiemTotalCount(data.totalCount);
					if (typeof data.page === 'number') setSiemPage(data.page);
					if (typeof data.totalPages === 'number') setSiemTotalPages(data.totalPages);
					if (Array.isArray(data.histogram)) setSiemHistogram(data.histogram);
				}
			} catch {
				if (!silent) {
					showNotice('err', isEn ? 'SIEM query failed.' : 'SIEM log sorgusu başarısız oldu.');
				}
			} finally {
				if (!silent) setIsLoading(false);
			}
		},
		[canView, isEn, showNotice, buildSiemQueryParams]
	);

	const handleResetDefcon = useCallback(async () => {
		if (!canManage || isResettingDefcon) return;
		const confirmed = await dialog.confirm({
			title: isEn ? 'Acknowledge Alarms & Reset DEFCON?' : 'Alarmları Teyit Et & DEFCON Seviyesini Sıfırla?',
			message: isEn
				? 'This will acknowledge past security alerts, clear threat baseline counters, and return the cyber defense system to DEFCON 5 (Peace Mode). Continue?'
				: 'Bu işlem geçmiş güvenlik alarmlarını teyit edilmiş sayar, tehdit sayacını arşivler ve siber savunma kalkanını DEFCON 5 (Normal Barış Hali) seviyesine döndürür. Devam edilsin mi?',
			tone: 'warning',
		});
		if (!confirmed) return;

		setIsResettingDefcon(true);
		try {
			const res = await fetch('/api/soc', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'reset_defcon' }),
			});
			const data = await res.json();
			if (res.ok) {
				showNotice('ok', isEn ? 'DEFCON reset to Level 5 (Peace).' : 'DEFCON başarıyla Seviye 5 (Barış) moduna sıfırlandı.');
				void fetchAll(true);
			} else {
				showNotice('err', data.error || (isEn ? 'Failed to reset DEFCON.' : 'DEFCON sıfırlanamadı.'));
			}
		} catch {
			showNotice('err', isEn ? 'Network error.' : 'Ağ hatası.');
		} finally {
			setIsResettingDefcon(false);
		}
	}, [canManage, isResettingDefcon, dialog, isEn, showNotice, fetchAll]);

	const handleExportSiem = useCallback(
		(format: 'csv' | 'json') => {
			const q = buildSiemQueryParams({ page: 1, limit: 5000 }).toString();
			const url = `/api/soc/export?format=${format}${q ? `&${q}` : ''}`;
			const link = document.createElement('a');
			link.href = url;
			link.download = `siem-export-${Date.now()}.${format}`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		},
		[buildSiemQueryParams]
	);

	const handleQuickExcludeSeviye = useCallback(
		(level: string) => {
			setSiemSeviye(level);
			setSiemSeviyeOp('neq');
			void fetchSiemFiltered({ seviye: level, seviyeOp: 'neq' });
		},
		[fetchSiemFiltered]
	);

	const handleQuickExcludeServis = useCallback(
		(service: string) => {
			setSiemServis(service);
			setSiemServisOp('neq');
			void fetchSiemFiltered({ servis: service, servisOp: 'neq' });
		},
		[fetchSiemFiltered]
	);

	const handleQuickExcludeIp = useCallback(
		(ipVal: string) => {
			setSiemIp(ipVal);
			setSiemIpOp('neq');
			void fetchSiemFiltered({ ip: ipVal, ipOp: 'neq' });
		},
		[fetchSiemFiltered]
	);

	const handleResetAllFilters = useCallback(() => {
		setSiemServis('all');
		setSiemServisOp('eq');
		setSiemSeviye('all');
		setSiemSeviyeOp('eq');
		setSiemIp('');
		setSiemIpOp('eq');
		setSiemArama('');
		setSiemAramaOp('contains');
		setSiemAramaAlani('all');
		setSiemTimeRange('24h');
		setSiemStartTime(null);
		setSiemEndTime(null);
		setSelectedBucket(null);
		setSiemPage(1);
		void fetchSiemFiltered({
			servis: 'all',
			servisOp: 'eq',
			seviye: 'all',
			seviyeOp: 'eq',
			ip: '',
			ipOp: 'eq',
			arama: '',
			aramaOp: 'contains',
			aramaAlani: 'all',
			timeRange: '24h',
			startTime: undefined,
			endTime: undefined,
			page: 1,
		});
	}, [fetchSiemFiltered]);

	const handleSelectTimeRange = useCallback(
		(range: TimeRangePreset) => {
			if (range === 'custom') {
				setShowCustomDateModal(true);
				return;
			}
			setSiemTimeRange(range);
			setSiemStartTime(null);
			setSiemEndTime(null);
			setSelectedBucket(null);
			setSiemPage(1);
			void fetchSiemFiltered({
				timeRange: range,
				startTime: undefined,
				endTime: undefined,
				page: 1,
			});
		},
		[fetchSiemFiltered]
	);

	const handleZoomBucket = useCallback(
		(bucket: HistogramBucket) => {
			if (selectedBucket === bucket.start) {
				setSelectedBucket(null);
				setSiemStartTime(null);
				setSiemEndTime(null);
				setSiemPage(1);
				void fetchSiemFiltered({
					startTime: undefined,
					endTime: undefined,
					page: 1,
				});
				return;
			}
			setSelectedBucket(bucket.start);
			setSiemTimeRange('custom');
			setSiemStartTime(bucket.start);
			setSiemEndTime(bucket.end);
			setSiemPage(1);
			void fetchSiemFiltered({
				timeRange: 'custom',
				startTime: bucket.start,
				endTime: bucket.end,
				page: 1,
			});
		},
		[selectedBucket, fetchSiemFiltered]
	);

	const handleApplyCustomDate = useCallback(() => {
		if (!customDateStart || !customDateEnd) {
			showNotice('err', isEn ? 'Please choose start and end date/time.' : 'Lütfen başlangıç ve bitiş zamanı seçin.');
			return;
		}
		const startTs = new Date(customDateStart).getTime();
		const endTs = new Date(customDateEnd).getTime();
		if (isNaN(startTs) || isNaN(endTs) || startTs >= endTs) {
			showNotice('err', isEn ? 'Invalid date range: start must be before end.' : 'Geçersiz date aralığı: başlangıç bitişten önce olmalı.');
			return;
		}
		setShowCustomDateModal(false);
		setSiemTimeRange('custom');
		setSiemStartTime(startTs);
		setSiemEndTime(endTs);
		setSelectedBucket(null);
		setSiemPage(1);
		void fetchSiemFiltered({
			timeRange: 'custom',
			startTime: startTs,
			endTime: endTs,
			page: 1,
		});
	}, [customDateStart, customDateEnd, isEn, showNotice, fetchSiemFiltered]);

	const handlePivotFilter = useCallback(
		(field: string, value: string, op: 'eq' | 'neq') => {
			if (!value) return;
			if (field === 'ip') {
				setSiemIp(value);
				setSiemIpOp(op);
				setSiemPage(1);
				void fetchSiemFiltered({ ip: value, ipOp: op, page: 1 });
			} else if (field === 'servis') {
				setSiemServis(value);
				setSiemServisOp(op);
				setSiemPage(1);
				void fetchSiemFiltered({ servis: value, servisOp: op, page: 1 });
			} else if (field === 'seviye') {
				setSiemSeviye(value);
				setSiemSeviyeOp(op);
				setSiemPage(1);
				void fetchSiemFiltered({ seviye: value, seviyeOp: op, page: 1 });
			} else if (field === 'userId') {
				setSiemAramaAlani('userId');
				setSiemArama(value);
				const aramaOp = op === 'eq' ? 'equals' : 'not_equals';
				setSiemAramaOp(aramaOp);
				setSiemPage(1);
				void fetchSiemFiltered({ aramaAlani: 'userId', arama: value, aramaOp, page: 1 });
			} else {
				const searchTerm = `"${field}":`;
				setSiemAramaAlani('detay');
				setSiemArama(searchTerm);
				const aramaOp = op === 'eq' ? 'contains' : 'not_contains';
				setSiemAramaOp(aramaOp);
				setSiemPage(1);
				void fetchSiemFiltered({ aramaAlani: 'detay', arama: searchTerm, aramaOp, page: 1 });
			}
			showNotice('ok', `${op === 'eq' ? '+' : '≠'} ${field}=${value}`);
		},
		[showNotice, fetchSiemFiltered]
	);

	const handlePageChange = useCallback(
		(newPage: number) => {
			if (newPage < 1 || (siemTotalPages > 0 && newPage > siemTotalPages)) return;
			setSiemPage(newPage);
			void fetchSiemFiltered({ page: newPage });
		},
		[siemTotalPages, fetchSiemFiltered]
	);

	const handleLimitChange = useCallback(
		(newLimit: number) => {
			setSiemLimit(newLimit);
			setSiemPage(1);
			void fetchSiemFiltered({ limit: newLimit, page: 1 });
		},
		[fetchSiemFiltered]
	);

	const handlePageJumpSubmit = useCallback(() => {
		const target = parseInt(pageJump.trim(), 10);
		if (isNaN(target) || target < 1 || (siemTotalPages > 0 && target > siemTotalPages)) {
			showNotice('err', isEn ? `Enter a valid page between 1 and ${siemTotalPages}.` : `1 ile ${siemTotalPages} arasında geçerli bir sayfa girin.`);
			return;
		}
		setPageJump('');
		handlePageChange(target);
	}, [pageJump, siemTotalPages, isEn, showNotice, handlePageChange]);

	useEffect(() => {
		const t = setTimeout(() => {
			void fetchAll(false);
		}, 0);
		return () => clearTimeout(t);
	}, [fetchAll]);

	useEffect(() => {
		if (!autoRefresh || !canView) return;
		const timer = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			void fetchAll(true);
		}, 6000);
		return () => clearInterval(timer);
	}, [autoRefresh, canView, fetchAll]);

	useEffect(() => {
		setExpandedLogIds(new Set());
	}, [siemPage, siemServis, siemSeviye, siemIp, siemArama, siemTimeRange]);

	const fetchInspectionData = useCallback(
		async (target = 'repo', force = false) => {
			if (!canView) return;
			if (inspectionAbortRef.current) {
				inspectionAbortRef.current.abort();
			}
			const controller = new AbortController();
			inspectionAbortRef.current = controller;
			const reqId = ++inspectionRequestIdRef.current;

			setInspectionLoading(true);
			setInspectionError(null);
			if (force) {
				setFimResult(null);
			}

			try {
				const res = await fetch(
					`/api/soc/inspection?target=${encodeURIComponent(target)}${force ? '&refresh=true' : ''}`,
					{
						signal: controller.signal,
						cache: 'no-store',
					}
				);

				if (reqId !== inspectionRequestIdRef.current) return;

				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					setInspectionError(
						err.error || (isEn ? 'Inspection telemetry could not be loaded.' : 'Teftiş verileri alınamadı.')
					);
					return;
				}

				const data = await res.json();
				if (reqId !== inspectionRequestIdRef.current) return;

				if (data.fim) setFimResult(data.fim);
				if (data.appSec) setAppSecResult(data.appSec);
			} catch (err: unknown) {
				if (err instanceof Error && err.name === 'AbortError') return;
				if (reqId === inspectionRequestIdRef.current) {
					setInspectionError(
						isEn ? 'Network error during inspection query.' : 'Teftiş telemetrisi sorgulanırken ağ hatası oluştu.'
					);
				}
			} finally {
				if (reqId === inspectionRequestIdRef.current) {
					setInspectionLoading(false);
				}
			}
		},
		[canView, isEn]
	);

	const setActiveTab = useCallback(
		(tab: SocTab) => {
			if (tab !== 'inspection' && inspectionAbortRef.current) {
				inspectionAbortRef.current.abort();
			}
			setBanner(null);
			setInspectionError(null);
			setActiveTabState(tab);
		},
		[]
	);

	const handleTargetChange = useCallback(
		(newTarget: string) => {
			if (newTarget === fimTarget) return;
			if (inspectionAbortRef.current) {
				inspectionAbortRef.current.abort();
			}
			setFimResult(null);
			setInspectionError(null);
			setFimTarget(newTarget);
		},
		[fimTarget]
	);

	const openLabTab = useCallback(
		(requested: TestbenchTab) => {
			const tab = canManage || LAB_KULLAN_TABS.includes(requested) ? requested : 'api';
			setActiveTab(tab);
			if (tab === 'api' && tb.apiItems.length === 0 && !tb.isRunningSuite) {
				void tb.runApiSuite();
			}
		},
		[canManage, setActiveTab, tb]
	);

	const handleTriggerFimScan = useCallback(async () => {
		if (inspectionAbortRef.current) {
			inspectionAbortRef.current.abort();
		}
		const controller = new AbortController();
		inspectionAbortRef.current = controller;
		const reqId = ++inspectionRequestIdRef.current;

		setInspectionLoading(true);
		setInspectionError(null);
		setFimResult(null);

		try {
			const res = await fetch('/api/soc/inspection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'scan_fim', target: fimTarget }),
				signal: controller.signal,
			});

			if (reqId !== inspectionRequestIdRef.current) return;

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				setInspectionError(err.error || (isEn ? 'FIM scan failed.' : 'FIM taraması başarısız oldu.'));
				return;
			}

			const data = await res.json();
			if (reqId !== inspectionRequestIdRef.current) return;
			if (data.fim) {
				setFimResult(data.fim);
				showNotice(
					'ok',
					isEn
						? `FIM scan complete: ${data.fim.scannedFiles} files checked.`
						: `FIM taraması tamamlandı: ${data.fim.scannedFiles} dosya incelendi.`
				);
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionError(isEn ? 'Network error during FIM scan.' : 'FIM taraması sırasında ağ hatası oluştu.');
			}
		} finally {
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionLoading(false);
			}
		}
	}, [fimTarget, isEn, showNotice]);

	const handleTriggerApiScan = useCallback(async () => {
		if (inspectionAbortRef.current) {
			inspectionAbortRef.current.abort();
		}
		const controller = new AbortController();
		inspectionAbortRef.current = controller;
		const reqId = ++inspectionRequestIdRef.current;

		setInspectionLoading(true);
		setInspectionError(null);
		setAppSecResult(null);

		try {
			const res = await fetch('/api/soc/inspection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'scan_api' }),
				signal: controller.signal,
			});

			if (reqId !== inspectionRequestIdRef.current) return;

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				setInspectionError(err.error || (isEn ? 'API scan failed.' : 'API güvenlik taraması başarısız oldu.'));
				return;
			}

			const data = await res.json();
			if (reqId !== inspectionRequestIdRef.current) return;
			if (data.appSec) {
				setAppSecResult(data.appSec);
				showNotice(
					'ok',
					isEn
						? `API audit complete: ${data.appSec.totalTested} endpoints checked.`
						: `API denetimi tamamlandı: ${data.appSec.totalTested} uç nokta test edildi.`
				);
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionError(isEn ? 'Network error during API scan.' : 'API taraması sırasında ağ hatası oluştu.');
			}
		} finally {
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionLoading(false);
			}
		}
	}, [isEn, showNotice]);

	const handleCreateBaseline = useCallback(async () => {
		if (!canManage) return;
		const confirmed = await dialog.confirm({
			title: isEn ? 'Create Integrity Baseline' : 'Dosya Bütünlüğü Başlangıç Profili Oluştur',
			message: isEn
				? 'All current SHA-256 hashes across the codebase will be committed as the trusted baseline profile. Proceed?'
				: 'Tüm mevcut kod tabanı SHA-256 hash profili güvenilir referans (baseline) olarak kaydedilecektir. Devam edilsin mi?',
			confirmLabel: isEn ? 'Create Baseline' : 'Profili Kaydet',
			cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
			tone: 'info',
		});
		if (!confirmed) return;

		if (inspectionAbortRef.current) {
			inspectionAbortRef.current.abort();
		}
		const controller = new AbortController();
		inspectionAbortRef.current = controller;
		const reqId = ++inspectionRequestIdRef.current;

		setInspectionLoading(true);
		setInspectionError(null);

		try {
			const res = await fetch('/api/soc/inspection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create_baseline', target: fimTarget }),
				signal: controller.signal,
			});

			if (reqId !== inspectionRequestIdRef.current) return;

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				setInspectionError(err.error || (isEn ? 'Failed to create baseline.' : 'Referans profili oluşturulamadı.'));
				return;
			}

			const data = await res.json();
			if (reqId !== inspectionRequestIdRef.current) return;
			if (data.fim) setFimResult(data.fim);
			showNotice('ok', isEn ? 'Baseline successfully generated and saved.' : 'Güvenilir referans profili başarıyla oluşturuldu.');
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionError(isEn ? 'Network error during baseline creation.' : 'Referans profili oluşturulurken ağ hatası oluştu.');
			}
		} finally {
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionLoading(false);
			}
		}
	}, [canManage, dialog, fimTarget, isEn, showNotice]);

	const handleProbeSingleRoute = useCallback(async (endpoint: string) => {
		setProbingEndpoint(endpoint);
		try {
			const res = await fetch('/api/soc/inspection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'probe_route', endpoint }),
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				showNotice('err', err.error || (isEn ? 'Probe failed.' : 'Rota sınaması başarısız.'));
				return;
			}
			const data = await res.json();
			if (data.route) {
				setAppSecResult((prev) => {
					if (!prev) return prev;
					const routes = prev.routes.map((r) => (r.endpoint === endpoint ? data.route : r));
					return { ...prev, routes };
				});
				const r = data.route;
				const statusText =
					r.status === 'PASS'
						? isEn ? 'Secure (PASS)' : 'Güvenli (PASS)'
						: r.status === 'WARN'
						? isEn ? 'Warning (WARN)' : 'Uyarı (WARN)'
						: isEn ? 'Vulnerability (FAIL)' : 'Zafiyet (FAIL)';
				showNotice(
					r.status === 'PASS' ? 'ok' : 'err',
					`${r.endpoint} -> HTTP ${r.unauthStatus} | WAF: ${r.wafIntercepted ? '403' : '—'} | ${statusText} (${r.latencyMs}ms)`
				);
			}
		} catch {
			showNotice('err', isEn ? 'Network error during route probe.' : 'Rota sınaması sırasında ağ hatası oluştu.');
		} finally {
			setProbingEndpoint(null);
		}
	}, [isEn, showNotice]);

	const handleDownloadAuditReport = useCallback(async () => {
		setReportLoading(true);
		try {
			const res = await fetch('/api/soc/inspection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'generate_report' }),
			});
			if (!res.ok) {
				showNotice('err', isEn ? 'Failed to generate audit report.' : 'Denetim raporu üretilemedi.');
				return;
			}
			const data = await res.json();
			if (data.report) {
				const blob = new Blob([data.report], { type: 'text/markdown;charset=utf-8' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `soc-audit-report-${Date.now()}.md`;
				a.click();
				URL.revokeObjectURL(url);
				showNotice('ok', isEn ? 'Audit report downloaded successfully.' : 'Denetim raporu başarıyla indirildi.');
			}
		} catch {
			showNotice('err', isEn ? 'Error downloading audit report.' : 'Rapor indirilirken hata oluştu.');
		} finally {
			setReportLoading(false);
		}
	}, [isEn, showNotice]);

	useEffect(() => {
		if (activeTab === 'inspection') {
			const t = setTimeout(() => {
				void fetchInspectionData(fimTarget, false);
			}, 0);
			return () => clearTimeout(t);
		}
	}, [activeTab, fetchInspectionData, fimTarget]);

	useEffect(() => {
		return () => {
			if (inspectionAbortRef.current) {
				inspectionAbortRef.current.abort();
			}
		};
	}, []);

	const runSocAction = useCallback(
		async (payload: Record<string, unknown>, successMsg: string): Promise<boolean> => {
			if (!canManage) {
				showNotice('err', isEn ? 'Manage permission required for this response action.' : 'Bu müdahale işlemi için SoC Yönetim yetkisi gereklidir.');
				return false;
			}
			setIsSubmitting(true);
			setBanner(null);
			try {
				const res = await fetch('/api/soc', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) {
					showNotice('err', data.error || (isEn ? 'Action failed.' : 'İşlem gerçekleştirilemedi.'));
					return false;
				}
				showNotice('ok', successMsg);
				await fetchAll(true);
				return true;
			} catch {
				showNotice('err', isEn ? 'Network error while executing action.' : 'İşlem sırasında bağlantı hatası oluştu.');
				return false;
			} finally {
				setIsSubmitting(false);
			}
		},
		[canManage, isEn, showNotice, fetchAll]
	);

	const handleToggleLockdown = useCallback(async () => {
		if (!canManage) return;
		setShowLockdownModal(true);
	}, [canManage]);

	const confirmLockdownToggle = useCallback(async () => {
		if (!canManage) return;
		const nextState = !overview?.lockdown.active;
		setShowLockdownModal(false);
		await runSocAction(
			{
				action: 'toggle_lockdown',
				enabled: nextState,
				reason: nextState
					? isEn
						? 'Under Attack Lockdown activated via SoC Command Center'
						: 'SoC Komuta Merkezi üzerinden Saldırı Altındayız Kalkanı açıldı'
					: isEn
					? 'Returned to normal mode via SoC Command Center'
					: 'SoC Komuta Merkezi üzerinden normal moda dönüldü',
			},
			nextState
				? isEn
					? 'DEFCON 1 Lockdown Shield activated.'
					: 'DEFCON 1 Saldırı Altındayız Kalkanı etkinleştirildi.'
				: isEn
				? 'Lockdown Shield deactivated.'
				: 'Saldırı Altındayız Kalkanı devre dışı bırakıldı.'
		);
	}, [canManage, overview?.lockdown.active, runSocAction, isEn]);

	const handleFirewallSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			const targetIp = fwIp.trim();
			if (!targetIp) return;

			if (fwMode === 'ban') {
				const durationMinutes = fwDuration === 'permanent' ? null : Number(fwDuration);
				const ok = await runSocAction(
					{
						action: 'ban_ip',
						ip: targetIp,
						neden:
							fwReason.trim() ||
							(isEn ? 'Manual quarantine by SoC Administrator' : 'SoC Yöneticisi tarafından manuel karantina'),
						durationMinutes,
					},
					isEn ? `IP ${targetIp} quarantined.` : `${targetIp} adresi karantinaya alındı.`
				);
				if (ok) {
					setFwIp('');
					setFwReason('');
				}
			} else {
				const ok = await runSocAction(
					{
						action: 'whitelist_ip',
						ip: targetIp,
						neden:
							fwReason.trim() || (isEn ? 'Trusted IP (Whitelist)' : 'Güvenilir IP (Whitelist)'),
					},
					isEn ? `IP ${targetIp} added to whitelist.` : `${targetIp} adresi güvenilir listeye eklendi.`
				);
				if (ok) {
					setFwIp('');
					setFwReason('');
				}
			}
		},
		[fwIp, fwMode, fwDuration, fwReason, runSocAction, isEn]
	);

	const handleQuickBan = useCallback(
		async (ip: string, reason: string) => {
			if (!ip || ip === 'unknown') return;
			const confirmed = await dialog.confirm({
				title: isEn ? `Quarantine IP ${ip}?` : `${ip} Adresi Karantinaya Alınsın mı?`,
				message: isEn
					? `All requests from ${ip} will be immediately blocked with 403 Forbidden for 2 hours.`
					: `${ip} adresinden gelen tüm istekler 2 saat boyunca anında 403 Forbidden ile engellenecektir.`,
				tone: 'danger',
				confirmLabel: isEn ? 'Quarantine IP' : 'Karantinaya Al',
				cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
			});
			if (!confirmed) return;
			await runSocAction(
				{
					action: 'ban_ip',
					ip,
					neden: reason,
					durationMinutes: 120,
				},
				isEn ? `IP ${ip} quarantined for 2 hours.` : `${ip} adresi 2 saat süreyle karantinaya alındı.`
			);
		},
		[dialog, isEn, runSocAction]
	);

	const handleUnban = useCallback(
		async (ip: string) => {
			await runSocAction(
				{ action: 'unban_ip', ip },
				isEn ? `Rule removed for ${ip}.` : `${ip} için güvenlik duvarı kuralı kaldırıldı.`
			);
		},
		[runSocAction, isEn]
	);

	const handleClearRateLimit = useCallback(
		async (key: string) => {
			const confirmed = await dialog.confirm({
				title: isEn ? 'Reset Rate Limit?' : 'Hız Sınırını Sıfırla?',
				message: isEn
					? `The rate-limit throttle counter for "${key}" will be reset immediately.`
					: `"${key}" için hız sınırı ve kilit sayacı derhal sıfırlanacak.`,
				tone: 'warning',
				confirmLabel: isEn ? 'Reset Rate Limit' : 'Hız Sınırını Sıfırla',
				cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
			});
			if (!confirmed) return;
			await runSocAction(
				{ action: 'clear_rate_limit', key },
				isEn ? `Rate limit reset for ${key}.` : `${key} için hız sınırı sıfırlandı.`
			);
		},
		[dialog, isEn, runSocAction]
	);

	const handleKillSession = useCallback(
		async (session: AktifOturumBilgisi) => {
			const confirmed = await dialog.confirm({
				title: isEn ? 'Terminate User Session?' : 'Oturum Sonlandırılsın mı?',
				message: isEn
					? `Session and active terminal connections for ${session.ad} ${session.soyad} (${session.email}) will be immediately revoked.`
					: `${session.ad} ${session.soyad} (${session.email}) kullanıcısının aktif oturumu ve açık terminal bağlantıları anında sonlandırılacak.`,
				tone: 'warning',
				confirmLabel: isEn ? 'Drop Session' : 'Oturumu Düşür',
				cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
			});
			if (!confirmed) return;
			await runSocAction(
				{ action: 'kill_session', userId: session.id },
				isEn ? `Session revoked for ${session.email}.` : `${session.email} oturumu düşürüldü.`
			);
		},
		[dialog, isEn, runSocAction]
	);

	const handleKillAllOtherSessions = useCallback(async () => {
		const confirmed = await dialog.confirm({
			title: isEn ? 'Emergency Session Kill-Switch' : 'Acil Durum Oturum Sıfırlama (Kill-Switch)',
			message: isEn
				? 'All active sessions and PTY terminals except your own session will be immediately terminated. Do you want to proceed?'
				: 'Kendi oturumunuz hariç sistemdeki tüm aktif kullanıcı oturumları ve açık terminal bağlantıları anında sonlandırılacaktır. Onaylıyor musunuz?',
			tone: 'danger',
			confirmLabel: isEn ? 'Revoke All Other Sessions' : 'Diğer Tüm Oturumları Düşür',
			cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
		});
		if (!confirmed) return;
		await runSocAction(
			{ action: 'kill_all_sessions' },
			isEn ? 'All other active sessions have been revoked.' : 'Diğer tüm aktif oturumlar başarıyla sonlandırıldı.'
		);
	}, [dialog, isEn, runSocAction]);

	const handleRevokeAnomalousSessions = useCallback(async () => {
		const confirmed = await dialog.confirm({
			title: isEn ? 'Drop All Suspicious Sessions?' : 'Tüm Şüpheli Oturumları Düşür?',
			message: isEn
				? 'All active sessions where mid-session IP changes (hijacking anomalies) were detected will be immediately terminated. Do you want to proceed?'
				: 'Oturum açılış IP adresinden farklı bir IP ile işlem yaptığı (IP anomalisi) tespit edilen tüm şüpheli oturumlar kapatılacaktır. Onaylıyor musunuz?',
			tone: 'danger',
			confirmLabel: isEn ? 'Drop Suspicious Sessions' : 'Tüm Şüpheli Oturumları Düşür',
			cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
		});
		if (!confirmed) return;
		await runSocAction(
			{ action: 'revoke_anomalies' },
			isEn ? 'All anomalous sessions have been revoked.' : 'IP anomalisi tespit edilen tüm şüpheli oturumlar düşürüldü.'
		);
	}, [dialog, isEn, runSocAction]);

	const handleSuspendUser = useCallback(
		async (session: AktifOturumBilgisi) => {
			const confirmed = await dialog.confirm({
				title: isEn ? 'Suspend User Account?' : 'Kullanıcı Hesabı Askıya Alınsın mı?',
				message: isEn
					? `${session.ad} ${session.soyad} (${session.email}) will be set to pending status and their active session/terminals will be terminated.`
					: `${session.ad} ${session.soyad} (${session.email}) hesabı askıya alınacak ve tüm aktif oturum/terminalleri kapatılacaktır.`,
				tone: 'danger',
				confirmLabel: isEn ? 'Suspend Account' : 'Hesabı Askıya Al',
				cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
			});
			if (!confirmed) return;
			await runSocAction(
				{ action: 'suspend_user', userId: session.id },
				isEn ? `Account suspended: ${session.email}` : `${session.email} hesabı askıya alındı.`
			);
		},
		[dialog, isEn, runSocAction]
	);

	const handleUpdateIncidentStatus = useCallback(
		async (id: string, status: SocIncidentStatus, analystNotes?: string) => {
			if (!canManage) return false;
			try {
				const res = await fetch('/api/soc', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'update_incident', id, status, analystNotes }),
				});
				if (!res.ok) {
					const json = await res.json().catch(() => ({}));
					showNotice('err', json.error || (isEn ? 'Failed to update incident.' : 'AppEvent durumu güncellenemedi.'));
					return false;
				}
				setIncidents((prev) =>
					prev.map((inc) =>
						inc.id === id
							? { ...inc, status, analystNotes: analystNotes !== undefined ? analystNotes : inc.analystNotes, updatedAt: Date.now() }
							: inc
					)
				);
				showNotice('ok', isEn ? 'Incident status updated.' : 'AppEvent durumu güncellendi.');
				return true;
			} catch {
				showNotice('err', isEn ? 'Network error.' : 'Ağ hatası.');
				return false;
			}
		},
		[canManage, isEn, showNotice]
	);

	const handleCreateIncident = useCallback(
		async (data: { title: string; severity: SocIncidentSeverity; sourceIp?: string; service?: string; analystNotes?: string }) => {
			if (!canManage) return;
			try {
				const res = await fetch('/api/soc', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'create_incident', ...data }),
				});
				if (!res.ok) {
					const json = await res.json().catch(() => ({}));
					showNotice('err', json.error || (isEn ? 'Failed to create incident.' : 'AppEvent oluşturulamadı.'));
					return;
				}
				const json = await res.json();
				if (json.incident) {
					setIncidents((prev) => [json.incident, ...prev]);
					showNotice('ok', isEn ? 'Security incident recorded.' : 'Güvenlik olayı kaydedildi.');
				}
			} catch {
				showNotice('err', isEn ? 'Network error.' : 'Ağ hatası.');
			}
		},
		[canManage, isEn, showNotice]
	);

	const handleKillUserTerminals = useCallback(
		async (userId: string) => {
			const confirmed = await dialog.confirm({
				title: isEn ? 'Kill Active Terminal Shells?' : 'Aktif Terminal Kabukları Kapatılsın mı?',
				message: isEn
					? `All active Linux PTY terminal shells associated with user #${userId} will be immediately terminated.`
					: `#${userId} kullanıcısına ait tüm aktif Linux PTY terminal kabukları sonlandırılacaktır.`,
				tone: 'danger',
				confirmLabel: isEn ? 'Kill Shells' : 'Kabukları Kapat',
				cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
			});
			if (!confirmed) return false;
			return await runSocAction(
				{ action: 'kill_user_terminals', userId },
				isEn ? `Active terminal processes killed for user #${userId}.` : `#${userId} kullanıcısının terminal süreçleri kapatıldı.`
			);
		},
		[dialog, isEn, runSocAction]
	);

	const handleExecutePlaybook = useCallback(
		async (
			playbookId: SoarPlaybookId,
			target: { ip?: string; userId?: string; path?: string; incidentId?: string }
		): Promise<SoarPlaybookExecutionResult> => {
			const confirmed = await dialog.confirm({
				title: isEn ? 'Execute SOAR Automated Playbook?' : 'SOAR Otomatik Tecrit Playbook Çalıştırılsın mı?',
				message: isEn
					? `Executing playbook '${playbookId}'. Automated isolation actions will take immediate effect on target: ${target.ip || target.userId || target.path || 'system'}.`
					: `'${playbookId}' playbook'u derhal yürütülecektir. Hedef (${target.ip || target.userId || target.path || 'sistem'}) için tecrit aksiyonları devreye alınacaktır.`,
				tone: 'danger',
				confirmLabel: isEn ? 'Execute Playbook' : 'Playbook Çalıştır',
				cancelLabel: isEn ? 'Cancel' : 'Vazgeç',
			});
			if (!confirmed) {
				return {
					success: false,
					playbookId,
					actionsTaken: [],
					timestamp: Date.now(),
					error: 'Canceled by analyst',
				};
			}

			setIsSubmitting(true);
			try {
				const res = await fetch('/api/soc/playbooks', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ playbookId, target }),
				});
				const data = await res.json();
				if (!res.ok) {
					showNotice('err', data.error || (isEn ? 'Playbook execution failed.' : 'Playbook çalıştırılamadı.'));
					return data.result || { success: false, playbookId, actionsTaken: [], timestamp: Date.now(), error: data.error };
				}
				showNotice('ok', isEn ? `Playbook '${playbookId}' executed successfully.` : `'${playbookId}' başarıyla icra edildi.`);
				void fetchAll(true);
				return data.result;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				showNotice('err', msg);
				return { success: false, playbookId, actionsTaken: [], timestamp: Date.now(), error: msg };
			} finally {
				setIsSubmitting(false);
			}
		},
		[dialog, isEn, showNotice, fetchAll]
	);

	const handleExportCaseDossier = useCallback(
		async (incidentId: string) => {
			const inc = incidents.find((i) => i.id === incidentId);
			if (!inc) {
				showNotice('err', isEn ? 'Incident not found.' : 'AppEvent bulunamadı.');
				return;
			}
			setIsSubmitting(true);
			try {
				const matchingLogs = siemLogs.filter(
					(l) => (inc.sourceIp && l.ip === inc.sourceIp) || (inc.service && l.servis === inc.service)
				);
				const dossier = await compileForensicDossier(inc, matchingLogs, currentUserId || 'SOC Analyst');
				downloadDossierFile(dossier);
				showNotice('ok', isEn ? 'Forensic Case Dossier downloaded.' : 'Adli vaka dosyası başarıyla indirildi.');
			} catch {
				showNotice('err', isEn ? 'Failed to compile case dossier.' : 'Adli dosya derlenirken hata oluştu.');
			} finally {
				setIsSubmitting(false);
			}
		},
		[incidents, siemLogs, currentUserId, isEn, showNotice]
	);

	// Deep-linking consumer via ClubPanel Window Focus Target
	const { focusTarget, clearFocusTarget } = useWindowFocusTarget();
	useEffect(() => {
		if (!focusTarget || focusTarget.appId !== 'soc') return;
		if (focusTarget.section === 'siem') {
			setActiveTabState('siem');
			if (focusTarget.kind === 'user' && focusTarget.itemId) {
				setSiemArama(focusTarget.itemId);
				setSiemAramaAlani('userId');
				setSiemAramaOp('equals');
			} else if (focusTarget.kind === 'ip' && focusTarget.itemId) {
				setSiemIp(focusTarget.itemId);
				setSiemIpOp('eq');
			}
		} else if (focusTarget.section === 'firewall') {
			setActiveTabState('firewall');
			if (focusTarget.itemId) {
				setFwIp(focusTarget.itemId);
			}
		} else if (focusTarget.section === 'sessions') {
			setActiveTabState('sessions');
		} else if (focusTarget.section === 'radar') {
			setActiveTabState('radar');
		}
		clearFocusTarget(focusTarget.nonce);
	}, [focusTarget, clearFocusTarget]);

	const handleToggleKillSwitch = useCallback(
		async (key: keyof EmergencyKillSwitches, value: boolean) => {
			if (!canManage) return;
			setIsSubmitting(true);
			try {
				const res = await fetch('/api/soc', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'toggle_kill_switch', key, value }),
				});
				const data = await res.json();
				if (!res.ok) {
					showNotice('err', data.error || (isEn ? 'Failed to update kill switch.' : 'Güvenlik anahtarı güncellenemedi.'));
					return;
				}
				if (data.emergencySwitches) {
					setOverview((prev) => (prev ? { ...prev, emergencySwitches: data.emergencySwitches } : prev));
				}
				showNotice(
					'ok',
					isEn
						? `Kill-switch '${key}' is now ${value ? 'ACTIVE' : 'DISABLED'}.`
						: `Acil status güvenlik anahtarı '${key}' ${value ? 'DEVREYE ALINDI' : 'DEVREDEN ÇIKARILDI'}.`
				);
			} catch {
				showNotice('err', isEn ? 'Network error.' : 'Ağ hatası.');
			} finally {
				setIsSubmitting(false);
			}
		},
		[canManage, isEn, showNotice]
	);

	const handleSaveWebhook = useCallback(async (overrideConfig?: WebhookConfig) => {
		if (!canManage) return;
		setIsSubmitting(true);
		const cfgToSave = overrideConfig ?? webhookConfig;
		try {
			const res = await fetch('/api/soc', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'save_webhook', config: cfgToSave }),
			});
			const data = await res.json();
			if (!res.ok) {
				showNotice('err', data.error || (isEn ? 'Failed to save webhook.' : 'Webhook kaydedilemedi.'));
				return;
			}
			setWebhookConfig(cfgToSave);
			showNotice('ok', isEn ? 'Webhook alerts configured successfully.' : 'Webhook bildirim ayarları kaydedildi.');
			setShowWebhookModal(false);
		} catch {
			showNotice('err', isEn ? 'Network error.' : 'Ağ hatası.');
		} finally {
			setIsSubmitting(false);
		}
	}, [canManage, webhookConfig, isEn, showNotice]);

	const handleTestWebhook = useCallback(async (overrideConfig?: WebhookConfig) => {
		if (!canManage) return;
		setIsTestingWebhook(true);
		const cfgToTest = overrideConfig ?? webhookConfig;
		try {
			const res = await fetch('/api/soc', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'test_webhook', config: cfgToTest }),
			});
			const data = await res.json();
			if (!res.ok || !data.sent) {
				showNotice(
					'err',
					data.error ||
						(isEn
							? 'Test alert failed to send. Check URL, tokens, or email addresses.'
							: 'Test bildirimi gönderilemedi. URL, token veya e-posta alıcı adreslerini kontrol edin.')
				);
			} else {
				showNotice('ok', isEn ? 'Test alert dispatched successfully!' : 'Test bildirimi başarıyla iletildi!');
			}
		} catch {
			showNotice('err', isEn ? 'Network error.' : 'Ağ hatası.');
		} finally {
			setIsTestingWebhook(false);
		}
	}, [canManage, webhookConfig, isEn, showNotice]);

	const handleToggleNotifyOn = useCallback(
		(key: 'lockdown' | 'autoban' | 'honeypot' | 'fim' | 'loginAnomalies', val: boolean) => {
			setWebhookConfig((prev) => {
				const current = prev?.notifyOn || {
					lockdown: true,
					autoban: true,
					honeypot: true,
					fim: true,
					loginAnomalies: false,
				};
				return {
					...prev,
					notifyOn: {
						...current,
						[key]: val,
					},
				};
			});
		},
		[]
	);

	const handleOpenForensicLog = useCallback((log: SystemLog) => {
		setForensicLog(log);
		setForensicCopied(false);
	}, []);

	const handleCopyForensic = useCallback(() => {
		if (!forensicLog) return;
		const text = JSON.stringify(forensicLog, null, 2);
		void navigator.clipboard.writeText(text);
		setForensicCopied(true);
		setTimeout(() => setForensicCopied(false), 2000);
	}, [forensicLog]);

	const handleSelectDataOnDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
		e.stopPropagation();
		const target = e.currentTarget;
		const selection = window.getSelection();
		if (!selection) return;

		const range = document.createRange();
		range.selectNodeContents(target);
		selection.removeAllRanges();
		selection.addRange(range);
	}, []);

	const handleDataContainerDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
		const target = e.target as HTMLElement;
		if (!target) return;

		if (target.closest('button, input, select, textarea, a')) {
			return;
		}

		const selection = window.getSelection();
		if (!selection) return;

		const tokenEl = target.closest<HTMLElement>('[data-type], [data-selectable="true"]');
		if (tokenEl) {
			e.stopPropagation();
			const range = document.createRange();
			range.selectNodeContents(tokenEl);
			selection.removeAllRanges();
			selection.addRange(range);
			return;
		}

		const textEl = target.closest<HTMLElement>('td, pre, code');
		if (textEl) {
			const elToSelect =
				target !== textEl && target.textContent?.trim() === target.innerText?.trim()
					? target
					: textEl;
			const range = document.createRange();
			range.selectNodeContents(elToSelect);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}, []);

	const forensicLogRef = useRef<SystemLog | null>(forensicLog);
	const expandedLogIdsRef = useRef<Set<number>>(expandedLogIds);
	const siemPageRef = useRef<number>(siemPage);
	const siemLimitRef = useRef<number>(siemLimit);

	useEffect(() => {
		forensicLogRef.current = forensicLog;
		expandedLogIdsRef.current = expandedLogIds;
		siemPageRef.current = siemPage;
		siemLimitRef.current = siemLimit;
	}, [forensicLog, expandedLogIds, siemPage, siemLimit]);

	useEffect(() => {
		if (!liveTail || !canView) return;
		let es: EventSource | null = null;
		let reconnectTimer: NodeJS.Timeout | null = null;
		const incomingBuffer: SystemLog[] = [];
		let rafId: number | null = null;

		const flushBuffer = () => {
			rafId = null;
			if (incomingBuffer.length === 0) return;
			const batch = incomingBuffer.splice(0, incomingBuffer.length);

			setSiemLogs((prev) => {
				const existingIds = new Set(prev.map((l) => l.id));
				const novel = batch.filter((l) => !existingIds.has(l.id));
				if (novel.length === 0) return prev;
				const limit = siemLimitRef.current || 50;
				// Novel logs are appended in reverse order so latest is at the top
				return [...novel.reverse(), ...prev].slice(0, limit);
			});
		};

		const connect = () => {
			try {
				es = new EventSource('/api/soc/stream');

				const handleLogMessage = (event: MessageEvent) => {
					try {
						if (typeof document !== 'undefined' && document.hidden) return;
						const raw = JSON.parse(event.data);
						const log: SystemLog = raw?.log ?? raw;
						if (log && typeof log.id === 'number') {
							if (forensicLogRef.current !== null || expandedLogIdsRef.current.size > 0 || siemPageRef.current > 1) {
								return;
							}
							incomingBuffer.push(log);
							if (rafId === null) {
								rafId = requestAnimationFrame(flushBuffer);
							}
						}
					} catch {}
				};

				es.addEventListener('log', handleLogMessage);
				es.onmessage = handleLogMessage;

				es.onerror = () => {
					if (es) {
						es.close();
						es = null;
					}
					if (!reconnectTimer) {
						reconnectTimer = setTimeout(() => {
							reconnectTimer = null;
							connect();
						}, 5000);
					}
				};
			} catch {}
		};

		connect();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			incomingBuffer.length = 0;
			if (es) {
				es.close();
				es = null;
			}
		};
	}, [liveTail, canView]);

	const toggleLogDetail = useCallback((id: number) => {
		setExpandedLogIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const value: SocContextType = useMemo(
		() => ({
			activeTab,
			setActiveTab,
			openLabTab,
			overview,
			bans,
			sessions,
			incidents,
			handleUpdateIncidentStatus,
			handleCreateIncident,
			siemLogs,
			currentUserId,
			callerIp,
			ingressDiagnostics,
			liveTail,
			setLiveTail,
			isLoading,
			isSubmitting,
			autoRefresh,
			setAutoRefresh,
			banner,
			setBanner,
			showNotice,
			canView,
			canManage,
			isEn,
			language,

			fwIp,
			setFwIp,
			fwMode,
			setFwMode,
			fwDuration,
			setFwDuration,
			fwReason,
			setFwReason,
			fwFilter,
			setFwFilter,
			handleFirewallSubmit,
			handleQuickBan,
			handleUnban,
			handleClearRateLimit,

			handleKillSession,
			handleKillAllOtherSessions,
			handleRevokeAnomalousSessions,
			handleSuspendUser,

			siemServis,
			setSiemServis,
			siemServisOp,
			setSiemServisOp,
			siemSeviye,
			setSiemSeviye,
			siemSeviyeOp,
			setSiemSeviyeOp,
			siemIp,
			setSiemIp,
			siemIpOp,
			setSiemIpOp,
			siemArama,
			setSiemArama,
			siemAramaOp,
			setSiemAramaOp,
			siemAramaAlani,
			setSiemAramaAlani,
			expandedLogIds,
			setExpandedLogIds,
			toggleLogDetail,
			siemTimeRange,
			setSiemTimeRange,
			siemStartTime,
			setSiemStartTime,
			siemEndTime,
			setSiemEndTime,
			siemPage,
			setSiemPage,
			siemLimit,
			setSiemLimit,
			siemTotalCount,
			siemTotalPages,
			siemHistogram,
			pageJump,
			setPageJump,
			selectedBucket,
			setSelectedBucket,
			fetchSiemFiltered,
			handleQuickExcludeSeviye,
			handleQuickExcludeServis,
			handleQuickExcludeIp,
			handleResetAllFilters,
			handleSelectTimeRange,
			handleZoomBucket,
			handleApplyCustomDate,
			handlePivotFilter,
			handlePageChange,
			handleLimitChange,
			handlePageJumpSubmit,
			handleExportSiem,

			inspectionSubTab,
			setInspectionSubTab,
			fimTarget,
			setFimTarget,
			handleTargetChange,
			fimResult,
			appSecResult,
			inspectionLoading,
			inspectionError,
			setInspectionError,
			apiFilterCategory,
			setApiFilterCategory,
			apiSearch,
			setApiSearch,
			probingEndpoint,
			reportLoading,
			fetchInspectionData,
			handleTriggerFimScan,
			handleTriggerApiScan,
			handleCreateBaseline,
			handleProbeSingleRoute,
			handleDownloadAuditReport,

			isResettingDefcon,
			handleResetDefcon,
			handleToggleLockdown,
			showLockdownModal,
			setShowLockdownModal,
			confirmLockdownToggle,

			handleToggleKillSwitch,
			showWebhookModal,
			setShowWebhookModal,
			webhookConfig,
			setWebhookConfig,
			isTestingWebhook,
			handleSaveWebhook,
			handleTestWebhook,
			handleToggleNotifyOn,

			forensicLog,
			setForensicLog,
			handleOpenForensicLog,
			handleCopyForensic,
			forensicCopied,
			showCustomDateModal,
			setShowCustomDateModal,
			customDateStart,
			setCustomDateStart,
			customDateEnd,
			setCustomDateEnd,

			fetchAll,
			runSocAction,
			tb,
			handleSelectDataOnDoubleClick,
			handleDataContainerDoubleClick,

			globalSearch,
			setGlobalSearch,

			// 3-Pane Inspector Drawer
			inspectorEntity,
			isInspectorOpen,
			openInspector,
			closeInspector,
			toggleInspector,

			// 24h Timeline Hour Filter Linkage
			selectedHourFilter,
			setSelectedHourFilter,

			// Universal Right-Click Context Menu
			contextMenu,
			setContextMenu,
			openContextMenu,
			closeContextMenu,

			// SOAR Playbooks & OS Integration
			handleExecutePlaybook,
			handleKillUserTerminals,
			handleExportCaseDossier,
		}),
		[
			activeTab,
			setActiveTab,
			openLabTab,
			overview,
			bans,
			sessions,
			incidents,
			handleUpdateIncidentStatus,
			handleCreateIncident,
			siemLogs,
			currentUserId,
			callerIp,
			ingressDiagnostics,
			liveTail,
			setLiveTail,
			isLoading,
			isSubmitting,
			autoRefresh,
			setAutoRefresh,
			banner,
			setBanner,
			showNotice,
			canView,
			canManage,
			isEn,
			language,
			fwIp,
			fwMode,
			fwDuration,
			fwReason,
			fwFilter,
			handleFirewallSubmit,
			handleQuickBan,
			handleUnban,
			handleClearRateLimit,
			handleKillSession,
			handleKillAllOtherSessions,
			handleRevokeAnomalousSessions,
			handleSuspendUser,
			siemServis,
			siemServisOp,
			siemSeviye,
			siemSeviyeOp,
			siemIp,
			siemIpOp,
			siemArama,
			siemAramaOp,
			siemAramaAlani,
			expandedLogIds,
			toggleLogDetail,
			siemTimeRange,
			siemStartTime,
			siemEndTime,
			siemPage,
			siemLimit,
			siemTotalCount,
			siemTotalPages,
			siemHistogram,
			pageJump,
			selectedBucket,
			fetchSiemFiltered,
			handleQuickExcludeSeviye,
			handleQuickExcludeServis,
			handleQuickExcludeIp,
			handleResetAllFilters,
			handleSelectTimeRange,
			handleZoomBucket,
			handleApplyCustomDate,
			handlePivotFilter,
			handlePageChange,
			handleLimitChange,
			handlePageJumpSubmit,
			handleExportSiem,
			inspectionSubTab,
			fimTarget,
			handleTargetChange,
			fimResult,
			appSecResult,
			inspectionLoading,
			inspectionError,
			apiFilterCategory,
			apiSearch,
			probingEndpoint,
			reportLoading,
			fetchInspectionData,
			handleTriggerFimScan,
			handleTriggerApiScan,
			handleCreateBaseline,
			handleProbeSingleRoute,
			handleDownloadAuditReport,
			isResettingDefcon,
			handleResetDefcon,
			handleToggleLockdown,
			showLockdownModal,
			confirmLockdownToggle,
			handleToggleKillSwitch,
			showWebhookModal,
			webhookConfig,
			isTestingWebhook,
			handleSaveWebhook,
			handleTestWebhook,
			handleToggleNotifyOn,
			forensicLog,
			handleOpenForensicLog,
			handleCopyForensic,
			forensicCopied,
			showCustomDateModal,
			customDateStart,
			customDateEnd,
			fetchAll,
			runSocAction,
			tb,
			handleSelectDataOnDoubleClick,
			handleDataContainerDoubleClick,
			globalSearch,
			inspectorEntity,
			isInspectorOpen,
			openInspector,
			closeInspector,
			toggleInspector,
			selectedHourFilter,
			contextMenu,
			openContextMenu,
			closeContextMenu,
			handleExecutePlaybook,
			handleKillUserTerminals,
			handleExportCaseDossier,
		]
	);

	return <SocContext.Provider value={value}>{children}</SocContext.Provider>;
}

export function useSoc() {
	const ctx = useContext(SocContext);
	if (!ctx) {
		throw new Error('useSoc must be used within a SocProvider');
	}
	return ctx;
}
