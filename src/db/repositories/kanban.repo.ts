import { randomUUID } from 'crypto';
import type { Pool, PoolClient } from 'pg';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type {
	TeamTask,
	TeamTaskDetail,
	TeamTaskItem,
	TeamTaskComment,
	TeamTaskActivity,
	UpcomingTask,
	TaskActivityType,
	TaskStatus,
	TaskPriority,
} from '@/db/schema';
import { notificationEvents, publishEvent } from '@/db/events';
import { ORDER_STEP } from '@/lib/kanban';

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

type TaskWriter = Pick<PoolClient, 'query'> | Pool;

const TASK_COLUMNS = `
	tg.id, tg.team_id AS "teamId", tg.title AS "baslik", tg.description AS "aciklama", tg.status, tg.priority AS "oncelik",
	tg.assignee_id AS "atananUyeId", tg.due_at AS "teslimTarihi",
	tg.labels AS "etiketler", tg.created_by AS "olusturanId", tg.updated_at AS "guncellenme", tg.completed_at AS "tamamlanma",
	tg.xp_awarded AS "xpVerildi", tg.created_at AS "olusturma"
`;

const TASK_SELECT = `
	SELECT ${TASK_COLUMNS},
	       COALESCE(tg.position, -tg.created_at) AS "order",
	       k.first_name || ' ' || k.last_name AS "assigneeNameSurname",
	       o.first_name || ' ' || o.last_name AS "creatorNameSurname",
	       jsonb_array_length(COALESCE(tg.checklist, '[]'::jsonb))::int AS "itemCount",
	       (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem WHERE COALESCE((elem->>'doneMi')::int, 0) = 1) AS "doneItemCount",
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

function toTask(row: Record<string, unknown>): TeamTask {
	return { ...(row as unknown as TeamTask), tags: parseTags(row.tags) };
}

export async function logTaskActivity(
	db: TaskWriter,
	taskId: string,
	actorId: string | null | undefined,
	typeValue: TaskActivityType,
	detail?: Record<string, string | number | null>
): Promise<void> {
	const entry = {
		id: randomUUID(),
		taskId,
		actorId: actorId || null,
		typeValue,
		detail: detail ?? null,
		creation: Date.now(),
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

export async function getTeamTasks(teamId: string): Promise<TeamTask[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`${TASK_SELECT}
		WHERE tg.team_id = $1
		ORDER BY COALESCE(tg.position, -tg.created_at) ASC, tg.created_at DESC`,
		[teamId]
	);
	return res.rows.map(toTask);
}

export async function getUserUpcomingTasks(
	userId: string,
	until: number
): Promise<UpcomingTask[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT tg.id, tg.team_id AS "teamId", tg.title AS "title", tg.priority AS "priority", tg.due_at AS "dueDate", t.name AS "teamName"
		FROM team_tasks tg
		JOIN teams t ON t.id = tg.team_id
		WHERE tg.assignee_id = $1
		  AND tg.status <> 'tamamlandi'
		  AND tg.due_at IS NOT NULL
		  AND tg.due_at <= $2
		ORDER BY tg.due_at ASC
		LIMIT 20`,
		[userId, until]
	);
	return res.rows;
}

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
	const status = params.status ?? 'yapilacak';
	const task: TeamTask = {
		id,
		teamId: params.teamId,
		title: params.title.trim(),
		description: params.description?.trim() || '',
		status,
		priority: params.priority || 'orta',
		assigneeMemberId: params.assigneeMemberId || undefined,
		dueDate: params.dueDate,
		tags: params.tags ?? [],
		order: -now,
		creatorId: params.creatorId ?? null,
		update: now,
		completion: status === 'tamamlandi' ? now : null,
		creation: now,
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
				task.creation,
				task.order,
				JSON.stringify(task.tags),
				task.creatorId,
				task.update,
				task.completion,
			]
		);
		await logTaskActivity(client, id, params.creatorId, 'olusturuldu', { status });
		if (task.assigneeMemberId) {
			await logTaskActivity(client, id, params.creatorId, 'atandi', { to: task.assigneeMemberId });
			await publishEvent(client, notificationEvents([task.assigneeMemberId]));
		}
	});

	return task;
}

