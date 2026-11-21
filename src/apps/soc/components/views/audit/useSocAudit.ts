import { useState, useEffect, useMemo, useRef } from 'react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { downloadCsv } from '@/core/data/download';
import { useToast } from '@/core/ui/Toast';
import { useDialog } from '@/components/Common/DialogProvider';
import { AUDIT_CSV_HEADERS, AUDIT_PAGE_SIZE, AUDIT_ACTIONS, auditCsvRows } from '@/lib/audit';
import { getActionCategory, type AuditResponse, type CategoryType, type DatePresetType } from './auditUtils';
import type { AuditCopy } from './i18nAudit';

export function useSocAudit(copy: AuditCopy, t: (k: string, f?: string) => string) {
	const notify = useToast();
	const dialog = useDialog();

	const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
	useEffect(() => {
		let cancelled = false;
		fetch('/api/roles', { cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then((payload) => {
				if (!cancelled && Array.isArray(payload?.roles)) setRoles(payload.roles);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	const [searchQuery, setSearchQuery] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [activeCategory, setActiveCategory] = useState<CategoryType>('all');
	const [selectedRole, setSelectedRole] = useState('');
	const [selectedAction, setSelectedAction] = useState('');
	const [datePreset, setDatePreset] = useState<DatePresetType>('all');
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [exporting, setExporting] = useState(false);
	const [clearing, setClearing] = useState(false);

	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const handleSearchChange = (val: string) => {
		setSearchQuery(val);
		if (searchTimer.current) clearTimeout(searchTimer.current);
		searchTimer.current = setTimeout(() => {
			setDebouncedSearch(val.trim());
			setCurrentPage(1);
		}, 280);
	};

	const clearSearch = () => {
		setSearchQuery('');
		setDebouncedSearch('');
		setCurrentPage(1);
	};

	const handleCategoryChange = (cat: CategoryType) => {
		setActiveCategory(cat);
		setSelectedAction('');
		setCurrentPage(1);
	};

	const handleDatePreset = (preset: DatePresetType) => {
		setDatePreset(preset);
		const today = new Date();
		const fmt = (d: Date) => d.toISOString().split('T')[0];
		if (preset === 'all') {
			setFromDate('');
			setToDate('');
		} else if (preset === 'today') {
			const str = fmt(today);
			setFromDate(str);
			setToDate(str);
		} else if (preset === '7d') {
			setFromDate(fmt(new Date(Date.now() - 7 * 86400000)));
			setToDate(fmt(today));
		} else if (preset === '30d') {
			setFromDate(fmt(new Date(Date.now() - 30 * 86400000)));
			setToDate(fmt(today));
		}
		setCurrentPage(1);
	};

	const resetAllFilters = () => {
		setSearchQuery('');
		setDebouncedSearch('');
		setActiveCategory('all');
		setSelectedRole('');
		setSelectedAction('');
		setDatePreset('all');
		setFromDate('');
		setToDate('');
		setCurrentPage(1);
	};

	const hasActiveFilters = Boolean(
		debouncedSearch || activeCategory !== 'all' || selectedRole || selectedAction || fromDate || toDate
	);

	const queryUrl = useMemo(() => {
		const p = new URLSearchParams();
		if (debouncedSearch) p.set('user', debouncedSearch);
		if (selectedRole) p.set('role', selectedRole);
		if (selectedAction) p.set('action', selectedAction);
		if (fromDate) p.set('from', fromDate);
		if (toDate) p.set('to', toDate);
		if (currentPage > 1) p.set('page', String(currentPage));
		return `/api/audit?${p.toString()}`;
	}, [debouncedSearch, selectedRole, selectedAction, fromDate, toDate, currentPage]);

	const { data, refetch, isLoading, error } = useJsonResource<AuditResponse>(queryUrl);

	const filteredRecords = useMemo(() => {
		const list = data?.records ?? [];
		if (activeCategory === 'all' || selectedAction) return list;
		return list.filter((r) => getActionCategory(r.action || '') === activeCategory);
	}, [data?.records, activeCategory, selectedAction]);

	const totalRecords = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalRecords / AUDIT_PAGE_SIZE));

	const exportAuditCsv = async () => {
		setExporting(true);
		try {
			const p = new URLSearchParams();
			if (debouncedSearch) p.set('user', debouncedSearch);
			if (selectedRole) p.set('role', selectedRole);
			if (selectedAction) p.set('action', selectedAction);
			if (fromDate) p.set('from', fromDate);
			if (toDate) p.set('to', toDate);
			p.set('all', '1');
			const res = await fetch(`/api/audit?${p.toString()}`);
			if (!res.ok) throw new Error();
			const json = (await res.json()) as AuditResponse;
			downloadCsv(`soc-audit-log-${new Date().toISOString().slice(0, 10)}`, AUDIT_CSV_HEADERS, auditCsvRows(json.records));
			notify(copy.csvExported, 'success');
		} catch {
			notify(t('auditCsvError'), 'error');
		} finally {
			setExporting(false);
		}
	};

	const purgeAuditLog = async () => {
		const approved = await dialog.confirm({
			title: t('auditPurgeHistory'),
			message: t('auditPurgeConfirm'),
			tone: 'danger',
			confirmLabel: t('auditPurgeHistory'),
		});
		if (!approved) return;
		setClearing(true);
		try {
			const res = await fetch('/api/audit', { method: 'DELETE' });
			if (!res.ok) throw new Error();
			notify(t('auditHistoryCleared'), 'success');
			await refetch();
		} catch {
			notify(t('auditError'), 'error');
		} finally {
			setClearing(false);
		}
	};

	const availableActions = useMemo(() => {
		if (activeCategory === 'all') return AUDIT_ACTIONS;
		return AUDIT_ACTIONS.filter((a) => getActionCategory(a) === activeCategory);
	}, [activeCategory]);

	return {
		roles,
		searchQuery,
		handleSearchChange,
		clearSearch,
		activeCategory,
		handleCategoryChange,
		selectedRole,
		setSelectedRole,
		selectedAction,
		setSelectedAction,
		datePreset,
		handleDatePreset,
		fromDate,
		setFromDate,
		toDate,
		setToDate,
		setDatePreset,
		currentPage,
		setCurrentPage,
		hasActiveFilters,
		resetAllFilters,
		data,
		refetch,
		isLoading,
		error,
		filteredRecords,
		totalRecords,
		totalPages,
		exporting,
		clearing,
		exportAuditCsv,
		purgeAuditLog,
		availableActions,
	};
}
