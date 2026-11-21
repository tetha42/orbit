'use client';

import React, { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { formatNewRowValues } from '../../utils/rowValues';
import type { ColumnSpec } from '../../types';
import s from '../../Database.module.css';

interface DatabaseAddRowModalProps {
	tableName: string;
	columns: ColumnSpec[];
	onInsertRow: (row: Record<string, unknown>) => void;
	onClose: () => void;
}

export function DatabaseAddRowModal({
	tableName,
	columns,
	onInsertRow,
	onClose,
}: DatabaseAddRowModalProps) {
	const { t } = useI18n();
	const [newRowData, setNewRowData] = useState<Record<string, string>>({});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onInsertRow(formatNewRowValues(newRowData, columns));
		setNewRowData({});
		onClose();
	};

	return (
		<div className={s.modalBackdrop}>
			<div className={s.modalCard}>
				<div className={s.modalHeader}>
					<span style={{ fontWeight: 700, fontSize: 14 }}>
						{t('dbAddNewRowTitle')} ({tableName})
					</span>
					<button
						type="button"
						className={s.modalCloseBtn}
						onClick={onClose}
					>
						✕
					</button>
				</div>

				<form onSubmit={handleSubmit} className={s.modalForm}>
					<div className={s.modalFormScroll}>
						{columns.map((col) => {
							if (col.isSensitive) return null;
							return (
								<div key={col.name} className={s.formGroup}>
									<label className={s.formLabel}>
										<span>{col.name}</span>
										<span className={s.gridThType}>{col.type}</span>
										{col.nullable && <span style={{ opacity: 0.5 }}>({t('dbOptional')})</span>}
									</label>
									<input
										type="text"
										className={s.formInput}
										value={newRowData[col.name] || ''}
										onChange={(e) =>
											setNewRowData({ ...newRowData, [col.name]: e.target.value })
										}
										placeholder={col.hasDefault ? t('dbDefaultValuePlaceholder') : ''}
									/>
								</div>
							);
						})}
					</div>

					<div className={s.modalActions}>
						<button
							type="button"
							className={s.secondaryBtn}
							onClick={onClose}
						>
							{t('cancel')}
						</button>
						<button type="submit" className={s.primaryBtn}>
							{t('dbInsertBtn')}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
