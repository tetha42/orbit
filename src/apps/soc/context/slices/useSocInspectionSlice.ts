'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '@/core/i18n';
import type { useDialog } from '@/components/Common/DialogProvider';
import { useSocFimSlice } from './useSocFimSlice';
import { useSocAppSecSlice } from './useSocAppSecSlice';
import { fetchInspectionQuery } from '../../queries/inspectionQueries';

interface InspectionSliceDeps {
	canView: boolean;
	canManage: boolean;
	dialog: ReturnType<typeof useDialog>;
	showNotice: (type: 'ok' | 'err', text: string) => void;
}

export function useSocInspectionSlice({
	canView,
	canManage,
	dialog,
	showNotice,
}: InspectionSliceDeps) {
	const { t } = useI18n();
	const [inspectionSubTab, setInspectionSubTab] = useState<'api' | 'fim'>('api');
	const [inspectionLoading, setInspectionLoading] = useState<boolean>(false);
	const [inspectionError, setInspectionError] = useState<string | null>(null);

	const inspectionAbortRef = useRef<AbortController | null>(null);
	const inspectionRequestIdRef = useRef<number>(0);

	const fim = useSocFimSlice({
		canManage,
		dialog,
		showNotice,
		inspectionAbortRef,
		inspectionRequestIdRef,
		setInspectionLoading,
		setInspectionError,
	});

	const appSec = useSocAppSecSlice({
		showNotice,
		inspectionAbortRef,
		inspectionRequestIdRef,
		setInspectionLoading,
		setInspectionError,
	});

	const { setFimResult } = fim;
	const { setAppSecResult } = appSec;

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
				const data = await fetchInspectionQuery(target, force, controller.signal);
				if (reqId !== inspectionRequestIdRef.current) return;

				if (data.fimResult) setFimResult(data.fimResult);
				if (data.appSecResult) setAppSecResult(data.appSecResult);
			} catch (err: unknown) {
				if (err instanceof Error && err.name === 'AbortError') return;
				if (reqId === inspectionRequestIdRef.current) {
					setInspectionError(
						err instanceof Error ? err.message : t('socInspectionLoadFailed')
					);
				}
			} finally {
				if (reqId === inspectionRequestIdRef.current) {
					setInspectionLoading(false);
				}
			}
		},
		[canView, t, setFimResult, setAppSecResult]
	);

	useEffect(() => {
		return () => {
			if (inspectionAbortRef.current) {
				inspectionAbortRef.current.abort();
			}
		};
	}, []);

	return {
		inspectionSubTab,
		setInspectionSubTab,
		inspectionLoading,
		setInspectionLoading,
		inspectionError,
		setInspectionError,
		fetchInspectionData,
		...fim,
		...appSec,
	};
}
