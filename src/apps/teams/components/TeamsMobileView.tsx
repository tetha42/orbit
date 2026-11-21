'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useI18n } from '@/core/i18n';
import { useSound } from '@/core/sound';
import { useToast } from '@/core/ui/Toast';
import { useNow } from '@/lib/client/useSheet';
import { sendJson } from '@/core/data/http';
import { COLUMNS, type TaskStatus, type TeamTask } from '../types';
import type { useTeams } from '../hooks/useTeams';
import { TeamsMobileDiscoverTab } from './mobile/TeamsMobileDiscoverTab';
import { TeamsMobileMyTeamsTab } from './mobile/TeamsMobileMyTeamsTab';
import { TeamsMobileBoardTab, type MobileWorkspaceTab } from './mobile/TeamsMobileBoardTab';
import { TeamsMobileViewModals } from './TeamsMobileViewModals';
import { TeamsMobileViewTabBar, type TeamsMobileTab } from './TeamsMobileViewTabBar';
import s from './TeamsMobile.module.css';

export interface TeamsMobileViewProps {
	state: ReturnType<typeof useTeams>;
}

export function TeamsMobileView({ state }: TeamsMobileViewProps) {
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const notify = useToast();
	const now = useNow(30_000);

	const [activeTab, setActiveTab] = useState<TeamsMobileTab>('discover');
	const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<MobileWorkspaceTab>('kanban');
	const [selectedKanbanCol, setSelectedKanbanCol] = useState<TaskStatus>('todo');
	const [newTaskCol, setNewTaskCol] = useState<TaskStatus | null>(null);
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	const myTeamsList = useMemo(
		() =>
			state.visibleTeams.filter(
				(tm) => tm.myStatus === 'active' || tm.leadId === state.currentUserId
			),
		[state.visibleTeams, state.currentUserId]
	);

	const activeBoardTeam = useMemo(() => {
		if (state.selectedTeam) return state.selectedTeam;
		if (myTeamsList.length > 0) return myTeamsList[0];
		if (state.teams.length > 0) return state.teams[0];
		return null;
	}, [state.selectedTeam, myTeamsList, state.teams]);

	const teamTasks = useMemo(() => activeBoardTeam?.tasks ?? [], [activeBoardTeam?.tasks]);

	const tasksByCol = useMemo(() => {
		const map = new Map<TaskStatus, TeamTask[]>();
		for (const col of COLUMNS) {
			map.set(col.id, teamTasks.filter((task) => task.status === col.id));
		}
		return map;
	}, [teamTasks]);

	const canManageTeam = Boolean(
		activeBoardTeam &&
			(activeBoardTeam.permissions?.editAll || activeBoardTeam.leadId === state.currentUserId)
	);

	const canWorkOnTask = (task: TeamTask) =>
		canManageTeam || task.assigneeMemberId === state.currentUserId;

	const handleStepTask = async (task: TeamTask, delta: -1 | 1) => {
		const currentIndex = COLUMNS.findIndex((c) => c.id === task.status);
		if (currentIndex < 0) return;
		const targetIndex = currentIndex + delta;
		if (targetIndex < 0 || targetIndex >= COLUMNS.length) return;
		const nextStatus = COLUMNS[targetIndex].id;

		state.setTeamsData((prev) =>
			prev
				? prev.map((tm) =>
						tm.id === task.teamId
							? {
									...tm,
									tasks: (tm.tasks ?? []).map((g) =>
										g.id === task.id ? { ...g, status: nextStatus } : g
									),
							  }
							: tm
				  )
				: prev
		);

		const res = await sendJson<{ ok: boolean; xpGiven?: boolean; error?: string }>(
			'/api/teams',
			'POST',
			{ action: 'updateTask', taskId: task.id, status: nextStatus }
		);

		if (!res.ok) {
			notify(res.error || t('kbMoveFailed'), 'error');
			await state.fetchTeams();
		} else {
			playSystemSound();
			if (res.data?.xpGiven) notify(t('kbRewardXp'));
		}
	};

	const members = useMemo(
		() =>
			(activeBoardTeam?.members ?? []).map((u) => ({
				id: u.userId,
				name: u.userName,
				role: u.teamRole,
			})),
		[activeBoardTeam?.members]
	);

	const allLabels = useMemo(() => {
		const set = new Set<string>();
		for (const g of teamTasks) for (const l of g.tags ?? []) set.add(l);
		return Array.from(set).sort();
	}, [teamTasks]);

	const handleTabChange = (tabId: TeamsMobileTab) => {
		if (tabId === 'add') {
			if (state.canCreateTeam) state.setCreating(true);
			else notify(t('tmNoPermissionCreateTeam'), 'error');
			return;
		}
		if (activeTab === tabId) {
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			setActiveTab(tabId);
			scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
		}
	};

	const openBoard = (teamId: string) => {
		state.showTeam(teamId);
		setActiveWorkspaceTab('kanban');
		setActiveTab('board');
	};

	return (
		<div className={s.mobileRoot}>
			<div ref={scrollAreaRef} className={s.mobileScrollArea}>
				{activeTab === 'discover' && (
					<TeamsMobileDiscoverTab state={state} onOpenTeam={openBoard} />
				)}
				{activeTab === 'my_teams' && (
					<TeamsMobileMyTeamsTab
						state={state}
						myTeamsList={myTeamsList}
						onOpenTeam={openBoard}
						onGoDiscover={() => setActiveTab('discover')}
					/>
				)}
				{activeTab === 'board' && (
					<TeamsMobileBoardTab
						state={state}
						activeBoardTeam={activeBoardTeam}
						myTeamsList={myTeamsList}
						activeWorkspaceTab={activeWorkspaceTab}
						setActiveWorkspaceTab={setActiveWorkspaceTab}
						selectedKanbanCol={selectedKanbanCol}
						setSelectedKanbanCol={setSelectedKanbanCol}
						tasksByCol={tasksByCol}
						membersCount={members.length}
						canManageTeam={canManageTeam}
						canWorkOnTask={canWorkOnTask}
						now={now}
						notify={notify}
						onGoDiscover={() => setActiveTab('discover')}
						onNewTask={(col) => setNewTaskCol(col)}
						onStepTask={(task, delta) => void handleStepTask(task, delta)}
					/>
				)}
			</div>

			<TeamsMobileViewTabBar
				activeTab={activeTab}
				myTeamsCount={myTeamsList.length}
				onTabChange={handleTabChange}
			/>

			<TeamsMobileViewModals
				state={state}
				activeBoardTeam={activeBoardTeam}
				newTaskCol={newTaskCol}
				onCloseNewTask={() => setNewTaskCol(null)}
				members={members}
				allLabels={allLabels}
				notify={notify}
			/>
		</div>
	);
}
