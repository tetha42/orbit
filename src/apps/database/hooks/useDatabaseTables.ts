'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FilterRule, TableDataResponse, TableSummary } from '../types';

interface UseDatabaseTablesOptions {
	is2FaVerified: boolean;
	dbToken: string;
	onUnauthorized: () => void;
}

export function useDatabaseTables({
	is2FaVerified,
	dbToken,
	onUnauthorized,
}: UseDatabaseTablesOptions) {
	const [tables, setTables] = useState<TableSummary[]>([]);
	const [selectedTable, setSelectedTable] = useState<string | null>(null);
	const [isTablesLoading, setIsTablesLoading] = useState(false);

	const [tableData, setTableData] = useState<TableDataResponse | null>(null);
	const [isDataLoading, setIsDataLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);
	const [searchQuery, setSearchQuery] = useState('');
	const [sortColumn, setSortColumn] = useState('');
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

	const [filters, setFilters] = useState<FilterRule[]>([]);
	const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
	const tablesAbortRef = useRef<AbortController | null>(null);
	const dataAbortRef = useRef<AbortController | null>(null);

	const fetchTables = useCallback(async () => {
		if (!dbToken) return;
		tablesAbortRef.current?.abort();
		const controller = new AbortController();
		tablesAbortRef.current = controller;
		setIsTablesLoading(true);
		try {
			const res = await fetch('/api/database/tables', {
				headers: { 'x-db-token': dbToken },
				signal: controller.signal,
			});
			if (controller.signal.aborted) return;
			if (res.ok) {
				const data = await res.json();
				if (controller.signal.aborted) return;
				const nextTables = Array.isArray(data.tables)
					? data.tables.filter(
							(t: unknown): t is TableSummary =>
								Boolean(t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string')
						)
					: [];
				setTables(nextTables);
				if (nextTables.length > 0) {
					setSelectedTable((prev) => prev || nextTables[0].name);
				}
			} else if (res.status === 401) {
				onUnauthorized();
			}
		} catch (err) {
			if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
			console.error('Failed to load tables:', err);
		} finally {
			if (tablesAbortRef.current === controller) {
				tablesAbortRef.current = null;
				setIsTablesLoading(false);
			}
		}
	}, [dbToken, onUnauthorized]);

	const fetchTableData = useCallback(async () => {
		if (!dbToken || !selectedTable) return;
		dataAbortRef.current?.abort();
		const controller = new AbortController();
		dataAbortRef.current = controller;
		setIsDataLoading(true);
		try {
			const params = new URLSearchParams({
				table: selectedTable,
				page: String(page),
				limit: String(pageSize),
			});
			if (searchQuery) params.set('search', searchQuery);
			if (sortColumn) {
				params.set('sort', sortColumn);
				params.set('order', sortOrder);
			}
			if (filters.length > 0) {
				params.set('filters', JSON.stringify(filters));
			}

			const res = await fetch(`/api/database/data?${params.toString()}`, {
				headers: { 'x-db-token': dbToken },
				signal: controller.signal,
			});
			if (controller.signal.aborted) return;
			if (res.ok) {
				const data = await res.json();
				if (controller.signal.aborted) return;
				setTableData(data);
			} else if (res.status === 401) {
				onUnauthorized();
			}
		} catch (err) {
			if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
			console.error(`Failed to load data for ${selectedTable}:`, err);
		} finally {
			if (dataAbortRef.current === controller) {
				dataAbortRef.current = null;
				setIsDataLoading(false);
			}
		}
	}, [dbToken, selectedTable, page, pageSize, searchQuery, sortColumn, sortOrder, filters, onUnauthorized]);

	useEffect(() => {
		if (is2FaVerified && dbToken) {
			void fetchTables();
		}
		return () => {
			tablesAbortRef.current?.abort();
		};
	}, [is2FaVerified, dbToken, fetchTables]);

	useEffect(() => {
		if (is2FaVerified && dbToken && selectedTable) {
			void fetchTableData();
		}
		return () => {
			dataAbortRef.current?.abort();
		};
	}, [is2FaVerified, dbToken, selectedTable, fetchTableData]);

	const applyTableSelection = (name: string) => {
		setSelectedTable(name);
		setTableData(null);
		setPage(1);
		setSearchQuery('');
		setSortColumn('');
		setFilters([]);
		setHiddenColumns(new Set());
	};

	const applyForeignKeyFilter = (foreignTable: string, foreignCol: string, value: unknown) => {
		setSelectedTable(foreignTable);
		setTableData(null);
		setSearchQuery('');
		setSortColumn('');
		setHiddenColumns(new Set());
		setFilters([
			{
				id: 'fk_' + Date.now(),
				column: foreignCol,
				op: '=',
				value: String(value),
			},
		]);
		setPage(1);
	};

	const handleAddFilter = (initial?: Partial<FilterRule>) => {
		const firstCol = tableData?.columns[0]?.name || 'id';
		setFilters((prev) => [
			...prev,
			{
				id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
				column: initial?.column || firstCol,
				op: initial?.op || '=',
				value: initial?.value ?? '',
			},
		]);
	};

	const handleUpdateFilter = (id: string, updated: Partial<FilterRule>) => {
		setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)));
	};

	const handleRemoveFilter = (id: string) => {
		setFilters((prev) => prev.filter((f) => f.id !== id));
	};

	const handleClearFilters = () => {
		setFilters([]);
	};

	const handleToggleColumnVisibility = (colName: string) => {
		setHiddenColumns((prev) => {
			const next = new Set(prev);
			if (next.has(colName)) next.delete(colName);
			else next.add(colName);
			return next;
		});
	};

	const handleShowAllColumns = () => {
		setHiddenColumns(new Set());
	};

	const handleSortChange = (col: string) => {
		if (sortColumn === col) {
			setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
		} else {
			setSortColumn(col);
			setSortOrder('asc');
		}
	};

	const handlePageSizeChange = (newSize: number) => {
		setPageSize(newSize);
		setPage(1);
	};

	const handleSearchChange = (query: string) => {
		setSearchQuery(query);
		setPage(1);
	};

	return {
		tables,
		selectedTable,
		isTablesLoading,
		tableData,
		isDataLoading,
		page,
		setPage,
		pageSize,
		sortColumn,
		sortOrder,
		filters,
		hiddenColumns,
		fetchTables,
		fetchTableData,
		applyTableSelection,
		applyForeignKeyFilter,
		handleAddFilter,
		handleUpdateFilter,
		handleRemoveFilter,
		handleClearFilters,
		handleToggleColumnVisibility,
		handleShowAllColumns,
		handleSortChange,
		handlePageSizeChange,
		handleSearchChange,
	};
}
