'use client';

import { useState, useCallback, type MutableRefObject } from 'react';
import type { useDialog } from '@/components/Common/DialogProvider';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import socContract from '../../soc.contract.json';
import { resolveContractError } from '@/contracts/client';
import type { FimScanResult } from '../../types';
import { executeTriggerFimScan, executeCreateBaseline } from '../../actions/inspectionActions';

interface FimSliceDeps {
	canManage: boolean;
	dialog: ReturnType<typeof useDialog>;
	showNotice: (type: 'ok' | 'err', text: string) => void;
	inspectionAbortRef: MutableRefObject<AbortController | null>;
	inspectionRequestIdRef: MutableRefObject<number>;
	setInspectionLoading: (v: boolean) => void;
	setInspectionError: (v: string | null) => void;
}

export function useSocFimSlice({
	canManage,
	dialog,
	showNotice,
	inspectionAbortRef,
	inspectionRequestIdRef,
	setInspectionLoading,
	setInspectionError,
}: FimSliceDeps) {
	const [fimTarget, setFimTarget] = useState<string>('repo');
	const [fimResult, setFimResult] = useState<FimScanResult | null>(null);
	const { t } = useI18n();

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
		[fimTarget, inspectionAbortRef, setInspectionError]
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
			const result = await executeTriggerFimScan(fimTarget, controller.signal);

			if (reqId !== inspectionRequestIdRef.current) return;

			if (!result.ok) {
				setInspectionError(
					resolveContractError(result.data, socContract, t, result.error || t('socFimScanFailed'))
				);
				return;
			}

			const fim = result.data?.fim as FimScanResult | undefined;
			if (fim) {
				setFimResult(fim);
				showNotice('ok', fill(t('socFimScanComplete'), { count: fim.scannedFiles }));
			}
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionError(t('socFimNetworkError'));
			}
		} finally {
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionLoading(false);
			}
		}
	}, [fimTarget, showNotice, t, inspectionAbortRef, inspectionRequestIdRef, setInspectionLoading, setInspectionError]);

	const handleCreateBaseline = useCallback(async () => {
		if (!canManage) return;
		const confirmed = await dialog.confirm({
			title: t('socFimBaselineTitle'),
			message: t('socFimBaselineConfirmBody'),
			confirmLabel: t('socFimBaselineConfirmBtn'),
			cancelLabel: t('cancel'),
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
			const result = await executeCreateBaseline(fimTarget, controller.signal);

			if (reqId !== inspectionRequestIdRef.current) return;

			if (!result.ok) {
				setInspectionError(
					resolveContractError(result.data, socContract, t, result.error || t('socFimBaselineFailed'))
				);
				return;
			}

			const fim = result.data?.fim as FimScanResult | undefined;
			if (fim) setFimResult(fim);
			showNotice('ok', t('socFimBaselineSaved'));
		} catch (err: unknown) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionError(t('socFimBaselineNetworkError'));
			}
		} finally {
			if (reqId === inspectionRequestIdRef.current) {
				setInspectionLoading(false);
			}
		}
	}, [canManage, dialog, fimTarget, showNotice, t, inspectionAbortRef, inspectionRequestIdRef, setInspectionLoading, setInspectionError]);

	return {
		fimTarget,
		setFimTarget,
		fimResult,
		setFimResult,
		handleTargetChange,
		handleTriggerFimScan,
		handleCreateBaseline,
	};
}
