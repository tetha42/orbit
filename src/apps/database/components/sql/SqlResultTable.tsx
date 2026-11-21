'use client';

import React from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { exportQueryRowsCsv, exportQueryRowsJson } from '../../utils/exportData';
import { getCellValue } from '../../utils/rowValues';
import s from '../../Database.module.css';

interface SqlResultTableProps {
	fields: { name: string; dataTypeID: number }[];
	rows: Record<string, unknown>[];
	rowCount?: number;
}

export function SqlResultTable({ fields, rows, rowCount }: SqlResultTableProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
			{/* Result header & export bar */}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
				<div style={{ fontSize: '11.5px', opacity: 0.8, fontWeight: 600 }}>
					{rows.length > 0 ? (
						<span>
							{fill(t('dbRowsListed'), { n: rows.length.toLocaleString() })}
							{rowCount !== undefined && rowCount > rows.length && (
								<span style={{ opacity: 0.6, marginLeft: 4 }}>
									{fill(t('dbTotalAffected'), { n: rowCount.toLocaleString() })}
								</span>
							)}
						</span>
					) : (
						<span>{t('dbZeroRowsReturned')}</span>
					)}
				</div>

				{rows.length > 0 && (
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<button
							type="button"
							onClick={() => exportQueryRowsCsv(fields.map((f) => f.name), rows)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 4,
								padding: '3px 8px',
								borderRadius: '5px',
								fontSize: '11px',
								background: 'var(--fill-soft)',
								border: '1px solid var(--window-border)',
								color: 'inherit',
								cursor: 'pointer',
							}}
							title={t('dbDownloadCsvTitle')}
						>
							<Download size={11} />
							<span>{t('privacyTableCsv')}</span>
						</button>

						<button
							type="button"
							onClick={() => exportQueryRowsJson(rows)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 4,
								padding: '3px 8px',
								borderRadius: '5px',
								fontSize: '11px',
								background: 'var(--fill-soft)',
								border: '1px solid var(--window-border)',
								color: 'inherit',
								cursor: 'pointer',
							}}
							title={t('dbDownloadJsonTitle')}
						>
							<Download size={11} />
							<span>{t('dbDownloadJson')}</span>
						</button>
					</div>
				)}
			</div>

			{rows.length > 0 ? (
				<div className={s.sqlResultTableWrapper}>
					<table className={s.gridTable}>
						<thead>
							<tr>
								<th className={s.gridTh} style={{ width: 44, textAlign: 'center' }}>
									#
								</th>
								{fields.map((f) => (
									<th key={f.name} className={s.gridTh}>
										{f.name}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, idx) => (
								<tr key={idx} className={s.gridRow}>
									<td
										className={s.gridTd}
										style={{
											width: 44,
											textAlign: 'center',
											opacity: 0.5,
											fontSize: '10.5px',
											fontFamily: 'ui-monospace, monospace',
										}}
									>
										{idx + 1}
									</td>
									{fields.map((f) => {
										const val = getCellValue(row, f.name);
										return (
											<td key={f.name} className={s.gridTd}>
												{val === null || val === undefined ? (
													<span style={{ opacity: 0.35, fontStyle: 'italic' }}>null</span>
												) : typeof val === 'object' ? (
													JSON.stringify(val)
												) : (
													String(val)
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div
					style={{
						padding: '32px',
						textAlign: 'center',
						opacity: 0.5,
						fontSize: 13,
						border: '1px dashed var(--window-border)',
						borderRadius: '8px',
					}}
				>
					{t('dbQueryNoRows')}
				</div>
			)}
		</div>
	);
}
