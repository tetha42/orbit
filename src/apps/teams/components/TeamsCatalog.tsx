'use client';

import React from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import { TEAM_LIMIT } from '@/lib/teams';
import styles from './Teams.module.css';
import ui from '@/core/ui/ui.module.css';
import type { Team } from '../types';
import { TeamCard } from './TeamCard';

interface TeamsCatalogProps {
	teams: Team[];
	visibleTeams: Team[];
	categories: string[];
	query: string;
	setQuery: (q: string) => void;
	category: string | null;
	setCategory: (c: string | null) => void;
	myTeams: number;
	canCreate: boolean;
	onOpenCreate?: () => void;
	onShowTeam: (id: string) => void;
	onEditTeam?: (team: Team) => void;
	onRemoveTeam: (team: Team) => void;
	renderJoinButton: (tm: Team) => React.ReactNode;
	hasLoaded: boolean;
}

export function TeamsCatalog({
	teams,
	visibleTeams,
	categories,
	query,
	setQuery,
	category,
	setCategory,
	myTeams,
	canCreate,
	onOpenCreate,
	onShowTeam,
	onEditTeam,
	onRemoveTeam,
	renderJoinButton,
	hasLoaded,
}: TeamsCatalogProps) {
	const { t } = useI18n();

	return (
		<div className={styles.showcase}>
			<div className={styles.header}>
				<div>
					<h2 className={styles.title}>{t('tmTitle')}</h2>
					<p className={styles.subtitle}>{t('tmSubtitle')}</p>
				</div>
				<div className={styles.stats}>
					<div className={styles.stat}>
						<div className={styles.statValue} style={{ color: 'var(--accent)' }}>
							{teams.length}
						</div>
						<div className={styles.statLabel}>{t('tmStatTeams')}</div>
					</div>
					<div className={styles.stat}>
						<div className={styles.statValue} style={{ color: '#30d158' }}>
							{teams.reduce((n, tm) => n + tm.doluKontenjan, 0)}/{teams.reduce((n, tm) => n + tm.kontenjan, 0)}
						</div>
						<div className={styles.statLabel}>{t('tmStatMembers')}</div>
					</div>
					<div className={styles.stat}>
						<div className={styles.statValue}>
							{myTeams}/{TEAM_LIMIT}
						</div>
						<div className={styles.statLabel}>{t('tmStatMine')}</div>
					</div>
				</div>
			</div>

			<div className={styles.toolbar}>
				<label className={ui.search}>
					<Search size={14} />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('tmSearch')}
						aria-label={t('tmSearch')}
					/>
					{query && (
						<button type="button" className={ui.iconBtn} onClick={() => setQuery('')} aria-label={t('kbClearSearch')}>
							<X size={13} />
						</button>
					)}
				</label>
				{categories.length > 1 && (
					<div className={ui.segmented} role="group">
						<button
							type="button"
							className={`${ui.segment} ${category === null ? ui.segmentActive : ''}`}
							onClick={() => setCategory(null)}
						>
							{t('tmAllCategories')}
						</button>
						{categories.map((c) => (
							<button
								key={c}
								type="button"
								className={`${ui.segment} ${category === c ? ui.segmentActive : ''}`}
								aria-pressed={category === c}
								onClick={() => setCategory(category === c ? null : c)}
							>
								{c}
							</button>
						))}
					</div>
				)}
				{canCreate && onOpenCreate && (
					<button type="button" className={ui.primaryBtn} onClick={onOpenCreate}>
						<Plus size={15} /> {t('tmNewTeam')}
					</button>
				)}
			</div>

			{hasLoaded && visibleTeams.length === 0 && (
				<div className={ui.empty}>{teams.length ? t('tmNoMatch') : t('tmNoTeams')}</div>
			)}

			<div className={styles.grid}>
				{visibleTeams.map((tm) => (
					<TeamCard
						key={tm.id}
						team={tm}
						joinButton={renderJoinButton(tm)}
						onOpen={onShowTeam}
						onEdit={onEditTeam}
						onRemove={onRemoveTeam}
					/>
				))}
			</div>
		</div>
	);
}
