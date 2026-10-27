'use client';

import React, { useState } from 'react';
import {
	Download,
	Trash2,
	Plus,
	RefreshCw,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Search,
	Upload,
	ExternalLink,
	Eye,
	Copy,
	Filter,
} from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { useDialog } from '@/components/Common/DialogProvider';
import { useShellActions } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import { downloadCsv, downloadBlob } from '@/core/data/download';
import { DatabaseFilterBar } from './DatabaseFilterBar';
import type { ColumnSpec, FilterRule, PendingCellChange, TableDataResponse } from '../types';
import s from '../Database.module.css';

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
	// Advanced Features Props
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

function getEffectivePk(data: TableDataResponse | null, primaryKey: string): string {
	const candidate = data?.primaryKey || primaryKey || 'id';
	if (!data || data.rows.length === 0) return candidate;

	const firstRow = data.rows[0];
	if (firstRow[candidate] !== undefined) return candidate;

	// Case-insensitive match on row keys
	const lowerTarget = candidate.toLowerCase();
	const matchedKey = Object.keys(firstRow).find((k) => k.toLowerCase() === lowerTarget);
	if (matchedKey && firstRow[matchedKey] !== undefined) return matchedKey;

	// Fallback: check if 'id' exists
	if (firstRow.id !== undefined) return 'id';

	// Fallback to first column name
	if (data.columns && data.columns.length > 0 && firstRow[data.columns[0].name] !== undefined) {
		return data.columns[0].name;
	}

	return candidate;
}

