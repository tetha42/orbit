'use client';

import React from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatMinor } from '@/lib/budget';
import ui from '@/core/ui/ui.module.css';
import k from './Vault.module.css';

interface VaultInsightsProps {
	distribution: { category: string; amountMinor: number; ratio: number }[];
	category: string;
	onSelectCategory: (cat: string) => void;
	months: { month: string; gelir: number; gider: number }[];
	month: string;
	onSelectMonth: (m: string) => void;
	maxMonth: number;
}

const tl = (minor: number) => `₺${formatMinor(minor)}`;
const monthName = (key: string, style: 'short' | 'long' = 'short', lang = 'tr') => {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(
		lang === 'tr' ? 'tr-TR' : 'en-US',
		style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' }
	);
};

export function VaultInsights({
	distribution,
	category,
	onSelectCategory,
	months,
	month,
	onSelectMonth,
	maxMonth,
}: VaultInsightsProps) {
	const { t, language } = useI18n();

	return (
		<div className={k.insights}>
			<section className={k.box} aria-label={t('kasaSpendingDistribution')}>
				<h4 className={k.boxTitle}>
					<PieChart size={15} /> {t('kasaSpendingDistribution')}
				</h4>
				{distribution.length === 0 && <div className={ui.muted}>{t('kasaNoExpenses')}</div>}
				{distribution.map((d) => (
					<button
						key={d.category}
						type="button"
						className={`${k.catRow} ${category === d.category ? k.catRowActive : ''}`}
						onClick={() => onSelectCategory(category === d.category ? '' : d.category)}
						title={d.category}
					>
						<span className={k.catName}>{d.category}</span>
						<span className={k.track}>
							<span style={{ width: `${Math.max(2, d.ratio * 100)}%` }} />
						</span>
						<span className={k.catAmount}>
							{tl(d.amountMinor)} · %{Math.round(d.ratio * 100)}
						</span>
					</button>
				))}
			</section>
			<section className={k.box} aria-label={t('kasaMonthlyFlow')}>
				<h4 className={k.boxTitle}>
					<BarChart3 size={15} /> {t('kasaLast6Months')}
				</h4>
				<div className={k.months}>
					{months.map((m) => (
						<button
							key={m.month}
							type="button"
							className={`${k.month} ${month === m.month ? k.monthActive : ''}`}
							onClick={() => onSelectMonth(month === m.month ? '' : m.month)}
							title={`${monthName(m.month, 'long', language)}: ${t('kasaIncome')} ${tl(m.gelir)}, ${t('kasaExpense')} ${tl(m.gider)}`}
						>
							<span className={k.bars}>
								<span
									className={`${k.bar} ${k.barIn}`}
									style={{ height: `${(m.gelir / maxMonth) * 100}%` }}
								/>
								<span
									className={`${k.bar} ${k.barOut}`}
									style={{ height: `${(m.gider / maxMonth) * 100}%` }}
								/>
							</span>
							<span className={k.monthLabel}>{monthName(m.month, 'short', language)}</span>
						</button>
					))}
				</div>
				<div className={k.legend}>
					<span>
						<i style={{ background: '#30d158' }} />
						{t('kasaIncome')}
					</span>
					<span>
						<i style={{ background: '#ff453a' }} />
						{t('kasaExpense')}
					</span>
					<span>{t('kasaMonthFilterHint')}</span>
				</div>
			</section>
		</div>
	);
}
