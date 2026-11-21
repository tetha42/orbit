'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { exportGridRowsCsv, exportGridRowsJson } from '../utils/exportData';
import { DatabaseFilterBar } from './DatabaseFilterBar';
import { DatabaseGridToolbar } from './grid/DatabaseGridToolbar';
import { DatabaseGridTable } from './grid/DatabaseGridTable';
import { DatabaseGridPagination } from './grid/DatabaseGridPagination';
import { DatabaseAddRowModal } from './grid/DatabaseAddRowModal';
import { useGridContextMenu } from './grid/useGridContextMenu';
import { useDatabaseGridState } from './grid/useDatabaseGridState';
import type { FilterRule, PendingCellChange, TableDataResponse } from '../types';

interface DatabaseGridProps {
	data: TableDataResponse | null;
	isLoading: boolean;
	primaryKey: string;
	pendingChanges: PendingCellChange[];
	onCellChange: (change: PendingCellChange) => void;
	onDeleteRows: (rowPks: unknown[]) => void;
	onInsertRow: (row: Record<string, unknown>) => void;
	onRefresh: () => void;
	onPageChange: (newPage: number) => void;
	pageSize: number;
	onPageSizeChange: (newPageSize: number) => void;
	onSearchChange: (search: string) => void;
	onSortChange: (column: string) => void;
	sortColumn: string;
	sortOrder: 'asc' | 'desc';
	filters: FilterRule[];
	onAddFilter: (initial?: Partial<FilterRule>) => void;
	onUpdateFilter: (id: string, updated: Partial<FilterRule>) => void;
	onRemoveFilter: (id: string) => void;
	onClearFilters: () => void;
	hiddenColumns: Set<string>;
	onToggleColumnVisibility: (col: string) => void;
	onShowAllColumns: () => void;
	onJumpToForeignKey?: (foreignTable: string, foreignCol: string, value: unknown) => void;
	onOpenImport?: () => void;
	onOpenRowDrawer?: (row: Record<string, unknown>) => void;
}

export function DatabaseGrid({
	data,
	isLoading,
	primaryKey,
	pendingChanges,
	onCellChange,
	onDeleteRows,
	onInsertRow,
	onRefresh,
	onPageChange,
	pageSize,
	onPageSizeChange,
	onSearchChange,
	onSortChange,
	sortColumn,
	sortOrder,
	filters,
	onAddFilter,
	onUpdateFilter,
	onRemoveFilter,
	onClearFilters,
	hiddenColumns,
	onToggleColumnVisibility,
	onShowAllColumns,
	onJumpToForeignKey,
	onOpenImport,
	onOpenRowDrawer,
}: DatabaseGridProps) {
	const { t } = useI18n();
	const gridState = useDatabaseGridState({
		data,
		primaryKey,
		pendingChanges,
		onCellChange,
		onDeleteRows,
	});
	const contextMenu = useGridContextMenu({
		onDeleteRows,
		onAddFilter,
		onOpenRowDrawer,
	});

	if (!data && isLoading) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, opacity: 0.6 }}>
				<RefreshCw size={24} className="animate-spin" />
			</div>
		);
	}

	if (!data) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, opacity: 0.5 }}>
				{t('dbSelectTablePrompt')}
			</div>
		);
	}

	const columns = data.columns;
	const visibleColumns = columns.filter((c) => !hiddenColumns.has(c.name));
	const rows = data.rows;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
			<DatabaseGridToolbar
				tableName={data.table}
				totalRows={data.totalRows}
				searchInput={gridState.searchInput}
				selectedCount={gridState.selectedRows.size}
				isLoading={isLoading}
				onSearchInputChange={(value) => {
					gridState.setSearchInput(value);
					onSearchChange(value);
				}}
				onOpenAddModal={() => gridState.setShowAddModal(true)}
				onOpenImport={onOpenImport}
				onDeleteSelected={gridState.handleDeleteSelected}
				onExportCsv={() => exportGridRowsCsv(data.table, visibleColumns.map((c) => c.name), rows)}
				onExportJson={() => exportGridRowsJson(data.table, rows)}
				onRefresh={onRefresh}
			/>

			<DatabaseFilterBar
				columns={columns}
				filters={filters}
				onAddFilter={onAddFilter}
				onUpdateFilter={onUpdateFilter}
				onRemoveFilter={onRemoveFilter}
				onClearFilters={onClearFilters}
				hiddenColumns={hiddenColumns}
				onToggleColumnVisibility={onToggleColumnVisibility}
				onShowAllColumns={onShowAllColumns}
			/>

			<DatabaseGridTable
				rows={rows}
				visibleColumns={visibleColumns}
				effectivePk={gridState.effectivePk}
				primaryKeys={data.primaryKeys}
				selectedRows={gridState.selectedRows}
				sortColumn={sortColumn}
				sortOrder={sortOrder}
				editingCell={gridState.editingCell}
				editValue={gridState.editValue}
				getPendingChange={gridState.getPendingChange}
				onToggleSelectAll={gridState.toggleSelectAll}
				onToggleSelectRow={gridState.toggleSelectRow}
				onSortChange={onSortChange}
				onStartEdit={gridState.startEditing}
				onEditValueChange={gridState.setEditValue}
				onCommitEdit={gridState.commitEditing}
				onCancelEdit={gridState.cancelEditing}
				onRowContextMenu={contextMenu.handleRowContextMenu}
				onCellContextMenu={contextMenu.handleCellContextMenu}
				onTouchStartRow={contextMenu.handleTouchStartRow}
				onTouchStartCell={contextMenu.handleTouchStartCell}
				onTouchEnd={contextMenu.handleTouchEndRow}
				onTouchMove={contextMenu.handleTouchMoveRow}
				onJumpToForeignKey={onJumpToForeignKey}
				onOpenRowDrawer={onOpenRowDrawer}
			/>

			<DatabaseGridPagination
				page={data.page}
				totalPages={data.totalPages}
				totalRows={data.totalRows}
				pageSize={pageSize}
				isLoading={isLoading}
				onPageChange={onPageChange}
				onPageSizeChange={onPageSizeChange}
			/>

			{gridState.showAddModal && (
				<DatabaseAddRowModal
					tableName={data.table}
					columns={columns}
					onInsertRow={onInsertRow}
					onClose={() => gridState.setShowAddModal(false)}
				/>
			)}
		</div>
	);
}
