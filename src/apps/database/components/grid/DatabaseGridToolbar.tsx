'use client';

import React from 'react';
import { Download, Trash2, Plus, RefreshCw, Search, Upload } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from '../../Database.module.css';

interface DatabaseGridToolbarProps {
	tableName: string;
	totalRows: number;
	searchInput: string;
	selectedCount: number;
	isLoading: boolean;
	onSearchInputChange: (value: string) => void;
	onOpenAddModal: () => void;
	onOpenImport?: () => void;
	onDeleteSelected: () => void;
	onExportCsv: () => void;
	onExportJson: () => void;
	onRefresh: () => void;
}

export function DatabaseGridToolbar({
	tableName,
	totalRows,
	searchInput,
	selectedCount,
	isLoading,
	onSearchInputChange,
	onOpenAddModal,
	onOpenImport,
	onDeleteSelected,
	onExportCsv,
	onExportJson,
	onRefresh,
}: DatabaseGridToolbarProps) {
	const { t } = useI18n();

	return (
		<div className={s.topBar}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
				<span style={{ fontSize: 13, fontWeight: 700 }}>{tableName}</span>
				<span style={{ fontSize: 11, opacity: 0.6 }}>
					({fill(t('dbRowsCount'), { n: totalRows })})
				</span>
			</div>

			<div className={s.actionsGroup}>
				{/* Search in active table */}
				<div style={{ position: 'relative' }}>
					<input
						type="text"
						className={s.searchInput}
						style={{ width: 170 }}
						placeholder={t('dbSearchPlaceholder')}
						value={searchInput}
						onChange={(e) => onSearchInputChange(e.target.value)}
					/>
					<Search
						size={12}
						style={{
							position: 'absolute',
							right: 8,
							top: '50%',
							transform: 'translateY(-50%)',
							opacity: 0.4,
						}}
					/>
				</div>

				<button
					type="button"
					className={s.actionBtn}
					onClick={onOpenAddModal}
					title={t('dbAddNewRow')}
				>
					<Plus size={13} />
					<span>{t('add')}</span>
				</button>

				{onOpenImport && (
					<button
						type="button"
						className={s.actionBtn}
						onClick={onOpenImport}
						title={t('dbImportCsvJsonTitle')}
					>
						<Upload size={13} />
						<span>{t('dbImportAction')}</span>
					</button>
				)}

				{selectedCount > 0 && (
					<button
						type="button"
						className={s.actionBtn}
						onClick={onDeleteSelected}
						style={{
							color: 'var(--danger)',
							borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',
						}}
					>
						<Trash2 size={13} />
						<span>{t('delete')} ({selectedCount})</span>
					</button>
				)}

				<button
					type="button"
					className={s.actionBtn}
					onClick={onExportCsv}
					title={t('dbExportCsvTitle')}
				>
					<Download size={13} />
					<span>CSV</span>
				</button>

				<button
					type="button"
					className={s.actionBtn}
					onClick={onExportJson}
					title={t('dbExportJsonTitle')}
				>
					<Download size={13} />
					<span>JSON</span>
				</button>

				<button
					type="button"
					className={s.actionBtn}
					onClick={onRefresh}
					disabled={isLoading}
				>
					<RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
				</button>
			</div>
		</div>
	);
}
