'use client';

import { useMemo, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useDialog } from '@/components/Common/DialogProvider';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { useJsonResource } from '@/core/data/useJsonResource';
import { foldTr, fill } from '@/lib/text';
import { TAKIM_KATEGORILERI } from '@/lib/teams';
import { sendJson } from '@/core/data/http';
import { useToast } from '@/core/ui/Toast';
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
	const teams = useMemo(() => teamsData ?? [], [teamsData]);

	const { data: rosterData } = useJsonResource<{ members: Array<{ id: string; ad: string; soyad: string; status?: string }> }>('/api/members');
	const roster = useMemo(() => (rosterData?.members ?? []).filter((m) => !m.status || m.status === 'aktif'), [rosterData]);

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

	const canCreateTeam = canManageApp('teams') || teams.some((tm) => tm.izinler.editAll);

	useFocusTarget('teams', {
		ready: teamsData !== null,
		apply: (target) => {
			const teamId = target.kind === 'team' ? target.itemId : (target.parentId ?? target.itemId);
			if (teamId) setSelectedTeamId(teamId);
			if (target.kind === 'task' && target.itemId) setOpenTaskId(target.itemId);
			setActiveTab(
				target.section === 'kasa' || target.kind === 'kasa' || target.kind === 'ledger'
					? 'kasa'
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

	const myTeams = teams.filter((tm) => tm.benimDurumum === 'aktif').length;
	const selectedTeam = teams.find((tm) => tm.id === selectedTeamId) ?? null;

	const visibleTeams = useMemo(() => {
		const q = foldTr(query.trim());
		return teams.filter(
			(tm) =>
				(!category || tm.kategori === category) &&
				(!q || foldTr([tm.ad, tm.aciklama, tm.kategori, tm.liderAdSoyad, ...tm.uyeler.map((u) => u.kullaniciAdSoyad)].join(' ')).includes(q))
		);
	}, [teams, query, category]);

	const categories = useMemo(() => {
		const used = new Set(teams.map((tm) => tm.kategori));
		return [...TAKIM_KATEGORILERI.filter((c) => used.has(c)), ...[...used].filter((c) => !(TAKIM_KATEGORILERI as readonly string[]).includes(c))];
	}, [teams]);

	const post = async (body: Record<string, unknown>) => {
		setBusy(true);
		const res = await sendJson<{ message?: string }>('/api/teams', 'POST', body);
		setBusy(false);
		if (!res.ok) notify(res.error || t('kbActionFailed'), 'error');
		else {
			playSystemSound();
			if (res.data.message) notify(res.data.message);
		}
		await fetchTeams();
		return res.ok;
	};

	const join = (team: Team) => (team.katilimTuru === 'onayli' ? setApplyTo(team) : void post({ action: 'join', teamId: team.id }));

	const leave = async (team: Team) => {
		const applied = team.benimDurumum === 'basvurdu';
		const message = fill(t(applied ? 'tmWithdrawConfirm' : 'tmLeaveConfirm'), { team: team.ad });
		if (!(await dialog.confirm({ message, tone: 'warning', confirmLabel: t(applied ? 'tmWithdraw' : 'tmLeave') }))) return;
		await post({ action: 'leave', teamId: team.id });
	};

	const remove = async (team: Team) => {
		if (!(await dialog.confirm({ message: fill(t('tmDeleteConfirm'), { team: team.ad }), tone: 'danger' }))) return;
		if (await post({ action: 'deleteTeam', teamId: team.id })) showTeam(null);
	};

	const canEnter = (tm: Team) => tm.izinler.manage || tm.benimDurumum === 'aktif';
	const canSeeKasa = (tm: Team) => tm.izinler.manage;
	const visibleTab: TeamWorkspaceTab =
		selectedTeam && ((activeTab === 'kasa' && !canSeeKasa(selectedTeam)) || (activeTab === 'settings' && !selectedTeam.izinler.manage))
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
		showTeam,
		post,
		join,
		leave,
		remove,
		canEnter,
		canSeeKasa,
		fetchTeams,
		setTeamsData,
		notify,
		playSystemSound,
	};
}
