'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ColumnSpec, FilterRule } from '../../types';

const FILTER_OPERATORS: Array<{ value: FilterRule['op']; labelKey: string }> = [
	{ value: '=', labelKey: 'dbFilterOpEquals' },
	{ value: '!=', labelKey: 'dbFilterOpNotEquals' },
	{ value: 'ilike', labelKey: 'dbFilterOpContains' },
	{ value: 'like', labelKey: 'dbFilterOpStartsWith' },
	{ value: '>', labelKey: 'dbFilterOpGreater' },
	{ value: '<', labelKey: 'dbFilterOpLess' },
	{ value: '>=', labelKey: 'dbFilterOpGreaterOrEqual' },
	{ value: '<=', labelKey: 'dbFilterOpLessOrEqual' },
	{ value: 'is_null', labelKey: 'dbFilterOpIsNull' },
	{ value: 'is_not_null', labelKey: 'dbFilterOpIsNotNull' },
];

interface FilterRuleRowProps {
	rule: FilterRule;
	index: number;
	columns: ColumnSpec[];
	onUpdate: (id: string, updated: Partial<FilterRule>) => void;
	onRemove: (id: string) => void;
}

export function FilterRuleRow({
	rule,
	index,
	columns,
	onUpdate,
	onRemove,
}: FilterRuleRowProps) {
	const { t } = useI18n();
	const isNullOp = rule.op === 'is_null' || rule.op === 'is_not_null';

	return (
		<div
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
				{index === 0 ? t('dbFilterWhere') : t('dbFilterAnd')}
			</span>

			{/* Column selector */}
			<select
				value={rule.column}
				onChange={(e) => onUpdate(rule.id, { column: e.target.value })}
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

			{/* Operator selector */}
			<select
				value={rule.op}
				onChange={(e) =>
					onUpdate(rule.id, { op: e.target.value as FilterRule['op'] })
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
				{FILTER_OPERATORS.map((op) => (
					<option key={op.value} value={op.value}>
						{t(op.labelKey)}
					</option>
				))}
			</select>

			{/* Value input */}
			{!isNullOp && (
				<input
					type="text"
					value={rule.value}
					placeholder={t('dbFilterValue')}
					onChange={(e) => onUpdate(rule.id, { value: e.target.value })}
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

			{/* Remove filter button */}
			<button
				type="button"
				onClick={() => onRemove(rule.id)}
				style={{
					background: 'transparent',
					border: 'none',
					color: 'var(--text-secondary)',
					cursor: 'pointer',
					padding: '2px',
					display: 'flex',
					alignItems: 'center',
				}}
				title={t('dbRemoveFilter')}
			>
				<X size={13} />
			</button>
		</div>
	);
}
