'use client';

import React from 'react';
import { ExternalLink, Code2, AlertCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import type { ColumnSpec } from '../../types';

interface RowDrawerFieldProps {
	column: ColumnSpec;
	rawValue: unknown;
	jsonError?: string;
	onChange: (colName: string, value: unknown) => void;
	onJsonValidate: (colName: string, rawText: string) => void;
	onPrettifyJson: (colName: string) => void;
	onJumpToForeignKey?: (foreignTable: string, foreignCol: string, value: unknown) => void;
}

export function RowDrawerField({
	column,
	rawValue,
	jsonError,
	onChange,
	onJsonValidate,
	onPrettifyJson,
	onJumpToForeignKey,
}: RowDrawerFieldProps) {
	const { t } = useI18n();
	const isJson = ['json', 'jsonb'].includes(column.type);
	const displayVal =
		isJson && typeof rawValue === 'object' && rawValue !== null
			? JSON.stringify(rawValue, null, 2)
			: rawValue !== null && rawValue !== undefined
				? String(rawValue)
				: '';

	const isFk = Boolean(column.isForeignKey && column.foreignKeyTarget);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
				<label
					style={{
						fontSize: '12px',
						fontWeight: column.isPrimaryKey ? 700 : 600,
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
					}}
				>
					<span>{column.name}</span>
					<span
						style={{
							fontSize: '10px',
							opacity: 0.5,
							fontWeight: 400,
							background: 'var(--fill-soft)',
							padding: '1px 5px',
							borderRadius: '3px',
						}}
					>
						{column.type}
					</span>
					{column.isPrimaryKey && (
						<span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700 }}>
							[PK]
						</span>
					)}
				</label>

				{/* Foreign key jump button */}
				{Boolean(
					isFk &&
					rawValue !== null &&
					rawValue !== undefined &&
					rawValue !== '' &&
					onJumpToForeignKey
				) && (
					<button
						type="button"
						onClick={() =>
							onJumpToForeignKey?.(
								column.foreignKeyTarget!.table,
								column.foreignKeyTarget!.column,
								rawValue
							)
						}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '3px',
							background: 'var(--accent-subtle)',
							color: 'var(--accent)',
							border: '1px solid var(--accent-border)',
							borderRadius: '4px',
							padding: '2px 6px',
							fontSize: '10px',
							fontWeight: 600,
							cursor: 'pointer',
						}}
						title={fill(t('dbJumpToRelatedTable'), { table: column.foreignKeyTarget!.table })}
					>
						<span>{column.foreignKeyTarget!.table}</span>
						<ExternalLink size={10} />
					</button>
				)}

				{/* JSON prettify button */}
				{isJson && !column.isSensitive && (
					<button
						type="button"
						onClick={() => onPrettifyJson(column.name)}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '3px',
							background: 'transparent',
							border: '1px solid var(--window-border)',
							borderRadius: '4px',
							padding: '2px 6px',
							fontSize: '10.5px',
							cursor: 'pointer',
							color: 'inherit',
							opacity: 0.7,
						}}
					>
						<Code2 size={11} />
						<span>{t('dbFormatJson')}</span>
					</button>
				)}
			</div>

			{/* Input control */}
			{column.isSensitive ? (
				<input
					type="text"
					disabled
					value={t('dbSensitiveValueMasked')}
					style={{
						background: 'var(--input-bg)',
						border: '1px solid var(--window-border)',
						borderRadius: '6px',
						padding: '6px 10px',
						fontSize: '12px',
						opacity: 0.6,
						color: 'inherit',
					}}
				/>
			) : isJson ? (
				<div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
					<textarea
						rows={5}
						value={displayVal}
						onChange={(e) => {
							onChange(column.name, e.target.value);
							onJsonValidate(column.name, e.target.value);
						}}
						style={{
							fontFamily: 'monospace',
							fontSize: '11px',
							background: 'var(--input-bg)',
							border: jsonError
								? '1px solid var(--danger)'
								: '1px solid var(--window-border)',
							borderRadius: '6px',
							padding: '8px 10px',
							color: 'inherit',
							resize: 'vertical',
						}}
					/>
					{jsonError && (
						<span style={{ fontSize: '10.5px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
							<AlertCircle size={11} />
							{jsonError}
						</span>
					)}
				</div>
			) : column.type === 'boolean' ? (
				<select
					value={String(rawValue ?? '')}
					onChange={(e) =>
						onChange(
							column.name,
							e.target.value === 'true' ? true : e.target.value === 'false' ? false : null
						)
					}
					style={{
						background: 'var(--input-bg)',
						border: '1px solid var(--window-border)',
						borderRadius: '6px',
						padding: '6px 10px',
						fontSize: '12px',
						color: 'inherit',
					}}
				>
					<option value="">(NULL)</option>
					<option value="true">TRUE</option>
					<option value="false">FALSE</option>
				</select>
			) : (
				<input
					type="text"
					value={displayVal}
					onChange={(e) => onChange(column.name, e.target.value)}
					style={{
						background: 'var(--input-bg)',
						border: '1px solid var(--window-border)',
						borderRadius: '6px',
						padding: '6px 10px',
						fontSize: '12px',
						color: 'inherit',
					}}
				/>
			)}
		</div>
	);
}
