'use client';

import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import socContract from '../../soc.contract.json';
import { getContractErrorMessage, resolveContractError } from '@/contracts/client';
import type {
	SocOverviewData,
	SecurityBlock,
	ActiveSessionInfo,
	SocIncident,
	SystemLog,
	HistogramBucket,
	IngressDiagnostics,
	WebhookConfig,
	SiemFilterSnapshot,
} from '../../types';
import { fetchSocOverviewData } from '../../queries/overviewQueries';
import { postSocAction } from '../../actions/sessionActions';
import { executeResetDefcon } from '../../actions/lockdownActions';

interface OverviewSliceDeps {
	canView: boolean;
	canManage: boolean;
	showNotice: (type: 'ok' | 'err', text: string) => void;
	dialog: ReturnType<typeof useDialog>;
	buildSiemQueryParams: (overrides?: Partial<SiemFilterSnapshot>) => URLSearchParams;
	setIsLoading: (v: boolean) => void;
	setIsSubmitting: (v: boolean) => void;
	setBanner: (v: { type: 'ok' | 'err'; text: string } | null) => void;
	setIngressDiagnostics: (v: IngressDiagnostics | null) => void;
	setBans: (v: SecurityBlock[]) => void;
	setSessions: (v: ActiveSessionInfo[]) => void;
	setIncidents: (v: SocIncident[]) => void;
	setSiemLogs: (v: SystemLog[]) => void;
	setSiemTotalCount: (v: number) => void;
	setSiemPage: (v: number) => void;
	setSiemTotalPages: (v: number) => void;
	setSiemHistogram: (v: HistogramBucket[]) => void;
	setCurrentUserId: (v: string) => void;
	setCallerIp: (v: string) => void;
	setWebhookConfig: React.Dispatch<React.SetStateAction<WebhookConfig>>;
	showWebhookModalRef: MutableRefObject<boolean>;
}

