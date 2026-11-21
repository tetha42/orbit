'use client';

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type ReactNode,
} from 'react';
import { useDialog } from '@/components/Common/DialogProvider';
import { useTestbench } from '../testbench/hooks/useTestbench';
import type { SocContextType } from './types';
import type { SocOverviewData, SecurityBlock, ActiveSessionInfo, SocIncident } from '../types';

import { useSocUiSlice } from './slices/useSocUiSlice';
import { useSocFirewallSlice } from './slices/useSocFirewallSlice';
import { useSocSessionsSlice } from './slices/useSocSessionsSlice';
import { useSocIncidentsSlice } from './slices/useSocIncidentsSlice';
import { useSocSiemSlice } from './slices/useSocSiemSlice';
import { useSocInspectionSlice } from './slices/useSocInspectionSlice';
import { useSocLockdownSlice } from './slices/useSocLockdownSlice';
import { useSocInspectorSlice } from './slices/useSocInspectorSlice';
import { useSocSelectionSlice } from './slices/useSocSelectionSlice';
import { useSocOverviewSlice } from './slices/useSocOverviewSlice';
import { useSocLiveTailSlice } from './slices/useSocLiveTailSlice';
import { useSocFocusTargetSlice } from './slices/useSocFocusTargetSlice';
import { useSocRefreshEffects } from './slices/useSocRefreshEffects';

export type { SocContextType };

const SocContext = createContext<SocContextType | null>(null);

