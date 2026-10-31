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
	const due = item.status === 'oduncte' ? returnStatus(item.iadeTarihi, now) : null;
	const mine = item.oduncAlanId === currentUserId;

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
					void copyToClipboard(item.kod);
				},
			},
		];

		if (item.status === 'saglam' && !isAlumni) {
			items.push({
				id: `inv-loan-${item.id}`,
				label: t('invActionBorrow'),
				icon: <PackageCheck size={13} />,
				action: () => onLoan({ id: item.id, mode: 'borrow' }),
			});
		} else if (item.status === 'oduncte' && (mine || isManager)) {
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
			case 'saglam': return t('invBadgeAvailable');
			case 'oduncte': return t('invBadgeOnLoan');
			case 'arizali': return t('invBadgeBroken');
			case 'kayip': return t('invBadgeLost');
		}
	};

	return (
		<article
			className={`${s.card} ${due?.gecikti ? s.cardOverdue : ''}`}
			data-focus-id={`item:${item.id}`}
			data-item-kod={item.kod}
			{...contextMenuProps}
		>
			<div className={s.cardTop}>
				<span className={s.code}>{item.kod}</span>
				<span className={`${s.badge} ${s[`b_${item.status}`]}`}>
					{statusBadgeText(item.status)}
				</span>
			</div>
			<button type="button" className={s.name} onClick={() => onDetail(item.id)}>
				{item.ad}
			</button>
			<div className={s.meta}>
				<span>
					<Tag size={12} /> {item.kategori}
				</span>
				<span>
					<MapPin size={12} /> {item.konum}
				</span>
			</div>
			{item.status === 'oduncte' && (
				<div className={`${s.loan} ${due?.gecikti ? s.loanOverdue : ''}`}>
					<span>
						<User size={12} /> <strong>{mine ? t('invWithYou') : item.oduncAlanAdSoyad}</strong>
					</span>
					<span>
						{t('invDueReturnPrefix')} {item.iadeTarihi ? trDate(item.iadeTarihi) : '—'}{' '}
						<span
							className={`${s.due} ${due?.gecikti ? s.dueLate : due && due.gun <= 2 ? s.dueSoon : ''}`}
						>
							· {returnText(item.iadeTarihi, now)}
						</span>
					</span>
				</div>
			)}
			<div className={s.actions}>
				{item.status === 'saglam' && !isAlumni && (
					<button
						type="button"
						className={s.btnPrimary}
						onClick={() => onLoan({ id: item.id, mode: 'borrow' })}
					>
						<PackageCheck size={14} /> {t('invActionBorrow')}
					</button>
				)}
				{item.status === 'oduncte' && (mine || isManager) && (
					<button
						type="button"
						className={s.btnSuccess}
						onClick={() => onLoan({ id: item.id, mode: 'return' })}
					>
						<PackageOpen size={14} /> {t('invActionReturn')}
					</button>
				)}
				{isManager && item.status === 'saglam' && (
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
