import { useMemo, useState } from 'react';
import { useSession } from '@/core/session';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { useWindowActions } from '@/core/windows';
import { useJsonResource } from '@/core/data/useJsonResource';
import { useFocusTarget } from '@/lib/client/useFocusTarget';
import { foldTr } from '@/lib/text';
import { sendJson } from '@/core/data/http';
import { useToast } from '@/core/ui/Toast';
import type { Project } from '@/db/schema';
import type { ProjectStatus } from '@/lib/projects';
import type { ProjectsResponse, TeamOption, SortMode } from '../types';

export function useProjects() {
	const { currentUserId } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const { openApp } = useWindowActions();
	const { data, setData, refetch, error, httpStatus } = useJsonResource<ProjectsResponse>('/api/projects');
	const { data: teamsData } = useJsonResource<TeamOption[]>('/api/teams');
	const projects = useMemo(() => data?.projects ?? [], [data]);
	const manage = data?.permissions.manage ?? false;

	const [tab, setTab] = useState<ProjectStatus>('yayinda');
	const [query, setQuery] = useState('');
	const [tech, setTech] = useState<string | null>(null);
	const [sort, setSort] = useState<SortMode>('featured');
	const [openId, setOpenId] = useState<string | null>(null);
	const [form, setForm] = useState<{ project: Project | null } | null>(null);

	const notify = useToast();

	useFocusTarget('projects', {
		ready: data !== null,
		apply: (target) => {
			const found = projects.find((p) => p.id === target.itemId);
			if (found) {
				setTab(found.status);
				setOpenId(found.id);
			} else if (target.section === 'oneri' || target.section === 'arsiv' || target.section === 'yayinda') {
				setTab(target.section);
			}
		},
		refetch,
	});

	const teamOptions = useMemo(
		() =>
			(teamsData ?? [])
				.filter(
					(tm) =>
						manage ||
						tm.leadId === currentUserId ||
						(tm.members ?? []).some((u) => u.userId === currentUserId && u.status === 'aktif')
				)
				.map((tm) => ({ id: tm.id, name: tm.name })),
		[teamsData, manage, currentUserId]
	);

	const counts = useMemo(
		() => ({
			yayinda: projects.filter((p) => p.status === 'yayinda').length,
			oneri: projects.filter((p) => p.status === 'oneri').length,
			arsiv: projects.filter((p) => p.status === 'arsiv').length,
		}),
		[projects]
	);

	const inTab = useMemo(() => projects.filter((p) => p.status === tab), [projects, tab]);
	const techs = useMemo(() => {
		const tally = new Map<string, number>();
		for (const p of inTab) for (const x of p.technologies) tally.set(x, (tally.get(x) ?? 0) + 1);
		return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x]) => x);
	}, [inTab]);

	const allFiltered = useMemo(() => {
		const q = foldTr(query.trim());
		const list = projects.filter((p) => {
			if (tech && !p.technologies.includes(tech)) return false;
			if (!q) return true;
			return foldTr(
				[p.title, p.summary, p.creatorNameSurname ?? '', p.teamName ?? '', ...p.technologies].join(' ')
			).includes(q);
		});
		const byNew = (a: Project, b: Project) => b.creation - a.creation;
		if (sort === 'newest') return list.sort(byNew);
		if (sort === 'stars') return list.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0) || byNew(a, b));
		return list.sort((a, b) => Number(b.oneLeaving) - Number(a.oneLeaving) || (b.likeCount ?? 0) - (a.likeCount ?? 0) || byNew(a, b));
	}, [projects, query, tech, sort]);

	const visible = useMemo(() => {
		const q = foldTr(query.trim());
		const list = inTab.filter((p) => {
			if (tech && !p.technologies.includes(tech)) return false;
			if (!q) return true;
			return foldTr(
				[p.title, p.summary, p.creatorNameSurname ?? '', p.teamName ?? '', ...p.technologies].join(' ')
			).includes(q);
		});
		const byNew = (a: Project, b: Project) => b.creation - a.creation;
		if (sort === 'newest') return list.sort(byNew);
		if (sort === 'stars') return list.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0) || byNew(a, b));
		return list.sort((a, b) => Number(b.oneLeaving) - Number(a.oneLeaving) || (b.likeCount ?? 0) - (a.likeCount ?? 0) || byNew(a, b));
	}, [inTab, query, tech, sort]);

	const open = projects.find((p) => p.id === openId) ?? null;

	const replace = (next: Project) =>
		setData((d) => (d ? { ...d, projects: d.projects.map((p) => (p.id === next.id ? next : p)) } : d));

	const star = async (p: Project) => {
		if (p.status !== 'yayinda') return;
		replace({ ...p, iLikedMi: !p.iLikedMi, likeCount: (p.likeCount ?? 0) + (p.iLikedMi ? -1 : 1) });
		const res = await sendJson<{ iLikedMi: boolean; likeCount: number }>(
			`/api/projects/${encodeURIComponent(p.id)}`,
			'POST',
			{ action: 'star' }
		);
		if (!res.ok) {
			replace(p);
			notify(res.error || t('kbActionFailed'), 'error');
			return;
		}
		replace({ ...p, iLikedMi: res.data.iLikedMi, likeCount: res.data.likeCount });
	};

	const patch = async (p: Project, body: Record<string, unknown>, success: string) => {
		const res = await sendJson<{ project: Project }>(`/api/projects/${encodeURIComponent(p.id)}`, 'PATCH', body);
		if (!res.ok) {
			notify(res.error || t('kbActionFailed'), 'error');
			return;
		}
		playSystemSound();
		notify(success);
		await refetch();
		if (res.data.project) setTab(res.data.project.status);
	};

	const remove = async (p: Project) => {
		const res = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			notify(body.error || t('kbActionFailed'), 'error');
			return;
		}
		setOpenId(null);
		await refetch();
	};

	const openTeam = (teamId: string) => {
		setOpenId(null);
		openApp('teams', { kind: 'team', itemId: teamId });
	};

	return {
		currentUserId,
		data,
		error,
		httpStatus,
		refetch,
		manage,
		tab,
		setTab,
		query,
		setQuery,
		tech,
		setTech,
		sort,
		setSort,
		openId,
		setOpenId,
		form,
		setForm,
		teamOptions,
		counts,
		techs,
		visible,
		allFiltered,
		open,
		star,
		patch,
		remove,
		openTeam,
	};
}
