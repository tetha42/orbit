import React, { useMemo } from 'react';
import { Info, MapPin, PackageCheck, PackageOpen, Tag, User, Copy, Eye } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { useContextMenu } from '@/core/shell';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import { returnStatus, returnText } from '@/lib/inventory';
import s from './Inventory.module.css';
import { trDate, type InventoryStatus, type InventoryItem } from '../types';
import type { LoanMode } from './LoanModal';

interface InventoryCardProps {
	item: InventoryItem;
	currentUserId?: string | null;
	isManager: boolean;
	isAlumni?: boolean;
	now: number;
	onDetail: (id: string) => void;
	onLoan: (loan: { id: string; mode: LoanMode }) => void;
}

export function InventoryCard({
	item,
	currentUserId,
	isManager,
	isAlumni = false,
	now,
	onDetail,
	onLoan,
}: InventoryCardProps) {
	const { t } = useI18n();
	const due = item.status === 'on_loan' ? returnStatus(item.returnDate, now) : null;
	const mine = item.loanFieldId === currentUserId;

	const menuItems = useMemo<MenuItem[]>(() => {
		const items: MenuItem[] = [
			{
				id: `inv-view-${item.id}`,
				label: t('ctxInvView'),
				icon: <Eye size={13} />,
				action: () => onDetail(item.id),
			},
			{
				id: `inv-copy-${item.id}`,
				label: t('ctxInvCopyBarcode'),
				icon: <Copy size={13} />,
				action: () => {
					void copyToClipboard(item.code);
				},
			},
		];

		if (item.status === 'available' && !isAlumni) {
			items.push({
				id: `inv-loan-${item.id}`,
				label: t('invActionBorrow'),
				icon: <PackageCheck size={13} />,
				action: () => onLoan({ id: item.id, mode: 'borrow' }),
			});
		} else if (item.status === 'on_loan' && (mine || isManager)) {
			items.push({
				id: `inv-return-${item.id}`,
				label: t('invActionReturn'),
				icon: <PackageOpen size={13} />,
				action: () => onLoan({ id: item.id, mode: 'return' }),
			});
		}

		return items;
	}, [item, mine, isManager, isAlumni, t, onDetail, onLoan]);

	const contextMenuProps = useContextMenu({ items: menuItems });

	const statusBadgeText = (d: InventoryStatus) => {
		switch (d) {
			case 'available': return t('invBadgeAvailable');
			case 'on_loan': return t('invBadgeOnLoan');
			case 'faulty': return t('invBadgeBroken');
			case 'lost': return t('invBadgeLost');
		}
	};

	return (
		<article
			className={`${s.card} ${due?.overdue ? s.cardOverdue : ''}`}
			data-focus-id={`item:${item.id}`}
			data-item-Code={item.code}
			{...contextMenuProps}
		>
			<div className={s.cardTop}>
				<span className={s.code}>{item.code}</span>
				<span className={`${s.badge} ${s[`b_${item.status}`]}`}>
					{statusBadgeText(item.status)}
				</span>
			</div>
			<button type="button" className={s.name} onClick={() => onDetail(item.id)}>
				{item.name}
			</button>
			<div className={s.meta}>
				<span>
					<Tag size={12} /> {item.category}
				</span>
				<span>
					<MapPin size={12} /> {item.location}
				</span>
			</div>
			{item.status === 'on_loan' && (
				<div className={`${s.loan} ${due?.overdue ? s.loanOverdue : ''}`}>
					<span>
						<User size={12} /> <strong>{mine ? t('invWithYou') : item.loanFieldNameSurname}</strong>
					</span>
					<span>
						{t('invDueReturnPrefix')} {item.returnDate ? trDate(item.returnDate) : '—'}{' '}
						<span
							className={`${s.due} ${due?.overdue ? s.dueLate : due && due.day <= 2 ? s.dueSoon : ''}`}
						>
							· {returnText(item.returnDate, now)}
						</span>
					</span>
				</div>
			)}
			<div className={s.actions}>
				{item.status === 'available' && !isAlumni && (
					<button
						type="button"
						className={s.btnPrimary}
						onClick={() => onLoan({ id: item.id, mode: 'borrow' })}
					>
						<PackageCheck size={14} /> {t('invActionBorrow')}
					</button>
				)}
				{item.status === 'on_loan' && (mine || isManager) && (
					<button
						type="button"
						className={s.btnSuccess}
						onClick={() => onLoan({ id: item.id, mode: 'return' })}
					>
						<PackageOpen size={14} /> {t('invActionReturn')}
					</button>
				)}
				{isManager && item.status === 'available' && (
					<button
						type="button"
						className={s.btnSecondary}
						onClick={() => onLoan({ id: item.id, mode: 'lend' })}
					>
						{t('invActionLendToMember')}
					</button>
				)}
				<button
					type="button"
					className={s.btnGhost}
					onClick={() => onDetail(item.id)}
					aria-label={t('invActionDetails')}
				>
					<Info size={14} /> {t('invActionDetails')}
				</button>
			</div>
		</article>
	);
}
