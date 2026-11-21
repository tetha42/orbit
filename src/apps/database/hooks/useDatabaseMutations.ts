'use client';

import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import { getCellValue } from '../utils/rowValues';
import type { PendingCellChange, TableDataResponse, TableSummary } from '../types';

interface UseDatabaseMutationsOptions {
	dbToken: string;
	selectedTable: string | null;
	tableData: TableDataResponse | null;
	tables: TableSummary[];
	onRefreshData: () => void;
	onRefreshTables: () => void;
}

export function useDatabaseMutations({
	dbToken,
	selectedTable,
	tableData,
	tables,
	onRefreshData,
	onRefreshTables,
}: UseDatabaseMutationsOptions) {
	const { t } = useI18n();
	const dialog = useDialog();

	const [pendingChanges, setPendingChanges] = useState<PendingCellChange[]>([]);
	const [isSaving, setIsSaving] = useState(false);

	const resolvePkCol = () =>
		tableData?.primaryKey ||
		tables.find((tbl) => tbl.name === selectedTable)?.primaryKey ||
		'id';

	const handleCellChange = (change: PendingCellChange) => {
		setPendingChanges((prev) => {
			const filtered = prev.filter(
				(c) =>
					!(String(c.rowPkVal) === String(change.rowPkVal) && c.columnName === change.columnName)
			);
			return [...filtered, change];
		});
	};

	const handleBatchSave = async () => {
		if (!selectedTable || pendingChanges.length === 0 || isSaving) return;

		const confirmed = await dialog.confirm({
			title: t('dbApplyConfirm'),
			message: fill(t('dbApplyConfirmPrompt'), { table: selectedTable, n: pendingChanges.length }),
			tone: 'warning',
		});

		if (!confirmed) return;

		setIsSaving(true);
		try {
			const rowMap = new Map<
				unknown,
				{ pkCol: string; changes: Record<string, unknown>; previous: Record<string, unknown> }
			>();
			for (const c of pendingChanges) {
				if (!rowMap.has(c.rowPkVal)) {
					rowMap.set(c.rowPkVal, { pkCol: c.rowPkCol, changes: {}, previous: {} });
				}
				rowMap.get(c.rowPkVal)!.changes[c.columnName] = c.newValue;
				rowMap.get(c.rowPkVal)!.previous[c.columnName] = c.originalValue;
			}

			const updates = Array.from(rowMap.entries()).map(([val, info]) => ({
				pk: { col: info.pkCol, val },
				changes: info.changes,
				previous: info.previous,
			}));

			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-db-token': dbToken },
				body: JSON.stringify({ table: selectedTable, updates }),
			});

			const data = await res.json();
			if (res.ok) {
				setPendingChanges([]);
				await dialog.alert({
					title: t('success'),
					message: data.message || t('dbSavedSuccess'),
				});
				onRefreshData();
				onRefreshTables();
			} else {
				await dialog.alert({
					title: t('error'),
					message: data.error || t('dbSaveFailed'),
				});
			}
		} catch (err) {
			await dialog.alert({
				title: t('error'),
				message: err instanceof Error ? err.message : t('dbConnectionError'),
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleSaveRowDrawer = async (
		activeRow: Record<string, unknown> | null,
		changedValues: Record<string, unknown>,
		onCloseDrawer: () => void
	) => {
		if (!activeRow || !selectedTable || Object.keys(changedValues).length === 0) {
			onCloseDrawer();
			return;
		}

		const pkCol = resolvePkCol();
		const pkVal = getCellValue(activeRow, pkCol);
		const previousValues: Record<string, unknown> = {};
		for (const key of Object.keys(changedValues)) {
			previousValues[key] = getCellValue(activeRow, key);
		}

		try {
			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-db-token': dbToken },
				body: JSON.stringify({
					table: selectedTable,
					updates: [{ pk: { col: pkCol, val: pkVal }, changes: changedValues, previous: previousValues }],
				}),
			});

			const data = await res.json();
			if (res.ok) {
				await dialog.alert({ title: t('success'), message: t('dbRowUpdated') });
				onCloseDrawer();
				onRefreshData();
			} else {
				await dialog.alert({ title: t('error'), message: data.error || t('dbRowUpdateFailed') });
			}
		} catch (err) {
			console.error('Drawer save error:', err);
		}
	};

	const handleDeleteRows = async (rowPks: unknown[]) => {
		if (!selectedTable || rowPks.length === 0) return;
		const pkCol = resolvePkCol();

		try {
			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-db-token': dbToken },
				body: JSON.stringify({
					table: selectedTable,
					deletes: rowPks.map((val) => ({ col: pkCol, val })),
				}),
			});

			if (res.ok) {
				onRefreshData();
				onRefreshTables();
			} else {
				const data = await res.json();
				await dialog.alert({
					title: t('dbDeleteFailed'),
					message: data.error || t('dbDeleteFailed'),
				});
			}
		} catch (err) {
			console.error('Delete error:', err);
		}
	};

	const handleInsertRow = async (row: Record<string, unknown>) => {
		if (!selectedTable) return;
		try {
			const res = await fetch('/api/database/mutate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-db-token': dbToken },
				body: JSON.stringify({ table: selectedTable, inserts: [row] }),
			});

			if (res.ok) {
				onRefreshData();
				onRefreshTables();
			} else {
				const data = await res.json();
				await dialog.alert({
					title: t('dbInsertFailed'),
					message: data.error || t('dbInsertFailed'),
				});
			}
		} catch (err) {
			console.error('Insert error:', err);
		}
	};

	return {
		pendingChanges,
		isSaving,
		clearPendingChanges: () => setPendingChanges([]),
		handleCellChange,
		handleBatchSave,
		handleSaveRowDrawer,
		handleDeleteRows,
		handleInsertRow,
	};
}
