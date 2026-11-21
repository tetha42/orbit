'use client';

import { useState, useRef, useEffect } from 'react';
import type {
	TimeRangePreset,
	SiemFilterSnapshot,
	SiemSearchOp,
	SiemSearchField,
} from '../../types';
import { INITIAL_SIEM_FILTER_SNAPSHOT } from './siemFilterUtils';

export function useSocSiemFilterState() {
	const [siemService, setSiemService] = useState<string>('all');
	const [siemServiceOp, setSiemServiceOp] = useState<'eq' | 'neq'>('eq');
	const [siemLevel, setSiemLevel] = useState<string>('all');
	const [siemLevelOp, setSiemLevelOp] = useState<'eq' | 'neq'>('eq');
	const [siemIp, setSiemIp] = useState<string>('');
	const [siemIpOp, setSiemIpOp] = useState<'eq' | 'neq' | 'contains' | 'not_contains'>('eq');
	const [siemSearch, setSiemSearch] = useState<string>('');
	const [siemSearchOp, setSiemSearchOp] = useState<SiemSearchOp>('contains');
	const [siemSearchField, setSiemSearchField] = useState<SiemSearchField>('all');

	const [siemTimeRange, setSiemTimeRange] = useState<TimeRangePreset>('24h');
	const [siemStartTime, setSiemStartTime] = useState<number | null>(null);
	const [siemEndTime, setSiemEndTime] = useState<number | null>(null);
	const [siemPage, setSiemPage] = useState<number>(1);
	const [siemLimit, setSiemLimit] = useState<number>(50);
	const [pageJump, setPageJump] = useState<string>('');
	const [selectedBucket, setSelectedBucket] = useState<number | null>(null);

	const [showCustomDateModal, setShowCustomDateModal] = useState<boolean>(false);
	const [customDateStart, setCustomDateStart] = useState<string>('');
	const [customDateEnd, setCustomDateEnd] = useState<string>('');

	const siemFilterRef = useRef<SiemFilterSnapshot>({ ...INITIAL_SIEM_FILTER_SNAPSHOT });

	useEffect(() => {
		siemFilterRef.current = {
			service: siemService,
			serviceOp: siemServiceOp,
			level: siemLevel,
			levelOp: siemLevelOp,
			ip: siemIp,
			ipOp: siemIpOp,
			search: siemSearch,
			searchOp: siemSearchOp,
			searchField: siemSearchField,
			timeRange: siemTimeRange,
			startTime: siemStartTime ?? undefined,
			endTime: siemEndTime ?? undefined,
			page: siemPage,
			limit: siemLimit,
		};
	}, [
		siemService,
		siemServiceOp,
		siemLevel,
		siemLevelOp,
		siemIp,
		siemIpOp,
		siemSearch,
		siemSearchOp,
		siemSearchField,
		siemTimeRange,
		siemStartTime,
		siemEndTime,
		siemPage,
		siemLimit,
	]);

	return {
		siemService,
		setSiemService,
		siemServiceOp,
		setSiemServiceOp,
		siemLevel,
		setSiemLevel,
		siemLevelOp,
		setSiemLevelOp,
		siemIp,
		setSiemIp,
		siemIpOp,
		setSiemIpOp,
		siemSearch,
		setSiemSearch,
		siemSearchOp,
		setSiemSearchOp,
		siemSearchField,
		setSiemSearchField,
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
		pageJump,
		setPageJump,
		selectedBucket,
		setSelectedBucket,
		showCustomDateModal,
		setShowCustomDateModal,
		customDateStart,
		setCustomDateStart,
		customDateEnd,
		setCustomDateEnd,
		siemFilterRef,
	};
}
