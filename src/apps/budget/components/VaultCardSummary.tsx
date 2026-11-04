'use client';

import React from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import type { CashTotals } from '../types';
import k from './Vault.module.css';
import { categoryLabel } from '../categoryLabel';

interface VaultCardSummaryProps {
	teamId: string | null;
	summary: CashTotals | null;
	isLoading: boolean;
	distributionFirstCategory?: { category: string; ratio: number };
}

const tl = (minor: number) => `₺${formatMinor(minor)}`;

export function VaultCardSummary({
	teamId,
	summary,
	isLoading,
	distributionFirstCategory,
}: VaultCardSummaryProps) {
	const { t } = useI18n();

	return (
		<div className={k.cards}>
			<div className={k.card}>
				<div className={k.cardHead}>
					{teamId ? t('kasaProjectBalance') : t('budgetNetBalance')}{' '}
					<Wallet size={17} color="#30d158" />
				</div>
				<div
					className={`${k.cardValue} ${(summary?.netBalanceMinor ?? 0) > 0 ? k.pos : ''}`}
					data-testid="vault-balance"
					data-loaded={summary ? '' : undefined}
				>
					{summary ? tl(summary.netBalanceMinor) : '—'}
				</div>
				<div className={k.cardNote}>
					{summary ? t('kasaEntryCount').replace('{n}', String(summary.recordCount)) : isLoading ? t('loading') : ''}
				</div>
			</div>
			<div className={k.card}>
				<div className={k.cardHead}>
					{t('budgetTotalIncome')} <TrendingUp size={17} color="#0a84ff" />
				</div>
				<div className={`${k.cardValue} ${k.blue}`}>{tl(summary?.totalIncomeMinor ?? 0)}</div>
				<div className={k.cardNote}>{t('kasaIncomeNote')}</div>
			</div>
			<div className={k.card}>
				<div className={k.cardHead}>
					{t('budgetTotalExpense')} <TrendingDown size={17} color="#ff453a" />
				</div>
				<div className={`${k.cardValue} ${k.neg}`}>{tl(summary?.totalExpenseMinor ?? 0)}</div>
				<div className={k.cardNote}>
					{distributionFirstCategory
						? t('kasaMostSpent')
								.replace('{cat}', categoryLabel(t, distributionFirstCategory.category))
								.replace('{pct}', String(Math.round(distributionFirstCategory.ratio * 100)))
						: t('kasaNoSpendingYet')}
				</div>
			</div>
		</div>
	);
}
