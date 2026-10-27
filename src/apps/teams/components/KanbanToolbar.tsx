'use client';

import React from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { GorevOnceligi } from '@/lib/kanban';
import styles from './Kanban.module.css';
import ui from '@/core/ui/ui.module.css';
import { COLUMNS, PRIORITIES, type TeamTask } from '../types';

export type AssigneeFilter = 'all' | 'mine' | 'pool';
export type SortMode = 'manual' | 'priority' | 'due';

interface KanbanToolbarProps {
	query: string;
	setQuery: (q: string) => void;
	assignee: AssigneeFilter;
	setAssignee: (a: AssigneeFilter) => void;
	priority: GorevOnceligi | '';
	setPriority: (p: GorevOnceligi | '') => void;
	label: string;
	setLabel: (l: string) => void;
	allLabels: string[];
	sort: SortMode;
	setSort: (s: SortMode) => void;
	canManage: boolean;
	onNewTask: () => void;
	stats: { total: number; done: number; overdue: number; mine: number };
	tasks: TeamTask[];
	filtersActive: boolean;
	hasVisible: boolean;
	onClearFilters: () => void;
}

export function KanbanToolbar({
	query,
	setQuery,
	assignee,
	setAssignee,
	priority,
	setPriority,
	label,
	setLabel,
	allLabels,
	sort,
	setSort,
	canManage,
	onNewTask,
	stats,
	tasks,
	filtersActive,
	hasVisible,
	onClearFilters,
}: KanbanToolbarProps) {
	const { t } = useI18n();

	return (
		<>
			<div className={styles.toolbar}>
				<label className={ui.search}>
					<Search size={14} />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('kbSearch')}
						aria-label={t('kbSearch')}
					/>
					{query && (
						<button type="button" className={ui.iconBtn} onClick={() => setQuery('')} aria-label={t('kbClearSearch')}>
							<X size={13} />
						</button>
					)}
				</label>
				<div className={ui.segmented} role="group">
					{(['all', 'mine', 'pool'] as const).map((id) => (
						<button
							key={id}
							type="button"
							className={`${ui.segment} ${assignee === id ? ui.segmentActive : ''}`}
							aria-pressed={assignee === id}
							onClick={() => setAssignee(id)}
						>
							{t(id === 'all' ? 'kbFilterAll' : id === 'mine' ? 'kbFilterMine' : 'kbFilterPool')}
						</button>
					))}
				</div>
				<select
					className={ui.select}
					value={priority}
					onChange={(e) => setPriority(e.target.value as GorevOnceligi | '')}
					aria-label={t('kbPriority')}
				>
					<option value="">{t('kbAnyPriority')}</option>
					{PRIORITIES.map((p) => (
						<option key={p.id} value={p.id}>
							{t(p.key)}
						</option>
					))}
				</select>
				{allLabels.length > 0 && (
					<select className={ui.select} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t('kbLabels')}>
						<option value="">{t('kbAnyLabel')}</option>
						{allLabels.map((l) => (
							<option key={l} value={l}>
								#{l}
							</option>
						))}
					</select>
				)}
				<select className={ui.select} value={sort} onChange={(e) => setSort(e.target.value as SortMode)} aria-label="Sort">
					<option value="manual">{t('kbSortManual')}</option>
					<option value="priority">{t('kbSortPriority')}</option>
					<option value="due">{t('kbSortDue')}</option>
				</select>
				{canManage && (
					<button type="button" className={ui.primaryBtn} onClick={onNewTask}>
						<Plus size={15} />
						{t('kbNewTask')}
					</button>
				)}
			</div>

			<div className={styles.stats}>
				<div className={styles.stat}>
					<div className={styles.statValue}>{stats.total}</div>
					<div className={styles.statLabel}>{t('kbStatTotal')}</div>
				</div>
				<div className={styles.stat}>
					<div className={styles.statValue} style={{ color: 'var(--kb-done)' }}>
						{stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%
					</div>
					<div className={styles.statLabel}>{t('kbStatDone')}</div>
				</div>
				<div className={styles.stat}>
					<div className={styles.statValue} style={{ color: stats.overdue ? '#ff453a' : undefined }}>
						{stats.overdue}
					</div>
					<div className={styles.statLabel}>{t('kbStatOverdue')}</div>
				</div>
				<div className={styles.stat}>
					<div className={styles.statValue} style={{ color: 'var(--accent)' }}>
						{stats.mine}
					</div>
					<div className={styles.statLabel}>{t('kbStatMine')}</div>
				</div>
				<div className={`${styles.stat} ${styles.progressWrap}`}>
					<div className={styles.progressTrack} aria-hidden>
						{COLUMNS.map((c) => {
							const n = tasks.filter((g) => g.status === c.id).length;
							return (
								<div
									key={c.id}
									className={styles.progressSeg}
									style={{ width: `${stats.total ? (n / stats.total) * 100 : 0}%`, background: c.color }}
									title={`${t(c.key)}: ${n}`}
								/>
							);
						})}
					</div>
					<div className={ui.hint}>{canManage ? t('kbDragHint') : t('kbOnlyManagers')}</div>
				</div>
			</div>

			{filtersActive && !hasVisible && (
				<div className={ui.empty}>
					{t('kbNoMatch')}{' '}
					<button type="button" className={ui.btn} onClick={onClearFilters} style={{ marginLeft: 8 }}>
						{t('kbClearFilters')}
					</button>
				</div>
			)}
		</>
	);
}
