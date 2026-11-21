import type { TaskStatus, TaskPriority } from '@/lib/kanban';

export type { TaskStatus, TaskPriority } from '@/lib/kanban';

export interface Team {
	id: string;
	name: string;
	slug: string;
	description: string;
	/** One of the configured team categories; older rows may hold a free-form value. */
	category: string;
	leadId: string;
	leaderName?: string;
	capacity: number;
	activeMemberCount?: number;
	repoUrl?: string;
	status: 'active' | 'done' | 'suspended';
	/** `open`: join at once; `approval`: apply, and the captain decides. */
	participationType?: 'open' | 'approval';
	/** `working_group` (default) or the decision body `committee`. */
	type?: 'working_group' | 'committee';
	/** Quorum for a committee, 0 when unspecified. */
	quorum?: number;
	createdAt: number;
}

export interface TeamMember {
	id: string;
	teamId: string;
	userId: string;
	userName?: string;
	userDepartment?: string;
	teamRole: string;
	status: 'active' | 'applied';
	/** What the applicant wrote with an application. */
	applicationNote?: string | null;
	joinedAt: number;
	/** Committee members only. */
	votingRight?: number;
	termStart?: number | null;
	termEnd?: number | null;
}

export interface TeamTask {
	id: string;
	teamId: string;
	title: string;
	description?: string;
	status: TaskStatus;
	priority: TaskPriority;
	assigneeMemberId?: string;
	assigneeName?: string;
	dueDate?: number;
	/** Position within its column; smaller sorts higher. */
	order?: number;
	/** Free-form labels ("frontend", "hardware"); stored as a JSON array. */
	tags?: string[];
	creatorId?: string | null;
	creatorName?: string | null;
	updatedAt?: number;
	/** When it last reached `done`; null while it is open. */
	completedAt?: number | null;
	/** Checklist progress and discussion size, for the card face. */
	itemCount?: number;
	doneItemCount?: number;
	commentCount?: number;
	createdAt: number;
}

/** One checklist line of a task. */
export interface TeamTaskItem {
	id: string;
	taskId: string;
	text: string;
	isDone: number;
	order: number;
	createdAt: number;
}

/** A comment in a task's discussion. */
export interface TeamTaskComment {
	id: string;
	taskId: string;
	userId: string | null;
	userName?: string | null;
	content: string;
	createdAt: number;
}

/**
 * What happened to a task, as facts: the client renders the sentence. `detail` is
 * a small JSON object whose shape depends on `type` (e.g. `{ "from": "in_progress", "to": "review" }`).
 */
export type TaskActivityType =
	| 'created'
	| 'moved'
	| 'edited'
	| 'assigned'
	| 'item_added'
	| 'item_completed'
	| 'comment';

export interface TeamTaskActivity {
	id: string;
	taskId: string;
	actorId: string | null;
	actorName?: string | null;
	type: TaskActivityType;
	detail: Record<string, string | number | null> | null;
	createdAt: number;
}

/** Everything the task detail sheet shows. */
export interface TeamTaskDetail {
	task: TeamTask;
	items: TeamTaskItem[];
	comments: TeamTaskComment[];
	activity: TeamTaskActivity[];
}

/** An open task assigned to a member, with the project it belongs to. */
export interface UpcomingTask {
	id: string;
	teamId: string;
	teamName: string;
	title: string;
	priority: TeamTask['priority'];
	dueDate: number;
}

/** An inventory item on loan to a member, with the date it is due back. */
export interface UpcomingReturn {
	id: string;
	code: string;
	name: string;
	dueDate: number;
}
