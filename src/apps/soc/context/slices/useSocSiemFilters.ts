'use client';

import { useCallback } from 'react';
import { useI18n } from '@/core/i18n';
import socContract from '../../soc.contract.json';
import { getContractLimit } from '@/contracts/client';
import type {
	TimeRangePreset,
	SiemFilterSnapshot,
	HistogramBucket,
} from '../../types';
import {
	INITIAL_SIEM_FILTER_SNAPSHOT,
	buildSiemQueryParams as serializeSiemParams,
	parseCustomDateRange,
	clampDateWindowStart,
	computePivotOverride,
} from './siemFilterUtils';
import { useSocSiemFilterState } from './useSocSiemFilterState';

interface SiemFiltersDeps {
	showNotice: (type: 'ok' | 'err', text: string) => void;
	onFilterChange: (overrides?: Partial<SiemFilterSnapshot>) => void;
}

export function useSocSiemFilters({ showNotice, onFilterChange }: SiemFiltersDeps) {
	const { t } = useI18n();
	const state = useSocSiemFilterState();
	const {
		setSiemService,
		setSiemServiceOp,
		setSiemLevel,
		setSiemLevelOp,
		setSiemIp,
		setSiemIpOp,
		setSiemSearch,
		setSiemSearchOp,
		setSiemSearchField,
		setSiemTimeRange,
		setSiemStartTime,
		setSiemEndTime,
		setSiemPage,
		setSelectedBucket,
		setShowCustomDateModal,
		customDateStart,
		customDateEnd,
		selectedBucket,
		siemFilterRef,
	} = state;

	const buildSiemQueryParams = useCallback((overrides?: Partial<SiemFilterSnapshot>): URLSearchParams => {
		return serializeSiemParams({ ...siemFilterRef.current, ...overrides });
	}, [siemFilterRef]);

	const handleQuickExcludeLevel = useCallback((level: string) => {
		setSiemLevel(level);
		setSiemLevelOp('neq');
		onFilterChange({ level, levelOp: 'neq' });
	}, [onFilterChange, setSiemLevel, setSiemLevelOp]);

	const handleQuickExcludeService = useCallback((service: string) => {
		setSiemService(service);
		setSiemServiceOp('neq');
		onFilterChange({ service, serviceOp: 'neq' });
	}, [onFilterChange, setSiemService, setSiemServiceOp]);

	const handleQuickExcludeIp = useCallback((ipVal: string) => {
		setSiemIp(ipVal);
		setSiemIpOp('neq');
		onFilterChange({ ip: ipVal, ipOp: 'neq' });
	}, [onFilterChange, setSiemIp, setSiemIpOp]);

	const handleResetAllFilters = useCallback(() => {
		setSiemService('all');
		setSiemServiceOp('eq');
		setSiemLevel('all');
		setSiemLevelOp('eq');
		setSiemIp('');
		setSiemIpOp('eq');
		setSiemSearch('');
		setSiemSearchOp('contains');
		setSiemSearchField('all');
		setSiemTimeRange('24h');
		setSiemStartTime(null);
		setSiemEndTime(null);
		setSelectedBucket(null);
		setSiemPage(1);
		onFilterChange({ ...INITIAL_SIEM_FILTER_SNAPSHOT });
	}, [
		onFilterChange, setSelectedBucket, setSiemEndTime, setSiemIp, setSiemIpOp,
		setSiemLevel, setSiemLevelOp, setSiemPage, setSiemSearch, setSiemSearchField,
		setSiemSearchOp, setSiemService, setSiemServiceOp, setSiemStartTime, setSiemTimeRange,
	]);

	const handleSelectTimeRange = useCallback((range: TimeRangePreset) => {
		if (range === 'custom') {
			setShowCustomDateModal(true);
			return;
		}
		setSiemTimeRange(range);
		setSiemStartTime(null);
		setSiemEndTime(null);
		setSelectedBucket(null);
		setSiemPage(1);
		onFilterChange({ timeRange: range, startTime: undefined, endTime: undefined, page: 1 });
	}, [
		onFilterChange, setSelectedBucket, setShowCustomDateModal,
		setSiemEndTime, setSiemPage, setSiemStartTime, setSiemTimeRange,
	]);

	const handleZoomBucket = useCallback((bucket: HistogramBucket) => {
		if (selectedBucket === bucket.start) {
			setSelectedBucket(null);
			setSiemStartTime(null);
			setSiemEndTime(null);
			setSiemPage(1);
			onFilterChange({ startTime: undefined, endTime: undefined, page: 1 });
			return;
		}
		setSelectedBucket(bucket.start);
		setSiemTimeRange('custom');
		setSiemStartTime(bucket.start);
		setSiemEndTime(bucket.end);
		setSiemPage(1);
		onFilterChange({ timeRange: 'custom', startTime: bucket.start, endTime: bucket.end, page: 1 });
	}, [
		selectedBucket, onFilterChange, setSelectedBucket,
		setSiemEndTime, setSiemPage, setSiemStartTime, setSiemTimeRange,
	]);

	const handleApplyCustomDate = useCallback(() => {
		const parsed = parseCustomDateRange(customDateStart, customDateEnd);
		if (!parsed) {
			showNotice('err', t('socInvalidDateRange'));
			return;
		}
		const maxWindowHours = getContractLimit(socContract, 'maxSiemQueryWindowHours', 720);
		const clampedStart = clampDateWindowStart(parsed.startTs, parsed.endTs, maxWindowHours);
		setShowCustomDateModal(false);
		setSiemTimeRange('custom');
		setSiemStartTime(clampedStart);
		setSiemEndTime(parsed.endTs);
		setSelectedBucket(null);
		setSiemPage(1);
		onFilterChange({ timeRange: 'custom', startTime: clampedStart, endTime: parsed.endTs, page: 1 });
	}, [
		customDateStart, customDateEnd, t, showNotice, onFilterChange,
		setSelectedBucket, setShowCustomDateModal, setSiemEndTime,
		setSiemPage, setSiemStartTime, setSiemTimeRange,
	]);

	const handlePivotFilter = useCallback((field: string, value: string, op: 'eq' | 'neq') => {
		if (!value) return;
		const override = computePivotOverride(field, value, op);
		if (override.ip !== undefined) {
			setSiemIp(override.ip);
			setSiemIpOp(override.ipOp ?? 'eq');
		} else if (override.service !== undefined) {
			setSiemService(override.service);
			setSiemServiceOp(override.serviceOp ?? 'eq');
		} else if (override.level !== undefined) {
			setSiemLevel(override.level);
			setSiemLevelOp(override.levelOp ?? 'eq');
		} else if (override.searchField !== undefined) {
			setSiemSearchField(override.searchField);
			setSiemSearch(override.search ?? '');
			setSiemSearchOp(override.searchOp ?? 'contains');
		}
		setSiemPage(1);
		onFilterChange(override);
		showNotice('ok', `${op === 'eq' ? '+' : '≠'} ${field}=${value}`);
	}, [
		showNotice, onFilterChange, setSiemIp, setSiemIpOp, setSiemLevel, setSiemLevelOp,
		setSiemPage, setSiemSearch, setSiemSearchField, setSiemSearchOp, setSiemService, setSiemServiceOp,
	]);

	return {
		...state,
		buildSiemQueryParams,
		handleQuickExcludeLevel,
		handleQuickExcludeService,
		handleQuickExcludeIp,
		handleResetAllFilters,
		handleSelectTimeRange,
		handleZoomBucket,
		handleApplyCustomDate,
		handlePivotFilter,
	};
}
