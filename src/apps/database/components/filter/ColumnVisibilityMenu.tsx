'use client';

import React, { useState } from 'react';
import { Eye, ChevronDown } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ColumnSpec } from '../../types';

interface ColumnVisibilityMenuProps {
	columns: ColumnSpec[];
	hiddenColumns: Set<string>;
	onToggleColumnVisibility: (col: string) => void;
	onShowAllColumns: () => void;
}

export function ColumnVisibilityMenu({
	columns,
	hiddenColumns,
	onToggleColumnVisibility,
	onShowAllColumns,
}: ColumnVisibilityMenuProps) {
	const { t } = useI18n();
	const [showColMenu, setShowColMenu] = useState(false);

	const visibleCount = columns.length - hiddenColumns.size;

	return (
		<div style={{ position: 'relative' }}>
			<button
				type="button"
				onClick={() => setShowColMenu(!showColMenu)}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '5px',
					padding: '4px 9px',
					borderRadius: '6px',
					fontSize: '11.5px',
					background: 'var(--fill-soft)',
					color: 'var(--text-primary)',
					border: '1px solid var(--window-border)',
					cursor: 'pointer',
				}}
			>
				<Eye size={12} />
				<span>{t('dbColumns')} ({visibleCount}/{columns.length})</span>
				<ChevronDown size={11} />
			</button>

			{showColMenu && (
				<div
					style={{
						position: 'absolute',
						top: '100%',
						right: 0,
						marginTop: '4px',
						zIndex: 100,
						background: 'var(--modal-surface)',
						backdropFilter: 'var(--glass-blur-strong)',
						WebkitBackdropFilter: 'var(--glass-blur-strong)',
						border: '1px solid var(--window-border)',
						borderRadius: '8px',
						boxShadow: 'var(--shadow-panel)',
						padding: '8px',
						minWidth: '200px',
						maxHeight: '260px',
						overflowY: 'auto',
						display: 'flex',
						flexDirection: 'column',
						gap: '4px',
					}}
				>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							paddingBottom: '6px',
							marginBottom: '4px',
							borderBottom: '1px solid var(--window-border)',
							fontSize: '11px',
							fontWeight: 600,
						}}
					>
						<span>{t('dbVisibleColumns')}</span>
						{hiddenColumns.size > 0 && (
							<button
								type="button"
								onClick={onShowAllColumns}
								style={{
									background: 'transparent',
									border: 'none',
									color: 'var(--accent)',
									cursor: 'pointer',
									fontSize: '10.5px',
								}}
							>
								{t('dbShowAll')}
							</button>
						)}
					</div>
					{columns.map((col) => {
						const isHidden = hiddenColumns.has(col.name);
						return (
							<label
								key={col.name}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '8px',
									padding: '3px 4px',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '11.5px',
								}}
							>
								<input
									type="checkbox"
									checked={!isHidden}
									onChange={() => onToggleColumnVisibility(col.name)}
								/>
								<span style={{ fontWeight: col.isPrimaryKey ? 700 : 400 }}>
									{col.name} {col.isPrimaryKey ? '(PK)' : ''}
								</span>
							</label>
						);
					})}
				</div>
			)}
		</div>
	);
}
