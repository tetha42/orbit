'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { buildInitialRowValues, getCellValue } from '../utils/rowValues';
import { RowDrawerField } from './rowDrawer/RowDrawerField';
import type { ColumnSpec } from '../types';
import s from '../Database.module.css';

interface DatabaseRowDrawerProps {
	row: Record<string, unknown> | null;
	columns: ColumnSpec[];
	tableName: string;
	onClose: () => void;
	onSave: (updatedValues: Record<string, unknown>) => void;
	onJumpToForeignKey?: (foreignTable: string, foreignCol: string, value: unknown) => void;
}

export function DatabaseRowDrawer({
	row,
	columns,
	tableName,
	onClose,
	onSave,
	onJumpToForeignKey,
}: DatabaseRowDrawerProps) {
	const { t } = useI18n();
	const columnsRef = useRef(columns);
	const [values, setValues] = useState<Record<string, unknown>>(() =>
		buildInitialRowValues(row, columns)
	);
	const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		columnsRef.current = columns;
	}, [columns]);

	useEffect(() => {
		if (row) {
			setValues(buildInitialRowValues(row, columnsRef.current));
			setJsonErrors({});
		}
	}, [row]);

	if (!row) return null;

	const handleChange = (colName: string, val: unknown) => {
		setValues((prev) => ({ ...prev, [colName]: val }));
	};

	const handleJsonValidate = (colName: string, rawText: string) => {
		try {
			JSON.parse(rawText);
			setJsonErrors((prev) => {
				const copy = { ...prev };
				delete copy[colName];
				return copy;
			});
		} catch {
			setJsonErrors((prev) => ({ ...prev, [colName]: t('dbInvalidJson') }));
		}
	};

	const handlePrettifyJson = (colName: string) => {
		try {
			const raw = values[colName];
			const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
			const formatted = JSON.stringify(parsed, null, 2);
			handleChange(colName, formatted);
			setJsonErrors((prev) => {
				const copy = { ...prev };
				delete copy[colName];
				return copy;
			});
		} catch {
			setJsonErrors((prev) => ({ ...prev, [colName]: t('dbInvalidJsonFormat') }));
		}
	};

	const handleSave = () => {
		const changed: Record<string, unknown> = {};
		for (const col of columns) {
			if (col.isSensitive) continue;
			let v = values[col.name];
			if (['json', 'jsonb'].includes(col.type) && typeof v === 'string') {
				try {
					v = JSON.parse(v);
				} catch {
					// Keep raw string if invalid JSON
				}
			}
			const orig = getCellValue(row, col.name);
			const isDiff =
				typeof v === 'object' && typeof orig === 'object' && v !== null && orig !== null
					? JSON.stringify(v) !== JSON.stringify(orig)
					: v !== orig;
			if (isDiff) {
				changed[col.name] = v;
			}
		}
		onSave(changed);
	};

	const pkCol = columns.find((c) => c.isPrimaryKey)?.name || 'id';
	const pkVal = getCellValue(row, pkCol);

	return (
		<>
			<div className={s.drawerBackdrop} onClick={onClose} style={{ zIndex: 75 }} />
			<div className={s.drawerPanel} style={{ zIndex: 80, width: 440 }}>
				{/* Drawer header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '14px 18px',
						borderBottom: '1px solid var(--window-border)',
						background: 'var(--fill-softer)',
					}}
				>
					<div>
						<div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
							<span>{t('dbRowDetail')}</span>
							<span
								style={{
									fontSize: '11px',
									padding: '2px 7px',
									borderRadius: '4px',
									background: 'var(--accent)',
									color: 'var(--accent-contrast)',
								}}
							>
								{tableName} #{String(pkVal)}
							</span>
						</div>
						<div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>
							{fill(t('dbColumnsInspected'), { n: columns.length })}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: 'transparent',
							border: 'none',
							color: 'inherit',
							cursor: 'pointer',
							padding: '4px',
							display: 'flex',
							alignItems: 'center',
							opacity: 0.7,
						}}
					>
						<X size={18} />
					</button>
				</div>

				{/* Fields body */}
				<div
					style={{
						flex: 1,
						overflowY: 'auto',
						padding: '16px 18px',
						display: 'flex',
						flexDirection: 'column',
						gap: '14px',
					}}
				>
					{columns.map((col) => (
						<RowDrawerField
							key={col.name}
							column={col}
							rawValue={values[col.name]}
							jsonError={jsonErrors[col.name]}
							onChange={handleChange}
							onJsonValidate={handleJsonValidate}
							onPrettifyJson={handlePrettifyJson}
							onJumpToForeignKey={onJumpToForeignKey}
						/>
					))}
				</div>

				{/* Footer actions */}
				<div
					style={{
						padding: '12px 18px',
						borderTop: '1px solid var(--window-border)',
						background: 'var(--fill-softer)',
						display: 'flex',
						justifyContent: 'flex-end',
						gap: '8px',
					}}
				>
					<button
						type="button"
						onClick={onClose}
						style={{
							padding: '6px 12px',
							borderRadius: '6px',
							fontSize: '12px',
							background: 'transparent',
							border: '1px solid var(--window-border)',
							color: 'inherit',
							cursor: 'pointer',
						}}
					>
						{t('cancel')}
					</button>
					<button
						type="button"
						onClick={handleSave}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '6px 14px',
							borderRadius: '6px',
							fontSize: '12px',
							fontWeight: 600,
							background: 'var(--accent)',
							color: 'var(--accent-contrast)',
							border: 'none',
							cursor: 'pointer',
						}}
					>
						<Save size={13} />
						<span>{t('save')}</span>
					</button>
				</div>
			</div>
		</>
	);
}