export async function getTeamTaskById(taskId: string): Promise<TeamTask | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${TASK_SELECT} WHERE tg.id = $1`, [taskId]);
	const row = res.rows[0];
	return row ? toTask(row) : null;
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
			     completed_at = CASE WHEN $1 = 'tamamlandi' THEN COALESCE(CASE WHEN status = 'tamamlandi' THEN completed_at END, $3) ELSE NULL END
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
			await logTaskActivity(client, params.taskId, params.actorId, 'tasindi', {
				from: row.status,
				to: params.status,
			});
		}

		if (params.status === 'tamamlandi' && row.assigneeMemberId && !Number(row.xpGiven)) {
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
			await logTaskActivity(client, taskId, actorId, 'duzenlendi', { fields: edited.join(',') });
		}
		if (assigneeChanged) {
			await logTaskActivity(client, taskId, actorId, 'atandi', {
				from: row.assigneeMemberId ?? null,
				to: patch.assigneeMemberId ?? null,
			});
			await publishEvent(client, notificationEvents([patch.assigneeMemberId]));
		}
		return true;
	});
	return found ? getTeamTaskById(taskId) : null;
}

export async function getTeamTaskDetail(taskId: string): Promise<TeamTaskDetail | null> {
	const task = await getTeamTaskById(taskId);
	if (!task) return null;
	const db = getPgPool();
	const [items, comments, activity] = await Promise.all([
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "taskId",
			        COALESCE(elem->>'text', '') AS text,
			        COALESCE((elem->>'doneMi')::int, 0) AS "doneMi",
			        COALESCE((elem->>'order')::float8, 0) AS "order",
			        COALESCE((elem->>'creation')::bigint, 0) AS creation
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'order')::float8, 0) ASC, COALESCE((elem->>'creation')::bigint, 0) ASC`,
			[taskId]
		),
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "taskId",
			        elem->>'userId' AS "userId",
			        COALESCE(elem->>'content', '') AS content,
			        COALESCE((elem->>'creation')::bigint, 0) AS creation,
			        k.first_name || ' ' || k.last_name AS "userNameSurname"
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.comments, '[]'::jsonb)) AS elem
			 LEFT JOIN users k ON k.id = (elem->>'userId')
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'creation')::bigint, 0) ASC`,
			[taskId]
		),
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "taskId",
			        elem->>'actorId' AS "actorId",
			        elem->>'typeValue' AS typeValue,
			        elem->'detail' AS detail,
			        COALESCE((elem->>'creation')::bigint, 0) AS creation,
			        k.first_name || ' ' || k.last_name AS "actorNameSurname"
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.activities, '[]'::jsonb)) AS elem
			 LEFT JOIN users k ON k.id = (elem->>'actorId')
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'creation')::bigint, 0) DESC
			 LIMIT 50`,
			[taskId]
		),
	]);
	return {
		task,
		items: items.rows.map((r) => ({
			...r,
			doneMi: Number(r.doneMi),
			order: Number(r.order),
			creation: Number(r.creation),
		})) as TeamTaskItem[],
		comments: comments.rows.map((r) => ({
			...r,
			creation: Number(r.creation),
		})) as TeamTaskComment[],
		activity: activity.rows.map((r) => {
			let detail: TeamTaskActivity['detail'] = null;
			if (typeof r.detail === 'string') {
				try {
					detail = JSON.parse(r.detail);
				} catch {
					detail = null;
				}
			} else if (r.detail && typeof r.detail === 'object') {
				detail = r.detail as TeamTaskActivity['detail'];
			}
			return {
				...(r as unknown as TeamTaskActivity),
				creation: Number(r.creation),
				detail,
			};
		}),
	};
}

export async function addTaskItem(taskId: string, text: string, actorId?: string): Promise<TeamTaskItem> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const max = await client.query(
			`SELECT COALESCE(MAX((elem->>'order')::float8), 0) AS m
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem
			 WHERE tg.id = $1`,
			[taskId]
		);
		const item: TeamTaskItem = {
			id: randomUUID(),
			taskId,
			text,
			doneMi: 0,
			order: Number(max.rows[0]?.m ?? 0) + 1,
			creation: Date.now(),
		};
		await client.query(
			`UPDATE team_tasks
			 SET checklist = COALESCE(checklist, '[]'::jsonb) || jsonb_build_array($1::jsonb),
			     updated_at = $2
			 WHERE id = $3`,
			[JSON.stringify(item), item.creation, taskId]
		);
		await logTaskActivity(client, taskId, actorId, 'madde_eklendi', { text: text.slice(0, 80) });
		return item;
	});
}

