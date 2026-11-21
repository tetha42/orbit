'use client';

import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { returnStatus } from '@/lib/inventory';
import { formatDate } from '@/core/data/format';
import type { InventoryItem } from '../../types';
import s from '../InventoryMobile.module.css';

interface InventoryMobileLoansTabProps {
	loading: boolean;
	loanedItems: InventoryItem[];
	now: number;
	onSelect: (id: string) => void;
}

export function InventoryMobileLoansTab({
	loading,
	loanedItems,
	now,
	onSelect,
}: InventoryMobileLoansTabProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('invMobTabLoans')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('invLoansDesc')}
				</p>
			</div>

			{loading ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<div>{t('loading')}</div>
				</div>
			) : loanedItems.length === 0 ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
					<div>{t('invNoLoans')}</div>
				</div>
			) : (
				loanedItems.map((item) => {
					const info = returnStatus(item.dueDate, now);
					return (
						<div
							key={item.id}
							className={s.loanCard}
							onClick={() => onSelect(item.id)}
						>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f8fafc' }}>
									{item.name}
								</div>
								<span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', opacity: 0.6 }}>
									{item.code}
								</span>
							</div>

							<div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', opacity: 0.8 }}>
								<div>
									<strong>{t('invBorrower')}:</strong> {item.holderName || '—'}
								</div>
								{item.loanDate && (
									<div>
										<strong>{t('invLoanDate')}:</strong> {formatDate(item.loanDate)}
									</div>
								)}
								{item.dueDate && (
									<div>
										<strong>{t('invReturnDate')}:</strong> {formatDate(item.dueDate)}
									</div>
								)}
							</div>

							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
								{info?.overdue ? (
									<span className={`${s.badge} ${s.badgeDanger}`}>
										<AlertTriangle size={12} /> {info.day} {t('invDaysOverdue')}
									</span>
								) : info ? (
									<span className={`${s.badge} ${s.badgeWarn}`}>
										<Clock size={12} /> {info.day} {t('invDaysLeft')}
									</span>
								) : (
									<span className={`${s.badge} ${s.badgeOk}`}>{t('invStatusOnLoan')}</span>
								)}

								<span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
									{t('details')} ›
								</span>
							</div>
						</div>
					);
				})
			)}
		</div>
	);
}
