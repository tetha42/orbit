'use client';

import React from 'react';
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Copy, ExternalLink, Pencil, Receipt, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatKurus } from '@/lib/budget';
import { formatDate } from '@/core/data/format';
import { useContextMenu } from '@/core/shell/useContextMenu';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import type { VaultRecord } from '../types';
import k from './Kasa.module.css';

interface VaultLedgerTableProps {
	records: VaultRecord[];
	filtered: VaultRecord[];
	balances: Map<string, number>;
	isLoading: boolean;
	canWrite: boolean;
	isManagement: boolean;
	anyFilter: boolean;
	filteredIn: number;
	filteredOut: number;
	onEdit: (r: VaultRecord) => void;
	onDelete: (r: VaultRecord) => void;
}

const tl = (kurus: number) => `₺${formatKurus(kurus)}`;
const dateFmt = (ms: number) => formatDate(ms);

interface VaultRowProps {
	r: VaultRecord;
	balance: number;
	lockedForMe: boolean;
	canWrite: boolean;
	isManagement: boolean;
	language: string;
	onEdit: (r: VaultRecord) => void;
	onDelete: (r: VaultRecord) => void;
}

function VaultTableRow({ r, balance, lockedForMe, language, onEdit, onDelete }: VaultRowProps) {
	const { t } = useI18n();
	const transfer = !!r.aktarimId;

	const menuItems: MenuItem[] = [
		{
			id: 'copy-desc',
			label: t('ctxBudgetCopyDesc'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(r.aciklama),
		},
		{
			id: 'copy-amount',
			label: t('ctxBudgetCopyAmount'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(tl(r.tutarKurus)),
		},
	];

	if (r.fisFotoUrl) {
		menuItems.push({
			id: 'view-receipt',
			label: t('ctxBudgetViewReceipt'),
			icon: <ExternalLink size={13} />,
			action: () => window.open(r.fisFotoUrl, '_blank', 'noopener,noreferrer'),
		});
	}

	if (!lockedForMe) {
		menuItems.push(
			{ id: 'sep-budget-actions', label: '', separator: true },
			{
				id: 'edit-entry',
				label: t('edit'),
				icon: <Pencil size={13} />,
				action: () => onEdit(r),
			},
			{
				id: 'delete-entry',
				label: transfer ? t('dlgRevoke') : t('delete'),
				icon: <Trash2 size={13} />,
				danger: true,
				action: () => onDelete(r),
			}
		);
	}

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<tr key={r.id} data-focus-id={`kasa-row:${r.id}`} {...contextMenuProps}>
			<td className={k.date}>{dateFmt(r.date)}</td>
			<td>
				{transfer ? (
					<span className={`${k.tag} ${k.tagTransfer}`}>
						<ArrowRightLeft size={11} /> {r.tur === 'gelir' ? t('kasaTagTransferIn') : t('kasaTagTransferOut')}
					</span>
				) : (
					<span className={`${k.tag} ${r.tur === 'gelir' ? k.tagIn : k.tagOut}`}>
						{r.tur === 'gelir' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
						{r.tur === 'gelir' ? t('kasaTagIncome') : t('kasaTagExpense')}
					</span>
				)}
			</td>
			<td style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>{r.kategori}</td>
			<td>
				<div className={k.desc}>{r.aciklama}</div>
				{(transfer || r.fisFotoUrl || r.guncellenme) && (
					<div className={k.sub}>
						{transfer && (
							<span>
								{r.tur === 'gelir'
									? `${t('kasaSource')} ${r.karsiKasaAd}`
									: `${t('kasaTarget')} ${r.karsiKasaAd}`}
							</span>
						)}
						{r.fisFotoUrl && (
							<a
								className={k.receipt}
								href={r.fisFotoUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								<Receipt size={11} /> {t('kasaReceipt')}
							</a>
						)}
						{r.guncellenme && (
							<span title={new Date(r.guncellenme).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')}>
								{t('kasaEdited')}{r.guncelleyenAdSoyad ? ` · ${r.guncelleyenAdSoyad}` : ''}
							</span>
						)}
					</div>
				)}
			</td>
			<td className={k.colUser} style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
				{r.kaydedenAdSoyad ?? '—'}
			</td>
			<td className={`${k.num} ${r.tur === 'gelir' ? k.pos : k.neg}`} style={{ fontWeight: 750 }}>
				{r.tur === 'gelir' ? '+' : '−'}
				{tl(r.tutarKurus)}
			</td>
			<td className={`${k.num} ${k.colBalance}`} style={{ color: 'var(--text-secondary)' }}>
				{tl(balance)}
			</td>
			<td>
				{!lockedForMe && (
					<div className={k.actions}>
						<button
							type="button"
							className={k.rowBtn}
							onClick={() => onEdit(r)}
							aria-label={`${t('edit')}: ${r.aciklama}`}
							title={t('edit')}
						>
							<Pencil size={14} />
						</button>
						<button
							type="button"
							className={`${k.rowBtn} ${k.rowBtnDanger}`}
							onClick={() => onDelete(r)}
							aria-label={`${t('delete')}: ${r.aciklama}`}
							title={transfer ? t('dlgRevoke') : t('delete')}
						>
							<Trash2 size={14} />
						</button>
					</div>
				)}
			</td>
		</tr>
	);
}

function VaultMobileCard({ r, lockedForMe, onEdit, onDelete }: Omit<VaultRowProps, 'balance'>) {
	const { t } = useI18n();
	const transfer = !!r.aktarimId;

	const menuItems: MenuItem[] = [
		{
			id: 'copy-desc',
			label: t('ctxBudgetCopyDesc'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(r.aciklama),
		},
		{
			id: 'copy-amount',
			label: t('ctxBudgetCopyAmount'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(tl(r.tutarKurus)),
		},
	];

	if (r.fisFotoUrl) {
		menuItems.push({
			id: 'view-receipt',
			label: t('ctxBudgetViewReceipt'),
			icon: <ExternalLink size={13} />,
			action: () => window.open(r.fisFotoUrl, '_blank', 'noopener,noreferrer'),
		});
	}

	if (!lockedForMe) {
		menuItems.push(
			{ id: 'sep-mob-budget', label: '', separator: true },
			{
				id: 'edit-entry',
				label: t('edit'),
				icon: <Pencil size={13} />,
				action: () => onEdit(r),
			},
			{
				id: 'delete-entry',
				label: transfer ? t('dlgRevoke') : t('delete'),
				icon: <Trash2 size={13} />,
				danger: true,
				action: () => onDelete(r),
			}
		);
	}

	const contextMenuProps = useContextMenu({ items: menuItems });

	return (
		<div
			className="cv-auto-card"
			{...contextMenuProps}
			style={{
				background: 'var(--card-bg)',
				border: '1px solid var(--card-border)',
				borderRadius: '12px',
				padding: '12px 14px',
				display: 'flex',
				flexDirection: 'column',
				gap: '8px',
				boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
				{transfer ? (
					<span className={`${k.tag} ${k.tagTransfer}`}>
						<ArrowRightLeft size={11} /> {r.tur === 'gelir' ? t('kasaTagTransferIn') : t('kasaTagTransferOut')}
					</span>
				) : (
					<span className={`${k.tag} ${r.tur === 'gelir' ? k.tagIn : k.tagOut}`}>
						{r.tur === 'gelir' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
						{r.tur === 'gelir' ? t('kasaTagIncome') : t('kasaTagExpense')}
					</span>
				)}
				<span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{dateFmt(r.date)}</span>
			</div>

			<div style={{ fontWeight: 650, fontSize: '14px', color: 'var(--text-primary)' }}>
				{r.aciklama}
			</div>

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
				<span>{r.kategori} · {r.kaydedenAdSoyad ?? '—'}</span>
				<span className={`${r.tur === 'gelir' ? k.pos : k.neg}`} style={{ fontWeight: 800, fontSize: '15px' }}>
					{r.tur === 'gelir' ? '+' : '−'}{tl(r.tutarKurus)}
				</span>
			</div>

			{(transfer || r.fisFotoUrl || !lockedForMe) && (
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--card-border)' }}>
					<div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
						{transfer && (
							<span>
								{r.tur === 'gelir' ? `${t('kasaSource')} ${r.karsiKasaAd}` : `${t('kasaTarget')} ${r.karsiKasaAd}`}
							</span>
						)}
						{r.fisFotoUrl && (
							<a
								className={k.receipt}
								href={r.fisFotoUrl}
								target="_blank"
								rel="noopener noreferrer"
								style={{ marginLeft: transfer ? '8px' : 0 }}
							>
								<Receipt size={11} /> {t('kasaReceipt')}
							</a>
						)}
					</div>

					{!lockedForMe && (
						<div className={k.actions}>
							<button
								type="button"
								className={k.rowBtn}
								onClick={() => onEdit(r)}
								title={t('edit')}
							>
								<Pencil size={13} />
							</button>
							<button
								type="button"
								className={`${k.rowBtn} ${k.rowBtnDanger}`}
								onClick={() => onDelete(r)}
								title={transfer ? t('dlgRevoke') : t('delete')}
							>
								<Trash2 size={13} />
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export function VaultLedgerTable({
	records,
	filtered,
	balances,
	isLoading,
	canWrite,
	isManagement,
	anyFilter,
	filteredIn,
	filteredOut,
	onEdit,
	onDelete,
}: VaultLedgerTableProps) {
	const { t, language } = useI18n();
	const [isMobile, setIsMobile] = React.useState(false);

	React.useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	if (isMobile) {
		return (
			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', padding: '10px 14px 32px' }}>
				{filtered.length === 0 && (
					<div style={{ padding: '36px 16px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
						{isLoading
							? t('loading')
							: records.length === 0
								? t('kasaEmptyLedger')
								: t('kasaNoMatch')}
					</div>
				)}
				{filtered.map((r) => {
					const transfer = !!r.aktarimId;
					const lockedForMe = !canWrite || (transfer && !isManagement);
					return (
						<VaultMobileCard
							key={r.id}
							r={r}
							lockedForMe={lockedForMe}
							canWrite={canWrite}
							isManagement={isManagement}
							language={language}
							onEdit={onEdit}
							onDelete={onDelete}
						/>
					);
				})}
			</div>
		);
	}

	return (
		<div className={k.ledger} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
			<table className={k.table} style={{ minWidth: '650px' }}>
				<thead>
					<tr>
						<th>{t('budgetColDate')}</th>
						<th>{t('budgetColType')}</th>
						<th>{t('budgetColCategory')}</th>
						<th style={{ width: '40%' }}>{t('budgetColTitle')}</th>
						<th className={k.colUser}>{t('budgetColUser')}</th>
						<th className={k.num}>{t('budgetColAmount')}</th>
						<th className={`${k.num} ${k.colBalance}`}>{t('kasaBalance')}</th>
						<th aria-label={t('actions')} />
					</tr>
				</thead>
				<tbody>
					{filtered.length === 0 && (
						<tr>
							<td colSpan={8} className={k.emptyRow}>
								{isLoading
									? t('loading')
									: records.length === 0
										? t('kasaEmptyLedger')
										: t('kasaNoMatch')}
							</td>
						</tr>
					)}
					{filtered.map((r) => {
						const transfer = !!r.aktarimId;
						const lockedForMe = !canWrite || (transfer && !isManagement);
						return (
							<VaultTableRow
								key={r.id}
								r={r}
								balance={balances.get(r.id) ?? 0}
								lockedForMe={lockedForMe}
								canWrite={canWrite}
								isManagement={isManagement}
								language={language}
								onEdit={onEdit}
								onDelete={onDelete}
							/>
						);
					})}
				</tbody>
				{filtered.length > 0 && anyFilter && (
					<tfoot>
						<tr className={k.foot}>
							<td colSpan={5}>{t('kasaFilteredTotal').replace('{n}', String(filtered.length))}</td>
							<td className={`${k.num} ${filteredIn - filteredOut >= 0 ? k.pos : k.neg}`}>
								{filteredIn - filteredOut >= 0 ? '+' : '−'}
								{tl(Math.abs(filteredIn - filteredOut))}
							</td>
							<td className={k.colBalance} />
							<td />
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}
