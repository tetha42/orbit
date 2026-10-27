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
import type { ProjeDurumu } from '@/lib/projects';
import type { ProjectsResponse, TeamOption, SortMode } from '../types';

export function useProjects() {
	const { currentUserId } = useSession();
	const { t } = useI18n();
	const { playSystemSound } = useSound();
	const { openApp } = useWindowActions();
	const { data, setData, refetch, error, httpStatus } = useJsonResource<ProjectsResponse>('/api/projects');
	const { data: teamsData } = useJsonResource<TeamOption[]>('/api/teams');
	const projeler = useMemo(() => data?.projeler ?? [], [data]);
	const manage = data?.izinler.manage ?? false;

	const [tab, setTab] = useState<ProjeDurumu>('yayinda');
	const [query, setQuery] = useState('');
	const [tech, setTech] = useState<string | null>(null);
	const [sort, setSort] = useState<SortMode>('featured');
	const [openId, setOpenId] = useState<string | null>(null);
	const [form, setForm] = useState<{ proje: Project | null } | null>(null);

	const notify = useToast();

	useFocusTarget('projects', {
		ready: data !== null,
		apply: (target) => {
			const found = projeler.find((p) => p.id === target.itemId);
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
						tm.liderId === currentUserId ||
						(tm.uyeler ?? []).some((u) => u.userId === currentUserId && u.status === 'aktif')
				)
				.map((tm) => ({ id: tm.id, ad: tm.ad })),
		[teamsData, manage, currentUserId]
	);

	const counts = useMemo(
		() => ({
			yayinda: projeler.filter((p) => p.status === 'yayinda').length,
			oneri: projeler.filter((p) => p.status === 'oneri').length,
			arsiv: projeler.filter((p) => p.status === 'arsiv').length,
		}),
		[projeler]
	);

	const inTab = useMemo(() => projeler.filter((p) => p.status === tab), [projeler, tab]);
	const techs = useMemo(() => {
		const tally = new Map<string, number>();
		for (const p of inTab) for (const x of p.teknolojiler) tally.set(x, (tally.get(x) ?? 0) + 1);
		return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([x]) => x);
	}, [inTab]);

	const allFiltered = useMemo(() => {
		const q = foldTr(query.trim());
		const list = projeler.filter((p) => {
			if (tech && !p.teknolojiler.includes(tech)) return false;
			if (!q) return true;
			return foldTr(
				[p.baslik, p.ozet, p.olusturanAdSoyad ?? '', p.takimAdi ?? '', ...p.teknolojiler].join(' ')
			).includes(q);
		});
		const byNew = (a: Project, b: Project) => b.olusturma - a.olusturma;
		if (sort === 'newest') return list.sort(byNew);
		if (sort === 'stars') return list.sort((a, b) => (b.begeniSayisi ?? 0) - (a.begeniSayisi ?? 0) || byNew(a, b));
		return list.sort((a, b) => Number(b.oneCikan) - Number(a.oneCikan) || (b.begeniSayisi ?? 0) - (a.begeniSayisi ?? 0) || byNew(a, b));
	}, [projeler, query, tech, sort]);

	const visible = useMemo(() => {
		const q = foldTr(query.trim());
		const list = inTab.filter((p) => {
			if (tech && !p.teknolojiler.includes(tech)) return false;
			if (!q) return true;
			return foldTr(
				[p.baslik, p.ozet, p.olusturanAdSoyad ?? '', p.takimAdi ?? '', ...p.teknolojiler].join(' ')
			).includes(q);
		});
		const byNew = (a: Project, b: Project) => b.olusturma - a.olusturma;
		if (sort === 'newest') return list.sort(byNew);
		if (sort === 'stars') return list.sort((a, b) => (b.begeniSayisi ?? 0) - (a.begeniSayisi ?? 0) || byNew(a, b));
		return list.sort((a, b) => Number(b.oneCikan) - Number(a.oneCikan) || (b.begeniSayisi ?? 0) - (a.begeniSayisi ?? 0) || byNew(a, b));
	}, [inTab, query, tech, sort]);

	const open = projeler.find((p) => p.id === openId) ?? null;

	const replace = (next: Project) =>
		setData((d) => (d ? { ...d, projeler: d.projeler.map((p) => (p.id === next.id ? next : p)) } : d));

	const star = async (p: Project) => {
		if (p.status !== 'yayinda') return;
		replace({ ...p, begendimMi: !p.begendimMi, begeniSayisi: (p.begeniSayisi ?? 0) + (p.begendimMi ? -1 : 1) });
		const res = await sendJson<{ begendimMi: boolean; begeniSayisi: number }>(
			`/api/projects/${encodeURIComponent(p.id)}`,
			'POST',
			{ action: 'star' }
		);
		if (!res.ok) {
			replace(p);
			notify(res.error || t('kbActionFailed'), 'error');
			return;
		}
		replace({ ...p, begendimMi: res.data.begendimMi, begeniSayisi: res.data.begeniSayisi });
	};

	const patch = async (p: Project, body: Record<string, unknown>, success: string) => {
		const res = await sendJson<{ proje: Project }>(`/api/projects/${encodeURIComponent(p.id)}`, 'PATCH', body);
		if (!res.ok) {
			notify(res.error || t('kbActionFailed'), 'error');
			return;
		}
		playSystemSound();
		notify(success);
		await refetch();
		if (res.data.proje) setTab(res.data.proje.status);
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
