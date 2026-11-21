import { randomUUID } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import type { TaskActivityType, TaskPriority, TeamTask } from '@/db/schema';

export interface TeamTaskPatch {
	title?: string;
	description?: string;
	priority?: TaskPriority;
	assigneeMemberId?: string | null;
	dueDate?: number | null;
	tags?: string[];
}

export interface NewAssignment {
	id: string;
	teamId: string;
	teamName: string;
	title: string;
	assigner: string | null;
	at: number;
}

export type TaskWriter = Pick<PoolClient, 'query'> | Pool;

export const TASK_COLUMNS = `
	tg.id, tg.team_id AS "teamId", tg.title AS "title", tg.description AS "description", tg.status, tg.priority AS "priority",
	tg.assignee_id AS "assigneeMemberId", tg.due_at AS "dueDate",
	tg.labels AS "tags", tg.created_by AS "creatorId", tg.updated_at AS "updatedAt", tg.completed_at AS "completedAt",
	tg.xp_awarded AS "xpGiven", tg.created_at AS "createdAt"
`;

export const TASK_SELECT = `
	SELECT ${TASK_COLUMNS},
	       COALESCE(tg.position, -tg.created_at) AS "order",
	       k.first_name || ' ' || k.last_name AS "assigneeName",
	       o.first_name || ' ' || o.last_name AS "creatorName",
	       jsonb_array_length(COALESCE(tg.checklist, '[]'::jsonb))::int AS "itemCount",
	       (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem WHERE COALESCE((elem->>'isDone')::int, 0) = 1) AS "doneItemCount",
	       jsonb_array_length(COALESCE(tg.comments, '[]'::jsonb))::int AS "commentCount"
	FROM team_tasks tg
	LEFT JOIN users k ON tg.assignee_id = k.id
	LEFT JOIN users o ON tg.created_by = o.id
`;

export function parseTags(raw: unknown): string[] {
	if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
	if (typeof raw !== 'string' || !raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

export function toTask(row: Record<string, unknown>): TeamTask {
	return { ...(row as unknown as TeamTask), tags: parseTags(row.tags) };
}

export async function logTaskActivity(
	db: TaskWriter,
	taskId: string,
	actorId: string | null | undefined,
	type: TaskActivityType,
	detail?: Record<string, string | number | null>
): Promise<void> {
	const now = Date.now();
	const entry = {
		id: randomUUID(),
		taskId,
		actorId: actorId || null,
		type,
		detail: detail ?? null,
		createdAt: now,
	};
	await db.query(
		`UPDATE team_tasks
		 SET activities = COALESCE(activities, '[]'::jsonb) || jsonb_build_array($1::jsonb)
		 WHERE id = $2`,
		[JSON.stringify(entry), taskId]
	);
}

export async function touchTask(db: TaskWriter, taskId: string): Promise<void> {
	await db.query('UPDATE team_tasks SET updated_at = $1 WHERE id = $2', [Date.now(), taskId]);
}
