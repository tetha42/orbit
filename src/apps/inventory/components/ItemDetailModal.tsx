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

interface Hareket {
	id: string;
	tur: 'ekle' | 'odunc' | 'iade' | 'uzat' | 'status' | 'duzenle';
	aktorAdSoyad: string | null;
	kullaniciAdSoyad: string | null;
	aciklama: string | null;
	date: number;
}

const EVENT_ICONS: Record<Hareket['tur'], typeof History> = {
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

	const getEventLabel = (h: Hareket) => {
		switch (h.tur) {
			case 'ekle':
				return fill(t('invItemAdded'), { code: item.kod });
			case 'odunc':
				return fill(t('invActionLoan'), { name: h.kullaniciAdSoyad ?? t('invMemberFallback') });
			case 'iade':
				return fill(t('invActionReturned'), { name: h.kullaniciAdSoyad ?? t('invBorrowerFallback') });
			case 'uzat':
				return t('invActionExtend');
			case 'status':
				return t('invActionStatus');
			case 'duzenle':
			default:
				return t('invActionEdit');
		}
	};
	const { data: history, refetch } = useJsonResource<{ hareketler: Hareket[] }>(
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
		QRCode.toDataURL(item.kod, { margin: 1, width: 320, errorCorrectionLevel: 'M' }).then(
			(url) => live && setQr(url),
		);
		return () => {
			live = false;
		};
	}, [item.kod]);

	// The list behind refreshes after an action; the history here follows it.
	useEffect(() => {
		void refetch();
	}, [item.status, item.iadeTarihi, item.ad, item.konum, refetch]);

	const mine = !!selfId && item.oduncAlanId === selfId;
	const due = item.status === 'oduncte' ? returnStatus(item.iadeTarihi, now) : null;

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
				`${fill(t('invStatusChangeConfirm'), { code: item.kod, status: text })}${item.status === 'oduncte' && status === 'kayip' ? fill(t('invStatusLostLoanNotice'), { name: item.oduncAlanAdSoyad }) : ''}`,
			))
		)
			return;
		const res = await sendJson<{ message?: string }>('/api/inventory', 'POST', {
			action: 'updateDurum',
			envanterId: item.id,
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
				fill(t('invDeleteConfirm'), { code: item.kod, name: item.ad }),
				'danger',
			))
		)
			return;
		const res = await sendJson<{ message?: string }>('/api/inventory', 'POST', {
			action: 'delete',
			envanterId: item.id,
		});
		if (res.ok) {
			onClose();
			onChanged(t('invItemDeleted'));
		} else onChanged(res.error || 'Silinemedi.', true);
	};

	const printLabel = () => {
		openPrintWindow({
			title: item.kod,
			width: 420,
			height: 520,
			css: 'body{display:grid;place-items:center;min-height:90vh}.label{border:1px dashed #999;padding:14px 18px;text-align:center;width:220px}.kod{font:700 16px ui-monospace,monospace;margin-top:6px}',
			body:
				`<div class="label"><img src="${qr}" width="160" height="160" alt=""><div class="kod">${escapeHtml(item.kod)}</div>` +
				`<div style="font-size:11px;margin-top:4px">${escapeHtml(item.ad)}</div><div class="muted" style="font-size:10px;margin-top:2px">${escapeHtml(item.konum)}</div></div>`,
		});
	};

	return (
		<Sheet
			pausedRef={dialogOpen}
			header={
				<>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
							<span className={s.code}>{item.kod}</span>
							<span className={`${s.badge} ${s[`b_${item.status}`]}`} style={{ marginLeft: 0 }}>
								{statusBadgeText(item.status)}
							</span>
						</div>
						<h3 style={{ margin: '4px 0 0', fontSize: 17, fontWeight: 780 }}>{item.ad}</h3>
					</div>
				</>
			}
			label={`${item.kod} ${t('invDetailsBtn').toLowerCase()}`}
			icon={<Cpu size={18} color="#0a84ff" />}
			onClose={onClose}
			maxWidth={780}
			wide
		>
			<div className={s.detailGrid}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
					<dl className={s.facts}>
						<dt>{t('invColCategory')}</dt>
						<dd>{item.kategori}</dd>
						<dt>{t('invLocationLabel')}</dt>
						<dd>{item.konum}</dd>
						{item.seriNo && (
							<>
								<dt>{t('invSerialOptional')}</dt>
								<dd style={{ fontFamily: 'ui-monospace, monospace' }}>{item.seriNo}</dd>
							</>
						)}
						{item.aciklama && (
							<>
								<dt>{t('description')}</dt>
								<dd style={{ whiteSpace: 'pre-wrap' }}>{item.aciklama}</dd>
							</>
						)}
					</dl>
					{item.status === 'oduncte' && (
						<div className={`${s.loan} ${due?.gecikti ? s.loanOverdue : ''}`}>
							<span>
								<strong>{t('invAssigned')}:</strong> {item.oduncAlanAdSoyad ?? '—'}
								{mine && ` (${t('invWithYou').toLowerCase()})`}
							</span>
							<span>
								{item.oduncTarihi ? `${trDate(item.oduncTarihi)} → ` : ''}
								{item.iadeTarihi ? trDate(item.iadeTarihi) : '—'}{' '}
								<span
									className={`${s.due} ${due?.gecikti ? s.dueLate : due && due.gun <= 2 ? s.dueSoon : ''}`}
								>
									· {returnText(item.iadeTarihi, now)}
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
						<Image src={qr} alt={`${item.kod} karekodu`} width={150} height={150} unoptimized />
					) : (
						<div style={{ width: 150, height: 150 }} />
					)}
					<strong style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
						{item.kod}
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
				{history && history.hareketler.length === 0 && (
					<div className={ui.muted}>
						{t('invNoHistory')}
					</div>
				)}
				<ol className={s.timeline}>
					{history?.hareketler.map((h) => {
						const Icon = EVENT_ICONS[h.tur] ?? Pencil;
						return (
							<li key={h.id} className={s.event}>
								<span className={s.eventIcon}>
									<Icon size={13} />
								</span>
								<div>
									<div className={s.eventTitle}>{getEventLabel(h)}</div>
									{h.aciklama && <div>{h.aciklama}</div>}
									<div className={s.eventMeta}>
										{new Date(h.date).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US', {
											day: '2-digit',
											month: '2-digit',
											year: 'numeric',
											hour: '2-digit',
											minute: '2-digit',
										})}
										{h.aktorAdSoyad ? ` · ${h.aktorAdSoyad}` : ''}
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