export function SocProvider({ children }: { children: ReactNode }) {
	const dialog = useDialog();

	// 1. UI Slice
	const tb = useTestbench(false);
	const ui = useSocUiSlice(tb);

	// 2. SIEM Slice
	const siem = useSocSiemSlice({
		canView: ui.canView,
		showNotice: ui.showNotice,
		setIsLoading: ui.setIsLoading,
	});

	// 3. Selection Slice
	const selection = useSocSelectionSlice();

	// 4. Lockdown & Webhooks Slice
	const lockdownHolder = useRef<{
		overview: SocOverviewData | null;
		runSocAction: (payload: Record<string, unknown>, successMsg: string) => Promise<boolean>;
	}>({ overview: null, runSocAction: async () => false });
	const forwardSocAction = useCallback(
		(p: Record<string, unknown>, msg: string) => lockdownHolder.current.runSocAction(p, msg),
		[]
	);
	const lockdown = useSocLockdownSlice({
		canManage: ui.canManage,
		showNotice: ui.showNotice,
		overview: null,
		setOverview: () => {},
		setIsSubmitting: ui.setIsSubmitting,
		runSocAction: forwardSocAction,
	});

	const stateHolders = useRef<{
		setBans: (v: SecurityBlock[]) => void;
		setSessions: (v: ActiveSessionInfo[]) => void;
		setIncidents: (v: SocIncident[]) => void;
	}>({ setBans: () => {}, setSessions: () => {}, setIncidents: () => {} });

	const forwardSetBans = useCallback((b: SecurityBlock[]) => stateHolders.current.setBans(b), []);
	const forwardSetSessions = useCallback(
		(s: ActiveSessionInfo[]) => stateHolders.current.setSessions(s),
		[]
	);
	const forwardSetIncidents = useCallback(
		(i: SocIncident[]) => stateHolders.current.setIncidents(i),
		[]
	);

	// 5. Firewalls & Sessions
	const overviewSlice = useSocOverviewSlice({
		canView: ui.canView,
		canManage: ui.canManage,
		showNotice: ui.showNotice,
		dialog,
		buildSiemQueryParams: siem.buildSiemQueryParams,
		setIsLoading: ui.setIsLoading,
		setIsSubmitting: ui.setIsSubmitting,
		setBanner: ui.setBanner,
		setIngressDiagnostics: ui.setIngressDiagnostics,
		setBans: forwardSetBans,
		setSessions: forwardSetSessions,
		setIncidents: forwardSetIncidents,
		setSiemLogs: siem.setSiemLogs,
		setSiemTotalCount: siem.setSiemTotalCount,
		setSiemPage: siem.setSiemPage,
		setSiemTotalPages: siem.setSiemTotalPages,
		setSiemHistogram: siem.setSiemHistogram,
		setCurrentUserId: ui.setCurrentUserId,
		setCallerIp: ui.setCallerIp,
		setWebhookConfig: lockdown.setWebhookConfig,
		showWebhookModalRef: lockdown.showWebhookModalRef,
	});

	const { overview, runSocAction, fetchAll } = overviewSlice;

	const firewall = useSocFirewallSlice({
		dialog,
		runSocAction,
	});

	const sessions = useSocSessionsSlice({
		dialog,
		runSocAction,
	});

	const incidents = useSocIncidentsSlice({
		canManage: ui.canManage,
		showNotice: ui.showNotice,
	});

	useLayoutEffect(() => {
		lockdownHolder.current = {
			overview,
			runSocAction,
		};
		stateHolders.current = {
			setBans: firewall.setBans,
			setSessions: sessions.setSessions,
			setIncidents: incidents.setIncidents,
		};
	}, [
		overview,
		runSocAction,
		firewall.setBans,
		sessions.setSessions,
		incidents.setIncidents,
	]);

	// 6. Inspection Slice
	const inspection = useSocInspectionSlice({
		canView: ui.canView,
		canManage: ui.canManage,
		dialog,
		showNotice: ui.showNotice,
	});

	// 7. Inspector & Playbooks Slice
	const inspector = useSocInspectorSlice({
		dialog,
		showNotice: ui.showNotice,
		incidents: incidents.incidents,
		siemLogs: siem.siemLogs,
		currentUserId: ui.currentUserId,
		fetchAll,
		runSocAction,
		setIsSubmitting: ui.setIsSubmitting,
	});

	// Effects: Initialization, live push invalidation, visibility-aware polling
	useSocRefreshEffects({
		canView: ui.canView,
		autoRefresh: ui.autoRefresh,
		activeTab: ui.activeTab,
		fimTarget: inspection.fimTarget,
		fetchAll,
		fetchInspectionData: inspection.fetchInspectionData,
	});

	const { setExpandedLogIds, siemPage, siemService, siemLevel, siemIp, siemSearch, siemTimeRange } = siem;
	useEffect(() => {
		setExpandedLogIds(new Set());
	}, [setExpandedLogIds, siemPage, siemService, siemLevel, siemIp, siemSearch, siemTimeRange]);

	useSocFocusTargetSlice({
		setActiveTabState: ui.setActiveTabState,
		setSiemSearch: siem.setSiemSearch,
		setSiemSearchField: siem.setSiemSearchField,
		setSiemSearchOp: siem.setSiemSearchOp,
		setSiemIp: siem.setSiemIp,
		setSiemIpOp: siem.setSiemIpOp,
		setFwIp: firewall.setFwIp,
	});

	useSocLiveTailSlice({
		liveTail: ui.liveTail,
		canView: ui.canView,
		forensicLog: inspector.forensicLog,
		expandedLogIds: siem.expandedLogIds,
		siemPage: siem.siemPage,
		siemLimit: siem.siemLimit,
		setSiemLogs: siem.setSiemLogs,
	});

	const value: SocContextType = useMemo(
		() => ({
			...ui,
			overview: overviewSlice.overview,
			isResettingDefcon: overviewSlice.isResettingDefcon,
			handleResetDefcon: overviewSlice.handleResetDefcon,
			fetchAll: overviewSlice.fetchAll,
			runSocAction: overviewSlice.runSocAction,
			...firewall,
			...sessions,
			...incidents,
			...siem,
			...inspection,
			...lockdown,
			...inspector,
			...selection,
			tb,
		}),
		[
			ui,
			overviewSlice,
			firewall,
			sessions,
			incidents,
			siem,
			inspection,
			lockdown,
			inspector,
			selection,
			tb,
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
