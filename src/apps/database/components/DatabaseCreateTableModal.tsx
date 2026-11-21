'use client';

import React, { useState, useMemo } from 'react';
import { X, AlertCircle, Database } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { buildCreateTableSql, validateCreateTableInput } from '../utils/ddlBuilder';
import { CreateTableColumnsSection } from './createTable/CreateTableColumnsSection';
import { CreateTableModalFooter } from './createTable/CreateTableModalFooter';
import type { CreateTableColumnInput } from '../types';

interface DatabaseCreateTableModalProps {
	dbToken: string;
	onClose: () => void;
	onSuccess: () => void;
}

export function DatabaseCreateTableModal({
	dbToken,
	onClose,
	onSuccess,
}: DatabaseCreateTableModalProps) {
	const { t } = useI18n();
	const [tableName, setTableName] = useState('');
	const [columns, setColumns] = useState<CreateTableColumnInput[]>([
		{ name: 'id', type: 'VARCHAR(50)', nullable: false, isPrimaryKey: true, defaultValue: '' },
		{ name: 'created_at', type: 'TIMESTAMPTZ', nullable: false, isPrimaryKey: false, defaultValue: 'NOW()' },
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

	const generatedSql = useMemo(() => buildCreateTableSql(tableName, columns), [tableName, columns]);

	const handleSubmit = async () => {
		const { cleanName, error: validationError } = validateCreateTableInput(tableName, columns);
		if (validationError) {
			setError(validationError);
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			const res = await fetch('/api/database/tables', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-db-token': dbToken },
				body: JSON.stringify({ action: 'create_table', tableName: cleanName, columns }),
			});

			const data = await res.json();
			if (!res.ok) {
				setError(data.error || t('dbCreateTableFailed'));
				setIsSubmitting(false);
				return;
			}

			onSuccess();
		} catch (err) {
			setError(err instanceof Error ? err.message : t('dbAuditNetworkError'));
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
							{t('dbCreateTableWizardTitle')}
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

					<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
						<label style={{ fontSize: '12px', fontWeight: 600 }}>{t('dbTableNameLabel')}</label>
						<input
							type="text"
							placeholder="e.g. club_awards"
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

					<CreateTableColumnsSection
						columns={columns}
						showSqlPreview={showSqlPreview}
						generatedSql={generatedSql}
						onAddColumn={handleAddColumn}
						onUpdateColumn={handleUpdateColumn}
						onRemoveColumn={handleRemoveColumn}
						onToggleSqlPreview={() => setShowSqlPreview((prev) => !prev)}
					/>
				</div>

				<CreateTableModalFooter
					isSubmitting={isSubmitting}
					onClose={onClose}
					onSubmit={handleSubmit}
				/>
			</div>
		</div>
	);
}
