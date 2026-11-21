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

interface VaultMobileCardProps {
	r: VaultRecord;
	lockedForMe: boolean;
	onEdit: (r: VaultRecord) => void;
	onDelete: (r: VaultRecord) => void;
}

export function VaultMobileCard({ r, lockedForMe, onEdit, onDelete }: VaultMobileCardProps) {
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
						<ArrowRightLeft size={11} /> {r.type === 'income' ? t('treasuryTagTransferIn') : t('treasuryTagTransferOut')}
					</span>
				) : (
					<span className={`${k.tag} ${r.type === 'income' ? k.tagIn : k.tagOut}`}>
						{r.type === 'income' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
						{r.type === 'income' ? t('treasuryTagIncome') : t('treasuryTagExpense')}
					</span>
				)}
				<span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDate(r.date)}</span>
			</div>

			<div style={{ fontWeight: 650, fontSize: '14px', color: 'var(--text-primary)' }}>{r.description}</div>

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
				<span>
					{categoryLabel(t, r.category)} · {r.recorderName ?? '—'}
				</span>
				<span className={`${r.type === 'income' ? k.pos : k.neg}`} style={{ fontWeight: 800, fontSize: '15px' }}>
					{r.type === 'income' ? '+' : '−'}
					{tl(r.amountMinor)}
				</span>
			</div>

			{(transfer || r.receiptUrl || !lockedForMe) && (
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid var(--card-border)' }}>
					<div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
						{transfer && (
							<span>
								{r.type === 'income' ? `${t('treasurySource')} ${r.counterpartVaultName}` : `${t('treasuryTarget')} ${r.counterpartVaultName}`}
							</span>
						)}
						{r.receiptUrl && (
							<a
								className={k.receipt}
								href={r.receiptUrl}
								target="_blank"
								rel="noopener noreferrer"
								style={{ marginLeft: transfer ? '8px' : 0 }}
							>
								<Receipt size={11} /> {t('treasuryReceipt')}
							</a>
						)}
					</div>

					{!lockedForMe && (
						<div className={k.actions}>
							<button type="button" className={k.rowBtn} onClick={() => onEdit(r)} title={t('edit')}>
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
