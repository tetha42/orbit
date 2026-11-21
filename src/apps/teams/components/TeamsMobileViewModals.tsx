'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import type { TaskStatus, Team } from '../types';
import type { useTeams } from '../hooks/useTeams';
import { TaskDetailModal } from './TaskDetailModal';
import { NewTaskModal } from './NewTaskModal';
import { EditTeamModal, NewTeamModal, ApplyModal } from './TeamDialogs';

interface TeamsMobileViewModalsProps {
	state: ReturnType<typeof useTeams>;
	activeBoardTeam: Team | null;
	newTaskCol: TaskStatus | null;
	onCloseNewTask: () => void;
	members: Array<{ id: string; name: string; role: string }>;
	allLabels: string[];
	notify: (text: string, tone?: 'success' | 'error') => void;
}

export function TeamsMobileViewModals({
	state,
	activeBoardTeam,
	newTaskCol,
	onCloseNewTask,
	members,
	allLabels,
	notify,
}: TeamsMobileViewModalsProps) {
	const { t } = useI18n();

	return (
		<>
			{newTaskCol && activeBoardTeam && (
				<NewTaskModal
					teamId={activeBoardTeam.id}
					column={newTaskCol}
					members={members}
					labels={allLabels}
					onClose={onCloseNewTask}
					onCreated={async () => {
						onCloseNewTask();
						notify(t('kbCreated'));
						await state.fetchTeams();
					}}
				/>
			)}
			{state.openTaskId && (
				<TaskDetailModal
					taskId={state.openTaskId}
					currentUserId={state.currentUserId}
					members={members}
					allLabels={allLabels}
					notify={notify}
					onClose={() => state.setOpenTaskId(null)}
					onChanged={state.fetchTeams}
				/>
			)}
			{state.editingTeam && (
				<EditTeamModal
					team={state.editingTeam}
					roster={state.roster}
					categories={state.teamCategories}
					onClose={() => state.setEditingTeam(null)}
					onSaved={async () => {
						state.setEditingTeam(null);
						notify(t('tmUpdated'));
						await state.fetchTeams();
					}}
				/>
			)}
			{state.creating && (
				<NewTeamModal
					roster={state.roster}
					categories={state.teamCategories}
					onClose={() => state.setCreating(false)}
					onCreated={async () => {
						state.setCreating(false);
						state.playSystemSound();
						state.notify(t('tmCreated'));
						await state.fetchTeams();
					}}
				/>
			)}
			{state.applyTo && (
				<ApplyModal
					teamName={state.applyTo.name}
					onClose={() => state.setApplyTo(null)}
					onSend={async (note) => {
						if (await state.post({ action: 'join', teamId: state.applyTo!.id, applicationNote: note }, t('tmAppliedToast'))) {
							state.setApplyTo(null);
						}
					}}
				/>
			)}
		</>
	);
}
