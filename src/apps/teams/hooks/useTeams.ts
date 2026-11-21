'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useJsonResource } from '@/core/data/useJsonResource';
import { foldSearchText, fill } from '@/lib/text';
import { TEAM_CATEGORIES } from '@/lib/teams';
import { sendJson } from '@/core/data/http';
import { useToast } from '@/core/ui/Toast';
import { useOrbitEvent } from '@/core/ipc/orbitBus';
import teamsContract from '../teams.contract.json';
import type { Team } from '../types';
import type { TeamWorkspaceTab } from '../components/TeamWorkspaceHeader';

export type HubTab = 'teams' | 'projects';

export function useTeams() {
	const { currentUserId, currentUser, canManageApp } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const dialog = useDialog();
	const notify = useToast();

	const { data: teamsData, setData: setTeamsData, refetch: fetchTeams } = useJsonResource<Team[]>('/api/teams');
	const { data: categoryData, refetch: refetchCategories } = useJsonResource<{ categories: string[] }>('/api/team-categories');
	const teamCategories = useMemo(
		() => (categoryData?.categories?.length ? categoryData.categories : [...TEAM_CATEGORIES]),
		[categoryData]
	);
	const teams = useMemo(() => teamsData ?? [], [teamsData]);

	const { data: rosterData } = useJsonResource<{ members: Array<{ id: string; name: string; surname: string; status?: string }> }>('/api/members');
	const roster = useMemo(() => (rosterData?.members ?? []).filter((m) => !m.status || m.status === 'active'), [rosterData]);

	const [activeHubTab, setActiveHubTab] = useState<HubTab>('teams');
	const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<TeamWorkspaceTab>('kanban');
	const [openTaskId, setOpenTaskId] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [editingTeam, setEditingTeam] = useState<Team | null>(null);
	const [applyTo, setApplyTo] = useState<Team | null>(null);
	const [busy, setBusy] = useState(false);

	const canCreateTeam = canManageApp('teams') || teams.some((tm) => tm.permissions.editAll);

	useEffect(() => {
		const refresh = () => void refetchCategories();
		window.addEventListener('orbit:team-categories-updated', refresh);
		return () => window.removeEventListener('orbit:team-categories-updated', refresh);
	}, [refetchCategories]);

	useOrbitEvent('budget:record_created', (evt) => {
		if (evt.teamId) {
			void fetchTeams();
		}
	});

	useFocusTarget('teams', {
		ready: teamsData !== null,
		apply: (target) => {
			const teamId = target.kind === 'team' ? target.itemId : (target.parentId ?? target.itemId);
			if (teamId) setSelectedTeamId(teamId);
			if (target.kind === 'task' && target.itemId) setOpenTaskId(target.itemId);
			setActiveTab(
				target.section === 'vault' || target.kind === 'vault' || target.kind === 'ledger'
					? 'vault'
					: target.section === 'members'
						? 'members'
						: 'kanban'
			);
		},
		refetch: fetchTeams,
	});

	const showTeam = (id: string | null) => {
		setSelectedTeamId(id);
		requestAnimationFrame(() => {
			let el: HTMLElement | null = document.querySelector('[data-teams-root]')?.parentElement ?? null;
			while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement;
			el?.scrollTo({ top: 0 });
		});
	};

	const myTeams = teams.filter((tm) => tm.myStatus === 'active').length;
	const selectedTeam = teams.find((tm) => tm.id === selectedTeamId) ?? null;

	const visibleTeams = useMemo(() => {
		const q = foldSearchText(query.trim());
		return teams.filter(
			(tm) =>
				(!category || tm.category === category) &&
				(!q || foldSearchText([tm.name, tm.description, tm.category, tm.leaderName, ...tm.members.map((u) => u.userName)].join(' ')).includes(q))
		);
	}, [teams, query, category]);

	const categories = useMemo(() => {
		const used = new Set(teams.map((tm) => tm.category));
		return [...teamCategories.filter((c) => used.has(c)), ...[...used].filter((c) => !teamCategories.includes(c))];
	}, [teams, teamCategories]);

	const mapTeamError = (message?: string) => {
		if (!message) return t('kbActionFailed');
		const matched = teamsContract.errorCodes.find((entry) => message.includes(entry.code));
		return matched ? t(matched.i18nKey, matched.description) : message;
	};

	const post = async (body: Record<string, unknown>, success?: string) => {
		setBusy(true);
		const res = await sendJson<{ message?: string }>('/api/teams', 'POST', body);
		setBusy(false);
		if (!res.ok) notify(mapTeamError(res.error), 'error');
		else {
			playSystemSound();
			if (success) notify(success);
			else if (res.data.message) notify(res.data.message);
		}
		await fetchTeams();
		return res.ok;
	};

	const join = (team: Team) =>
		team.participationType === 'approval'
			? setApplyTo(team)
			: void post({ action: 'join', teamId: team.id }, t('tmJoinedToast'));

	const leave = async (team: Team) => {
		const applied = team.myStatus === 'applied';
		const message = fill(t(applied ? 'tmWithdrawConfirm' : 'tmLeaveConfirm'), { team: team.name });
		if (!(await dialog.confirm({ message, tone: 'warning', confirmLabel: t(applied ? 'tmWithdraw' : 'tmLeave') }))) return;
		await post({ action: 'leave', teamId: team.id }, t(applied ? 'tmWithdrawnToast' : 'tmLeftToast'));
	};

	const remove = async (team: Team) => {
		if (!(await dialog.confirm({ message: fill(t('tmDeleteConfirm'), { team: team.name }), tone: 'danger' }))) return;
		if (await post({ action: 'deleteTeam', teamId: team.id }, t('tmDeletedToast'))) showTeam(null);
	};

	const canEnter = (tm: Team) => tm.permissions.manage || tm.myStatus === 'active';
	const canSeeVault = (tm: Team) => tm.permissions.manage;
	const visibleTab: TeamWorkspaceTab =
		selectedTeam && ((activeTab === 'vault' && !canSeeVault(selectedTeam)) || (activeTab === 'settings' && !selectedTeam.permissions.manage))
			? 'kanban'
			: activeTab;

	return {
		activeHubTab,
		setActiveHubTab,
		currentUserId,
		currentUser,
		teamsData,
		teams,
		roster,
		selectedTeamId,
		selectedTeam,
		activeTab,
		setActiveTab,
		visibleTab,
		openTaskId,
		setOpenTaskId,
		query,
		setQuery,
		category,
		setCategory,
		creating,
		setCreating,
		editingTeam,
		setEditingTeam,
		canCreateTeam,
		applyTo,
		setApplyTo,
		busy,
		myTeams,
		visibleTeams,
		categories,
		teamCategories,
		showTeam,
		post,
		join,
		leave,
		remove,
		canEnter,
		canSeeVault,
		fetchTeams,
		setTeamsData,
		notify,
		playSystemSound,
	};
}
