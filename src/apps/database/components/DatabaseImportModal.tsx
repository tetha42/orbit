'use client';

import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { buildAutoMapping, buildMappedRows, parseImportText } from '../utils/importParser';
import { ImportStepProgress } from './import/ImportStepProgress';
import { ImportStepFileSelect } from './import/ImportStepFileSelect';
import { ImportStepColumnMapping } from './import/ImportStepColumnMapping';
import {
	ImportStepConflictStrategy,
	type ImportConflictStrategy,
} from './import/ImportStepConflictStrategy';
import { ImportModalFooter } from './import/ImportModalFooter';
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
	const [mapping, setMapping] = useState<Record<string, string>>({});
	const [conflictStrategy, setConflictStrategy] = useState<ImportConflictStrategy>('upsert');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;

		setError(null);
		const isJson = file.name.toLowerCase().endsWith('.json');
		const reader = new FileReader();
		reader.onload = (evt) => {
			const text = String(evt.target?.result || '');
			const parsed = parseImportText(text, isJson);
			if (parsed.error) {
				setError(fill(t(parsed.error), { message: parsed.errorDetail ?? '' }));
				return;
			}
			setSourceColumns(parsed.sourceColumns);
			setParsedRows(parsed.rows);
			setMapping(buildAutoMapping(columns, parsed.sourceColumns));
			setStep(2);
		};
		reader.readAsText(file);
	};

	const handleMapChange = (targetCol: string, sourceCol: string) => {
		setMapping((prev) => {
			const updated = { ...prev };
			if (sourceCol) updated[targetCol] = sourceCol;
			else delete updated[targetCol];
			return updated;
		});
	};

	const handleNextFromStep2 = () => {
		if (Object.keys(mapping).length === 0) {
			setError(t('dbImportMappingRequired'));
			return;
		}
		setError(null);
		setStep(3);
	};

	const executeImport = async () => {
		setIsSubmitting(true);
		setError(null);

		try {
			const mappedRows = buildMappedRows(parsedRows, mapping);
			const res = await fetch('/api/database/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-db-token': dbToken },
				body: JSON.stringify({ table: tableName, rows: mappedRows, conflictStrategy }),
			});

			const data = await res.json();
			if (!res.ok) {
				setError(data.error || t('dbImportFailed'));
				setIsSubmitting(false);
				return;
			}

			onSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : t('dbImportNetworkError'));
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
						<Upload size={18} color="var(--accent)" />
						<div style={{ fontSize: '15px', fontWeight: 700 }}>
							<span>{t('dbImportTitle')}</span>
							<span style={{ fontSize: '12px', opacity: 0.6, marginLeft: '8px' }}>→ {tableName}</span>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{ background: 'transparent', border: 'none', color: 'inherit', opacity: 0.7, cursor: 'pointer' }}
					>
						<X size={18} />
					</button>
				</div>

				<ImportStepProgress step={step} />

				{/* Body */}
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

					{step === 1 && <ImportStepFileSelect onFileChange={handleFileUpload} />}
					{step === 2 && (
						<ImportStepColumnMapping
							columns={columns}
							sourceColumns={sourceColumns}
							parsedRows={parsedRows}
							mapping={mapping}
							onMapChange={handleMapChange}
						/>
					)}
					{step === 3 && (
						<ImportStepConflictStrategy
							conflictStrategy={conflictStrategy}
							rowCount={parsedRows.length}
							tableName={tableName}
							onChangeStrategy={setConflictStrategy}
						/>
					)}
				</div>

				<ImportModalFooter
					step={step}
					isSubmitting={isSubmitting}
					onBack={() => setStep((prev) => (prev - 1) as 1 | 2)}
					onClose={onClose}
					onNextFromStep2={handleNextFromStep2}
					onSubmitImport={executeImport}
				/>
			</div>
		</div>
	);
}
