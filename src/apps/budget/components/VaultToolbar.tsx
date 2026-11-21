'use client';

import React from 'react';
import { ArrowRightLeft, Download, Plus } from 'lucide-react';
import { getLocaleDefinition, useI18n } from '@/core/i18n';
import { BUDGET_CATEGORIES, TRANSFER_CATEGORY } from '@/types/budget';
import ui from '@/core/ui/ui.module.css';
import k from './Vault.module.css';
import { categoryLabel } from '../categoryLabel';

interface VaultToolbarProps {
	search: string;
	onSearchChange: (val: string) => void;
	typeFilter: 'all' | 'income' | 'expense';
	onTypeChange: (val: 'all' | 'income' | 'expense') => void;
	category: string;
	onCategoryChange: (val: string) => void;
	month: string;
	onMonthChange: (val: string) => void;
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
		getLocaleDefinition(lang).dateLocale,
		style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' }
	);
};

export function VaultToolbar({
	search,
	onSearchChange,
	typeFilter,
	onTypeChange,
	category,
	onCategoryChange,
	month,
	onMonthChange,
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
				placeholder={t('treasurySearchPlaceholder')}
				value={search}
				onChange={(e) => onSearchChange(e.target.value)}
				aria-label={t('treasurySearchPlaceholder')}
			/>
			<div className={ui.segmented} role="radiogroup" aria-label={t('budgetColType')}>
				{(['all', 'income', 'expense'] as const).map((f) => (
					<button
						key={f}
						type="button"
						role="radio"
						aria-checked={typeFilter === f}
						className={`${ui.segment} ${typeFilter === f ? ui.segmentActive : ''}`}
						onClick={() => onTypeChange(f)}
					>
						{f === 'all' ? t('all') : f === 'income' ? t('treasuryIncome') : t('treasuryExpense')}
					</button>
				))}
			</div>
			<select
				className={ui.select}
				style={{ width: 'auto' }}
				value={category}
				onChange={(e) => onCategoryChange(e.target.value)}
				aria-label={t('budgetColCategory')}
			>
				<option value="">{t('treasuryAllCategories')}</option>
				{[...BUDGET_CATEGORIES, TRANSFER_CATEGORY].map((c) => (
					<option key={c} value={c}>
						{categoryLabel(t, c)}
					</option>
				))}
			</select>
			<select
				className={ui.select}
				style={{ width: 'auto' }}
				value={month}
				onChange={(e) => onMonthChange(e.target.value)}
				aria-label={t('budgetColDate')}
			>
				<option value="">{t('treasuryAllMonths')}</option>
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
					<ArrowRightLeft size={14} /> {t('treasuryTransferGrant')}
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