export function useSocOverviewSlice(deps: OverviewSliceDeps) {
	const {
		canView,
		canManage,
		showNotice,
		dialog,
		buildSiemQueryParams,
		setIsLoading,
		setIsSubmitting,
		setBanner,
		setIngressDiagnostics,
		setBans,
		setSessions,
		setIncidents,
		setSiemLogs,
		setSiemTotalCount,
		setSiemPage,
		setSiemTotalPages,
		setSiemHistogram,
		setCurrentUserId,
		setCallerIp,
		setWebhookConfig,
		showWebhookModalRef,
	} = deps;

	const [overview, setOverview] = useState<SocOverviewData | null>(null);
	const [isResettingDefcon, setIsResettingDefcon] = useState<boolean>(false);
	const { t } = useI18n();
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const fetchAll = useCallback(
		async (silent = false) => {
			if (!canView) return;
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;
			if (!silent) setIsLoading(true);
			try {
				const params = buildSiemQueryParams();
				const data = await fetchSocOverviewData(params, controller.signal);
				if (controller.signal.aborted) return;
				if (data.overview) {
					setOverview(data.overview);
					if (data.overview.webhookConfig && !showWebhookModalRef.current) {
						setWebhookConfig((prev) => ({
							...prev,
							...data.overview!.webhookConfig,
							emailRecipients: data.overview!.webhookConfig?.emailRecipients ?? prev.emailRecipients ?? '',
							alsoSendEmail: Boolean(data.overview!.webhookConfig?.alsoSendEmail ?? prev.alsoSendEmail),
							notifyOn: {
								lockdown: data.overview!.webhookConfig?.notifyOn?.lockdown ?? prev.notifyOn?.lockdown ?? true,
								autoban: data.overview!.webhookConfig?.notifyOn?.autoban ?? prev.notifyOn?.autoban ?? true,
								honeypot: data.overview!.webhookConfig?.notifyOn?.honeypot ?? prev.notifyOn?.honeypot ?? true,
								fim: data.overview!.webhookConfig?.notifyOn?.fim ?? prev.notifyOn?.fim ?? true,
								loginAnomalies: data.overview!.webhookConfig?.notifyOn?.loginAnomalies ?? prev.notifyOn?.loginAnomalies ?? false,
							},
						}));
					}
				}
				if (data.ingressDiagnostics) setIngressDiagnostics(data.ingressDiagnostics);
				setBans(data.bans);
				setSessions(data.sessions);
				setIncidents(data.incidents);
				setSiemLogs(data.siemLogs);
				if (data.siemMeta) {
					if (typeof data.siemMeta.totalCount === 'number') setSiemTotalCount(data.siemMeta.totalCount);
					if (typeof data.siemMeta.page === 'number') setSiemPage(data.siemMeta.page);
					if (typeof data.siemMeta.totalPages === 'number') setSiemTotalPages(data.siemMeta.totalPages);
					if (Array.isArray(data.siemMeta.histogram)) setSiemHistogram(data.siemMeta.histogram);
				}
				if (data.currentUserId) setCurrentUserId(data.currentUserId);
				if (data.callerIp) setCallerIp(data.callerIp);
			} catch (err) {
				if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
					return;
				}
				if (!silent) {
					showNotice(
						'err',
						err instanceof Error ? err.message : t('socFetchNetworkError')
					);
				}
			} finally {
				if (abortRef.current === controller) {
					abortRef.current = null;
					setIsLoading(false);
				}
			}
		},
		[
			canView,
			showNotice,
			buildSiemQueryParams,
			setIsLoading,
			showWebhookModalRef,
			setWebhookConfig,
			setIngressDiagnostics,
			setBans,
			setSessions,
			setIncidents,
			setSiemLogs,
			setSiemTotalCount,
			setSiemPage,
			setSiemTotalPages,
			setSiemHistogram,
			setCurrentUserId,
			setCallerIp,
			t,
		]
	);

	const runSocAction = useCallback(
		async (
			payloadOrExec:
				| Record<string, unknown>
				| (() => Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }>),
			successMsg: string
		): Promise<boolean> => {
			if (!canManage) {
				showNotice('err', getContractErrorMessage(socContract, 'SOC_ACCESS_DENIED', t));
				return false;
			}
			setIsSubmitting(true);
			setBanner(null);
			try {
				const execOverride =
					typeof payloadOrExec === 'object' &&
					payloadOrExec !== null &&
					typeof (payloadOrExec as { __exec?: unknown }).__exec === 'function'
						? (
								payloadOrExec as {
									__exec: () => Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }>;
								}
						  ).__exec
						: null;
				const result =
					typeof payloadOrExec === 'function'
						? await payloadOrExec()
						: execOverride
						? await execOverride()
						: await postSocAction(payloadOrExec);
				if (!result.ok) {
					const fallback = t('socActionFailed');
					showNotice('err', resolveContractError(result.data, socContract, t, result.error || fallback));
					return false;
				}
				showNotice('ok', successMsg);
				await fetchAll(true);
				return true;
			} catch {
				showNotice('err', t('socActionNetworkError'));
				return false;
			} finally {
				setIsSubmitting(false);
			}
		},
		[canManage, showNotice, t, fetchAll, setIsSubmitting, setBanner]
	);

	const handleResetDefcon = useCallback(async () => {
		if (!canManage || isResettingDefcon) return;
		const confirmed = await dialog.confirm({
			title: t('socResetDefconTitle'),
			message: t('socResetDefconMsg'),
			tone: 'warning',
		});
		if (!confirmed) return;

		setIsResettingDefcon(true);
		try {
			const result = await executeResetDefcon();
			if (result.ok) {
				showNotice('ok', t('socResetDefconSuccess'));
				void fetchAll(true);
			} else {
				showNotice('err', result.error || t('socResetDefconFailed'));
			}
		} catch {
			showNotice('err', t('socNetworkError'));
		} finally {
			setIsResettingDefcon(false);
		}
	}, [canManage, isResettingDefcon, dialog, t, showNotice, fetchAll]);

	return {
		overview,
		setOverview,
		isResettingDefcon,
		fetchAll,
		runSocAction,
		handleResetDefcon,
	};
}
