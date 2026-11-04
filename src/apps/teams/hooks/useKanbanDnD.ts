'use client';

import { useState } from 'react';
import { ORDER_STEP, orderBetween, orderFits, type TaskStatus } from '@/lib/kanban';
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
		let order: number | undefined = orderBetween(before?.order, after?.order, -now);
		let columnOrder: string[] | undefined;

		if (!orderFits(before?.order, order, after?.order)) {
			const column = tasks
				.filter((g) => g.status === to && g.id !== task.id)
				.sort((a, b) => a.order - b.order || b.creation - a.creation)
				.map((g) => g.id);
			const at = after ? column.indexOf(after.id) : before ? column.indexOf(before.id) + 1 : column.length;
			column.splice(at < 0 ? column.length : at, 0, task.id);
			columnOrder = column;
			order = undefined;
		}

		if (to === task.status && order === task.order) return;

		mutateTasks((list) =>
			list.map((g) => {
				if (g.id === task.id) return { ...g, status: to, order: order ?? (columnOrder!.indexOf(g.id) + 1) * ORDER_STEP };
				if (columnOrder?.includes(g.id)) return { ...g, order: (columnOrder.indexOf(g.id) + 1) * ORDER_STEP };
				return g;
			})
		);

		const res = await sendJson<{ ok: boolean; xpGiven?: boolean; error?: string }>('/api/teams', 'POST', {
			action: 'updateTask',
			taskId: task.id,
			status: to,
			order,
			sort: columnOrder,
		});

		if (!res.ok) {
			notify(res.error || t('kbMoveFailed'), 'error');
			await refetch();
		} else if (res.data?.xpGiven) {
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
