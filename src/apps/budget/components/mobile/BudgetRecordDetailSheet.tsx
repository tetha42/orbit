'use client';

import React from 'react';
import { ExternalLink, FileText, Trash2, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import { formatDate } from '@/core/data/format';
import type { VaultRecord } from '../../types';
import { categoryLabel } from '../../categoryLabel';

const tl = (minor: number) => `₺${formatMinor(minor)}`;

interface BudgetRecordDetailSheetProps {
	record: VaultRecord;
	canWrite: boolean;
	onClose: () => void;
	onRemove: (record: VaultRecord) => void;
}

export function BudgetRecordDetailSheet({ record, canWrite, onClose, onRemove }: BudgetRecordDetailSheetProps) {
	const { t } = useI18n();

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(0, 0, 0, 0.7)',
				backdropFilter: 'blur(8px)',
				zIndex: 100,
				display: 'flex',
				alignItems: 'flex-end',
			}}
			onClick={onClose}
		>
			<div
				style={{
					width: '100%',
					background: '#1c1c1e',
					borderTop: '1px solid rgba(255, 255, 255, 0.15)',
					borderRadius: '20px 20px 0 0',
					padding: '20px 18px calc(24px + env(safe-area-inset-bottom)) 18px',
					display: 'flex',
					flexDirection: 'column',
					gap: '14px',
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<span style={{ fontSize: '15px', fontWeight: 700 }}>{t('treasuryTxDetailTitle')}</span>
					<button
						type="button"
						onClick={onClose}
						style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.6)', cursor: 'pointer' }}
					>
						<X size={18} />
					</button>
				</div>

				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						padding: '12px',
						background: 'rgba(255, 255, 255, 0.04)',
						borderRadius: '12px',
					}}
				>
					<div>
						<div style={{ fontSize: '15px', fontWeight: 700 }}>{record.description}</div>
						<div style={{ fontSize: '12px', opacity: 0.6 }}>
							{categoryLabel(t, record.category)} • {formatDate(record.date)}
						</div>
					</div>
					<div style={{ fontSize: '18px', fontWeight: 800, color: record.type === 'income' ? 'var(--success)' : '#ffffff' }}>
						{record.type === 'income' ? '+' : '-'}
						{tl(record.amountMinor)}
					</div>
				</div>

				{record.receiptUrl && (
					<div>
						<span style={{ fontSize: '11.5px', opacity: 0.65, display: 'block', marginBottom: '6px' }}>
							{t('treasuryReceiptAttached')}
						</span>
						<a
							href={record.receiptUrl}
							target="_blank"
							rel="noreferrer noopener"
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '6px',
								color: 'var(--accent)',
								textDecoration: 'none',
								fontSize: '13px',
								fontWeight: 600,
							}}
						>
							<FileText size={16} />
							<span>{t('treasuryViewReceipt')}</span>
							<ExternalLink size={13} />
						</a>
					</div>
				)}

				{canWrite && (
					<div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
						<button
							type="button"
							style={{
								flex: 1,
								height: '42px',
								borderRadius: '12px',
								border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
								background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
								color: 'var(--danger)',
								fontSize: '13px',
								fontWeight: 700,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								gap: '6px',
								cursor: 'pointer',
							}}
							onClick={() => onRemove(record)}
						>
							<Trash2 size={15} />
							<span>{t('delete')}</span>
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
