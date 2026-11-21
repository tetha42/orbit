'use client';

import React from 'react';
import { UserCheck, RotateCcw } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { returnStatus } from '@/lib/inventory';
import { formatDate } from '@/core/data/format';
import type { InventoryItem } from '../../types';
import s from '../InventoryMobile.module.css';

interface InventoryMobileMineTabProps {
	loading: boolean;
	myItems: InventoryItem[];
	now: number;
	onReturn: (id: string) => void;
}

export function InventoryMobileMineTab({
	loading,
	myItems,
	now,
	onReturn,
}: InventoryMobileMineTabProps) {
	const { t } = useI18n();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
			<div style={{ padding: '0 4px' }}>
				<h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{t('invMobTabMine')}</h3>
				<p style={{ margin: '2px 0 0', fontSize: '11.5px', opacity: 0.65 }}>
					{t('invMyItemsDesc')}
				</p>
			</div>

			{loading ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<div>{t('loading')}</div>
				</div>
			) : myItems.length === 0 ? (
				<div className={s.card} style={{ textAlign: 'center', padding: '40px 16px', opacity: 0.65, fontSize: '13px' }}>
					<UserCheck size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
					<div>{t('invNoMyItems')}</div>
				</div>
			) : (
				myItems.map((item) => {
					const info = returnStatus(item.dueDate, now);
					return (
						<div key={item.id} className={s.loanCard}>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f8fafc' }}>
									{item.name}
								</div>
								<span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', opacity: 0.6 }}>
									{item.code}
								</span>
							</div>

							<div style={{ fontSize: '12px', opacity: 0.75 }}>
								{item.dueDate ? `${t('invReturnDate')}: ${formatDate(item.dueDate)}` : ''}
							</div>

							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
								{info?.overdue ? (
									<span className={`${s.badge} ${s.badgeDanger}`}>
										{info.day} {t('invDaysOverdue')}
									</span>
								) : info ? (
									<span className={`${s.badge} ${s.badgeWarn}`}>
										{info.day} {t('invDaysLeft')}
									</span>
								) : null}

								<button
									type="button"
									className={s.chip}
									style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', padding: '5px 12px' }}
									onClick={() => onReturn(item.id)}
								>
									<RotateCcw size={12} />
									<span>{t('invReturnBtn')}</span>
								</button>
							</div>
						</div>
					);
				})
			)}
		</div>
	);
}
