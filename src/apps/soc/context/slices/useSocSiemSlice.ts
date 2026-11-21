'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '@/core/i18n';
import type { SystemLog, HistogramBucket, SiemFilterSnapshot } from '../../types';
import { useSocSiemFilters } from './useSocSiemFilters';
import { fetchFilteredSiemLogs } from '../../queries/siemQueries';

interface SiemSliceDeps {
	canView: boolean;
	showNotice: (type: 'ok' | 'err', text: string) => void;
	setIsLoading: (v: boolean) => void;
}

export function useSocSiemSlice({ canView, showNotice, setIsLoading }: SiemSliceDeps) {
	const { t } = useI18n();
	const [siemLogs, setSiemLogs] = useState<SystemLog[]>([]);
	const [siemTotalCount, setSiemTotalCount] = useState<number>(0);
	const [siemTotalPages, setSiemTotalPages] = useState<number>(1);
	const [siemHistogram, setSiemHistogram] = useState<HistogramBucket[]>([]);
	const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());

	const fetchSiemRef = useRef<
		(overrides?: Partial<SiemFilterSnapshot>, silent?: boolean) => Promise<void>
	>(() => Promise.resolve());

	const filters = useSocSiemFilters({
		showNotice,
		onFilterChange: (overrides) => void fetchSiemRef.current(overrides),
	});

	const { buildSiemQueryParams, setSiemPage, setSiemLimit } = filters;

	const fetchSiemFiltered = useCallback(
		async (overrides?: Partial<SiemFilterSnapshot>, silent = false) => {
			if (!canView) return;
			if (!silent) setIsLoading(true);
			try {
				const params = buildSiemQueryParams(overrides);
				const data = await fetchFilteredSiemLogs(params);
				setSiemLogs(data.logs);
				setSiemTotalCount(data.totalCount);
				setSiemPage(data.page);
				setSiemTotalPages(data.totalPages);
				setSiemHistogram(data.histogram);
			} catch {
				if (!silent) {
					showNotice('err', t('socSiemQueryFailed'));
				}
			} finally {
				if (!silent) setIsLoading(false);
			}
		},
		[canView, t, showNotice, setIsLoading, buildSiemQueryParams, setSiemPage]
	);

	useEffect(() => {
		fetchSiemRef.current = fetchSiemFiltered;
	}, [fetchSiemFiltered]);

	const handlePageChange = useCallback(
		(newPage: number) => {
			if (newPage < 1 || (siemTotalPages > 0 && newPage > siemTotalPages)) return;
			setSiemPage(newPage);
			void fetchSiemFiltered({ page: newPage });
		},
		[siemTotalPages, setSiemPage, fetchSiemFiltered]
	);

	const handleLimitChange = useCallback(
		(newLimit: number) => {
			setSiemLimit(newLimit);
			setSiemPage(1);
			void fetchSiemFiltered({ limit: newLimit, page: 1 });
		},
		[setSiemLimit, setSiemPage, fetchSiemFiltered]
	);

	const handleToggleExpandLog = useCallback((id: number) => {
		setExpandedLogIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const handlePageJumpSubmit = useCallback(() => {
		const target = parseInt(filters.pageJump, 10);
		if (!isNaN(target) && target >= 1 && target <= siemTotalPages) {
			setSiemPage(target);
			filters.setPageJump('');
			void fetchSiemFiltered({ page: target });
		}
	}, [filters, siemTotalPages, setSiemPage, fetchSiemFiltered]);

	const handleExportSiem = useCallback(
		(format: 'csv' | 'json') => {
			const params = buildSiemQueryParams();
			params.set('action', 'siem_export');
			params.set('format', format);
			window.open(`/api/soc?${params.toString()}`, '_blank');
		},
		[buildSiemQueryParams]
	);

	return {
		siemLogs,
		setSiemLogs,
		siemTotalCount,
		setSiemTotalCount,
		siemTotalPages,
		setSiemTotalPages,
		siemHistogram,
		setSiemHistogram,
		expandedLogIds,
		setExpandedLogIds,
		fetchSiemFiltered,
		handlePageChange,
		handleLimitChange,
		handleToggleExpandLog,
		toggleLogDetail: handleToggleExpandLog,
		handlePageJumpSubmit,
		handleExportSiem,
		...filters,
	};
}