function getRowPk(
	row: Record<string, unknown>,
	index: number,
	effectivePk: string,
	primaryKeys?: string[]
): unknown {
	if (row[effectivePk] !== undefined && row[effectivePk] !== null) {
		return row[effectivePk];
	}
	const lowerTarget = effectivePk.toLowerCase();
	const matchedKey = Object.keys(row).find((k) => k.toLowerCase() === lowerTarget);
	if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
		return row[matchedKey];
	}
	if (row.id !== undefined && row.id !== null) {
		return row.id;
	}
	if (primaryKeys && primaryKeys.length > 1) {
		const composite = primaryKeys.map((k) => String(row[k] ?? '')).join('_');
		if (composite && composite.replace(/_/g, '').length > 0) return composite;
	}
	return `row_${index}`;
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
	const dialog = useDialog();
	const { openContextMenu } = useShellActions();

	const [editingCell, setEditingCell] = useState<{ pkVal: unknown; colName: string } | null>(null);
	const [editValue, setEditValue] = useState<string>('');
	const [selectedRows, setSelectedRows] = useState<Set<unknown>>(new Set());
	const [searchInput, setSearchInput] = useState('');
	const [showAddModal, setShowAddModal] = useState(false);
	const [newRowData, setNewRowData] = useState<Record<string, string>>({});
	const [pageJump, setPageJump] = useState<string>('');
	const rowTouchTimerRef = React.useRef<{ timer: NodeJS.Timeout | null; startX: number; startY: number } | null>(null);

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
	const effectivePk = getEffectivePk(data, primaryKey);

	// Helper to find pending change for a cell
	const getPendingChange = (pkVal: unknown, colName: string) => {
		return pendingChanges.find(
			(c) => String(c.rowPkVal) === String(pkVal) && c.columnName === colName
		);
	};

	const startEditing = (row: Record<string, unknown>, col: ColumnSpec, index: number) => {
		if (col.isSensitive) return; // Cannot edit masked sensitive fields
		const pkVal = getRowPk(row, index, effectivePk, data.primaryKeys);
		const pending = getPendingChange(pkVal, col.name);
		const currentVal = pending ? pending.newValue : row[col.name];

		setEditingCell({ pkVal, colName: col.name });
		setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal));
	};

	const commitEditing = (row: Record<string, unknown>, col: ColumnSpec, index: number) => {
		if (!editingCell) return;
		const pkVal = getRowPk(row, index, effectivePk, data.primaryKeys);
		const originalVal = row[col.name];

		let parsedValue: unknown = editValue;
		if (col.type === 'integer' || col.type === 'bigint' || col.type === 'smallint') {
			parsedValue = editValue.trim() === '' ? null : parseInt(editValue, 10);
		} else if (col.type === 'boolean') {
			parsedValue = editValue === 'true' || editValue === '1';
		} else if (editValue.trim() === '' && col.nullable) {
			parsedValue = null;
		}

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

	const handleExportCsv = () => {
		if (rows.length === 0) return;
		const header = visibleColumns.map((c) => c.name);
		const rowData = rows.map((r) =>
			visibleColumns.map((c) => {
				const val = r[c.name];
				if (val === null || val === undefined) return '';
				if (typeof val === 'object') return JSON.stringify(val);
				return typeof val === 'number' ? val : String(val);
			})
		);
		downloadCsv(`${data.table}_export`, header, rowData);
	};

	const handleExportJson = () => {
		if (rows.length === 0) return;
		const jsonString = JSON.stringify(rows, null, 2);
		const blob = new Blob([jsonString], { type: 'application/json' });
		downloadBlob(blob, `${data.table}_export_${new Date().toISOString().slice(0, 10)}.json`);
	};

	const handleAddRowSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const formatted: Record<string, unknown> = {};
		for (const col of columns) {
			const val = newRowData[col.name];
			if (val !== undefined && val !== '') {
				if (col.type === 'integer' || col.type === 'bigint') {
					formatted[col.name] = parseInt(val, 10);
				} else if (col.type === 'boolean') {
					formatted[col.name] = val === 'true';
				} else {
					formatted[col.name] = val;
				}
			}
		}
		onInsertRow(formatted);
		setShowAddModal(false);
		setNewRowData({});
	};

	const triggerRowMenu = (x: number, y: number, row: Record<string, unknown>, pkVal: unknown) => {
		const items: MenuItem[] = [
			{
				id: `copy-json-${String(pkVal)}`,
				label: t('ctxDbCopyJson'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(JSON.stringify(row, null, 2));
				},
			},
		];

		if (onOpenRowDrawer) {
			items.push({
				id: `inspect-${String(pkVal)}`,
				label: t('ctxDbInspect'),
				icon: <Eye size={13} />,
				action: () => onOpenRowDrawer(row),
			});
		}

		items.push(
			{ id: `sep-db-${String(pkVal)}`, label: '', separator: true },
			{
				id: `delete-row-${String(pkVal)}`,
				label: t('ctxDbDeleteRow'),
				icon: <Trash2 size={13} />,
				danger: true,
				action: async () => {
					const confirmed = await dialog.confirm({
						title: t('ctxDbDeleteRow'),
						message: fill(t('dbDeleteRowsConfirm'), { n: 1 }),
						tone: 'danger',
					});
					if (confirmed) {
						onDeleteRows([pkVal]);
					}
				},
			}
		);

		openContextMenu({
			x,
			y,
			mode: 'app',
			customItems: items,
		});
	};

	const handleRowContextMenu = (e: React.MouseEvent, row: Record<string, unknown>, pkVal: unknown) => {
		e.preventDefault();
		e.stopPropagation();
		triggerRowMenu(e.clientX, e.clientY, row, pkVal);
	};

	const triggerCellMenu = (
		x: number,
		y: number,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => {
		const strVal = displayVal === null || displayVal === undefined
			? ''
			: typeof displayVal === 'object'
			? JSON.stringify(displayVal)
			: String(displayVal);

		const items: MenuItem[] = [
			{
				id: `copy-cell-${String(pkVal)}-${col.name}`,
				label: t('ctxDbCopyCell'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(strVal);
				},
			},
			{
				id: `filter-cell-${String(pkVal)}-${col.name}`,
				label: t('ctxDbFilterByCell'),
				icon: <Filter size={13} />,
				action: () => {
					onAddFilter({
						column: col.name,
						op: '=',
						value: strVal,
					});
				},
			},
			{ id: `sep-cell-${String(pkVal)}-${col.name}`, label: '', separator: true },
			{
				id: `copy-json-${String(pkVal)}`,
				label: t('ctxDbCopyJson'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(JSON.stringify(row, null, 2));
				},
			},
		];

		if (onOpenRowDrawer) {
			items.push({
				id: `inspect-${String(pkVal)}`,
				label: t('ctxDbInspect'),
				icon: <Eye size={13} />,
				action: () => onOpenRowDrawer(row),
			});
		}

		items.push(
			{ id: `sep-db-${String(pkVal)}`, label: '', separator: true },
			{
				id: `delete-row-${String(pkVal)}`,
				label: t('ctxDbDeleteRow'),
				icon: <Trash2 size={13} />,
				danger: true,
				action: async () => {
					const confirmed = await dialog.confirm({
						title: t('ctxDbDeleteRow'),
						message: fill(t('dbDeleteRowsConfirm'), { n: 1 }),
						tone: 'danger',
					});
					if (confirmed) {
						onDeleteRows([pkVal]);
					}
				},
			}
		);

		openContextMenu({
			x,
			y,
			mode: 'app',
			customItems: items,
		});
	};

	const handleCellContextMenu = (
		e: React.MouseEvent,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => {
		e.preventDefault();
		e.stopPropagation();
		triggerCellMenu(e.clientX, e.clientY, row, col, pkVal, displayVal);
	};

	const handleTouchStartRow = (e: React.TouchEvent, row: Record<string, unknown>, pkVal: unknown) => {
		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		const { clientX, clientY } = touch;
		rowTouchTimerRef.current = {
			startX: clientX,
			startY: clientY,
			timer: setTimeout(() => {
				try {
					if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
						navigator.vibrate(20);
					}
				} catch {}
				triggerRowMenu(clientX, clientY, row, pkVal);
			}, 500),
		};
	};

	const handleTouchEndRow = () => {
		if (rowTouchTimerRef.current?.timer) {
			clearTimeout(rowTouchTimerRef.current.timer);
		}
		rowTouchTimerRef.current = null;
	};

	const handleTouchMoveRow = (e: React.TouchEvent) => {
		if (!rowTouchTimerRef.current?.timer || e.touches.length !== 1) return;
		const touch = e.touches[0];
		const dx = Math.abs(touch.clientX - rowTouchTimerRef.current.startX);
		const dy = Math.abs(touch.clientY - rowTouchTimerRef.current.startY);
		if (dx > 10 || dy > 10) {
			clearTimeout(rowTouchTimerRef.current.timer);
			rowTouchTimerRef.current = null;
		}
	};

	const handleTouchStartCell = (
		e: React.TouchEvent,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => {
		if (e.touches.length !== 1) return;
		// Cancel row-level timer so cell menu takes precedence on cell tap
		if (rowTouchTimerRef.current?.timer) {
			clearTimeout(rowTouchTimerRef.current.timer);
			rowTouchTimerRef.current = null;
		}
		const touch = e.touches[0];
		const { clientX, clientY } = touch;
		rowTouchTimerRef.current = {
			startX: clientX,
			startY: clientY,
			timer: setTimeout(() => {
				try {
					if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
						navigator.vibrate(20);
					}
				} catch {}
				triggerCellMenu(clientX, clientY, row, col, pkVal, displayVal);
			}, 500),
		};
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
			{/* Action Toolbar */}
			<div className={s.topBar}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<span style={{ fontSize: 13, fontWeight: 700 }}>
						{data.table}
					</span>
					<span style={{ fontSize: 11, opacity: 0.6 }}>
						({fill(t('dbRowsCount'), { n: data.totalRows })})
					</span>
				</div>

				<div className={s.actionsGroup}>
					{/* Search in active table */}
					<div style={{ position: 'relative' }}>
						<input
							type="text"
							className={s.searchInput}
							style={{ width: 170 }}
							placeholder={t('dbSearchPlaceholder')}
							value={searchInput}
							onChange={(e) => {
								setSearchInput(e.target.value);
								onSearchChange(e.target.value);
							}}
						/>
						<Search
							size={12}
							style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}
						/>
					</div>

					<button
						type="button"
						className={s.actionBtn}
						onClick={() => setShowAddModal(true)}
						title={t('dbAddNewRow')}
					>
						<Plus size={13} />
						<span>{t('add')}</span>
					</button>

					{onOpenImport && (
						<button
							type="button"
							className={s.actionBtn}
							onClick={onOpenImport}
							title="CSV / JSON İçe Aktar"
						>
							<Upload size={13} />
							<span>İçe Aktar</span>
						</button>
					)}

					{selectedRows.size > 0 && (
						<button
							type="button"
							className={s.actionBtn}
							onClick={handleDeleteSelected}
							style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)' }}
						>
							<Trash2 size={13} />
							<span>{t('delete')} ({selectedRows.size})</span>
						</button>
					)}

					<button
						type="button"
						className={s.actionBtn}
						onClick={handleExportCsv}
						title="CSV Dışa Aktar"
					>
						<Download size={13} />
						<span>CSV</span>
					</button>

					<button
						type="button"
						className={s.actionBtn}
						onClick={handleExportJson}
						title="JSON Dışa Aktar"
					>
						<Download size={13} />
						<span>JSON</span>
					</button>

					<button
						type="button"
						className={s.actionBtn}
						onClick={onRefresh}
						disabled={isLoading}
					>
						<RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
					</button>
				</div>
			</div>

			{/* Filter Bar (Airtable / Supabase multi-column filter bar) */}
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

			{/* Excel Grid Table Area */}
			<div className={s.gridWrapper}>
				<table className={s.gridTable}>
					<thead>
						<tr>
							{/* Row Selection & Inspection Th */}
							<th className={s.gridTh} style={{ width: 60, textAlign: 'center' }}>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
									<input
										type="checkbox"
										checked={rows.length > 0 && selectedRows.size === rows.length}
										onChange={toggleSelectAll}
									/>
									<span style={{ fontSize: '10px', opacity: 0.5 }}>#</span>
								</div>
							</th>

							{/* Dynamic Visible Column Headers */}
							{visibleColumns.map((col) => {
								const isSorted = sortColumn === col.name;
								return (
									<th
										key={col.name}
										className={s.gridTh}
										onClick={() => onSortChange(col.name)}
										style={{ cursor: 'pointer' }}
									>
										<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
											<span style={{ fontWeight: col.isPrimaryKey ? 700 : 600 }}>{col.name}</span>
											{col.isPrimaryKey && (
												<span style={{ fontSize: '9px', color: 'var(--warning)', fontWeight: 700 }}>[PK]</span>
											)}
											{col.isForeignKey && (
												<span style={{ fontSize: '9px', color: 'var(--info)', fontWeight: 700 }}>[FK]</span>
											)}
											<span className={s.gridThType}>{col.type}</span>
											{isSorted && (
												<span style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 'bold' }}>
													{sortOrder === 'asc' ? '▲' : '▼'}
												</span>
											)}
										</div>
									</th>
								);
							})}
						</tr>
					</thead>

					<tbody>
						{(() => {
							const seenKeys = new Set<string>();
							return rows.map((row, index) => {
								const pkVal = getRowPk(row, index, effectivePk, data.primaryKeys);
								const isSelected = selectedRows.has(pkVal);

								let rowKey =
									pkVal !== undefined && pkVal !== null && String(pkVal) !== '' && String(pkVal) !== 'undefined'
										? String(pkVal)
										: `row-${index}`;

								if (seenKeys.has(rowKey)) {
									rowKey = `${rowKey}__${index}`;
								}
								seenKeys.add(rowKey);

								return (
									<tr
										key={rowKey}
										className={`${s.gridRow} ${isSelected ? s.gridRowSelected : ''}`}
										onContextMenu={(e) => handleRowContextMenu(e, row, pkVal)}
										onTouchStart={(e) => handleTouchStartRow(e, row, pkVal)}
										onTouchEnd={handleTouchEndRow}
										onTouchMove={handleTouchMoveRow}
									>
										{/* Checkbox & Inspect Drawer Action Td */}
										<td className={s.gridTd} style={{ textAlign: 'center' }}>
											<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => toggleSelectRow(pkVal)}
												/>
												{onOpenRowDrawer && (
													<button
														type="button"
														onClick={() => onOpenRowDrawer(row)}
														style={{
															background: 'transparent',
															border: 'none',
															color: 'var(--accent)',
															cursor: 'pointer',
															padding: '2px',
															display: 'flex',
															alignItems: 'center',
															opacity: 0.8,
														}}
														title="Satırı Sağ Çekmecede İncele"
													>
														<Eye size={12} />
													</button>
												)}
											</div>
										</td>

										{/* Data Tds (Visible Columns Only) */}
										{visibleColumns.map((col) => {
											const pending = getPendingChange(pkVal, col.name);
											const isEdited = Boolean(pending);
											const isCurrentEditing =
												editingCell?.pkVal === pkVal && editingCell?.colName === col.name;
											const displayVal = pending ? pending.newValue : row[col.name];

											const isFK = Boolean(col.isForeignKey && col.foreignKeyTarget && displayVal);

											return (
												<td
													key={col.name}
													className={`${s.gridTd} ${isEdited ? s.gridTdEdited : ''}`}
													onDoubleClick={() => startEditing(row, col, index)}
													onContextMenu={(e) => handleCellContextMenu(e, row, col, pkVal, displayVal)}
													onTouchStart={(e) => handleTouchStartCell(e, row, col, pkVal, displayVal)}
													onTouchEnd={handleTouchEndRow}
													onTouchMove={handleTouchMoveRow}
													title={
														isEdited
															? `${t('dbOriginalValue')}: ${String(pending?.originalValue)}`
															: String(displayVal ?? '')
													}
												>
													{isCurrentEditing ? (
														<input
															type="text"
															autoFocus
															className={s.gridCellInput}
															value={editValue}
															onChange={(e) => setEditValue(e.target.value)}
															onBlur={() => commitEditing(row, col, index)}
															onKeyDown={(e) => {
																if (e.key === 'Enter') commitEditing(row, col, index);
																if (e.key === 'Escape') setEditingCell(null);
															}}
														/>
													) : (
														<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
															<span>
																{displayVal === null || displayVal === undefined ? (
																	<span style={{ opacity: 0.35, fontStyle: 'italic' }}>null</span>
																) : typeof displayVal === 'boolean' ? (
																	<span style={{ color: displayVal ? 'var(--success)' : 'var(--danger)' }}>
																		{String(displayVal)}
																	</span>
																) : typeof displayVal === 'object' ? (
																	JSON.stringify(displayVal)
																) : (
																	String(displayVal)
																)}
															</span>

															{/* Foreign Key Jump Badge */}
															{isFK && onJumpToForeignKey && (
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation();
																		onJumpToForeignKey(
																			col.foreignKeyTarget!.table,
																			col.foreignKeyTarget!.column,
																			displayVal
																		);
																	}}
																	style={{
																		background: 'var(--accent-subtle)',
																		border: '1px solid var(--accent-border)',
																		borderRadius: '3px',
																		color: 'var(--accent)',
																		cursor: 'pointer',
																		padding: '1px 3px',
																		display: 'inline-flex',
																		alignItems: 'center',
																	}}
																	title={`Zıpla: ${col.foreignKeyTarget!.table}`}
																>
																	<ExternalLink size={9} />
																</button>
															)}
														</div>
													)}
												</td>
											);
										})}
									</tr>
								);
							});
						})()}

						{rows.length === 0 && (
							<tr>
								<td
									colSpan={visibleColumns.length + 1}
									style={{ textAlign: 'center', padding: '32px', opacity: 0.5, fontSize: 13 }}
								>
									{t('dbNoRecords')}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Pagination Footer */}
			<div className={s.paginationBar}>
				<div className={s.paginationInfo}>
					<span>
						{data.totalRows > 0
							? `Toplam ${data.totalRows.toLocaleString()} kayıttan ${(data.page - 1) * pageSize + 1} - ${Math.min(data.page * pageSize, data.totalRows)} gösteriliyor`
							: 'Kayıt bulunamadı'}
					</span>
					<span style={{ opacity: 0.3 }}>|</span>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<span>Sayfa Başına:</span>
						<select
							className={s.pageSizeSelect}
							value={pageSize}
							onChange={(e) => onPageSizeChange(Number(e.target.value))}
							disabled={isLoading}
						>
							<option value={25}>25 Satır</option>
							<option value={50}>50 Satır</option>
							<option value={100}>100 Satır</option>
							<option value={250}>250 Satır</option>
							<option value={500}>500 Satır</option>
						</select>
					</div>
				</div>

				<div className={s.paginationControls}>
					<button
						type="button"
						className={s.pageBtn}
						disabled={data.page <= 1 || isLoading}
						onClick={() => onPageChange(1)}
						title="İlk Sayfa"
					>
						<ChevronsLeft size={13} />
					</button>

					<button
						type="button"
						className={s.pageBtn}
						disabled={data.page <= 1 || isLoading}
						onClick={() => onPageChange(data.page - 1)}
						title="Önceki Sayfa"
					>
						<ChevronLeft size={13} />
					</button>

					<div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 4px', fontSize: 11.5 }}>
						<span>Sayfa</span>
						<input
							type="text"
							className={s.pageJumpInput}
							value={pageJump !== '' ? pageJump : data.page}
							onChange={(e) => setPageJump(e.target.value.replace(/\D/g, ''))}
							onBlur={() => {
								const num = parseInt(pageJump, 10);
								if (!isNaN(num) && num >= 1 && num <= data.totalPages && num !== data.page) {
									onPageChange(num);
								}
								setPageJump('');
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									const num = parseInt(pageJump, 10);
									if (!isNaN(num) && num >= 1 && num <= data.totalPages && num !== data.page) {
										onPageChange(num);
									}
									setPageJump('');
								}
							}}
						/>
						<span>/ {data.totalPages || 1}</span>
					</div>

					<button
						type="button"
						className={s.pageBtn}
						disabled={data.page >= data.totalPages || isLoading}
						onClick={() => onPageChange(data.page + 1)}
						title="Sonraki Sayfa"
					>
						<ChevronRight size={13} />
					</button>

					<button
						type="button"
						className={s.pageBtn}
						disabled={data.page >= data.totalPages || isLoading}
						onClick={() => onPageChange(data.totalPages)}
						title="Son Sayfa"
					>
						<ChevronsRight size={13} />
					</button>
				</div>
			</div>

			{/* Add Row Modal */}
			{showAddModal && (
				<div className={s.modalBackdrop}>
					<div className={s.modalCard}>
						<div className={s.modalHeader}>
							<span style={{ fontWeight: 700, fontSize: 14 }}>
								{t('dbAddNewRowTitle')} ({data.table})
							</span>
							<button
								type="button"
								className={s.modalCloseBtn}
								onClick={() => setShowAddModal(false)}
							>
								✕
							</button>
						</div>

						<form onSubmit={handleAddRowSubmit} className={s.modalForm}>
							<div className={s.modalFormScroll}>
								{columns.map((col) => {
									if (col.isSensitive) return null;
									return (
										<div key={col.name} className={s.formGroup}>
											<label className={s.formLabel}>
												<span>{col.name}</span>
												<span className={s.gridThType}>{col.type}</span>
												{col.nullable && <span style={{ opacity: 0.5 }}>({t('dbOptional')})</span>}
											</label>
											<input
												type="text"
												className={s.formInput}
												value={newRowData[col.name] || ''}
												onChange={(e) =>
													setNewRowData({ ...newRowData, [col.name]: e.target.value })
												}
												placeholder={col.hasDefault ? t('dbDefaultValuePlaceholder') : ''}
											/>
										</div>
									);
								})}
							</div>

							<div className={s.modalActions}>
								<button
									type="button"
									className={s.secondaryBtn}
									onClick={() => setShowAddModal(false)}
								>
									{t('cancel')}
								</button>
								<button type="submit" className={s.primaryBtn}>
									{t('dbInsertBtn')}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
