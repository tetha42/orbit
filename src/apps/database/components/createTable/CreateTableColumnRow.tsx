'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { POSTGRES_DATA_TYPES } from '../../utils/ddlBuilder';
import type { CreateTableColumnInput } from '../../types';

interface CreateTableColumnRowProps {
	column: CreateTableColumnInput;
	index: number;
	canRemove: boolean;
	onUpdate: (index: number, patch: Partial<CreateTableColumnInput>) => void;
	onRemove: (index: number) => void;
}

export function CreateTableColumnRow({
	column,
	index,
	canRemove,
	onUpdate,
	onRemove,
}: CreateTableColumnRowProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '8px',
				background: 'var(--fill-softer)',
				border: '1px solid var(--window-border)',
				padding: '8px 10px',
				borderRadius: '8px',
				flexWrap: 'wrap',
			}}
		>
			{/* Column name */}
			<input
				type="text"
				placeholder={t('dbColumnNamePlaceholder')}
				value={column.name}
				onChange={(e) => onUpdate(index, { name: e.target.value })}
				style={{
					flex: 2,
					minWidth: '120px',
					background: 'var(--input-bg)',
					border: '1px solid var(--input-border)',
					borderRadius: '5px',
					padding: '6px 8px',
					fontSize: '12px',
					color: 'var(--text-primary)',
				}}
			/>

			{/* Data type */}
			<select
				value={column.type}
				onChange={(e) => onUpdate(index, { type: e.target.value })}
				style={{
					flex: 2,
					minWidth: '140px',
					background: 'var(--input-bg)',
					border: '1px solid var(--input-border)',
					borderRadius: '5px',
					padding: '6px 8px',
					fontSize: '12px',
					color: 'var(--text-primary)',
				}}
			>
				{POSTGRES_DATA_TYPES.map((dt) => (
					<option key={dt.value} value={dt.value}>
						{t(dt.labelKey)}
					</option>
				))}
			</select>

			{/* Primary key checkbox */}
			<label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
				<input
					type="checkbox"
					checked={column.isPrimaryKey}
					onChange={(e) => onUpdate(index, { isPrimaryKey: e.target.checked })}
				/>
				<span>PK</span>
			</label>

			{/* Nullable checkbox */}
			<label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
				<input
					type="checkbox"
					checked={column.nullable}
					onChange={(e) => onUpdate(index, { nullable: e.target.checked })}
				/>
				<span>Null</span>
			</label>

			{/* Default value */}
			<input
				type="text"
				placeholder={t('dbDefaultValuePlaceholder')}
				value={column.defaultValue || ''}
				onChange={(e) => onUpdate(index, { defaultValue: e.target.value })}
				style={{
					flex: 1,
					minWidth: '80px',
					background: 'var(--input-bg)',
					border: '1px solid var(--input-border)',
					borderRadius: '5px',
					padding: '6px 8px',
					fontSize: '11px',
					color: 'var(--text-primary)',
				}}
			/>

			{/* Remove column button */}
			<button
				type="button"
				onClick={() => onRemove(index)}
				disabled={!canRemove}
				style={{
					background: 'transparent',
					border: 'none',
					color: 'var(--danger)',
					cursor: canRemove ? 'pointer' : 'not-allowed',
					opacity: canRemove ? 0.8 : 0.3,
					padding: '4px',
				}}
			>
				<Trash2 size={13} />
			</button>
		</div>
	);
}
