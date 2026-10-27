'use client';

import React from 'react';
import { useI18n } from '@/core/i18n';
import { useAppCommand } from '@/core/commands';
import { useIsMobile } from '@/lib/client/useClientValue';
import styles from './components/Teams.module.css';
import { useTeams } from './hooks/useTeams';
import { TeamsCatalog } from './components/TeamsCatalog';
import { TeamWorkspaceHeader } from './components/TeamWorkspaceHeader';
import { TeamWorkspaceBody } from './components/TeamWorkspaceBody';
import { LockedTeamView } from './components/LockedTeamView';
import { TeamJoinButton } from './components/TeamJoinButton';
import { ApplyModal, EditTeamModal, NewTeamModal } from './components/TeamDialogs';
import { TeamsMobileView } from './components/TeamsMobileView';

export function TeamsApp() {
	const isMobile = useIsMobile();
	const { t } = useI18n();
	const state = useTeams();

	const boardOpen = !!state.selectedTeam && state.visibleTab === 'kanban' && state.canEnter(state.selectedTeam);
	useAppCommand(
		'teams',
		(cmd) => {
			if (cmd === 'new-team') {
				if (state.canCreateTeam) state.setCreating(true);
				else state.notify(t('tmNoPermissionCreateTeam'), 'error');
			} else if (cmd === 'new-task') {
				if (!boardOpen) state.notify(t('tmOpenBoardFirst'), 'error');
			} else if (cmd === 'kanban-refresh') {
				void state.fetchTeams().then(() => state.notify(t('tmTeamsRefreshed')));
			}
		},
		true
	);

	if (isMobile) {
		return <TeamsMobileView state={state} />;
	}

	return (
		<div data-teams-root className={styles.root}>
			{!state.selectedTeam ? (
				<TeamsCatalog
					teams={state.teams}
					visibleTeams={state.visibleTeams}
					categories={state.categories}
					query={state.query}
					setQuery={state.setQuery}
					category={state.category}
					setCategory={state.setCategory}
					myTeams={state.myTeams}
					canCreate={state.canCreateTeam}
					onOpenCreate={() => state.setCreating(true)}
					onShowTeam={state.showTeam}
					onEditTeam={state.setEditingTeam}
					onRemoveTeam={state.remove}
					renderJoinButton={(tm) => (
						<TeamJoinButton
							team={tm}
							currentUserId={state.currentUserId}
							busy={state.busy}
							myTeams={state.myTeams}
							onJoin={state.join}
							onLeave={state.leave}
						/>
					)}
					hasLoaded={state.teamsData !== null}
				/>
			) : (
				<div className={styles.wsShell}>
					<TeamWorkspaceHeader
						team={state.selectedTeam}
						visibleTab={state.visibleTab}
						setActiveTab={state.setActiveTab}
						canSeeKasa={state.canSeeKasa(state.selectedTeam)}
						onBack={() => state.showTeam(null)}
					/>
					{!state.canEnter(state.selectedTeam) ? (
						<LockedTeamView
							joinButton={
								<TeamJoinButton
									team={state.selectedTeam}
									currentUserId={state.currentUserId}
									busy={state.busy}
									myTeams={state.myTeams}
									onJoin={state.join}
									onLeave={state.leave}
								/>
							}
						/>
					) : (
						<TeamWorkspaceBody
							team={state.selectedTeam}
							visibleTab={state.visibleTab}
							currentUserId={state.currentUserId}
							currentUserName={state.currentUser ? `${state.currentUser.ad} ${state.currentUser.soyad}`.trim() : undefined}
							canSeeKasa={state.canSeeKasa(state.selectedTeam)}
							openTaskId={state.openTaskId}
							setOpenTaskId={state.setOpenTaskId}
							roster={state.roster}
							notify={state.notify}
							fetchTeams={state.fetchTeams}
							setTeamsData={state.setTeamsData}
							onRemoveTeam={state.remove}
						/>
					)}
				</div>
			)}
			{state.creating && (
				<NewTeamModal
					roster={state.roster}
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
					teamName={state.applyTo.ad}
					onClose={() => state.setApplyTo(null)}
					onSend={async (note) => {
						if (await state.post({ action: 'join', teamId: state.applyTo!.id, basvuruNotu: note })) {
							state.setApplyTo(null);
						}
					}}
				/>
			)}
			{state.editingTeam && (
				<EditTeamModal
					team={state.editingTeam}
					roster={state.roster}
					onClose={() => state.setEditingTeam(null)}
					onSaved={async () => {
						state.setEditingTeam(null);
						state.playSystemSound();
						state.notify(t('tmSaved'));
						await state.fetchTeams();
					}}
				/>
			)}
		</div>
	);
}
