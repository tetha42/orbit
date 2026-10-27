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
	arama: string;
	setArama: (s: string) => void;
	kategori: string;
	setKategori: (k: string) => void;
	categories: string[];
	counts: {
		hepsi: number;
		saglam: number;
		oduncte: number;
		gecikmis: number;
		arizali: number;
		kayip: number;
		bende: number;
	};
	isManager: boolean;
	onNewItem: () => void;
}

export function InventoryToolbar({
	filter,
	setFilter,
	arama,
	setArama,
	kategori,
	setKategori,
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
			onClick={() => setFilter(filter === key ? 'hepsi' : key)}
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
					{stat('hepsi', t('invStatTotal'), counts.hepsi)}
					{stat('saglam', t('invStatAvailable'), counts.saglam, 'var(--green)')}
					{stat('oduncte', t('invStatOnLoan'), counts.oduncte, 'var(--orange)')}
					{stat(
						'gecikmis',
						t('invStatOverdue'),
						counts.gecikmis,
						counts.gecikmis ? 'var(--red)' : undefined
					)}
					{stat('arizali', t('invStatBroken'), counts.arizali)}
					{counts.kayip > 0 && stat('kayip', t('invStatLost'), counts.kayip)}
				</div>
			</header>

			<div className={s.toolbar}>
				<input
					className={ui.search}
					style={{ flex: '1 1 220px', maxWidth: 360 }}
					placeholder={t('invSearchInputPlaceholder')}
					value={arama}
					onChange={(e) => setArama(e.target.value)}
					aria-label="Envanterde ara"
				/>
				<select
					className={ui.select}
					value={kategori}
					onChange={(e) => setKategori(e.target.value)}
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
					className={`${ui.btn} ${filter === 'bende' ? ui.segmentActive : ''}`}
					onClick={() => setFilter(filter === 'bende' ? 'hepsi' : 'bende')}
					aria-pressed={filter === 'bende'}
				>
					<User size={14} /> {fill(t('invMyItems'), { n: counts.bende })}
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
