'use client';

import React from 'react';
import { Search, X, Plus, Users, Layers } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { useTeams } from '../../hooks/useTeams';
import { TeamMobileCard } from './TeamMobileCard';
import s from '../TeamsMobile.module.css';

interface TeamsMobileDiscoverTabProps {
	state: ReturnType<typeof useTeams>;
	onOpenTeam: (id: string) => void;
}

export function TeamsMobileDiscoverTab({ state, onOpenTeam }: TeamsMobileDiscoverTabProps) {
	const { t } = useI18n();

	return (
		<>
			<div className={s.headerBox}>
				<div className={s.headerTop}>
					<h1 className={s.title}>{t('tmTitle')}</h1>
					{state.canCreateTeam && (
						<button
							type="button"
							className={s.newTeamBtn}
							onClick={() => state.setCreating(true)}
						>
							<Plus size={15} />
							<span>{t('tmNewTeam')}</span>
						</button>
					)}
				</div>
				<p className={s.subtitle}>
					{state.teams.length} {t('tmStatTeams')} • {state.myTeams} {t('tmStatMine')}
				</p>
			</div>

			<div className={s.searchBox}>
				<Search size={15} className={s.searchIcon} />
				<input
					type="text"
					className={s.searchInput}
					placeholder={t('tmSearch')}
					value={state.query}
					onChange={(e) => state.setQuery(e.target.value)}
				/>
				{state.query && (
					<button
						type="button"
						className={s.clearSearchBtn}
						onClick={() => state.setQuery('')}
					>
						<X size={14} />
					</button>
				)}
			</div>

			<div className={s.filterScrollRow}>
				<button
					type="button"
					className={`${s.filterPill} ${!state.category ? s.filterPillActive : ''}`}
					onClick={() => state.setCategory(null)}
				>
					<Layers size={13} />
					<span>{t('tmAllCategories')}</span>
				</button>
				{state.categories.map((cat) => (
					<button
						key={cat}
						type="button"
						className={`${s.filterPill} ${state.category === cat ? s.filterPillActive : ''}`}
						onClick={() => state.setCategory(state.category === cat ? null : cat)}
					>
						<span>{cat}</span>
					</button>
				))}
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
				{state.visibleTeams.length === 0 ? (
					<div className={s.emptyCard}>
						<Users size={32} opacity={0.4} />
						<div style={{ fontWeight: 600, fontSize: '13.5px' }}>
							{state.teams.length ? t('tmNoMatch') : t('tmNoTeams')}
						</div>
					</div>
				) : (
					state.visibleTeams.map((team) => (
						<TeamMobileCard
							key={team.id}
							team={team}
							currentUserId={state.currentUserId}
							busy={state.busy}
							myTeams={state.myTeams}
							canEnter={state.canEnter(team)}
							onOpen={onOpenTeam}
							onJoin={state.join}
							onLeave={state.leave}
						/>
					))
				)}
			</div>
		</>
	);
}
