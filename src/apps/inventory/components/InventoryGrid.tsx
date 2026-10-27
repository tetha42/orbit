import React from 'react';
import { useI18n } from '@/core/i18n';
import s from './Inventory.module.css';
import { InventoryCard } from './InventoryCard';
import type { InventoryItem } from '../types';
import type { LoanMode } from './LoanModal';

interface InventoryGridProps {
	data: InventoryItem[] | null;
	visible: InventoryItem[];
	totalCount: number;
	currentUserId?: string | null;
	isManager: boolean;
	isMezun?: boolean;
	now: number;
	onDetail: (id: string) => void;
	onLoan: (loan: { id: string; mode: LoanMode }) => void;
}

export function InventoryGrid({
	data,
	visible,
	totalCount,
	currentUserId,
	isManager,
	isMezun = false,
	now,
	onDetail,
	onLoan,
}: InventoryGridProps) {
	const { t } = useI18n();

	if (data === null) {
		return <div className={s.empty}>{t('loading')}</div>;
	}

	if (visible.length === 0) {
		return (
			<div className={s.empty}>
				{totalCount === 0 ? t('invEmptyShelf') : t('invNoFilterMatch')}
			</div>
		);
	}

	return (
		<div className={s.grid}>
			{visible.map((item) => (
				<InventoryCard
					key={item.id}
					item={item}
					currentUserId={currentUserId}
					isManager={isManager}
					isMezun={isMezun}
					now={now}
					onDetail={onDetail}
					onLoan={onLoan}
				/>
			))}
		</div>
	);
}
