'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { ColumnSpec, PendingCellChange } from '../../types';
import s from '../../Database.module.css';

interface DatabaseGridCellProps {
	column: ColumnSpec;
	displayVal: unknown;
	pendingChange?: PendingCellChange;
	isEditing: boolean;
	editValue: string;
	onEditValueChange: (val: string) => void;
	onStartEdit: () => void;
	onCommitEdit: () => void;
	onCancelEdit: () => void;
	onContextMenu: (e: React.MouseEvent) => void;
	onTouchStart: (e: React.TouchEvent) => void;
	onTouchEnd: () => void;
	onTouchMove: (e: React.TouchEvent) => void;
	onJumpToForeignKey?: (foreignTable: string, foreignCol: string, value: unknown) => void;
}

export function DatabaseGridCell({
	column,
	displayVal,
	pendingChange,
	isEditing,
	editValue,
	onEditValueChange,
	onStartEdit,
	onCommitEdit,
	onCancelEdit,
	onContextMenu,
	onTouchStart,
	onTouchEnd,
	onTouchMove,
	onJumpToForeignKey,
}: DatabaseGridCellProps) {
	const { t } = useI18n();
	const isEdited = Boolean(pendingChange);
	const hasDisplayVal =
		displayVal !== null && displayVal !== undefined && displayVal !== '';
	const isFk = Boolean(column.isForeignKey && column.foreignKeyTarget && hasDisplayVal);

	return (
		<td
			className={`${s.gridTd} ${isEdited ? s.gridTdEdited : ''}`}
			onDoubleClick={onStartEdit}
			onContextMenu={onContextMenu}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			onTouchMove={onTouchMove}
			title={
				isEdited
					? `${t('dbOriginalValue')}: ${String(pendingChange?.originalValue)}`
					: String(displayVal ?? '')
			}
		>
			{isEditing ? (
				<input
					type="text"
					autoFocus
					className={s.gridCellInput}
					value={editValue}
					onChange={(e) => onEditValueChange(e.target.value)}
					onBlur={onCommitEdit}
					onKeyDown={(e) => {
						if (e.key === 'Enter') onCommitEdit();
						if (e.key === 'Escape') onCancelEdit();
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

					{isFk && onJumpToForeignKey && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onJumpToForeignKey(
									column.foreignKeyTarget!.table,
									column.foreignKeyTarget!.column,
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
							title={fill(t('dbJumpToTable'), { table: column.foreignKeyTarget!.table })}
						>
							<ExternalLink size={9} />
						</button>
					)}
				</div>
			)}
		</td>
	);
}
