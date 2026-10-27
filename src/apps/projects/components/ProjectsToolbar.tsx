import React from 'react';
import { Search, X, LayoutGrid, Kanban } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { ProjeDurumu } from '@/lib/projects';
import type { SortMode, ViewMode } from '../types';
import ui from '@/core/ui/ui.module.css';
import styles from './Projects.module.css';

interface TabItem {
	id: ProjeDurumu;
	label: string;
	count: number;
	show: boolean;
}

interface Props {
	tabs: TabItem[];
	activeTab: ProjeDurumu;
	onSelectTab: (tab: ProjeDurumu) => void;
	query: string;
	onQueryChange: (q: string) => void;
	sort: SortMode;
	onSortChange: (sort: SortMode) => void;
	viewMode?: ViewMode;
	onViewModeChange?: (view: ViewMode) => void;
	techs: string[];
	activeTech: string | null;
	onSelectTech: (tech: string | null) => void;
}

export function ProjectsToolbar({
	tabs,
	activeTab,
	onSelectTab,
	query,
	onQueryChange,
	sort,
	onSortChange,
	viewMode = 'grid',
	onViewModeChange,
	techs,
	activeTech,
	onSelectTech,
}: Props) {
	const { t } = useI18n();

	return (
		<>
			<div className={styles.toolbar}>
				<div className={ui.segmented} role="tablist">
					{tabs
						.filter((x) => x.show)
						.map((x) => (
							<button
								key={x.id}
								type="button"
								role="tab"
								aria-selected={activeTab === x.id}
								className={`${ui.segment} ${activeTab === x.id ? ui.segmentActive : ''}`}
								onClick={() => {
									onSelectTab(x.id);
									onSelectTech(null);
								}}
							>
								{x.label}
								{x.id === 'oneri' && x.count > 0 && <span className={styles.tabBadge}>{x.count}</span>}
							</button>
						))}
				</div>
				<label className={ui.search}>
					<Search size={14} />
					<input
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						placeholder={t('pjSearch')}
						aria-label={t('pjSearch')}
					/>
					{query && (
						<button
							type="button"
							className={ui.iconBtn}
							onClick={() => onQueryChange('')}
							aria-label={t('kbClearSearch')}
						>
							<X size={13} />
						</button>
					)}
				</label>
				<select
					className={ui.select}
					value={sort}
					onChange={(e) => onSortChange(e.target.value as SortMode)}
					aria-label="Sort"
				>
					<option value="featured">{t('pjSortFeatured')}</option>
					<option value="newest">{t('pjSortNewest')}</option>
					<option value="stars">{t('pjSortStars')}</option>
				</select>
				{onViewModeChange && (
					<div className={ui.segmented} style={{ marginLeft: 'auto' }}>
						<button
							type="button"
							className={`${ui.segment} ${viewMode === 'grid' ? ui.segmentActive : ''}`}
							onClick={() => onViewModeChange('grid')}
							title={t('pjViewGrid')}
							aria-label={t('pjViewGrid')}
						>
							<LayoutGrid size={14} />
						</button>
						<button
							type="button"
							className={`${ui.segment} ${viewMode === 'kanban' ? ui.segmentActive : ''}`}
							onClick={() => onViewModeChange('kanban')}
							title={t('pjViewKanban')}
							aria-label={t('pjViewKanban')}
						>
							<Kanban size={14} />
						</button>
					</div>
				)}
			</div>

			{techs.length > 1 && (
				<div className={styles.chips}>
					<button
						type="button"
						className={`${styles.chip} ${activeTech === null ? styles.chipActive : ''}`}
						onClick={() => onSelectTech(null)}
					>
						{t('pjAllTech')}
					</button>
					{techs.map((x) => (
						<button
							key={x}
							type="button"
							className={`${styles.chip} ${activeTech === x ? styles.chipActive : ''}`}
							aria-pressed={activeTech === x}
							onClick={() => onSelectTech(activeTech === x ? null : x)}
						>
							{x}
						</button>
					))}
				</div>
			)}
		</>
	);
}
