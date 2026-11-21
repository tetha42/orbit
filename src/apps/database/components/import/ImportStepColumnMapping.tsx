'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { ColumnSpec } from '../../types';

interface ImportStepColumnMappingProps {
	columns: ColumnSpec[];
	sourceColumns: string[];
	parsedRows: Record<string, unknown>[];
	mapping: Record<string, string>;
	onMapChange: (targetCol: string, sourceCol: string) => void;
}

export function ImportStepColumnMapping({
	columns,
	sourceColumns,
	parsedRows,
	mapping,
	onMapChange,
}: ImportStepColumnMappingProps) {
	const { t } = useI18n();
	const mappedTargetKeys = Object.keys(mapping);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
			<div style={{ fontSize: '13px', opacity: 0.8 }}>
				{t('dbImportRowsDetectedPrefix')} <strong>{parsedRows.length}</strong>{' '}
				{t('dbImportRowsDetectedSuffix')}
			</div>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
					gap: '10px',
					background: 'var(--fill-softer)',
					padding: '12px',
					borderRadius: '8px',
				}}
			>
				{columns.map((col) => (
					<div
						key={col.name}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: '8px',
							fontSize: '12px',
						}}
					>
						<div style={{ fontWeight: 600 }}>
							{col.name} {col.isPrimaryKey ? '(PK)' : ''}
						</div>
						<select
							value={mapping[col.name] || ''}
							onChange={(e) => onMapChange(col.name, e.target.value)}
							style={{
								background: 'var(--input-bg)',
								color: 'var(--text-primary)',
								border: '1px solid var(--window-border)',
								borderRadius: '6px',
								padding: '4px 8px',
								fontSize: '11px',
							}}
						>
							<option value="">{t('dbImportMappingSkip')}</option>
							{sourceColumns.map((sc) => (
								<option key={sc} value={sc}>
									{sc}
								</option>
							))}
						</select>
					</div>
				))}
			</div>

			{/* Preview of first 3 rows */}
			<div>
				<div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
					{t('dbImportPreviewTitle')}
				</div>
				<div
					style={{
						overflowX: 'auto',
						border: '1px solid var(--window-border)',
						borderRadius: '8px',
						fontSize: '11px',
					}}
				>
					<table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
						<thead>
							<tr style={{ background: 'var(--fill-softer)' }}>
								{mappedTargetKeys.map((col) => (
									<th
										key={col}
										style={{ padding: '6px 10px', borderBottom: '1px solid var(--window-border)' }}
									>
										{col}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{parsedRows.slice(0, 3).map((r, idx) => (
								<tr key={idx} style={{ borderBottom: '1px solid var(--window-border)' }}>
									{mappedTargetKeys.map((col) => {
										const srcKey = mapping[col];
										return (
											<td key={col} style={{ padding: '6px 10px' }}>
												{String(r[srcKey] ?? '')}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
