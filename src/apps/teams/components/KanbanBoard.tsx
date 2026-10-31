'use client';

import React, { useMemo, useState } from 'react';
import { useSound } from '@/core/sound';
import { useI18n } from '@/core/i18n';
import { foldTr } from '@/lib/text';
import { dueStatus, type TaskStatus, type TaskPriority } from '@/lib/kanban';
import styles from './Kanban.module.css';
import { COLUMNS, sortTasks, type TeamMember, type TeamTask } from '../types';
import { NewTaskModal } from './NewTaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { useNow } from '@/lib/client/useSheet';
import { useAppCommand } from '@/core/commands';
import { useToast } from '@/core/ui/Toast';
import { KanbanToolbar, type AssigneeFilter, type SortMode } from './KanbanToolbar';
import { KanbanColumnGrid } from './KanbanColumnGrid';
import { useKanbanDnD } from '../hooks/useKanbanDnD';

export interface KanbanTeam {
	id: string;
	liderId: string;
	liderAdSoyad: string;
	uyeler: TeamMember[];
	gorevler: TeamTask[];
}

interface Props {
	team: KanbanTeam;
	currentUserId: string;
	isManager: boolean;
	mutateTasks: (fn: (tasks: TeamTask[]) => TeamTask[]) => void;
	refetch: () => Promise<void>;
	openTaskId: string | null;
	setOpenTaskId: (id: string | null) => void;
}

export type Notify = (text: string, tone?: 'success' | 'error') => void;

export function KanbanBoard({ team, currentUserId, isManager, mutateTasks, refetch, openTaskId, setOpenTaskId }: Props) {
	const { t, language } = useI18n();
	const { playSystemSound } = useSound();
	const tasks = useMemo(() => team.gorevler ?? [], [team.gorevler]);
	const canManage = isManager || team.liderId === currentUserId;
	const canWork = (task: TeamTask) => canManage || task.atananUyeId === currentUserId;

	const [query, setQuery] = useState('');
	const [assignee, setAssignee] = useState<AssigneeFilter>('all');
	const [priority, setPriority] = useState<TaskPriority | ''>('');
	const [label, setLabel] = useState('');
	const [sort, setSort] = useState<SortMode>('manual');
	const [newTaskCol, setNewTaskCol] = useState<TaskStatus | null>(null);
	const notify: Notify = useToast();

	useAppCommand('teams', (command) => {
		if (command === 'new-task') {
			if (canManage) setNewTaskCol('yapilacak');
			else notify(t('tmAddTaskCaptainOnly'), 'error');
		} else if (command === 'kanban-refresh') {
			void refetch().then(() => notify('Pano yenilendi.'));
		}
	});

	const members = useMemo(() => {
		const active = (team.uyeler ?? []).filter((u) => u.status === 'aktif');
		const list = active.map((u) => ({ id: u.userId, name: u.kullaniciAdSoyad, role: u.takimRolu }));
		if (team.liderId && !list.some((m) => m.id === team.liderId)) {
			list.unshift({ id: team.liderId, name: team.liderAdSoyad, role: '' });
		}
		return list;
	}, [team.uyeler, team.liderId, team.liderAdSoyad]);

	const allLabels = useMemo(
		() => [...new Set(tasks.flatMap((g) => g.etiketler ?? []))].sort((a, b) => a.localeCompare(b, 'tr')),
		[tasks]
	);

	const now = useNow();
	const filtersActive = !!query.trim() || assignee !== 'all' || !!priority || !!label;
	const visible = useMemo(() => {
		const q = foldTr(query.trim());
		return tasks.filter((g) => {
			if (q && !foldTr(g.baslik).includes(q) && !foldTr(g.aciklama ?? '').includes(q)) return false;
			if (assignee === 'mine' && g.atananUyeId !== currentUserId) return false;
			if (assignee === 'pool' && g.atananUyeId) return false;
			if (priority && g.oncelik !== priority) return false;
			if (label && !(g.etiketler ?? []).includes(label)) return false;
			return true;
		});
	}, [tasks, query, assignee, currentUserId, priority, label]);

	const byColumn = useMemo(() => {
		const map = new Map<TaskStatus, TeamTask[]>();
		for (const col of COLUMNS) map.set(col.id, []);
		for (const task of visible) map.get(task.status)?.push(task);
		for (const col of COLUMNS) map.set(col.id, sortTasks(map.get(col.id) ?? [], sort));
		return map;
	}, [visible, sort]);

	const stats = useMemo(() => {
		const total = tasks.length;
		const done = tasks.filter((g) => g.status === 'tamamlandi').length;
		const overdue = tasks.filter((g) => dueStatus(g.teslimTarihi, g.status, now) === 'gecikti').length;
		const mine = tasks.filter((g) => g.atananUyeId === currentUserId && g.status !== 'tamamlandi').length;
		return { total, done, overdue, mine };
	}, [tasks, currentUserId, now]);

	const { dragId, drop, setDragId, setDrop, move, step } = useKanbanDnD({
		tasks, byColumn, sort, now, canWork, mutateTasks, refetch, notify, playSystemSound, t,
	});

	const dueText = (state: ReturnType<typeof dueStatus>, ts: number) => {
		if (state === 'gecikti') return t('kbDueOverdue');
		if (state === 'bugun') return t('kbDueToday');
		return new Date(ts).toLocaleDateString(language === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'short' });
	};

	return (
		<div className={styles.board}>
			<KanbanToolbar
				query={query}
				setQuery={setQuery}
				assignee={assignee}
				setAssignee={setAssignee}
				priority={priority}
				setPriority={setPriority}
				label={label}
				setLabel={setLabel}
				allLabels={allLabels}
				sort={sort}
				setSort={setSort}
				canManage={canManage}
				onNewTask={() => setNewTaskCol('yapilacak')}
				stats={stats}
				tasks={tasks}
				filtersActive={filtersActive}
				hasVisible={visible.length > 0}
				onClearFilters={() => {
					setQuery('');
					setAssignee('all');
					setPriority('');
					setLabel('');
				}}
			/>

			<KanbanColumnGrid
				tasks={tasks}
				byColumn={byColumn}
				drop={drop}
				dragId={dragId}
				canManage={canManage}
				canWork={canWork}
				now={now}
				dueText={dueText}
				move={move}
				step={step}
				setOpenTaskId={setOpenTaskId}
				setNewTaskCol={setNewTaskCol}
				setDragId={setDragId}
				setDrop={setDrop}
			/>

			{newTaskCol && (
				<NewTaskModal
					teamId={team.id}
					column={newTaskCol}
					members={members}
					labels={allLabels}
					onClose={() => setNewTaskCol(null)}
					onCreated={async () => {
						setNewTaskCol(null);
						notify(t('kbCreated'));
						await refetch();
					}}
				/>
			)}

			{openTaskId && (
				<TaskDetailModal
					taskId={openTaskId}
					currentUserId={currentUserId}
					members={members}
					allLabels={allLabels}
					notify={notify}
					onClose={() => setOpenTaskId(null)}
					onChanged={refetch}
				/>
			)}
		</div>
	);
}
