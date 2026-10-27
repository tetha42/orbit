'use client';

import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Check, AlertCircle, Database, Code2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { CreateTableColumnInput } from '../types';

interface DatabaseCreateTableModalProps {
	dbToken: string;
	onClose: () => void;
	onSuccess: () => void;
}

const DATA_TYPES = [
	{ label: 'TEXT (Serbest Metin)', value: 'TEXT' },
	{ label: 'VARCHAR(255) (Kısa Metin)', value: 'VARCHAR(255)' },
	{ label: 'INTEGER (Tam Sayı)', value: 'INTEGER' },
	{ label: 'BIGINT (Büyük Sayı)', value: 'BIGINT' },
	{ label: 'BOOLEAN (Evet/Hayır)', value: 'BOOLEAN' },
	{ label: 'TIMESTAMPTZ (Zaman Damgası)', value: 'TIMESTAMPTZ' },
	{ label: 'JSONB (Yapılandırılmış Veri)', value: 'JSONB' },
	{ label: 'NUMERIC (Ondalıklı Sayı)', value: 'NUMERIC' },
	{ label: 'UUID (Evrensel Kimlik)', value: 'UUID' },
];

export function DatabaseCreateTableModal({ dbToken, onClose, onSuccess }: DatabaseCreateTableModalProps) {
	const { t } = useI18n();

	const [tableName, setTableName] = useState('');
	const [columns, setColumns] = useState<CreateTableColumnInput[]>([
		{ name: 'id', type: 'VARCHAR(50)', nullable: false, isPrimaryKey: true, defaultValue: '' },
		{ name: 'olusturulma', type: 'TIMESTAMPTZ', nullable: false, isPrimaryKey: false, defaultValue: 'NOW()' },
	]);

	const [showSqlPreview, setShowSqlPreview] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleAddColumn = () => {
		setColumns((prev) => [
			...prev,
			{ name: '', type: 'TEXT', nullable: true, isPrimaryKey: false, defaultValue: '' },
		]);
	};

	const handleUpdateColumn = (idx: number, patch: Partial<CreateTableColumnInput>) => {
		setColumns((prev) => {
			const updated = [...prev];
			updated[idx] = { ...updated[idx], ...patch };
			return updated;
		});
	};

	const handleRemoveColumn = (idx: number) => {
		if (columns.length <= 1) return;
		setColumns((prev) => prev.filter((_, i) => i !== idx));
	};

	const generatedSql = useMemo(() => {
		const safeTable = tableName.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'yeni_tablo';
		const colDefs: string[] = [];
		const pks: string[] = [];

		for (const c of columns) {
			const name = c.name.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'sutun';
			const nullClause = c.nullable ? '' : 'NOT NULL';
			const defaultClause = c.defaultValue?.trim() ? `DEFAULT ${c.defaultValue.trim()}` : '';
			colDefs.push(`  "${name}" ${c.type} ${nullClause} ${defaultClause}`.trim());
			if (c.isPrimaryKey) {
				pks.push(`"${name}"`);
			}
		}

		if (pks.length > 0) {
			colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
		}

		return `CREATE TABLE "${safeTable}" (\n${colDefs.join(',\n')}\n);`;
	}, [tableName, columns]);

	const handleSubmit = async () => {
		const cleanName = tableName.trim().toLowerCase();
		if (!cleanName || !/^[a-zA-Z0-9_]+$/.test(cleanName)) {
			setError('Lütfen geçerli bir tablo adı girin (sadece harf, rakam ve alt çizgi).');
			return;
		}

		for (const c of columns) {
			if (!c.name.trim() || !/^[a-zA-Z0-9_]+$/.test(c.name.trim())) {
				setError(`Geçersiz sütun adı: "${c.name}". Sütun adları boş bırakılamaz.`);
				return;
			}
		}

		setIsSubmitting(true);
		setError(null);

		try {
			const res = await fetch('/api/database/tables', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({
					action: 'create_table',
					tableName: cleanName,
					columns,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				setError(data.error || 'Tablo oluşturulamadı.');
				setIsSubmitting(false);
				return;
			}

			onSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ağ hatası.');
			setIsSubmitting(false);
		}
	};

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 210,
				background: 'var(--modal-scrim)',
				backdropFilter: 'blur(8px)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				padding: '20px',
			}}
		>
			<div
				style={{
					width: '720px',
					maxWidth: '100%',
					maxHeight: '90vh',
					background: 'var(--modal-surface, #1e2026)',
					backdropFilter: 'blur(32px) saturate(180%)',
					WebkitBackdropFilter: 'blur(32px) saturate(180%)',
					border: '1px solid var(--window-border)',
					borderRadius: '14px',
					boxShadow: 'var(--shadow-panel)',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
				}}
			>
				{/* Header */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '16px 20px',
						borderBottom: '1px solid var(--window-border)',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Database size={18} color="var(--accent)" />
						<div style={{ fontSize: '15px', fontWeight: 700 }}>
							Yeni Tablo Oluşturucu (DDL Sihirbazı)
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: 'transparent',
							border: 'none',
							color: 'inherit',
							opacity: 0.7,
							cursor: 'pointer',
						}}
					>
						<X size={18} />
					</button>
				</div>

				{/* Body */}
				<div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
					{error && (
						<div
							style={{
								padding: '10px 14px',
								borderRadius: '8px',
								background: 'color-mix(in srgb, var(--danger) 14%, transparent)',
								border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
								color: 'var(--danger)',
								fontSize: '12px',
								display: 'flex',
								alignItems: 'center',
								gap: '8px',
							}}
						>
							<AlertCircle size={16} />
							<span>{error}</span>
						</div>
					)}

					{/* Table Name */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						<label style={{ fontSize: '12px', fontWeight: 600 }}>Tablo Adı:</label>
						<input
							type="text"
							placeholder="orn: kulup_odulleri"
							value={tableName}
							onChange={(e) => setTableName(e.target.value)}
							style={{
								background: 'var(--input-bg)',
								border: '1px solid var(--input-border)',
								borderRadius: '6px',
								padding: '8px 12px',
								fontSize: '13px',
								color: 'var(--text-primary)',
							}}
						/>
					</div>

					{/* Columns Configuration List */}
					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<label style={{ fontSize: '12px', fontWeight: 600 }}>Sütun Yapısı ({columns.length}):</label>
							<button
								type="button"
								onClick={handleAddColumn}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '4px',
									padding: '4px 8px',
									borderRadius: '5px',
									fontSize: '11px',
									background: 'var(--accent-subtle)',
									color: 'var(--accent)',
									border: '1px solid var(--accent-border)',
									cursor: 'pointer',
								}}
							>
								<Plus size={12} />
								<span>Sütun Ekle</span>
							</button>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
							{columns.map((c, idx) => (
								<div
									key={idx}
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
									{/* Column Name */}
									<input
										type="text"
										placeholder="Sütun Adı"
										value={c.name}
										onChange={(e) => handleUpdateColumn(idx, { name: e.target.value })}
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

									{/* Data Type */}
									<select
										value={c.type}
										onChange={(e) => handleUpdateColumn(idx, { type: e.target.value })}
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
										{DATA_TYPES.map((dt) => (
											<option key={dt.value} value={dt.value}>
												{dt.label}
											</option>
										))}
									</select>

									{/* PK Checkbox */}
									<label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
										<input
											type="checkbox"
											checked={c.isPrimaryKey}
											onChange={(e) => handleUpdateColumn(idx, { isPrimaryKey: e.target.checked })}
										/>
										<span>PK</span>
									</label>

									{/* Nullable Checkbox */}
									<label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
										<input
											type="checkbox"
											checked={c.nullable}
											onChange={(e) => handleUpdateColumn(idx, { nullable: e.target.checked })}
										/>
										<span>Null</span>
									</label>

									{/* Default value */}
									<input
										type="text"
										placeholder="Varsayılan"
										value={c.defaultValue || ''}
										onChange={(e) => handleUpdateColumn(idx, { defaultValue: e.target.value })}
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

									{/* Remove Column */}
									<button
										type="button"
										onClick={() => handleRemoveColumn(idx)}
										disabled={columns.length <= 1}
										style={{
											background: 'transparent',
											border: 'none',
											color: 'var(--danger)',
											cursor: columns.length > 1 ? 'pointer' : 'not-allowed',
											opacity: columns.length > 1 ? 0.8 : 0.3,
											padding: '4px',
										}}
									>
										<Trash2 size={13} />
									</button>
								</div>
							))}
						</div>
					</div>

					{/* Live SQL Preview Toggle */}
					<div>
						<button
							type="button"
							onClick={() => setShowSqlPreview(!showSqlPreview)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '5px',
								background: 'transparent',
								border: 'none',
								color: 'var(--accent)',
								fontSize: '11.5px',
								cursor: 'pointer',
								padding: 0,
							}}
						>
							<Code2 size={13} />
							<span>{showSqlPreview ? 'SQL Önizlemesini Gizle' : 'Üretilen SQL Kodunu Gör'}</span>
						</button>

						{showSqlPreview && (
							<pre
								style={{
									marginTop: '8px',
									padding: '10px 12px',
									borderRadius: '8px',
									background: 'var(--fill-softer)',
									border: '1px solid var(--window-border)',
									fontFamily: 'monospace',
									fontSize: '11px',
									overflowX: 'auto',
								}}
							>
								{generatedSql}
							</pre>
						)}
					</div>
				</div>

				{/* Footer */}
				<div
					style={{
						padding: '14px 20px',
						borderTop: '1px solid var(--window-border)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'flex-end',
						gap: '8px',
					}}
				>
					<button
						type="button"
						onClick={onClose}
						style={{
							padding: '7px 14px',
							borderRadius: '6px',
							fontSize: '12px',
							background: 'transparent',
							border: '1px solid var(--window-border)',
							color: 'inherit',
							cursor: 'pointer',
						}}
					>
						{t('cancel') || 'Vazgeç'}
					</button>

					<button
						type="button"
						onClick={handleSubmit}
						disabled={isSubmitting}
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '6px',
							padding: '7px 18px',
							borderRadius: '6px',
							fontSize: '12px',
							fontWeight: 700,
							background: 'var(--accent)',
							color: 'var(--accent-contrast)',
							border: 'none',
							cursor: isSubmitting ? 'not-allowed' : 'pointer',
							opacity: isSubmitting ? 0.7 : 1,
						}}
					>
						<Check size={14} strokeWidth={3} />
						<span>{isSubmitting ? 'Oluşturuluyor...' : 'Tabloyu Oluştur'}</span>
					</button>
				</div>
			</div>
		</div>
	);
}
