import React from 'react';
import { Cpu, Plus, User } from 'lucide-react';
import ui from '@/core/ui/ui.module.css';
import { useI18n } from '@/core/i18n';
import { fill } from '@/lib/text';
import s from './Inventory.module.css';
import type { Filter } from '../types';

interface InventoryToolbarProps {
	filter: Filter;
	setFilter: (f: Filter) => void;
	search: string;
	setSearch: (s: string) => void;
	category: string;
	setCategory: (k: string) => void;
	categories: string[];
	counts: {
		all: number;
		available: number;
		on_loan: number;
		overdue: number;
		faulty: number;
		lost: number;
		mine: number;
	};
	isManager: boolean;
	onNewItem: () => void;
}

export function InventoryToolbar({
	filter,
	setFilter,
	search,
	setSearch,
	category,
	setCategory,
	categories,
	counts,
	isManager,
	onNewItem,
}: InventoryToolbarProps) {
	const { t } = useI18n();

	const stat = (key: Filter, label: string, value: number, tone?: string) => (
		<button
			type="button"
			className={`${s.stat} ${filter === key ? s.statActive : ''}`}
			onClick={() => setFilter(filter === key ? 'all' : key)}
			aria-pressed={filter === key}
		>
			<div className={s.statValue} style={tone ? { color: tone } : undefined}>
				{value}
			</div>
			<div className={s.statLabel}>{label}</div>
		</button>
	);

	return (
		<>
			<header className={s.header}>
				<div>
					<h2 className={s.title}>
						<Cpu size={20} color="#0a84ff" /> {t('invHeader')}
					</h2>
					<p className={s.subtitle}>{t('invSubtitle')}</p>
				</div>
				<div className={s.stats}>
					{stat('all', t('invStatTotal'), counts.all)}
					{stat('available', t('invStatAvailable'), counts.available, 'var(--green)')}
					{stat('on_loan', t('invStatOnLoan'), counts.on_loan, 'var(--orange)')}
					{stat(
						'overdue',
						t('invStatOverdue'),
						counts.overdue,
						counts.overdue ? 'var(--red)' : undefined
					)}
					{stat('faulty', t('invStatBroken'), counts.faulty)}
					{counts.lost > 0 && stat('lost', t('invStatLost'), counts.lost)}
				</div>
			</header>

			<div className={s.toolbar}>
				<input
					className={ui.search}
					style={{ flex: '1 1 220px', maxWidth: 360 }}
					placeholder={t('invSearchInputPlaceholder')}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					aria-label="Envanterde ara"
				/>
				<select
					className={ui.select}
					value={category}
					onChange={(e) => setCategory(e.target.value)}
					aria-label="Kategori"
				>
					<option value="">{t('invAllCategoriesOpt')}</option>
					{categories.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
				<button
					type="button"
					className={`${ui.btn} ${filter === 'mine' ? ui.segmentActive : ''}`}
					onClick={() => setFilter(filter === 'mine' ? 'all' : 'mine')}
					aria-pressed={filter === 'mine'}
				>
					<User size={14} /> {fill(t('invMyItems'), { n: counts.mine })}
				</button>
				<span className={s.spacer} />
				{isManager && (
					<button type="button" className={ui.primaryBtn} onClick={onNewItem}>
						<Plus size={15} /> {t('invNewEquipment')}
					</button>
				)}
			</div>
		</>
	);
}
