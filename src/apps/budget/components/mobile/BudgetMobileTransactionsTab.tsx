'use client';

import React from 'react';
import { ArrowLeftRight, FileText, Landmark, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import { formatDate } from '@/core/data/format';
import type { VaultRecord, VaultSummary } from '../../types';
import { categoryLabel } from '../../categoryLabel';
import s from '../BudgetMobile.module.css';

const tl = (minor: number) => `₺${formatMinor(minor)}`;

interface BudgetMobileTransactionsTabProps {
	active: VaultSummary | undefined;
	netBalanceMinor: number;
	totalIncomeMinor: number;
	totalExpenseMinor: number;
	search: string;
	onSearchChange: (val: string) => void;
	typeFilter: 'all' | 'income' | 'expense';
	onTypeChange: (val: 'all' | 'income' | 'expense') => void;
	totalCount: number;
	filtered: VaultRecord[];
	isLoading: boolean;
	onSelectRecord: (record: VaultRecord) => void;
}

export function BudgetMobileTransactionsTab({
	active,
	netBalanceMinor,
	totalIncomeMinor,
	totalExpenseMinor,
	search,
	onSearchChange,
	typeFilter,
	onTypeChange,
	totalCount,
	filtered,
	isLoading,
	onSelectRecord,
}: BudgetMobileTransactionsTabProps) {
	const { t } = useI18n();

	return (
		<>
			<div className={s.heroCard}>
				<div className={s.heroHeader}>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
						<Landmark size={18} color="var(--accent)" />
						<span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
							{active?.name ?? t('treasuryGeneralTitle')}
						</span>
					</div>
					<span className={`${s.badge} ${s.badgeOk}`}>
						{(active?.netBalanceMinor ?? 0) >= 0 ? t('treasuryStatusPositive') : t('treasuryStatusDeficit')}
					</span>
				</div>

				<div className={s.heroBalance}>{tl(netBalanceMinor)}</div>

				<div className={s.statRow}>
					<div className={s.statItem}>
						<span className={s.statLabel}>{t('treasuryTotalIncome')}</span>
						<span className={s.statValIncome}>+{tl(totalIncomeMinor)}</span>
					</div>
					<div className={s.statItem}>
						<span className={s.statLabel}>{t('treasuryTotalExpense')}</span>
						<span className={s.statValExpense}>-{tl(totalExpenseMinor)}</span>
					</div>
				</div>
			</div>

			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('treasurySearchPlaceholder')}
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
				/>
			</div>

			<div className={s.chipRow}>
				<button
					type="button"
					className={`${s.chip} ${typeFilter === 'all' ? s.chipActive : ''}`}
					onClick={() => onTypeChange('all')}
				>
					{t('treasuryFilterAll')} ({totalCount})
				</button>
				<button
					type="button"
					className={`${s.chip} ${typeFilter === 'income' ? s.chipActive : ''}`}
					onClick={() => onTypeChange('income')}
				>
					<TrendingUp size={13} color="var(--success)" />
					<span>{t('treasuryFilterIncome')}</span>
				</button>
				<button
					type="button"
					className={`${s.chip} ${typeFilter === 'expense' ? s.chipActive : ''}`}
					onClick={() => onTypeChange('expense')}
				>
					<TrendingDown size={13} color="var(--danger)" />
					<span>{t('treasuryFilterExpense')}</span>
				</button>
			</div>

			<div className={s.txList}>
				{filtered.length === 0 ? (
					<div className={s.card} style={{ textAlign: 'center', padding: '36px', opacity: 0.65, fontSize: '13px' }}>
						{isLoading ? t('loading') : totalCount === 0 ? t('treasuryEmptyLedger') : t('treasuryNoMatch')}
					</div>
				) : (
					filtered.map((r) => {
						const isIncome = r.type === 'income';
						return (
							<div key={r.id} className={s.txItem} onClick={() => onSelectRecord(r)}>
								<div className={s.txLeft}>
									<div className={`${s.txIconWrap} ${isIncome ? s.txIconIncome : s.txIconExpense}`}>
										{isIncome ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
									</div>
									<div className={s.txDetails}>
										<div className={s.txDesc}>{r.description}</div>
										<div className={s.txSub}>
											<span>{formatDate(r.date)}</span>
											<span>•</span>
											<span>{categoryLabel(t, r.category)}</span>
											{r.receiptUrl && (
												<>
													<span>•</span>
													<span title={t('treasuryReceiptAttached')} style={{ display: 'inline-flex', alignItems: 'center' }}>
														<FileText size={11} color="var(--accent)" />
													</span>
												</>
											)}
										</div>
									</div>
								</div>

								<div className={s.txRight}>
									<span className={`${s.txAmount} ${isIncome ? s.txAmountIncome : s.txAmountExpense}`}>
										{isIncome ? '+' : '-'}
										{tl(r.amountMinor)}
									</span>
									{r.counterpartVaultName && (
										<span style={{ fontSize: '10px', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '3px' }}>
											<ArrowLeftRight size={10} />
											<span>{r.counterpartVaultName}</span>
										</span>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</>
	);
}
