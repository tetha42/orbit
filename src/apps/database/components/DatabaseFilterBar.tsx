'use client';

import React from 'react';
import { Plus, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { ColumnVisibilityMenu } from './filter/ColumnVisibilityMenu';
import { FilterRuleRow } from './filter/FilterRuleRow';
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
						onClick={() => onAddFilter()}
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
						<span>{t('dbAddFilter')}</span>
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
							<span>{t('dbClearFilters')} ({filters.length})</span>
						</button>
					)}
				</div>

				<ColumnVisibilityMenu
					columns={columns}
					hiddenColumns={hiddenColumns}
					onToggleColumnVisibility={onToggleColumnVisibility}
					onShowAllColumns={onShowAllColumns}
				/>
			</div>

			{/* Filter rule rows */}
			{filters.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
					{filters.map((rule, idx) => (
						<FilterRuleRow
							key={rule.id}
							rule={rule}
							index={idx}
							columns={columns}
							onUpdate={onUpdateFilter}
							onRemove={onRemoveFilter}
						/>
					))}
				</div>
			)}
		</div>
	);
}
