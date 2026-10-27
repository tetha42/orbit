'use client';

import React, { useState } from 'react';
import { Plus, X, Eye, ChevronDown } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ColumnSpec, FilterRule } from '../types';

interface DatabaseFilterBarProps {
	columns: ColumnSpec[];
	filters: FilterRule[];
	onAddFilter: () => void;
	onUpdateFilter: (id: string, updated: Partial<FilterRule>) => void;
	onRemoveFilter: (id: string) => void;
	onClearFilters: () => void;
	hiddenColumns: Set<string>;
	onToggleColumnVisibility: (col: string) => void;
	onShowAllColumns: () => void;
}

const OPERATORS = [
	{ value: '=', label: 'Eşittir (=)' },
	{ value: '!=', label: 'Eşit Değildir (!=)' },
	{ value: 'ilike', label: 'İçerir (ILIKE)' },
	{ value: 'like', label: 'İle Başlar (LIKE)' },
	{ value: '>', label: 'Büyüktür (>)' },
	{ value: '<', label: 'Küçüktür (<)' },
	{ value: '>=', label: 'Büyük Eşittir (>=)' },
	{ value: '<=', label: 'Küçük Eşittir (<=)' },
	{ value: 'is_null', label: 'Boştur (NULL)' },
	{ value: 'is_not_null', label: 'Doludur (NOT NULL)' },
];

export function DatabaseFilterBar({
	columns,
	filters,
	onAddFilter,
	onUpdateFilter,
	onRemoveFilter,
	onClearFilters,
	hiddenColumns,
	onToggleColumnVisibility,
	onShowAllColumns,
}: DatabaseFilterBarProps) {
	const { t } = useI18n();
	const [showColMenu, setShowColMenu] = useState(false);

	const visibleCount = columns.length - hiddenColumns.size;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: '8px',
				padding: '8px 12px',
				background: 'var(--fill-softer)',
				borderBottom: '1px solid var(--window-border)',
				fontSize: '12px',
				flexShrink: 0,
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
					<button
						type="button"
						onClick={onAddFilter}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '4px',
							padding: '4px 9px',
							borderRadius: '6px',
							fontSize: '11.5px',
							fontWeight: 600,
							background: 'var(--accent)',
							color: 'var(--accent-contrast)',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						<Plus size={13} />
						<span>{t('dbAddFilter') || 'Filtre Ekle'}</span>
					</button>

					{filters.length > 0 && (
						<button
							type="button"
							onClick={onClearFilters}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '4px',
								padding: '4px 8px',
								borderRadius: '6px',
								fontSize: '11px',
								background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
								color: 'var(--danger)',
								border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
								cursor: 'pointer',
							}}
						>
							<X size={12} />
							<span>{t('dbClearFilters') || 'Filtreleri Temizle'} ({filters.length})</span>
						</button>
					)}
				</div>

				{/* Column visibility menu toggle */}
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
						<span>{t('dbColumns') || 'Sütunlar'} ({visibleCount}/{columns.length})</span>
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
								<span>{t('dbVisibleColumns') || 'Görünür Sütunlar'}</span>
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
										{t('dbShowAll') || 'Hepsini Göster'}
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
			</div>

			{/* Filter Rule Rows */}
			{filters.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
					{filters.map((f, idx) => {
						const isNullOp = f.op === 'is_null' || f.op === 'is_not_null';
						return (
							<div
								key={f.id}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '6px',
									background: 'var(--fill-softer)',
									padding: '4px 8px',
									borderRadius: '6px',
									border: '1px solid var(--window-border)',
									flexWrap: 'wrap',
								}}
							>
								<span style={{ fontSize: '10.5px', opacity: 0.6, width: '40px' }}>
									{idx === 0 ? 'NEREDE' : 'VE'}
								</span>

								{/* Column Select */}
								<select
									value={f.column}
									onChange={(e) => onUpdateFilter(f.id, { column: e.target.value })}
									style={{
										background: 'var(--input-bg)',
										color: 'var(--text-primary)',
										border: '1px solid var(--input-border)',
										borderRadius: '5px',
										padding: '3px 7px',
										fontSize: '11px',
									}}
								>
									{columns.map((c) => (
										<option key={c.name} value={c.name}>
											{c.name}
										</option>
									))}
								</select>

								{/* Operator Select */}
								<select
									value={f.op}
									onChange={(e) =>
										onUpdateFilter(f.id, { op: e.target.value as FilterRule['op'] })
									}
									style={{
										background: 'var(--input-bg)',
										color: 'var(--text-primary)',
										border: '1px solid var(--input-border)',
										borderRadius: '5px',
										padding: '3px 7px',
										fontSize: '11px',
									}}
								>
									{OPERATORS.map((op) => (
										<option key={op.value} value={op.value}>
											{op.label}
										</option>
									))}
								</select>

								{/* Value Input */}
								{!isNullOp && (
									<input
										type="text"
										value={f.value}
										placeholder={t('dbFilterValue') || 'Değer...'}
										onChange={(e) => onUpdateFilter(f.id, { value: e.target.value })}
										style={{
											flex: 1,
											minWidth: '120px',
											background: 'var(--input-bg)',
											color: 'var(--text-primary)',
											border: '1px solid var(--input-border)',
											borderRadius: '5px',
											padding: '3px 7px',
											fontSize: '11px',
										}}
									/>
								)}

								{/* Remove Filter Button */}
								<button
									type="button"
									onClick={() => onRemoveFilter(f.id)}
									style={{
										background: 'transparent',
										border: 'none',
										color: 'var(--text-secondary)',
										cursor: 'pointer',
										padding: '2px',
										display: 'flex',
										alignItems: 'center',
									}}
									title="Filtreyi kaldır"
								>
									<X size={13} />
								</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
