import type { TaskStatus, TaskPriority } from '@/lib/kanban';
export type { TaskStatus, TaskPriority };

export interface TeamMember {
	id: string;
	teamId: string;
	userId: string;
	teamRole: string;
	status: string;
	userNameSurname: string;
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
	assigneeNameSurname: string | null;
	dueDate: number | null;
	order: number;
	tags: string[];
	creatorId?: string | null;
	creatorNameSurname?: string | null;
	update?: number | null;
	completion?: number | null;
	itemCount?: number;
	doneItemCount?: number;
	commentCount?: number;
	creation: number;
}

export interface TeamApplication extends TeamMember {
	applicationNote?: string | null;
	participationDate: number;
}

/** A team as `/api/teams` returns it to one member. */
export interface Team {
	id: string;
	name: string;
	slug: string;
	description: string;
	category: string;
	leadId: string;
	leaderNameSurname: string;
	capacity: number;
	repoUrl: string | null;
	status: 'aktif' | 'askida' | 'tamamlandi';
	participationType: 'acik' | 'onayli';
	fullCapacity: number;
	remainingCapacity: number;
	occupancyRatio: number;
	members: (TeamMember & { participationDate?: number })[];
	applications: TeamApplication[];
	myMyStatus: 'aktif' | 'basvurdu' | null;
	permissions: { manage: boolean; editAll: boolean };
	tasks: TeamTask[];
	canManage?: boolean;
}

export const COLUMNS: { id: TaskStatus; color: string; key: string }[] = [
	{ id: 'yapilacak', color: 'var(--kb-todo)', key: 'kbColTodo' },
	{ id: 'suruyor', color: 'var(--kb-doing)', key: 'kbColDoing' },
	{ id: 'inceleme', color: 'var(--kb-review)', key: 'kbColReview' },
	{ id: 'tamamlandi', color: 'var(--kb-done)', key: 'kbColDone' },
];

export const PRIORITIES: { id: TaskPriority; color: string; key: string }[] = [
	{ id: 'dusuk', color: 'var(--kb-low)', key: 'kbPrioLow' },
	{ id: 'orta', color: 'var(--kb-medium)', key: 'kbPrioMedium' },
	{ id: 'yuksek', color: 'var(--kb-high)', key: 'kbPrioHigh' },
	{ id: 'kritik', color: 'var(--kb-critical)', key: 'kbPrioCritical' },
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
	const byManual = (a: TeamTask, b: TeamTask) => a.order - b.order || b.creation - a.creation;
	if (mode === 'manual') return list.sort(byManual);
	if (mode === 'priority') {
		return list.sort(
			(a, b) =>
				(b.priority === 'kritik' ? 4 : b.priority === 'yuksek' ? 3 : b.priority === 'orta' ? 2 : 1) -
				(a.priority === 'kritik' ? 4 : a.priority === 'yuksek' ? 3 : a.priority === 'orta' ? 2 : 1) ||
				(a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) ||
				byManual(a, b)
		);
	}
	return list.sort(
		(a, b) =>
			(a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) ||
			(b.priority === 'kritik' ? 4 : b.priority === 'yuksek' ? 3 : b.priority === 'orta' ? 2 : 1) -
			(a.priority === 'kritik' ? 4 : a.priority === 'yuksek' ? 3 : a.priority === 'orta' ? 2 : 1) ||
			byManual(a, b)
	);
}
