'use client';

import React from 'react';
import { Search, X, Plus, Users, Compass } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { useTeams } from '../../hooks/useTeams';
import type { Team } from '../../types';
import { TeamMobileCard } from './TeamMobileCard';
import s from '../TeamsMobile.module.css';

interface TeamsMobileMyTeamsTabProps {
	state: ReturnType<typeof useTeams>;
	myTeamsList: Team[];
	onOpenTeam: (id: string) => void;
	onGoDiscover: () => void;
}

export function TeamsMobileMyTeamsTab({
	state,
	myTeamsList,
	onOpenTeam,
	onGoDiscover,
}: TeamsMobileMyTeamsTabProps) {
	const { t } = useI18n();

	return (
		<>
			<div className={s.headerBox}>
				<div className={s.headerTop}>
					<h1 className={s.title}>{t('tmMobTabMyTeams')}</h1>
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
					{myTeamsList.length} {t('tmStatMine')}
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

			<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
				{myTeamsList.length === 0 ? (
					<div className={s.emptyCard}>
						<Users size={32} opacity={0.4} />
						<div style={{ fontWeight: 700, fontSize: '15px' }}>{t('tmMobNoMyTeams')}</div>
						<div style={{ opacity: 0.7, fontSize: '12px', maxWidth: '280px', lineHeight: 1.4 }}>
							{t('tmMobNoMyTeamsHint')}
						</div>
						<button
							type="button"
							className={s.enterBtn}
							style={{ marginTop: '8px' }}
							onClick={onGoDiscover}
						>
							<Compass size={14} />
							<span>{t('tmMobTabDiscover')}</span>
						</button>
					</div>
				) : (
					myTeamsList.map((team) => (
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
