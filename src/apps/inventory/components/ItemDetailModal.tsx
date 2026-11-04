'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import {
	ArrowRightLeft,
	CalendarClock,
	CircleAlert,
	Cpu,
	History,
	PackageCheck,
	PackageOpen,
	Pencil,
	PlusCircle,
	Printer,
	Trash2,
	Wrench,
} from 'lucide-react';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useDialog } from '@/components/Common/DialogProvider';
import { returnStatus, returnText } from '@/lib/inventory';
import type { InventoryStatus } from '@/types/inventory';
import ui from '@/core/ui/ui.module.css';
import { sendJson } from '@/core/data/http';
import s from './Inventory.module.css';
import { trDate, type InventoryItem } from '../types';
import type { LoanMode } from './LoanModal';
import { escapeHtml } from '@/core/text/escape';
import { openPrintWindow } from '@/core/data/print';
import { Sheet } from '@/core/ui/Sheet';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';

interface Movement {
	id: string;
	typeValue: 'ekle' | 'odunc' | 'iade' | 'uzat' | 'status' | 'duzenle';
	actorNameSurname: string | null;
	userNameSurname: string | null;
	description: string | null;
	date: number;
}

const EVENT_ICONS: Record<Movement['typeValue'], typeof History> = {
	ekle: PlusCircle,
	odunc: PackageOpen,
	iade: PackageCheck,
	uzat: CalendarClock,
	status: Wrench,
	duzenle: Pencil,
};

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
	const { t, language } = useI18n();
	const dialog = useDialog();
	const dialogOpen = useRef(false);

	const getEventLabel = (h: Movement) => {
		switch (h.typeValue) {
			case 'ekle':
				return fill(t('invItemAdded'), { code: item.code });
			case 'odunc':
				return fill(t('invActionLoan'), { name: h.userNameSurname ?? t('invMemberFallback') });
			case 'iade':
				return fill(t('invActionReturned'), { name: h.userNameSurname ?? t('invBorrowerFallback') });
			case 'uzat':
				return t('invActionExtend');
			case 'status':
				return t('invActionStatus');
			case 'duzenle':
			default:
				return t('invActionEdit');
		}
	};
	const { data: history, refetch } = useJsonResource<{ movements: Movement[] }>(
		`/api/inventory?gecmis=${encodeURIComponent(item.id)}`,
	);
	const [qr, setQr] = useState('');

	const statusBadgeText = (d: InventoryStatus) => {
		switch (d) {
			case 'saglam': return t('invBadgeAvailable');
			case 'oduncte': return t('invBadgeOnLoan');
			case 'arizali': return t('invBadgeBroken');
			case 'kayip': return t('invBadgeLost');
		}
	};

	useEffect(() => {
		let live = true;
		QRCode.toDataURL(item.code, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then(
			(url) => live && setQr(url),
		);
		return () => {
			live = false;
		};
	}, [item.code]);

	// The list behind refreshes after an action; the history here follows it.
	useEffect(() => {
		void refetch();
	}, [item.status, item.returnDate, item.name, item.location, refetch]);

	const mine = !!selfId && item.loanFieldId === selfId;
	const due = item.status === 'oduncte' ? returnStatus(item.returnDate, now) : null;

	const confirm = async (message: string, tone: 'danger' | 'warning' = 'warning') => {
		dialogOpen.current = true;
		try {
			return await dialog.confirm({ message, tone });
		} finally {
			dialogOpen.current = false;
		}
	};

	const setStatus = async (status: 'saglam' | 'arizali' | 'kayip') => {
		const text = { saglam: t('invStatusAvailable'), arizali: t('invStatusFaulty'), kayip: t('invStatusLost') }[status];
		if (
			!(await confirm(
				`${fill(t('invStatusChangeConfirm'), { code: item.code, status: text })}${item.status === 'oduncte' && status === 'kayip' ? fill(t('invStatusLostLoanNotice'), { name: item.loanFieldNameSurname }) : ''}`,
			))
		)
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
		if (
			!(await confirm(
				fill(t('invDeleteConfirm'), { code: item.code, name: item.name }),
				'danger',
			))
		)
			return;
		const res = await sendJson<{ message?: string }>('/api/inventory', 'POST', {
			action: 'delete',
			inventoryId: item.id,
		});
		if (res.ok) {
			onClose();
			onChanged(t('invItemDeleted'));
		} else onChanged(res.error || 'Silinemedi.', true);
	};

	const printLabel = () => {
		openPrintWindow({
			title: item.code,
			width: 420,
			height: 520,
			css: 'body{display:grid;place-items:center;min-height:90vh}.label{border:1px dashed #999;padding:14px 18px;text-align:center;width:220px}.kod{font:700 16px ui-monospace,monospace;margin-top:6px}',
			body:
				`<div class="label"><img src="${qr}" width="160" height="160" alt=""><div class="kod">${escapeHtml(item.code)}</div>` +
				`<div style="font-size:11px;margin-top:4px">${escapeHtml(item.name)}</div><div class="muted" style="font-size:10px;margin-top:2px">${escapeHtml(item.location)}</div></div>`,
		});
	};

	return (
		<Sheet
			pausedRef={dialogOpen}
			header={
				<>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
							<span className={s.code}>{item.code}</span>
							<span className={`${s.badge} ${s[`b_${item.status}`]}`} style={{ marginLeft: 0 }}>
								{statusBadgeText(item.status)}
							</span>
						</div>
						<h3 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 780 }}>{item.name}</h3>
					</div>
				</>
			}
			label={`${item.code} ${t('invDetailsBtn').toLowerCase()}`}
			icon={<Cpu size={18} color="#0a84ff" />}
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
						{item.seriesNo && (
							<>
								<dt>{t('invSerialOptional')}</dt>
								<dd style={{ fontFamily: 'ui-monospace, monospace' }}>{item.seriesNo}</dd>
							</>
						)}
						{item.description && (
							<>
								<dt>{t('description')}</dt>
								<dd style={{ whiteSpace: 'pre-wrap' }}>{item.description}</dd>
							</>
						)}
					</dl>
					{item.status === 'oduncte' && (
						<div className={`${s.loan} ${due?.gecikti ? s.loanOverdue : ''}`}>
							<span>
								<strong>{t('invAssigned')}:</strong> {item.loanFieldNameSurname ?? '—'}
								{mine && ` (${t('invWithYou').toLowerCase()})`}
							</span>
							<span>
								{item.loanDate ? `${trDate(item.loanDate)} → ` : ''}
								{item.returnDate ? trDate(item.returnDate) : '—'}{' '}
								<span
									className={`${s.due} ${due?.gecikti ? s.dueLate : due && due.day <= 2 ? s.dueSoon : ''}`}
								>
									· {returnText(item.returnDate, now)}
								</span>
							</span>
						</div>
					)}
					<div className={ui.btnRow} style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
						{item.status === 'saglam' && !isAlumni && (
							<button type="button" className={ui.primaryBtn} onClick={() => onLoan('borrow')}>
								<PackageOpen size={14} /> {t('invBorrowBtn')}
							</button>
						)}
						{item.status === 'saglam' && isManager && (
							<button type="button" className={ui.btn} onClick={() => onLoan('lend')}>
								<ArrowRightLeft size={14} /> {t('invLendForMember')}
							</button>
						)}
						{item.status === 'oduncte' && (mine || isManager) && (
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
				<div className={s.qrBox}>
					{qr ? (
						<Image src={qr} alt={`${item.code} karekodu`} width={150} height={150} unoptimized />
					) : (
						<div style={{ width: 150, height: 150 }} />
					)}
					<strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
						{item.code}
					</strong>
					<button
						type="button"
						className={ui.btn}
						onClick={printLabel}
						disabled={!qr}
						style={{ color: '#111', background: '#f2f2f7' }}
					>
						<Printer size={13} /> {t('invPrintQr')}
					</button>
				</div>
			</div>

			{isManager && (
				<div className={s.manage} aria-label={t('invManageSection').replace(':', '')}>
					<strong style={{ fontSize: 12.5 }}>{t('invManageSection')}</strong>
					<button type="button" className={ui.btn} onClick={onEdit}>
						<Pencil size={13} /> {t('edit')}
					</button>
					{item.status !== 'saglam' && item.status !== 'oduncte' && (
						<button type="button" className={ui.btn} onClick={() => setStatus('saglam')}>
							<Wrench size={13} /> {t('invMarkRepaired')}
						</button>
					)}
					{item.status === 'saglam' && (
						<button type="button" className={ui.btn} onClick={() => setStatus('arizali')}>
							<CircleAlert size={13} /> {t('invMarkBroken')}
						</button>
					)}
					{item.status !== 'kayip' && (
						<button type="button" className={ui.btn} onClick={() => setStatus('kayip')}>
							{t('invMarkLost')}
						</button>
					)}
					<span className={s.spacer} />
					<button
						type="button"
						className={`${ui.btn} ${ui.btnDanger}`}
						onClick={remove}
						disabled={item.status === 'oduncte'}
						title={item.status === 'oduncte' ? t('invCannotDeleteLoaned') : undefined}
					>
						<Trash2 size={13} /> {t('delete')}
					</button>
				</div>
			)}

			<section aria-label={t('invHistoryTitle')}>
				<h4 className={ui.sectionTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<History size={14} /> {t('invHistoryTitle')}
				</h4>
				{!history && <div className={ui.muted}>{t('loading')}</div>}
				{history && history.movements.length === 0 && (
					<div className={ui.muted}>
						{t('invNoHistory')}
					</div>
				)}
				<ol className={s.timeline}>
					{history?.movements.map((h) => {
						const Icon = EVENT_ICONS[h.typeValue] ?? Pencil;
						return (
							<li key={h.id} className={s.event}>
								<span className={s.eventIcon}>
									<Icon size={13} />
								</span>
								<div>
									<div className={s.eventTitle}>{getEventLabel(h)}</div>
									{h.description && <div>{h.description}</div>}
									<div className={s.eventMeta}>
										{new Date(h.date).toLocaleString(language, {
											day: '2-digit',
											month: '2-digit',
											year: 'numeric',
											hour: '2-digit',
											minute: '2-digit',
										})}
										{h.actorNameSurname ? ` · ${h.actorNameSurname}` : ''}
									</div>
								</div>
							</li>
						);
					})}
				</ol>
			</section>
		</Sheet>
	);
}
