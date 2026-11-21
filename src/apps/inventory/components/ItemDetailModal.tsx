'use client';

import React, { useEffect, useRef } from 'react';
import { ArrowRightLeft, CalendarClock, Cpu, PackageCheck, PackageOpen } from 'lucide-react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useDialog } from '@/components/Common/DialogProvider';
import { returnStatus, returnText } from '@/lib/inventory';
import type { InventoryStatus } from '@/types/inventory';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import s from './Inventory.module.css';
import { trDate, type InventoryItem } from '../types';
import type { LoanMode } from './LoanModal';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import { ItemDetailHistory, type Movement } from './ItemDetailHistory';
import { ItemDetailManageBar } from './ItemDetailManageBar';
import { ItemDetailQrBox } from './ItemDetailQrBox';

/**
 * Everything about one item: facts, its QR label, the loan, the history, and —
 * for management — editing, status changes, lending on someone's behalf and deletion.
 */
export function ItemDetailModal({
	item,
	isManager,
	isAlumni = false,
	selfId,
	now,
	onClose,
	onLoan,
	onEdit,
	onChanged,
}: {
	item: InventoryItem;
	isManager: boolean;
	isAlumni?: boolean;
	selfId: string | null;
	now: number;
	onClose: () => void;
	onLoan: (mode: LoanMode) => void;
	onEdit: () => void;
	onChanged: (message: string, error?: boolean) => void;
}) {
	const { t } = useI18n();
	const dialog = useDialog();
	const dialogOpen = useRef(false);

	const { data: history, refetch } = useJsonResource<{ movements: Movement[] }>(
		`/api/inventory?history=${encodeURIComponent(item.id)}`,
	);

	const statusBadgeText = (d: InventoryStatus) => {
		switch (d) {
			case 'available': return t('invBadgeAvailable');
			case 'on_loan': return t('invBadgeOnLoan');
			case 'faulty': return t('invBadgeBroken');
			case 'lost': return t('invBadgeLost');
		}
	};

	useEffect(() => {
		void refetch();
	}, [item.status, item.dueDate, item.name, item.location, refetch]);

	const mine = !!selfId && item.holderUserId === selfId;
	const due = item.status === 'on_loan' ? returnStatus(item.dueDate, now) : null;

	const confirm = async (message: string, tone: 'danger' | 'warning' = 'warning') => {
		dialogOpen.current = true;
		try {
			return await dialog.confirm({ message, tone });
		} finally {
			dialogOpen.current = false;
		}
	};

	const setStatus = async (status: 'available' | 'faulty' | 'lost') => {
		const text = { available: t('invStatusAvailable'), faulty: t('invStatusFaulty'), lost: t('invStatusLost') }[status];
		const notice = item.status === 'on_loan' && status === 'lost'
			? fill(t('invStatusLostLoanNotice'), { name: item.holderName ?? '' })
			: '';
		if (!(await confirm(`${fill(t('invStatusChangeConfirm'), { code: item.code, status: text })}${notice}`)))
			return;
		const res = await sendJson<{ message?: string }>('/api/inventory', 'POST', {
			action: 'updateStatus',
			inventoryId: item.id,
			status,
		});
		onChanged(
			res.ok ? res.data.message || t('invUpdated') : res.error || t('invUpdateFailed'),
			!res.ok,
		);
	};

	const remove = async () => {
		if (!(await confirm(fill(t('invDeleteConfirm'), { code: item.code, name: item.name }), 'danger')))
			return;
		const res = await sendJson<{ message?: string }>('/api/inventory', 'POST', {
			action: 'delete',
			inventoryId: item.id,
		});
		if (res.ok) {
			onClose();
			onChanged(t('invItemDeleted'));
		} else onChanged(res.error || t('invUpdateFailed'), true);
	};

	return (
		<Sheet
			pausedRef={dialogOpen}
			header={
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
						<span className={s.code}>{item.code}</span>
						<span className={`${s.badge} ${s[`b_${item.status}`]}`} style={{ marginLeft: 0 }}>
							{statusBadgeText(item.status)}
						</span>
					</div>
					<h3 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 780 }}>{item.name}</h3>
				</div>
			}
			label={`${item.code} ${t('invDetailsBtn').toLowerCase()}`}
			icon={<Cpu size={18} color="var(--accent)" />}
			onClose={onClose}
			maxWidth={780}
			wide
		>
			<div className={s.detailGrid}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
					<dl className={s.facts}>
						<dt>{t('invColCategory')}</dt>
						<dd>{item.category}</dd>
						<dt>{t('invLocationLabel')}</dt>
						<dd>{item.location}</dd>
						{item.serialNo && (
							<>
								<dt>{t('invSerialOptional')}</dt>
								<dd style={{ fontFamily: 'ui-monospace, monospace' }}>{item.serialNo}</dd>
							</>
						)}
						{item.description && (
							<>
								<dt>{t('description')}</dt>
								<dd style={{ whiteSpace: 'pre-wrap' }}>{item.description}</dd>
							</>
						)}
					</dl>
					{item.status === 'on_loan' && (
						<div className={`${s.loan} ${due?.overdue ? s.loanOverdue : ''}`}>
							<span>
								<strong>{t('invAssigned')}:</strong> {item.holderName ?? '—'}
								{mine && ` (${t('invWithYou').toLowerCase()})`}
							</span>
							<span>
								{item.loanDate ? `${trDate(item.loanDate)} → ` : ''}
								{item.dueDate ? trDate(item.dueDate) : '—'}{' '}
								<span className={`${s.due} ${due?.overdue ? s.dueLate : due && due.day <= 2 ? s.dueSoon : ''}`}>
									· {returnText(item.dueDate, now)}
								</span>
							</span>
						</div>
					)}
					<div className={ui.btnRow} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
						{item.status === 'available' && !isAlumni && (
							<button type="button" className={ui.primaryBtn} onClick={() => onLoan('borrow')}>
								<PackageOpen size={14} /> {t('invBorrowBtn')}
							</button>
						)}
						{item.status === 'available' && isManager && (
							<button type="button" className={ui.btn} onClick={() => onLoan('lend')}>
								<ArrowRightLeft size={14} /> {t('invLendForMember')}
							</button>
						)}
						{item.status === 'on_loan' && (mine || isManager) && (
							<>
								<button type="button" className={ui.primaryBtn} onClick={() => onLoan('return')}>
									<PackageCheck size={14} /> {t('invReturnBtn')}
								</button>
								<button type="button" className={ui.btn} onClick={() => onLoan('extend')}>
									<CalendarClock size={14} /> {t('invExtendLoan')}
								</button>
							</>
						)}
					</div>
				</div>
				<ItemDetailQrBox item={item} />
			</div>

			{isManager && (
				<ItemDetailManageBar
					item={item}
					onEdit={onEdit}
					onSetStatus={(st) => void setStatus(st)}
					onRemove={() => void remove()}
				/>
			)}

			<ItemDetailHistory itemCode={item.code} history={history} />
		</Sheet>
	);
}
