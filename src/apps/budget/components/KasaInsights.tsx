'use client';

import React from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { formatKurus } from '@/lib/budget';
import ui from '@/core/ui/ui.module.css';
import k from './Kasa.module.css';

interface VaultInsightsProps {
	dagilim: { kategori: string; tutarKurus: number; oran: number }[];
	kategori: string;
	onSelectKategori: (cat: string) => void;
	aylar: { ay: string; gelir: number; gider: number }[];
	ay: string;
	onSelectAy: (m: string) => void;
	maxMonth: number;
}

const tl = (kurus: number) => `₺${formatKurus(kurus)}`;
const monthName = (key: string, style: 'short' | 'long' = 'short', lang = 'tr') => {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(
		lang === 'tr' ? 'tr-TR' : 'en-US',
		style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' }
	);
};

export function VaultInsights({
	dagilim,
	kategori,
	onSelectKategori,
	aylar,
	ay,
	onSelectAy,
	maxMonth,
}: VaultInsightsProps) {
	const { t, language } = useI18n();

	return (
		<div className={k.insights}>
			<section className={k.box} aria-label={t('kasaSpendingDistribution')}>
				<h4 className={k.boxTitle}>
					<PieChart size={15} /> {t('kasaSpendingDistribution')}
				</h4>
				{dagilim.length === 0 && <div className={ui.muted}>{t('kasaNoExpenses')}</div>}
				{dagilim.map((d) => (
					<button
						key={d.kategori}
						type="button"
						className={`${k.catRow} ${kategori === d.kategori ? k.catRowActive : ''}`}
						onClick={() => onSelectKategori(kategori === d.kategori ? '' : d.kategori)}
						title={d.kategori}
					>
						<span className={k.catName}>{d.kategori}</span>
						<span className={k.track}>
							<span style={{ width: `${Math.max(2, d.oran * 100)}%` }} />
						</span>
						<span className={k.catAmount}>
							{tl(d.tutarKurus)} · %{Math.round(d.oran * 100)}
						</span>
					</button>
				))}
			</section>
			<section className={k.box} aria-label={t('kasaMonthlyFlow')}>
				<h4 className={k.boxTitle}>
					<BarChart3 size={15} /> {t('kasaLast6Months')}
				</h4>
				<div className={k.months}>
					{aylar.map((m) => (
						<button
							key={m.ay}
							type="button"
							className={`${k.month} ${ay === m.ay ? k.monthActive : ''}`}
							onClick={() => onSelectAy(ay === m.ay ? '' : m.ay)}
							title={`${monthName(m.ay, 'long', language)}: ${t('kasaIncome')} ${tl(m.gelir)}, ${t('kasaExpense')} ${tl(m.gider)}`}
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
							<span className={k.monthLabel}>{monthName(m.ay, 'short', language)}</span>
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
