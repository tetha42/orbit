'use client';

import React from 'react';
import { ArrowRightLeft, Download, Plus } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { BUDGET_CATEGORIES, TRANSFER_CATEGORY } from '@/types/budget';
import ui from '@/core/ui/ui.module.css';
import k from './Kasa.module.css';

interface VaultToolbarProps {
	arama: string;
	onAramaChange: (val: string) => void;
	tur: 'hepsi' | 'gelir' | 'gider';
	onTurChange: (val: 'hepsi' | 'gelir' | 'gider') => void;
	kategori: string;
	onKategoriChange: (val: string) => void;
	ay: string;
	onAyChange: (val: string) => void;
	monthOptions: string[];
	canWrite: boolean;
	canTransfer: boolean;
	hasFilteredRecords: boolean;
	onExportCsv: () => void;
	onOpenTransfer: () => void;
	onOpenNewEntry: () => void;
}

const monthName = (key: string, style: 'short' | 'long' = 'short', lang = 'tr') => {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(
		lang === 'tr' ? 'tr-TR' : 'en-US',
		style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' }
	);
};

export function VaultToolbar({
	arama,
	onAramaChange,
	tur,
	onTurChange,
	kategori,
	onKategoriChange,
	ay,
	onAyChange,
	monthOptions,
	canWrite,
	canTransfer,
	hasFilteredRecords,
	onExportCsv,
	onOpenTransfer,
	onOpenNewEntry,
}: VaultToolbarProps) {
	const { t, language } = useI18n();

	return (
		<div className={k.toolbar}>
			<input
				className={`${ui.search} ${k.searchInput}`}
				placeholder={t('kasaSearchPlaceholder')}
				value={arama}
				onChange={(e) => onAramaChange(e.target.value)}
				aria-label={t('kasaSearchPlaceholder')}
			/>
			<div className={ui.segmented} role="radiogroup" aria-label={t('budgetColType')}>
				{(['hepsi', 'gelir', 'gider'] as const).map((f) => (
					<button
						key={f}
						type="button"
						role="radio"
						aria-checked={tur === f}
						className={`${ui.segment} ${tur === f ? ui.segmentActive : ''}`}
						onClick={() => onTurChange(f)}
					>
						{f === 'hepsi' ? t('all') : f === 'gelir' ? t('kasaIncome') : t('kasaExpense')}
					</button>
				))}
			</div>
			<select
				className={ui.select}
				style={{ width: 'auto' }}
				value={kategori}
				onChange={(e) => onKategoriChange(e.target.value)}
				aria-label={t('budgetColCategory')}
			>
				<option value="">{t('kasaAllCategories')}</option>
				{[...BUDGET_CATEGORIES, TRANSFER_CATEGORY].map((c) => (
					<option key={c} value={c}>
						{c}
					</option>
				))}
			</select>
			<select
				className={ui.select}
				style={{ width: 'auto' }}
				value={ay}
				onChange={(e) => onAyChange(e.target.value)}
				aria-label={t('budgetColDate')}
			>
				<option value="">{t('kasaAllMonths')}</option>
				{monthOptions.map((m) => (
					<option key={m} value={m}>
						{monthName(m, 'long', language)}
					</option>
				))}
			</select>
			<span className={k.spacer} />
			<button
				type="button"
				className={ui.btn}
				onClick={onExportCsv}
				disabled={!hasFilteredRecords}
				title="CSV"
			>
				<Download size={14} /> CSV
			</button>
			{canTransfer && (
				<button type="button" className={ui.btn} onClick={onOpenTransfer}>
					<ArrowRightLeft size={14} /> {t('kasaTransferGrant')}
				</button>
			)}
			{canWrite && (
				<button type="button" className={ui.primaryBtn} onClick={onOpenNewEntry}>
					<Plus size={15} /> {t('budgetNewEntry')}
				</button>
			)}
		</div>
	);
}
