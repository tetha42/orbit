'use client';

import React from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import type { CashTotals } from '../types';
import k from './Vault.module.css';

interface VaultCardSummaryProps {
	teamId: string | null;
	summary: CashTotals | null;
	isLoading: boolean;
	dagilimFirstCategory?: { kategori: string; oran: number };
}

const tl = (kurus: number) => `₺${formatMinor(kurus)}`;

export function VaultCardSummary({
	teamId,
	summary,
	isLoading,
	dagilimFirstCategory,
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
					data-testid="kasa-balance"
					data-loaded={summary ? '' : undefined}
				>
					{summary ? tl(summary.netBalanceMinor) : '—'}
				</div>
				<div className={k.cardNote}>
					{summary ? t('kasaEntryCount').replace('{n}', String(summary.kayitSayisi)) : isLoading ? t('loading') : ''}
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
					{dagilimFirstCategory
						? t('kasaMostSpent')
								.replace('{cat}', dagilimFirstCategory.kategori)
								.replace('{pct}', String(Math.round(dagilimFirstCategory.oran * 100)))
						: t('kasaNoSpendingYet')}
				</div>
			</div>
		</div>
	);
}
