'use client';

import React from 'react';
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Copy, ExternalLink, Pencil, Receipt, Trash2 } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import { formatDate } from '@/core/data/format';
import { useContextMenu } from '@/core/shell/useContextMenu';
import { copyToClipboard } from '@/lib/clipboard';
import type { MenuItem } from '@/types/workspace';
import type { VaultRecord } from '../types';
import { categoryLabel } from '../categoryLabel';
import k from './Vault.module.css';

const tl = (minor: number) => `₺${formatMinor(minor)}`;

export interface VaultRowProps {
	r: VaultRecord;
	balance: number;
	lockedForMe: boolean;
	language: string;
	onEdit: (r: VaultRecord) => void;
	onDelete: (r: VaultRecord) => void;
}

export function VaultTableRow({ r, balance, lockedForMe, language, onEdit, onDelete }: VaultRowProps) {
	const { t } = useI18n();
	const transfer = !!r.transferId;

	const menuItems: MenuItem[] = [
		{
			id: 'copy-desc',
			label: t('ctxBudgetCopyDesc'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(r.description),
		},
		{
			id: 'copy-amount',
			label: t('ctxBudgetCopyAmount'),
			icon: <Copy size={13} />,
			action: () => copyToClipboard(tl(r.amountMinor)),
		},
	];

	const receiptUrl = r.receiptUrl;
	if (receiptUrl) {
		menuItems.push({
			id: 'view-receipt',
			label: t('ctxBudgetViewReceipt'),
			icon: <ExternalLink size={13} />,
			action: () => window.open(receiptUrl, '_blank', 'noopener,noreferrer'),
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
		<tr data-focus-id={`vault-row:${r.id}`} {...contextMenuProps}>
			<td className={k.date}>{formatDate(r.date)}</td>
			<td>
				{transfer ? (
					<span className={`${k.tag} ${k.tagTransfer}`}>
						<ArrowRightLeft size={11} /> {r.type === 'income' ? t('treasuryTagTransferIn') : t('treasuryTagTransferOut')}
					</span>
				) : (
					<span className={`${k.tag} ${r.type === 'income' ? k.tagIn : k.tagOut}`}>
						{r.type === 'income' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
						{r.type === 'income' ? t('treasuryTagIncome') : t('treasuryTagExpense')}
					</span>
				)}
			</td>
			<td style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>{categoryLabel(t, r.category)}</td>
			<td>
				<div className={k.desc}>{r.description}</div>
				{(transfer || r.receiptUrl || r.updatedAt) && (
					<div className={k.sub}>
						{transfer && (
							<span>
								{r.type === 'income'
									? `${t('treasurySource')} ${r.counterpartVaultName}`
									: `${t('treasuryTarget')} ${r.counterpartVaultName}`}
							</span>
						)}
						{r.receiptUrl && (
							<a className={k.receipt} href={r.receiptUrl} target="_blank" rel="noopener noreferrer">
								<Receipt size={11} /> {t('treasuryReceipt')}
							</a>
						)}
						{r.updatedAt && (
							<span title={new Date(r.updatedAt).toLocaleString(language)}>
								{t('treasuryEdited')}
								{r.updaterName ? ` · ${r.updaterName}` : ''}
							</span>
						)}
					</div>
				)}
			</td>
			<td className={k.colUser} style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
				{r.recorderName ?? '—'}
			</td>
			<td className={`${k.num} ${r.type === 'income' ? k.pos : k.neg}`} style={{ fontWeight: 750 }}>
				{r.type === 'income' ? '+' : '−'}
				{tl(r.amountMinor)}
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
							aria-label={`${t('edit')}: ${r.description}`}
							title={t('edit')}
						>
							<Pencil size={14} />
						</button>
						<button
							type="button"
							className={`${k.rowBtn} ${k.rowBtnDanger}`}
							onClick={() => onDelete(r)}
							aria-label={`${t('delete')}: ${r.description}`}
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
