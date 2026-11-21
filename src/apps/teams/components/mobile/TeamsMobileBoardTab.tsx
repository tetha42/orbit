'use client';

import React from 'react';
import { Users, Columns3, MessageSquare, Wallet, Settings, Compass } from 'lucide-react';
import { useI18n } from '@/core/i18n';
import type { useTeams } from '../../hooks/useTeams';
import type { TaskStatus, Team, TeamTask } from '../../types';
import { TeamJoinButton } from '../TeamJoinButton';
import { LockedTeamView } from '../LockedTeamView';
import { TeamMembers } from '../TeamMembers';
import { TeamChatRoom } from '../TeamChatRoom';
import { VaultPanel } from '@/apps/embeds';
import { TeamsMobileKanbanTab } from './TeamsMobileKanbanTab';
import s from '../TeamsMobile.module.css';

export type MobileWorkspaceTab = 'kanban' | 'members' | 'chat' | 'vault';

interface TeamsMobileBoardTabProps {
	state: ReturnType<typeof useTeams>;
	activeBoardTeam: Team | null;
	myTeamsList: Team[];
	activeWorkspaceTab: MobileWorkspaceTab;
	setActiveWorkspaceTab: (tab: MobileWorkspaceTab) => void;
	selectedKanbanCol: TaskStatus;
	setSelectedKanbanCol: (col: TaskStatus) => void;
	tasksByCol: Map<TaskStatus, TeamTask[]>;
	membersCount: number;
	canManageTeam: boolean;
	canWorkOnTask: (task: TeamTask) => boolean;
	now: number;
	notify: (text: string, tone?: 'success' | 'error') => void;
	onGoDiscover: () => void;
	onNewTask: (col: TaskStatus) => void;
	onStepTask: (task: TeamTask, delta: -1 | 1) => void;
}

export function TeamsMobileBoardTab({
	state,
	activeBoardTeam,
	myTeamsList,
	activeWorkspaceTab,
	setActiveWorkspaceTab,
	selectedKanbanCol,
	setSelectedKanbanCol,
	tasksByCol,
	membersCount,
	canManageTeam,
	canWorkOnTask,
	now,
	notify,
	onGoDiscover,
	onNewTask,
	onStepTask,
}: TeamsMobileBoardTabProps) {
	const { t } = useI18n();

	if (!activeBoardTeam) {
		return (
			<div className={s.emptyCard}>
				<Columns3 size={32} opacity={0.4} />
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
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
			{(myTeamsList.length > 1 || state.teams.length > 1) && (
				<div className={s.teamPickerRow}>
					{(myTeamsList.length > 0 ? myTeamsList : state.teams).map((tm) => {
						const isSelected = activeBoardTeam.id === tm.id;
						return (
							<button
								key={tm.id}
								type="button"
								className={`${s.teamPickerBtn} ${isSelected ? s.teamPickerBtnActive : ''}`}
								onClick={() => state.showTeam(tm.id)}
							>
								<Users size={12} />
								<span>{tm.name}</span>
							</button>
						);
					})}
				</div>
			)}

			<div className={s.subHeader}>
				<div className={s.subTeamInfo}>
					<div className={s.subTeamTitle}>{activeBoardTeam.name}</div>
					<div className={s.subTeamMeta}>
						<span>{activeBoardTeam.category}</span>
						<span>•</span>
						<span>{activeBoardTeam.leaderName || t('tmNoCaptain')}</span>
					</div>
				</div>

				{canManageTeam && (
					<button
						type="button"
						className={s.editTeamBtn}
						title={t('tmTabSettings')}
						onClick={() => state.setEditingTeam(activeBoardTeam)}
					>
						<Settings size={15} />
					</button>
				)}
			</div>

			<div
				className={`${s.workspaceTabsBar} ${
					state.canSeeVault(activeBoardTeam) ? s.workspaceTabsBarFour : ''
				}`}
			>
				<button
					type="button"
					className={`${s.workspaceTabBtn} ${
						activeWorkspaceTab === 'kanban' ? s.workspaceTabBtnActive : ''
					}`}
					onClick={() => setActiveWorkspaceTab('kanban')}
				>
					<Columns3 size={13} />
					<span>{t('tmTabBoard')}</span>
				</button>
				<button
					type="button"
					className={`${s.workspaceTabBtn} ${
						activeWorkspaceTab === 'members' ? s.workspaceTabBtnActive : ''
					}`}
					onClick={() => setActiveWorkspaceTab('members')}
				>
					<Users size={13} />
					<span>{t('tmTabMembers')}</span>
					{membersCount > 0 && <span className={s.tabCountBadge}>{membersCount}</span>}
				</button>
				<button
					type="button"
					className={`${s.workspaceTabBtn} ${
						activeWorkspaceTab === 'chat' ? s.workspaceTabBtnActive : ''
					}`}
					onClick={() => setActiveWorkspaceTab('chat')}
				>
					<MessageSquare size={13} />
					<span>{t('tmTabChat')}</span>
				</button>
				{state.canSeeVault(activeBoardTeam) && (
					<button
						type="button"
						className={`${s.workspaceTabBtn} ${
							activeWorkspaceTab === 'vault' ? s.workspaceTabBtnActive : ''
						}`}
						onClick={() => setActiveWorkspaceTab('vault')}
					>
						<Wallet size={13} />
						<span>{t('tmTabTreasury')}</span>
					</button>
				)}
			</div>

			{activeWorkspaceTab === 'kanban' &&
				(!state.canEnter(activeBoardTeam) ? (
					<LockedTeamView
						joinButton={
							<TeamJoinButton
								team={activeBoardTeam}
								currentUserId={state.currentUserId}
								busy={state.busy}
								myTeams={state.myTeams}
								onJoin={state.join}
								onLeave={state.leave}
							/>
						}
					/>
				) : (
					<TeamsMobileKanbanTab
						selectedKanbanCol={selectedKanbanCol}
						setSelectedKanbanCol={setSelectedKanbanCol}
						tasksByCol={tasksByCol}
						canManageTeam={canManageTeam}
						canWorkOnTask={canWorkOnTask}
						now={now}
						onNewTask={onNewTask}
						onOpenTask={(id) => state.setOpenTaskId(id)}
						onStepTask={onStepTask}
					/>
				))}

			{activeWorkspaceTab === 'members' && (
				<TeamMembers
					key={activeBoardTeam.id}
					team={activeBoardTeam}
					currentUserId={state.currentUserId}
					roster={state.roster}
					notify={notify}
					onChanged={state.fetchTeams}
				/>
			)}

			{activeWorkspaceTab === 'chat' && (
				<TeamChatRoom
					key={activeBoardTeam.id}
					team={activeBoardTeam}
					currentUserId={state.currentUserId}
					currentUserName={
						state.currentUser
							? `${state.currentUser.name} ${state.currentUser.surname}`.trim()
							: t('tmMemberFallback')
					}
				/>
			)}

			{activeWorkspaceTab === 'vault' && state.canSeeVault(activeBoardTeam) && (
				<VaultPanel key={activeBoardTeam.id} teamId={activeBoardTeam.id} embedded />
			)}
		</div>
	);
}