export async function getTaskItem(id: string): Promise<TeamTaskItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        tg.id AS "taskId",
		        COALESCE(elem->>'text', '') AS text,
		        COALESCE((elem->>'doneMi')::int, 0) AS "doneMi",
		        COALESCE((elem->>'order')::float8, 0) AS "order",
		        COALESCE((elem->>'creation')::bigint, 0) AS creation
		 FROM team_tasks tg,
		      jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem
		 WHERE elem->>'id' = $1
		 LIMIT 1`,
		[id]
	);
	const r = res.rows[0];
	if (!r) return null;
	return {
		id: String(r.id),
		taskId: String(r.taskId),
		text: String(r.text),
		doneMi: Number(r.doneMi),
		order: Number(r.order),
		creation: Number(r.creation),
	};
}

export async function updateTaskItem(
	id: string,
	patch: { text?: string; doneMi?: boolean },
	actorId?: string
): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const prev = await client.query(
			`SELECT tg.id AS "taskId", tg.checklist
			 FROM team_tasks tg
			 WHERE EXISTS (
			   SELECT 1 FROM jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem
			   WHERE elem->>'id' = $1
			 )
			 FOR UPDATE`,
			[id]
		);
		const row = prev.rows[0];
		if (!row) return false;
		const taskId = String(row.taskId);
		const checklist: Array<Record<string, unknown>> = Array.isArray(row.checklist) ? row.checklist : [];
		const idx = checklist.findIndex((item) => String(item.id) === id);
		if (idx === -1) return false;

		const currentItem = checklist[idx];
		const prevDoneMi = Number(currentItem.doneMi ?? 0);
		const text = patch.text ?? String(currentItem.text ?? '');
		const doneMi = patch.doneMi === undefined ? prevDoneMi : patch.doneMi ? 1 : 0;

		const nextChecklist = [...checklist];
		nextChecklist[idx] = {
			...currentItem,
			taskId,
			text,
			doneMi,
		};

		await client.query(
			'UPDATE team_tasks SET checklist = $1::jsonb, updated_at = $2 WHERE id = $3',
			[JSON.stringify(nextChecklist), Date.now(), taskId]
		);
		if (doneMi === 1 && prevDoneMi !== 1) {
			await logTaskActivity(client, taskId, actorId, 'madde_tamamlandi', {
				text: String(text).slice(0, 80),
			});
		}
		return true;
	});
}

export async function deleteTaskItem(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE team_tasks tg
		 SET checklist = COALESCE(
		       (SELECT jsonb_agg(elem) FROM jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem WHERE elem->>'id' <> $1),
		       '[]'::jsonb
		     ),
		     updated_at = $2
		 WHERE EXISTS (
		   SELECT 1 FROM jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem WHERE elem->>'id' = $1
		 )`,
		[id, Date.now()]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function addTaskComment(taskId: string, userId: string, content: string): Promise<TeamTaskComment> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const comment: TeamTaskComment = {
			id: randomUUID(),
			taskId,
			userId,
			content,
			creation: Date.now(),
		};
		await client.query(
			`UPDATE team_tasks
			 SET comments = COALESCE(comments, '[]'::jsonb) || jsonb_build_array($1::jsonb),
			     updated_at = $2
			 WHERE id = $3`,
			[JSON.stringify(comment), comment.creation, taskId]
		);
		await logTaskActivity(client, taskId, userId, 'yorum');
		return comment;
	});
}

export async function getTaskComment(id: string): Promise<TeamTaskComment | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        tg.id AS "taskId",
		        elem->>'userId' AS "userId",
		        COALESCE(elem->>'content', '') AS content,
		        COALESCE((elem->>'creation')::bigint, 0) AS creation
		 FROM team_tasks tg,
		      jsonb_array_elements(COALESCE(tg.comments, '[]'::jsonb)) AS elem
		 WHERE elem->>'id' = $1
		 LIMIT 1`,
		[id]
	);
	const r = res.rows[0];
	if (!r) return null;
	return {
		id: String(r.id),
		taskId: String(r.taskId),
		userId: r.userId ? String(r.userId) : null,
		content: String(r.content),
		creation: Number(r.creation),
	};
}

export async function deleteTaskComment(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`UPDATE team_tasks tg
		 SET comments = COALESCE(
		       (SELECT jsonb_agg(elem) FROM jsonb_array_elements(COALESCE(tg.comments, '[]'::jsonb)) AS elem WHERE elem->>'id' <> $1),
		       '[]'::jsonb
		     ),
		     updated_at = $2
		 WHERE EXISTS (
		   SELECT 1 FROM jsonb_array_elements(COALESCE(tg.comments, '[]'::jsonb)) AS elem WHERE elem->>'id' = $1
		 )`,
		[id, Date.now()]
	);
	return (res.rowCount ?? 0) > 0;
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
		 WHERE team_id = $1 AND assignee_id = $2 AND status <> 'tamamlandi'
		 RETURNING id`,
		[teamId, userId, Date.now()]
	);
	for (const row of open.rows) {
		await logTaskActivity(db, row.id as string, actorId, 'atandi', {
			from: userId,
			to: null,
		});
	}
}

export async function getUserNewAssignments(userId: string, since: number): Promise<NewAssignment[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT DISTINCT ON (tg.id)
		        tg.id, tg.team_id AS "teamId", t.name AS "teamName", tg.title AS "title",
		        k.first_name || ' ' || k.last_name AS "assigner", COALESCE((elem->>'creation')::bigint, 0) AS "at"
		 FROM team_tasks tg
		 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(tg.activities, '[]'::jsonb)) AS elem
		 JOIN teams t ON t.id = tg.team_id
		 LEFT JOIN users k ON k.id = (elem->>'actorId')
		 WHERE elem->>'typeValue' = 'atandi'
		   AND (elem->'detail'->>'to') = $1
		   AND ((elem->>'actorId') IS NULL OR (elem->>'actorId') <> $1)
		   AND COALESCE((elem->>'creation')::bigint, 0) >= $2
		   AND tg.assignee_id = $1
		   AND tg.status <> 'tamamlandi'
		 ORDER BY tg.id, COALESCE((elem->>'creation')::bigint, 0) DESC`,
		[userId, since]
	);
	return res.rows
		.map((r) => ({ ...(r as NewAssignment), at: Number(r.at) }))
		.sort((a, b) => b.at - a.at);
}

