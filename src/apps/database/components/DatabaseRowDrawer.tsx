'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Code2, AlertCircle, Save } from 'lucide-react';
import { useI18n } from '@/core/i18n';
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
	const [values, setValues] = useState<Record<string, unknown>>({});
	const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		if (row) {
			setValues({ ...row });
			setJsonErrors({});
		}
	}, [row]);

	if (!row) return null;

	const handleChange = (colName: string, val: unknown) => {
		setValues((prev) => ({ ...prev, [colName]: val }));
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
			setJsonErrors((prev) => ({ ...prev, [colName]: 'Geçersiz JSON formatı' }));
		}
	};

	const handleSave = () => {
		// Filter out sensitive and unchanged
		const changed: Record<string, unknown> = {};
		for (const col of columns) {
			if (col.isSensitive) continue;
			let v = values[col.name];
			if (['json', 'jsonb'].includes(col.type) && typeof v === 'string') {
				try {
					v = JSON.parse(v);
				} catch {
					// keep as is
				}
			}
			if (v !== row[col.name]) {
				changed[col.name] = v;
			}
		}
		onSave(changed);
	};

	const pkCol = columns.find((c) => c.isPrimaryKey)?.name || 'id';
	const pkVal = row[pkCol];

	return (
		<>
			<div className={s.drawerBackdrop} onClick={onClose} style={{ zIndex: 75 }} />
			<div className={s.drawerPanel} style={{ zIndex: 80, width: 440 }}>
				{/* Drawer Header */}
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
						<span>{t('dbRowDetail') || 'Satır Detayı'}</span>
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
						{columns.length} sütun inceleniyor
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

			{/* Drawer Fields Body */}
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
				{columns.map((col) => {
					const isJson = ['json', 'jsonb'].includes(col.type);
					const rawVal = values[col.name];
					const displayVal =
						isJson && typeof rawVal === 'object' && rawVal !== null
							? JSON.stringify(rawVal, null, 2)
							: rawVal !== null && rawVal !== undefined
							? String(rawVal)
							: '';

					const isFK = Boolean(col.isForeignKey && col.foreignKeyTarget);

					return (
						<div
							key={col.name}
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: '4px',
							}}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<label
									style={{
										fontSize: '12px',
										fontWeight: col.isPrimaryKey ? 700 : 600,
										display: 'flex',
										alignItems: 'center',
										gap: '6px',
									}}
								>
									<span>{col.name}</span>
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
										{col.type}
									</span>
									{col.isPrimaryKey && (
										<span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700 }}>
											[PK]
										</span>
									)}
								</label>

								{/* FK Jump Link */}
								{isFK && rawVal && onJumpToForeignKey && (
									<button
										type="button"
										onClick={() =>
											onJumpToForeignKey(
												col.foreignKeyTarget!.table,
												col.foreignKeyTarget!.column,
												rawVal
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
										title={`İlişkili ${col.foreignKeyTarget!.table} tablosuna zıpla`}
									>
										<span>{col.foreignKeyTarget!.table}</span>
										<ExternalLink size={10} />
									</button>
								)}

								{/* JSON Prettify Button */}
								{isJson && !col.isSensitive && (
									<button
										type="button"
										onClick={() => handlePrettifyJson(col.name)}
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
										<span>Biçimlendir</span>
									</button>
								)}
							</div>

							{/* Input Rendering */}
							{col.isSensitive ? (
								<input
									type="text"
									disabled
									value="•••••••• (Hassas Veri)"
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
											handleChange(col.name, e.target.value);
											try {
												JSON.parse(e.target.value);
												setJsonErrors((prev) => {
													const copy = { ...prev };
													delete copy[col.name];
													return copy;
												});
											} catch {
												setJsonErrors((prev) => ({
													...prev,
													[col.name]: 'Geçersiz JSON',
												}));
											}
										}}
										style={{
											fontFamily: 'monospace',
											fontSize: '11px',
											background: 'var(--input-bg)',
											border: jsonErrors[col.name]
												? '1px solid var(--danger)'
												: '1px solid var(--window-border)',
											borderRadius: '6px',
											padding: '8px 10px',
											color: 'inherit',
											resize: 'vertical',
										}}
									/>
									{jsonErrors[col.name] && (
										<span style={{ fontSize: '10.5px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
											<AlertCircle size={11} />
											{jsonErrors[col.name]}
										</span>
									)}
								</div>
							) : col.type === 'boolean' ? (
								<select
									value={String(rawVal ?? '')}
									onChange={(e) =>
										handleChange(col.name, e.target.value === 'true' ? true : e.target.value === 'false' ? false : null)
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
									onChange={(e) => handleChange(col.name, e.target.value)}
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
				})}
			</div>

			{/* Drawer Footer Actions */}
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
					{t('cancel') || 'Kapat'}
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
					<span>{t('save') || 'Değişiklikleri Kaydet'}</span>
				</button>
			</div>
		</div>
		</>
	);
}
