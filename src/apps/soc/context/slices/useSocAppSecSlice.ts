'use client';

import { useState, useCallback, type MutableRefObject } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import socContract from '../../soc.contract.json';
import { resolveContractError } from '@/contracts/client';
import type { AppSecSummary } from '../../types';
import { executeTriggerApiScan, executeProbeRoute } from '../../actions/inspectionActions';

type AppSecRouteItem = AppSecSummary['routes'][number];

interface AppSecSliceDeps {
	showNotice: (type: 'ok' | 'err', text: string) => void;
	inspectionAbortRef: MutableRefObject<AbortController | null>;
	inspectionRequestIdRef: MutableRefObject<number>;
	setInspectionLoading: (v: boolean) => void;
	setInspectionError: (v: string | null) => void;
}

export function useSocAppSecSlice({
	showNotice,
	inspectionAbortRef,
	inspectionRequestIdRef,
	setInspectionLoading,
	setInspectionError,
}: AppSecSliceDeps) {
	const [appSecResult, setAppSecResult] = useState<AppSecSummary | null>(null);
	const [apiFilterCategory, setApiFilterCategory] = useState<string>('all');
	const [apiSearch, setApiSearch] = useState<string>('');
	const [probingEndpoint, setProbingEndpoint] = useState<string | null>(null);
	const [reportLoading, setReportLoading] = useState<boolean>(false);
	const { t } = useI18n();

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
			const result = await executeTriggerApiScan(controller.signal);

			if (reqId !== inspectionRequestIdRef.current) return;

			if (!result.ok) {
				setInspectionError(
					resolveContractError(result.data, socContract, t, result.error || t('socApiScanFailed'))
				);
				return;
			}

			const appSec = result.data?.appSec as AppSecSummary | undefined;
			if (appSec) {
				setAppSecResult(appSec);
				showNotice('ok', fill(t('socApiAuditComplete'), { count: appSec.totalTested }));
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionError(t('socApiNetworkError'));
			}
		} finally {
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionLoading(false);
			}
		}
	}, [showNotice, t, inspectionAbortRef, inspectionRequestIdRef, setInspectionLoading, setInspectionError]);

	const handleProbeSingleRoute = useCallback(
		async (endpoint: string) => {
			setProbingEndpoint(endpoint);
			try {
				const result = await executeProbeRoute(endpoint);
				if (!result.ok) {
					showNotice(
						'err',
						resolveContractError(result.data, socContract, t, result.error || t('socRouteProbeFailed'))
					);
					return;
				}
				const r = result.data?.route as AppSecRouteItem | undefined;
				if (r) {
					setAppSecResult((prev) => {
						if (!prev) return prev;
						const routes = prev.routes.map((route) => (route.endpoint === endpoint ? r : route));
						return { ...prev, routes };
					});
					const statusMap: Record<string, string> = {
						PASS: t('socRouteStatusPass'),
						WARN: t('socRouteStatusWarn'),
					};
					const statusText = statusMap[r.status] ?? t('socRouteStatusFail');
					const wafLabel = r.wafIntercepted ? '403' : '—';
					showNotice(
						r.status === 'PASS' ? 'ok' : 'err',
						`${r.endpoint} -> HTTP ${r.unauthStatus} | WAF: ${wafLabel} | ${statusText} (${r.latencyMs}ms)`
					);
				}
			} catch {
				showNotice('err', t('socRouteProbeNetworkError'));
			} finally {
				setProbingEndpoint(null);
			}
		},
		[showNotice, t]
	);

	const handleDownloadAuditReport = useCallback(async () => {
		setReportLoading(true);
		try {
			const res = await fetch('/api/soc/inspection', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'generate_report' }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				showNotice('err', resolveContractError(data, socContract, t, t('socAuditReportFailed')));
				return;
			}
			if (data.report) {
				const blob = new Blob([data.report], { type: 'text/markdown;charset=utf-8' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `soc-audit-report-${Date.now()}.md`;
				a.click();
				URL.revokeObjectURL(url);
				showNotice('ok', t('socAuditReportDownloaded'));
			}
		} catch {
			showNotice('err', t('socAuditReportDownloadError'));
		} finally {
			setReportLoading(false);
		}
	}, [showNotice, t]);

	return {
		appSecResult,
		setAppSecResult,
		apiFilterCategory,
		setApiFilterCategory,
		apiSearch,
		setApiSearch,
		probingEndpoint,
		setProbingEndpoint,
		reportLoading,
		setReportLoading,
		handleTriggerApiScan,
		handleProbeSingleRoute,
		handleDownloadAuditReport,
	};
}
