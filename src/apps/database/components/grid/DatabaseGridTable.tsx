'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { getCellValue, getRowPk } from '../../utils/rowValues';
import { DatabaseGridCell } from './DatabaseGridCell';
import type { ColumnSpec, PendingCellChange } from '../../types';
import s from '../../Database.module.css';

interface DatabaseGridTableProps {
	rows: Record<string, unknown>[];
	visibleColumns: ColumnSpec[];
	effectivePk: string;
	primaryKeys?: string[];
	selectedRows: Set<unknown>;
	sortColumn: string;
	sortOrder: 'asc' | 'desc';
	editingCell: { pkVal: unknown; colName: string } | null;
	editValue: string;
	getPendingChange: (pkVal: unknown, colName: string) => PendingCellChange | undefined;
	onToggleSelectAll: () => void;
	onToggleSelectRow: (pkVal: unknown) => void;
	onSortChange: (colName: string) => void;
	onStartEdit: (row: Record<string, unknown>, col: ColumnSpec, index: number) => void;
	onEditValueChange: (val: string) => void;
	onCommitEdit: (row: Record<string, unknown>, col: ColumnSpec, index: number) => void;
	onCancelEdit: () => void;
	onRowContextMenu: (e: React.MouseEvent, row: Record<string, unknown>, pkVal: unknown) => void;
	onCellContextMenu: (
		e: React.MouseEvent,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => void;
	onTouchStartRow: (e: React.TouchEvent, row: Record<string, unknown>, pkVal: unknown) => void;
	onTouchStartCell: (
		e: React.TouchEvent,
		row: Record<string, unknown>,
		col: ColumnSpec,
		pkVal: unknown,
		displayVal: unknown
	) => void;
	onTouchEnd: () => void;
	onTouchMove: (e: React.TouchEvent) => void;
	onJumpToForeignKey?: (foreignTable: string, foreignCol: string, value: unknown) => void;
	onOpenRowDrawer?: (row: Record<string, unknown>) => void;
}

export function DatabaseGridTable({
	rows,
	visibleColumns,
	effectivePk,
	primaryKeys,
	selectedRows,
	sortColumn,
	sortOrder,
	editingCell,
	editValue,
	getPendingChange,
	onToggleSelectAll,
	onToggleSelectRow,
	onSortChange,
	onStartEdit,
	onEditValueChange,
	onCommitEdit,
	onCancelEdit,
	onRowContextMenu,
	onCellContextMenu,
	onTouchStartRow,
	onTouchStartCell,
	onTouchEnd,
	onTouchMove,
	onJumpToForeignKey,
	onOpenRowDrawer,
}: DatabaseGridTableProps) {
	const { t } = useI18n();
	const seenKeys = new Set<string>();

	return (
		<div className={s.gridWrapper}>
			<table className={s.gridTable}>
				<thead>
					<tr>
						<th className={s.gridTh} style={{ width: 60, textAlign: 'center' }}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
								<input
									type="checkbox"
									checked={rows.length > 0 && selectedRows.size === rows.length}
									onChange={onToggleSelectAll}
								/>
								<span style={{ fontSize: '10px', opacity: 0.5 }}>#</span>
							</div>
						</th>

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
					{rows.map((row, index) => {
						const pkVal = getRowPk(row, index, effectivePk, primaryKeys);
						const isSelected = selectedRows.has(pkVal);

						let rowKey =
							pkVal !== undefined && pkVal !== null && String(pkVal) !== '' && String(pkVal) !== 'undefined'
								? String(pkVal)
								: `row-${index}`;
						if (seenKeys.has(rowKey)) rowKey = `${rowKey}__${index}`;
						seenKeys.add(rowKey);

						return (
							<tr
								key={rowKey}
								className={`${s.gridRow} ${isSelected ? s.gridRowSelected : ''}`}
								onContextMenu={(e) => onRowContextMenu(e, row, pkVal)}
								onTouchStart={(e) => onTouchStartRow(e, row, pkVal)}
								onTouchEnd={onTouchEnd}
								onTouchMove={onTouchMove}
							>
								<td className={s.gridTd} style={{ textAlign: 'center' }}>
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
										<input
											type="checkbox"
											checked={isSelected}
											onChange={() => onToggleSelectRow(pkVal)}
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
												title={t('dbInspectRowInDrawer')}
											>
												<Eye size={12} />
											</button>
										)}
									</div>
								</td>

								{visibleColumns.map((col) => {
									const pending = getPendingChange(pkVal, col.name);
									const isCurrentEditing =
										editingCell?.pkVal === pkVal && editingCell?.colName === col.name;
									const displayVal = pending ? pending.newValue : getCellValue(row, col.name);

									return (
										<DatabaseGridCell
											key={col.name}
											column={col}
											displayVal={displayVal}
											pendingChange={pending}
											isEditing={isCurrentEditing}
											editValue={editValue}
											onEditValueChange={onEditValueChange}
											onStartEdit={() => onStartEdit(row, col, index)}
											onCommitEdit={() => onCommitEdit(row, col, index)}
											onCancelEdit={onCancelEdit}
											onContextMenu={(e) => onCellContextMenu(e, row, col, pkVal, displayVal)}
											onTouchStart={(e) => onTouchStartCell(e, row, col, pkVal, displayVal)}
											onTouchEnd={onTouchEnd}
											onTouchMove={onTouchMove}
											onJumpToForeignKey={onJumpToForeignKey}
										/>
									);
								})}
							</tr>
						);
					})}

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
	);
}
