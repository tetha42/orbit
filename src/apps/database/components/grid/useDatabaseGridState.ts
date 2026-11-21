'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import {
	getCellValue,
	getEffectivePk,
	getRowPk,
	parseEditedCellValue,
} from '../../utils/rowValues';
import type { ColumnSpec, PendingCellChange, TableDataResponse } from '../../types';

interface UseDatabaseGridStateOptions {
	data: TableDataResponse | null;
	primaryKey: string;
	pendingChanges: PendingCellChange[];
	onCellChange: (change: PendingCellChange) => void;
	onDeleteRows: (rowPks: unknown[]) => void;
}

export function useDatabaseGridState({
	data,
	primaryKey,
	pendingChanges,
	onCellChange,
	onDeleteRows,
}: UseDatabaseGridStateOptions) {
	const { t } = useI18n();
	const dialog = useDialog();

	const [editingCell, setEditingCell] = useState<{ pkVal: unknown; colName: string } | null>(null);
	const [editValue, setEditValue] = useState<string>('');
	const [selectedRows, setSelectedRows] = useState<Set<unknown>>(new Set());
	const [searchInput, setSearchInput] = useState('');
	const [showAddModal, setShowAddModal] = useState(false);

	const tableKey = data?.table ?? null;
	const pageKey = data?.page ?? null;

	useEffect(() => {
		setSelectedRows(new Set());
		setEditingCell(null);
	}, [tableKey, pageKey]);

	const rows = data?.rows ?? [];
	const effectivePk = getEffectivePk(data, primaryKey);

	const getPendingChange = (pkVal: unknown, colName: string) =>
		pendingChanges.find(
			(c) => String(c.rowPkVal) === String(pkVal) && c.columnName === colName
		);

	const startEditing = (row: Record<string, unknown>, col: ColumnSpec, index: number) => {
		if (col.isSensitive || !data) return;
		const pkVal = getRowPk(row, index, effectivePk, data.primaryKeys);
		const pending = getPendingChange(pkVal, col.name);
		const currentVal = pending ? pending.newValue : getCellValue(row, col.name);

		setEditingCell({ pkVal, colName: col.name });
		setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal));
	};

	const commitEditing = (row: Record<string, unknown>, col: ColumnSpec, index: number) => {
		if (!editingCell || !data) return;
		const pkVal = getRowPk(row, index, effectivePk, data.primaryKeys);
		const originalVal = getCellValue(row, col.name);
		const parsedValue = parseEditedCellValue(editValue, col);

		if (String(parsedValue) !== String(originalVal)) {
			onCellChange({
				rowPkVal: pkVal,
				rowPkCol: effectivePk,
				columnName: col.name,
				originalValue: originalVal,
				newValue: parsedValue,
			});
		}

		setEditingCell(null);
	};

	const toggleSelectAll = () => {
		if (!data) return;
		if (selectedRows.size === rows.length) {
			setSelectedRows(new Set());
		} else {
			setSelectedRows(new Set(rows.map((r, i) => getRowPk(r, i, effectivePk, data.primaryKeys))));
		}
	};

	const toggleSelectRow = (pkVal: unknown) => {
		const next = new Set(selectedRows);
		if (next.has(pkVal)) next.delete(pkVal);
		else next.add(pkVal);
		setSelectedRows(next);
	};

	const handleDeleteSelected = async () => {
		if (selectedRows.size === 0) return;
		const confirmed = await dialog.confirm({
			title: t('dbDeleteRows'),
			message: fill(t('dbDeleteRowsConfirm'), { n: selectedRows.size }),
			tone: 'danger',
		});

		if (confirmed) {
			onDeleteRows(Array.from(selectedRows));
			setSelectedRows(new Set());
		}
	};

	return {
		effectivePk,
		editingCell,
		editValue,
		setEditValue,
		cancelEditing: () => setEditingCell(null),
		selectedRows,
		searchInput,
		setSearchInput,
		showAddModal,
		setShowAddModal,
		getPendingChange,
		startEditing,
		commitEditing,
		toggleSelectAll,
		toggleSelectRow,
		handleDeleteSelected,
	};
}
