'use client';

import React from 'react';
import { CircleAlert, Pencil, Trash2, Wrench } from 'lucide-react';
import ui from '@/core/ui/ui.module.css';
import { useI18n } from '@/core/i18n';
import type { InventoryItem } from '../types';
import s from './Inventory.module.css';

interface ItemDetailManageBarProps {
	item: InventoryItem;
	onEdit: () => void;
	onSetStatus: (status: 'available' | 'faulty' | 'lost') => void;
	onRemove: () => void;
}

export function ItemDetailManageBar({
	item,
	onEdit,
	onSetStatus,
	onRemove,
}: ItemDetailManageBarProps) {
	const { t } = useI18n();

	return (
		<div className={s.manage} aria-label={t('invManageSection').replace(':', '')}>
			<strong style={{ fontSize: 12.5 }}>{t('invManageSection')}</strong>
			<button type="button" className={ui.btn} onClick={onEdit}>
				<Pencil size={13} /> {t('edit')}
			</button>
			{item.status !== 'available' && item.status !== 'on_loan' && (
				<button type="button" className={ui.btn} onClick={() => onSetStatus('available')}>
					<Wrench size={13} /> {t('invMarkRepaired')}
				</button>
			)}
			{item.status === 'available' && (
				<button type="button" className={ui.btn} onClick={() => onSetStatus('faulty')}>
					<CircleAlert size={13} /> {t('invMarkBroken')}
				</button>
			)}
			{item.status !== 'lost' && (
				<button type="button" className={ui.btn} onClick={() => onSetStatus('lost')}>
					{t('invMarkLost')}
				</button>
			)}
			<span className={s.spacer} />
			<button
				type="button"
				className={`${ui.btn} ${ui.btnDanger}`}
				onClick={onRemove}
				disabled={item.status === 'on_loan'}
				title={item.status === 'on_loan' ? t('invCannotDeleteLoaned') : undefined}
			>
				<Trash2 size={13} /> {t('delete')}
			</button>
		</div>
	);
}
