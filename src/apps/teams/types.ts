import type { TaskStatus, TaskPriority } from '@/lib/kanban';
import type { TeamTaskActivity, TeamTaskItem, TeamTaskComment } from '@/db/schema';
export type { TaskStatus, TaskPriority };

export interface TeamTaskDetail {
	task: TeamTask;
	items: TeamTaskItem[];
	comments: TeamTaskComment[];
	activity: TeamTaskActivity[];
	permissions: { manage: boolean; work: boolean; comment: boolean };
}

export interface TeamMember {
	id: string;
	teamId: string;
	userId: string;
	teamRole: string;
	status: string;
	userName: string;
	userDepartment: string;
}

export interface TeamTask {
	id: string;
	teamId: string;
	title: string;
	description: string | null;
	status: TaskStatus;
	priority: TaskPriority;
	assigneeMemberId: string | null;
	assigneeName: string | null;
	dueDate: number | null;
	order: number;
	tags: string[];
	creatorId?: string | null;
	creatorName?: string | null;
	updatedAt?: number | null;
	completedAt?: number | null;
	itemCount?: number;
	doneItemCount?: number;
	commentCount?: number;
	createdAt: number;
}

export interface TeamApplication extends TeamMember {
	applicationNote?: string | null;
	joinedAt: number;
}

/** A team as `/api/teams` returns it to one member. */
export interface Team {
	id: string;
	name: string;
	slug: string;
	description: string;
	category: string;
	leadId: string;
	leaderName: string;
	capacity: number;
	repoUrl: string | null;
	status: 'active' | 'suspended' | 'done';
	participationType: 'open' | 'approval';
	fullCapacity: number;
	remainingCapacity: number;
	occupancyRatio: number;
	members: (TeamMember & { joinedAt?: number })[];
	applications: TeamApplication[];
	myStatus: 'active' | 'applied' | null;
	permissions: { manage: boolean; editAll: boolean };
	tasks: TeamTask[];
	canManage?: boolean;
}

export const COLUMNS: { id: TaskStatus; color: string; key: string }[] = [
	{ id: 'todo', color: 'var(--kb-todo)', key: 'kbColTodo' },
	{ id: 'in_progress', color: 'var(--kb-doing)', key: 'kbColDoing' },
	{ id: 'review', color: 'var(--kb-review)', key: 'kbColReview' },
	{ id: 'done', color: 'var(--kb-done)', key: 'kbColDone' },
];

export const PRIORITIES: { id: TaskPriority; color: string; key: string }[] = [
	{ id: 'low', color: 'var(--kb-low)', key: 'kbPrioLow' },
	{ id: 'medium', color: 'var(--kb-medium)', key: 'kbPrioMedium' },
	{ id: 'high', color: 'var(--kb-high)', key: 'kbPrioHigh' },
	{ id: 'critical', color: 'var(--kb-critical)', key: 'kbPrioCritical' },
];

export const priorityMeta = (id: TaskPriority) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1];
export const columnMeta = (id: TaskStatus) => COLUMNS.find((c) => c.id === id) ?? COLUMNS[0];

const LABEL_HUES = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff', '#ac8e68', '#5e5ce6'];

export function labelHue(label: string): string {
	let h = 0;
	for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
	return LABEL_HUES[h % LABEL_HUES.length];
}

export function sortTasks(tasks: TeamTask[], mode: 'manual' | 'priority' | 'due'): TeamTask[] {
	const list = [...tasks];
	const byManual = (a: TeamTask, b: TeamTask) => a.order - b.order || b.createdAt - a.createdAt;
	if (mode === 'manual') return list.sort(byManual);
	if (mode === 'priority') {
		return list.sort(
			(a, b) =>
				(b.priority === 'critical' ? 4 : b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1) -
				(a.priority === 'critical' ? 4 : a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1) ||
				(a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) ||
				byManual(a, b)
		);
	}
	return list.sort(
		(a, b) =>
			(a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) ||
			(b.priority === 'critical' ? 4 : b.priority === 'high' ? 3 : b.priority === 'medium' ? 2 : 1) -
			(a.priority === 'critical' ? 4 : a.priority === 'high' ? 3 : a.priority === 'medium' ? 2 : 1) ||
			byManual(a, b)
	);
}
