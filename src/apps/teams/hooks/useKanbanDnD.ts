'use client';

import { useState } from 'react';
import { SIRA_ADIMI, siraBetween, siraFits, type TaskStatus } from '@/lib/kanban';
import { COLUMNS, type TeamTask } from '../types';
import { sendJson } from '@/core/data/http';

interface UseKanbanDnDParams {
	tasks: TeamTask[];
	byColumn: Map<TaskStatus, TeamTask[]>;
	sort: string;
	now: number;
	canWork: (task: TeamTask) => boolean;
	mutateTasks: (fn: (tasks: TeamTask[]) => TeamTask[]) => void;
	refetch: () => Promise<void>;
	notify: (text: string, tone?: 'success' | 'error') => void;
	playSystemSound: (sound?: string) => void;
	t: (key: string) => string;
}

export function useKanbanDnD({
	tasks,
	byColumn,
	sort,
	now,
	canWork,
	mutateTasks,
	refetch,
	notify,
	playSystemSound,
	t,
}: UseKanbanDnDParams) {
	const [dragId, setDragId] = useState<string | null>(null);
	const [drop, setDrop] = useState<{ col: TaskStatus; index: number } | null>(null);

	const move = async (task: TeamTask, to: TaskStatus, index?: number) => {
		if (!canWork(task)) return;
		const shown = (byColumn.get(to) ?? []).filter((g) => g.id !== task.id);
		const i = index === undefined ? 0 : Math.max(0, Math.min(index, shown.length));
		const reorder = sort === 'manual' && index !== undefined;
		if (!reorder && to === task.status) return;

		const before = reorder ? shown[i - 1] : undefined;
		const after = reorder ? shown[i] : shown[0];
		let sira: number | undefined = siraBetween(before?.sira, after?.sira, -now);
		let sirala: string[] | undefined;

		if (!siraFits(before?.sira, sira, after?.sira)) {
			const column = tasks
				.filter((g) => g.status === to && g.id !== task.id)
				.sort((a, b) => a.sira - b.sira || b.olusturma - a.olusturma)
				.map((g) => g.id);
			const at = after ? column.indexOf(after.id) : before ? column.indexOf(before.id) + 1 : column.length;
			column.splice(at < 0 ? column.length : at, 0, task.id);
			sirala = column;
			sira = undefined;
		}

		if (to === task.status && sira === task.sira) return;

		mutateTasks((list) =>
			list.map((g) => {
				if (g.id === task.id) return { ...g, status: to, sira: sira ?? (sirala!.indexOf(g.id) + 1) * SIRA_ADIMI };
				if (sirala?.includes(g.id)) return { ...g, sira: (sirala.indexOf(g.id) + 1) * SIRA_ADIMI };
				return g;
			})
		);

		const res = await sendJson<{ ok: boolean; xpVerildi?: boolean; error?: string }>('/api/teams', 'POST', {
			action: 'updateTask',
			gorevId: task.id,
			status: to,
			sira,
			sirala,
		});

		if (!res.ok) {
			notify(res.error || t('kbMoveFailed'), 'error');
			await refetch();
		} else if (res.data?.xpVerildi) {
			playSystemSound('hero');
			notify(t('kbRewardXp'));
		}
	};

	const step = (task: TeamTask, delta: -1 | 1) => {
		const idx = COLUMNS.findIndex((c) => c.id === task.status);
		const target = COLUMNS[idx + delta];
		if (target) void move(task, target.id);
	};

	return {
		dragId,
		drop,
		setDragId,
		setDrop,
		move,
		step,
	};
}
