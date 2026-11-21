'use client';

import React from 'react';
import { Users, User, ChevronRight } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { Team } from '../../types';
import { TeamJoinButton } from '../TeamJoinButton';
import s from '../TeamsMobile.module.css';

interface TeamMobileCardProps {
	team: Team;
	currentUserId: string;
	busy: boolean;
	myTeams: number;
	canEnter: boolean;
	onOpen: (id: string) => void;
	onJoin: (team: Team) => void;
	onLeave: (team: Team) => void;
}

export function TeamMobileCard({
	team,
	currentUserId,
	busy,
	myTeams,
	canEnter,
	onOpen,
	onJoin,
	onLeave,
}: TeamMobileCardProps) {
	const { t } = useI18n();
	const isMember = team.myStatus === 'active';
	const hasApplied = team.myStatus === 'applied';

	return (
		<div
			className={s.teamCard}
			onClick={() => {
				if (canEnter) onOpen(team.id);
			}}
		>
			<div className={s.teamCardHeader}>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className={s.teamName}>{team.name}</div>
					<div className={s.teamLeaderRow} style={{ marginTop: '4px' }}>
						<User size={12} />
						<span>{team.leaderName || t('tmNoCaptain')}</span>
					</div>
				</div>
				<span className={s.categoryBadge}>{team.category}</span>
			</div>

			{team.description && <div className={s.teamDesc}>{team.description}</div>}

			<div className={s.teamMetaRow}>
				<span className={s.quotaPill}>
					<Users size={12} />
					<span>
						{team.fullCapacity}/{team.capacity} {t('tmQuota')}
					</span>
				</span>

				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{isMember ? (
						<button
							type="button"
							className={s.enterBtn}
							onClick={(e) => {
								e.stopPropagation();
								onOpen(team.id);
							}}
						>
							<span>{t('tmOpen')}</span>
							<ChevronRight size={13} />
						</button>
					) : hasApplied ? (
						<span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 600 }}>
							{t('tmApplied')}
						</span>
					) : (
						<div onClick={(e) => e.stopPropagation()}>
							<TeamJoinButton
								team={team}
								currentUserId={currentUserId}
								busy={busy}
								myTeams={myTeams}
								onJoin={onJoin}
								onLeave={onLeave}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
