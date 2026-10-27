'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import styles from './Teams.module.css';
import type { Team } from '../types';
import type { TeamWorkspaceTab } from './TeamWorkspaceHeader';
import { KanbanBoard } from './KanbanBoard';
import { TeamMembers } from './TeamMembers';
import { TeamSettings } from './TeamSettings';
import { KasaPanel } from '@/apps/budget/components/KasaPanel';
import { TeamChatRoom } from './TeamChatRoom';

interface TeamWorkspaceBodyProps {
	team: Team;
	visibleTab: TeamWorkspaceTab;
	currentUserId: string;
	currentUserName?: string;
	canSeeKasa: boolean;
	openTaskId: string | null;
	setOpenTaskId: (id: string | null) => void;
	roster: { id: string; ad: string; soyad: string }[];
	notify: (text: string, tone?: 'success' | 'error') => void;
	fetchTeams: () => Promise<void>;
	setTeamsData: React.Dispatch<React.SetStateAction<Team[] | null>>;
	onRemoveTeam: (team: Team) => void;
}

export function TeamWorkspaceBody({
	team,
	visibleTab,
	currentUserId,
	currentUserName,
	canSeeKasa,
	openTaskId,
	setOpenTaskId,
	roster,
	notify,
	fetchTeams,
	setTeamsData,
	onRemoveTeam,
}: TeamWorkspaceBodyProps) {
	const { t } = useI18n();
	return (
		<div className={`${styles.wsBody} ${visibleTab === 'chat' ? styles.wsBodyFlush : ''}`}>
			{visibleTab === 'kanban' && (
				<KanbanBoard
					key={team.id}
					team={team}
					currentUserId={currentUserId}
					isManager={team.izinler.editAll}
					mutateTasks={(fn) =>
						setTeamsData((prev) =>
							prev ? prev.map((tm) => (tm.id === team.id ? { ...tm, gorevler: fn(tm.gorevler ?? []) } : tm)) : prev
						)
					}
					refetch={fetchTeams}
					openTaskId={openTaskId}
					setOpenTaskId={setOpenTaskId}
				/>
			)}
			{visibleTab === 'members' && (
				<TeamMembers
					key={team.id}
					team={team}
					currentUserId={currentUserId}
					roster={roster}
					notify={notify}
					onChanged={fetchTeams}
				/>
			)}
			{visibleTab === 'chat' && (
				<TeamChatRoom
					key={team.id}
					team={team}
					currentUserId={currentUserId}
					currentUserName={currentUserName || t('tmMemberFallback')}
				/>
			)}
			{visibleTab === 'kasa' && canSeeKasa && <KasaPanel key={team.id} teamId={team.id} embedded />}
			{visibleTab === 'settings' && team.izinler.manage && (
				<TeamSettings
					key={`${team.id}:${team.ad}:${team.kontenjan}:${team.liderId}:${team.status}:${team.katilimTuru}`}
					team={team}
					roster={roster}
					notify={notify}
					onChanged={fetchTeams}
					onDelete={() => onRemoveTeam(team)}
				/>
			)}
		</div>
	);
}
