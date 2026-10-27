'use client';

import React, { useState } from 'react';
import { X, Upload, ArrowRight, ArrowLeft, Check, FileText, AlertCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ColumnSpec } from '../types';

interface DatabaseImportModalProps {
	tableName: string;
	columns: ColumnSpec[];
	dbToken: string;
	onClose: () => void;
	onSuccess: () => void;
}

export function DatabaseImportModal({
	tableName,
	columns,
	dbToken,
	onClose,
	onSuccess,
}: DatabaseImportModalProps) {
	const { t } = useI18n();

	const [step, setStep] = useState<1 | 2 | 3>(1);

	const [sourceColumns, setSourceColumns] = useState<string[]>([]);
	const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);

	// Mapping: targetCol -> sourceCol
	const [mapping, setMapping] = useState<Record<string, string>>({});
	const [conflictStrategy, setConflictStrategy] = useState<'error' | 'upsert' | 'skip'>('upsert');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Handle file upload
	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setError(null);

		const isJson = file.name.endsWith('.json');

		const reader = new FileReader();
		reader.onload = (evt) => {
			const text = String(evt.target?.result || '');

			try {
				if (isJson) {
					const data = JSON.parse(text);
					if (!Array.isArray(data) || data.length === 0) {
						setError('JSON dosyası boş veya bir nesne dizisi (array) formatında değil.');
						return;
					}
					const cols = Object.keys(data[0] || {});
					setSourceColumns(cols);
					setParsedRows(data);
					autoMap(cols);
					setStep(2);
				} else {
					// Parse CSV
					const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
					if (lines.length < 2) {
						setError('CSV dosyası en az bir başlık ve bir veri satırı içermelidir.');
						return;
					}
					// Auto detect separator (, or ;)
					const separator = lines[0].includes(';') ? ';' : ',';
					const headers = lines[0].split(separator).map((h) => h.trim().replace(/^["']|["']$/g, ''));
					const rows: Record<string, unknown>[] = [];

					for (let i = 1; i < lines.length; i++) {
						const parts = lines[i].split(separator);
						const rowObj: Record<string, unknown> = {};
						headers.forEach((h, idx) => {
							const val = (parts[idx] || '').trim().replace(/^["']|["']$/g, '');
							rowObj[h] = val;
						});
						rows.push(rowObj);
					}

					setSourceColumns(headers);
					setParsedRows(rows);
					autoMap(headers);
					setStep(2);
				}
			} catch (err) {
				setError('Dosya okunurken bir hata oluştu: ' + (err instanceof Error ? err.message : String(err)));
			}
		};
		reader.readAsText(file);
	};

	const autoMap = (sources: string[]) => {
		const newMap: Record<string, string> = {};
		for (const targetCol of columns) {
			const lowerTarget = targetCol.name.toLowerCase();
			const matched = sources.find((s) => s.toLowerCase() === lowerTarget);
			if (matched) {
				newMap[targetCol.name] = matched;
			}
		}
		setMapping(newMap);
	};

	const handleMapChange = (targetCol: string, sourceCol: string) => {
		setMapping((prev) => {
			const updated = { ...prev };
			if (sourceCol) {
				updated[targetCol] = sourceCol;
			} else {
				delete updated[targetCol];
			}
			return updated;
		});
	};

	const executeImport = async () => {
		setIsSubmitting(true);
		setError(null);

		try {
			// Transform parsedRows according to mapping
			const mappedRows: Record<string, unknown>[] = [];
			for (const raw of parsedRows) {
				const row: Record<string, unknown> = {};
				for (const [targetCol, sourceCol] of Object.entries(mapping)) {
					if (sourceCol && raw[sourceCol] !== undefined) {
						row[targetCol] = raw[sourceCol];
					}
				}
				if (Object.keys(row).length > 0) {
					mappedRows.push(row);
				}
			}

			const res = await fetch('/api/database/import', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-db-token': dbToken,
				},
				body: JSON.stringify({
					table: tableName,
					rows: mappedRows,
					conflictStrategy,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				setError(data.error || 'İçe aktarma başarısız oldu.');
				setIsSubmitting(false);
				return;
			}

			onSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ağ hatası oluştu.');
			setIsSubmitting(false);
		}
	};

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 200,
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
					width: '680px',
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
				{/* Modal Header */}
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
						<Upload size={18} color="var(--accent, #3b82f6)" />
						<div style={{ fontSize: '15px', fontWeight: 700 }}>
							<span>{t('dbImportTitle') || 'Akıllı Veri İçe Aktarma'}</span>
							<span style={{ fontSize: '12px', opacity: 0.6, marginLeft: '8px' }}>
								→ {tableName}
							</span>
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

				{/* Step Progress Pills */}
				<div
					style={{
						display: 'flex',
						padding: '10px 20px',
						background: 'var(--fill-softer)',
						borderBottom: '1px solid var(--window-border)',
						gap: '12px',
						fontSize: '11.5px',
					}}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: step === 1 ? 700 : 400, color: step === 1 ? 'var(--accent)' : 'inherit' }}>
						<span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 1 ? 'var(--accent)' : 'var(--fill-strong)', color: step === 1 ? 'var(--accent-contrast)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>1</span>
						<span>Dosya Seçimi</span>
					</div>
					<span>›</span>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: step === 2 ? 700 : 400, color: step === 2 ? 'var(--accent)' : 'inherit' }}>
						<span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 2 ? 'var(--accent)' : 'var(--fill-strong)', color: step === 2 ? 'var(--accent-contrast)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>2</span>
						<span>Sütun Eşleştirme & Önizleme</span>
					</div>
					<span>›</span>
					<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: step === 3 ? 700 : 400, color: step === 3 ? 'var(--accent)' : 'inherit' }}>
						<span style={{ width: '18px', height: '18px', borderRadius: '50%', background: step === 3 ? 'var(--accent)' : 'var(--fill-strong)', color: step === 3 ? 'var(--accent-contrast)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>3</span>
						<span>Çatışma Çözümü & Yükleme</span>
					</div>
				</div>

				{/* Step Body */}
				<div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
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
								marginBottom: '14px',
							}}
						>
							<AlertCircle size={16} />
							<span>{error}</span>
						</div>
					)}

					{/* STEP 1: File Selection */}
					{step === 1 && (
						<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', border: '2px dashed var(--window-border)', borderRadius: '12px' }}>
							<Upload size={36} style={{ opacity: 0.5, marginBottom: '12px' }} />
							<div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
								CSV veya JSON Dosyasını Seçin
							</div>
							<div style={{ fontSize: '12px', opacity: 0.6, marginBottom: '18px', textAlign: 'center' }}>
								Mevcut kayıtlarınıza toplu veri aktarmak için UTF-8 formatlı CSV veya JSON dizisi yükleyin.
							</div>
							<label
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '8px',
									padding: '8px 18px',
									borderRadius: '8px',
									background: 'var(--accent)',
									color: 'var(--accent-contrast)',
									fontSize: '13px',
									fontWeight: 600,
									cursor: 'pointer',
								}}
							>
								<FileText size={15} />
								<span>Dosya Seç (.csv, .json)</span>
								<input
									type="file"
									accept=".csv, .json"
									onChange={handleFileUpload}
									style={{ display: 'none' }}
								/>
							</label>
						</div>
					)}

					{/* STEP 2: Column Mapping & Validation Preview */}
					{step === 2 && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
							<div style={{ fontSize: '13px', opacity: 0.8 }}>
								Dosyanızda <strong>{parsedRows.length}</strong> satır tespit edildi. Hedef tablodaki sütunlarla dosya sütunlarını eşleştirin:
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
								{columns.map((col) => {
									return (
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
												onChange={(e) => handleMapChange(col.name, e.target.value)}
												style={{
													background: 'var(--input-bg)',
													color: 'var(--text-primary)',
													border: '1px solid var(--window-border)',
													borderRadius: '6px',
													padding: '4px 8px',
													fontSize: '11px',
												}}
											>
												<option value="">(Eşleme Yok - Atla)</option>
												{sourceColumns.map((sc) => (
													<option key={sc} value={sc}>
														{sc}
													</option>
												))}
											</select>
										</div>
									);
								})}
							</div>

							{/* Preview of first 3 rows */}
							<div>
								<div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
									İlk 3 Satır Önizlemesi (Eşlenmiş Hali):
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
												{Object.keys(mapping).map((col) => (
													<th key={col} style={{ padding: '6px 10px', borderBottom: '1px solid var(--window-border)' }}>
														{col}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{parsedRows.slice(0, 3).map((r, idx) => (
												<tr key={idx} style={{ borderBottom: '1px solid var(--window-border)' }}>
													{Object.keys(mapping).map((col) => {
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
					)}

					{/* STEP 3: Conflict Resolution & Final Submit */}
					{step === 3 && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
							<div style={{ fontSize: '13px', fontWeight: 600 }}>
								Çakışma ve Birincil Anahtar Stratejisi:
							</div>
							<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
								<label
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										gap: '10px',
										padding: '12px',
										borderRadius: '8px',
										border: conflictStrategy === 'upsert' ? '1px solid var(--accent)' : '1px solid var(--window-border)',
										background: conflictStrategy === 'upsert' ? 'var(--accent-subtle)' : 'transparent',
										cursor: 'pointer',
									}}
								>
									<input
										type="radio"
										name="conflict"
										checked={conflictStrategy === 'upsert'}
										onChange={() => setConflictStrategy('upsert')}
										style={{ marginTop: '2px' }}
									/>
									<div>
										<div style={{ fontSize: '13px', fontWeight: 600 }}>
											Güncelle / Upsert (Önerilen)
										</div>
										<div style={{ fontSize: '11.5px', opacity: 0.65 }}>
											Eğer yüklenen kaydın birincil anahtarı veritabanında zaten varsa o satırın değerlerini günceller.
										</div>
									</div>
								</label>

								<label
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										gap: '10px',
										padding: '12px',
										borderRadius: '8px',
										border: conflictStrategy === 'skip' ? '1px solid var(--accent)' : '1px solid var(--window-border)',
										background: conflictStrategy === 'skip' ? 'var(--accent-subtle)' : 'transparent',
										cursor: 'pointer',
									}}
								>
									<input
										type="radio"
										name="conflict"
										checked={conflictStrategy === 'skip'}
										onChange={() => setConflictStrategy('skip')}
										style={{ marginTop: '2px' }}
									/>
									<div>
										<div style={{ fontSize: '13px', fontWeight: 600 }}>
											Mevcut Kaydı Atla (Skip)
										</div>
										<div style={{ fontSize: '11.5px', opacity: 0.65 }}>
											Aynı anahtara sahip satırlar sessizce atlanır, yalnızca yeni satırlar eklenir.
										</div>
									</div>
								</label>

								<label
									style={{
										display: 'flex',
										alignItems: 'flex-start',
										gap: '10px',
										padding: '12px',
										borderRadius: '8px',
										border: conflictStrategy === 'error' ? '1px solid var(--accent)' : '1px solid var(--window-border)',
										background: conflictStrategy === 'error' ? 'var(--accent-subtle)' : 'transparent',
										cursor: 'pointer',
									}}
								>
									<input
										type="radio"
										name="conflict"
										checked={conflictStrategy === 'error'}
										onChange={() => setConflictStrategy('error')}
										style={{ marginTop: '2px' }}
									/>
									<div>
										<div style={{ fontSize: '13px', fontWeight: 600 }}>
											Hata Ver ve Durdur (Strict Fail)
										</div>
										<div style={{ fontSize: '11.5px', opacity: 0.65 }}>
											Mevcut bir anahtar çakışırsa tüm işlem geri alınır (Rollback) ve hata fırlatılır.
										</div>
									</div>
								</label>
							</div>

							<div style={{ padding: '12px', borderRadius: '8px', background: 'var(--fill-softer)', fontSize: '12px' }}>
								<strong>Özet:</strong> Toplam <strong>{parsedRows.length}</strong> satır tek bir transaction içinde <strong>{tableName}</strong> tablosuna yazılacaktır.
							</div>
						</div>
					)}
				</div>

				{/* Modal Footer Controls */}
				<div
					style={{
						padding: '14px 20px',
						borderTop: '1px solid var(--window-border)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					{step > 1 ? (
						<button
							type="button"
							onClick={() => setStep((s) => (s - 1) as 1 | 2)}
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '6px',
								padding: '7px 14px',
								borderRadius: '6px',
								fontSize: '12px',
								background: 'transparent',
								border: '1px solid var(--window-border)',
								color: 'inherit',
								cursor: 'pointer',
							}}
						>
							<ArrowLeft size={14} />
							<span>Geri</span>
						</button>
					) : (
						<div />
					)}

					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

						{step === 2 && (
							<button
								type="button"
								onClick={() => {
									if (Object.keys(mapping).length === 0) {
										setError('Lütfen en az bir sütun eşleştirmesi yapın.');
										return;
									}
									setError(null);
									setStep(3);
								}}
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '6px',
									padding: '7px 16px',
									borderRadius: '6px',
									fontSize: '12px',
									fontWeight: 600,
									background: 'var(--accent)',
									color: 'var(--accent-contrast)',
									border: 'none',
									cursor: 'pointer',
								}}
							>
								<span>İlerle</span>
								<ArrowRight size={14} />
							</button>
						)}

						{step === 3 && (
							<button
								type="button"
								onClick={executeImport}
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
								<span>{isSubmitting ? 'İçe Aktarılıyor...' : 'İçe Aktarımı Tamamla'}</span>
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
