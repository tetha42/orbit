import type { PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { TaskPriority, TaskStatus, TeamTask } from '@/db/schema';
import { notificationEvents, publishEvent } from '@/db/events';
import { ORDER_STEP } from '@/lib/kanban';
import { logTaskActivity, parseTags, TASK_COLUMNS, type TeamTaskPatch } from './shared';
import { getTeamTaskById } from './taskQueries';

export async function createTeamTask(params: {
	teamId: string;
	title: string;
	description?: string;
	priority?: TaskPriority;
	assigneeMemberId?: string;
	dueDate?: number;
	tags?: string[];
	status?: TaskStatus;
	creatorId?: string;
}): Promise<TeamTask> {
	await ensurePostgresInit();
	const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const now = Date.now();
	const status = params.status ?? 'todo';
	const task: TeamTask = {
		id,
		teamId: params.teamId,
		title: params.title.trim(),
		description: params.description?.trim() || '',
		status,
		priority: params.priority || 'medium',
		assigneeMemberId: params.assigneeMemberId || undefined,
		dueDate: params.dueDate,
		tags: params.tags ?? [],
		order: -now,
		creatorId: params.creatorId ?? null,
		createdAt: now,
		updatedAt: now,
		completedAt: status === 'done' ? now : null,
	};

	await withTransaction(async (client) => {
		await client.query(
			`INSERT INTO team_tasks
			   (id, team_id, title, description, status, priority, assignee_id, due_at, created_at,
			    position, labels, checklist, comments, activities, created_by, updated_at, completed_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $12, $13, $14)`,
			[
				task.id,
				task.teamId,
				task.title,
				task.description,
				task.status,
				task.priority,
				task.assigneeMemberId || null,
				task.dueDate || null,
				task.createdAt,
				task.order,
				JSON.stringify(task.tags),
				task.creatorId,
				task.updatedAt,
				task.completedAt,
			]
		);
		await logTaskActivity(client, id, params.creatorId, 'created', { status });
		if (task.assigneeMemberId) {
			await logTaskActivity(client, id, params.creatorId, 'assigned', { to: task.assigneeMemberId });
			await publishEvent(client, notificationEvents([task.assigneeMemberId]));
		}
	});

	return task;
}

export async function updateTeamTaskStatus(params: {
	taskId: string;
	status: TaskStatus;
	order?: number;
	sort?: string[];
	actorId?: string;
}): Promise<{ xpGiven: boolean }> {
	return withTransaction(async (client) => {
		const prev = await client.query(
			'SELECT team_id AS "teamId", status, assignee_id AS "assigneeMemberId", xp_awarded AS "xpGiven" FROM team_tasks WHERE id = $1 FOR UPDATE',
			[params.taskId]
		);
		const row = prev.rows[0];
		if (!row) return { xpGiven: false };

		const now = Date.now();
		const statusChanged = row.status !== params.status;
		await client.query(
			`UPDATE team_tasks
			 SET status = $1,
			     position = COALESCE($2, position),
			     updated_at = $3,
			     completed_at = CASE WHEN $1 = 'done' THEN COALESCE(CASE WHEN status = 'done' THEN completed_at END, $3) ELSE NULL END
			 WHERE id = $4`,
			[params.status, Number.isFinite(params.order) ? params.order : null, now, params.taskId]
		);
		if (params.sort?.length) {
			await client.query(
				`UPDATE team_tasks t
				 SET position = v.idx * ${ORDER_STEP}
				 FROM unnest($1::text[]) WITH ORDINALITY AS v(id, idx)
				 WHERE t.id = v.id AND t.team_id = $2 AND t.status = $3`,
				[params.sort, row.teamId, params.status]
			);
		}
		if (statusChanged) {
			await logTaskActivity(client, params.taskId, params.actorId, 'moved', {
				from: row.status,
				to: params.status,
			});
		}

		if (params.status === 'done' && row.assigneeMemberId && !Number(row.xpGiven)) {
			await client.query('UPDATE team_tasks SET xp_awarded = 1 WHERE id = $1', [params.taskId]);
			await client.query('UPDATE users SET xp = COALESCE(xp, 0) + 100 WHERE id = $1', [
				row.assigneeMemberId,
			]);
			return { xpGiven: true };
		}
		return { xpGiven: false };
	});
}

export async function updateTeamTask(
	taskId: string,
	patch: TeamTaskPatch,
	actorId?: string
): Promise<TeamTask | null> {
	await ensurePostgresInit();
	const found = await withTransaction(async (client) => {
		const prev = await client.query(`SELECT ${TASK_COLUMNS} FROM team_tasks tg WHERE tg.id = $1 FOR UPDATE`, [taskId]);
		const row = prev.rows[0];
		if (!row) return false;

		const sets: string[] = [];
		const values: unknown[] = [];
		const changed: string[] = [];
		const set = (column: string, value: unknown, field: string) => {
			values.push(value);
			sets.push(`${column} = $${values.length}`);
			changed.push(field);
		};

		if (patch.title !== undefined && patch.title !== row.title) set('title', patch.title, 'title');
		if (patch.description !== undefined && patch.description !== (row.description ?? '')) set('description', patch.description, 'description');
		if (patch.priority !== undefined && patch.priority !== row.priority) set('priority', patch.priority, 'priority');
		if (patch.dueDate !== undefined && (patch.dueDate ?? null) !== (row.dueDate ?? null)) {
			set('due_at', patch.dueDate, 'dueDate');
		}
		if (patch.tags !== undefined) {
			const next = JSON.stringify(patch.tags);
			if (next !== JSON.stringify(parseTags(row.tags))) set('labels', next, 'tags');
		}
		const assigneeChanged =
			patch.assigneeMemberId !== undefined && (patch.assigneeMemberId ?? null) !== (row.assigneeMemberId ?? null);
		if (assigneeChanged) set('assignee_id', patch.assigneeMemberId, 'assigneeMemberId');

		if (sets.length === 0) return true;

		values.push(Date.now());
		sets.push(`updated_at = $${values.length}`);
		values.push(taskId);
		await client.query(`UPDATE team_tasks SET ${sets.join(', ')} WHERE id = $${values.length}`, values);

		const edited = changed.filter((f) => f !== 'assigneeMemberId');
		if (edited.length) {
			await logTaskActivity(client, taskId, actorId, 'edited', { fields: edited.join(',') });
		}
		if (assigneeChanged) {
			await logTaskActivity(client, taskId, actorId, 'assigned', {
				from: row.assigneeMemberId ?? null,
				to: patch.assigneeMemberId ?? null,
			});
			await publishEvent(client, notificationEvents([patch.assigneeMemberId]));
		}
		return true;
	});
	return found ? getTeamTaskById(taskId) : null;
}

export async function deleteTeamTask(taskId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM team_tasks WHERE id = $1', [taskId]);
	return (res.rowCount ?? 0) > 0;
}

export async function unassignTeamMemberTasks(
	db: Pick<PoolClient, 'query'>,
	teamId: string,
	userId: string,
	actorId?: string
): Promise<void> {
	const open = await db.query(
		`UPDATE team_tasks SET assignee_id = NULL, updated_at = $3
		 WHERE team_id = $1 AND assignee_id = $2 AND status <> 'done'
		 RETURNING id`,
		[teamId, userId, Date.now()]
	);
	for (const row of open.rows) {
		await logTaskActivity(db, row.id as string, actorId, 'assigned', {
			from: userId,
			to: null,
		});
	}
}
