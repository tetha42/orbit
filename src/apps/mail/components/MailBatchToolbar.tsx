'use client';

import React from 'react';
import { MailOpen, X, Check, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import styles from '../Mail.module.css';

interface MailBatchToolbarProps {
	selectedCount: number;
	isAllSelected: boolean;
	isTrashFolder: boolean;
	onSelectAll?: () => void;
	onDeselectAll?: () => void;
	onBatchToggleRead?: (markSeen: boolean) => void;
	onBatchTrash?: () => void;
}

export const MailBatchToolbar: React.FC<MailBatchToolbarProps> = ({
	selectedCount,
	isAllSelected,
	isTrashFolder,
	onSelectAll,
	onDeselectAll,
	onBatchToggleRead,
	onBatchTrash,
}) => {
	const { t } = useI18n();

	return (
		<div className={styles.batchToolbar}>
			<div className={styles.batchToolbarLeft}>
				<button
					type="button"
					className={`${styles.selectionCheckbox} ${isAllSelected ? styles.selectionCheckboxChecked : ''}`}
					onClick={isAllSelected ? onDeselectAll : onSelectAll}
					title={isAllSelected ? t('mailDeselectAll') : t('mailSelectAll')}
				>
					{isAllSelected && <Check size={12} strokeWidth={3} />}
				</button>
				<span className={styles.batchCount}>
					{fill(t('mailSelectedCount'), { count: selectedCount })}
				</span>
			</div>
			<div className={styles.batchToolbarRight}>
				{onBatchToggleRead && (
					<button
						type="button"
						className={styles.batchActionBtn}
						onClick={() => onBatchToggleRead(true)}
						title={t('mailBatchMarkRead')}
					>
						<MailOpen size={13} />
						<span>{t('mailBatchMarkRead')}</span>
					</button>
				)}
				{onBatchTrash && (
					<button
						type="button"
						className={`${styles.batchActionBtn} ${styles.batchActionBtnDanger}`}
						onClick={onBatchTrash}
						title={isTrashFolder ? t('mailBatchDelete') : t('mailBatchTrash')}
					>
						<Trash2 size={13} />
						<span>{isTrashFolder ? t('mailBatchDelete') : t('mailBatchTrash')}</span>
					</button>
				)}
				{onDeselectAll && (
					<button
						type="button"
						className={styles.batchActionBtn}
						onClick={onDeselectAll}
						title={t('mailDeselectAll')}
					>
						<X size={13} />
					</button>
				)}
			</div>
		</div>
	);
};
