import { ensurePostgresInit, getPgPool } from '@/db/index';
import type {
	TaskActivityType,
	TeamTask,
	TeamTaskActivity,
	TeamTaskComment,
	TeamTaskDetail,
	TeamTaskItem,
	UpcomingTask,
} from '@/db/schema';
import { type NewAssignment, TASK_SELECT, toTask } from './shared';

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
		  AND tg.status <> 'done'
		  AND tg.due_at IS NOT NULL
		  AND tg.due_at <= $2
		ORDER BY tg.due_at ASC
		LIMIT 20`,
		[userId, until]
	);
	return res.rows;
}

export async function getTeamTaskById(taskId: string): Promise<TeamTask | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${TASK_SELECT} WHERE tg.id = $1`, [taskId]);
	const row = res.rows[0];
	return row ? toTask(row) : null;
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
			        COALESCE((elem->>'isDone')::int, 0) AS "isDone",
			        COALESCE((elem->>'order')::float8, 0) AS "order",
			        COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) AS "createdAt"
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'order')::float8, 0) ASC, COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) ASC`,
			[taskId]
		),
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "taskId",
			        elem->>'userId' AS "userId",
			        COALESCE(elem->>'content', '') AS content,
			        COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) AS "createdAt",
			        k.first_name || ' ' || k.last_name AS "userName"
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.comments, '[]'::jsonb)) AS elem
			 LEFT JOIN users k ON k.id = (elem->>'userId')
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) ASC`,
			[taskId]
		),
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "taskId",
			        elem->>'actorId' AS "actorId",
			        COALESCE(elem->>'type', elem->>'typeValue') AS type,
			        elem->'detail' AS detail,
			        COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) AS "createdAt",
			        k.first_name || ' ' || k.last_name AS "actorName"
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.activities, '[]'::jsonb)) AS elem
			 LEFT JOIN users k ON k.id = (elem->>'actorId')
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) DESC
			 LIMIT 50`,
			[taskId]
		),
	]);
	return {
		task,
		items: items.rows.map((r) => ({
			...r,
			isDone: Number(r.isDone),
			order: Number(r.order),
			createdAt: Number(r.createdAt),
		})) as TeamTaskItem[],
		comments: comments.rows.map((r) => ({
			...r,
			userName: r.userName ? String(r.userName) : null,
			createdAt: Number(r.createdAt),
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
				actorName: r.actorName ? String(r.actorName) : null,
				type: r.type as TaskActivityType,
				createdAt: Number(r.createdAt),
				detail,
			};
		}),
	};
}

export async function getUserNewAssignments(userId: string, since: number): Promise<NewAssignment[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT DISTINCT ON (tg.id)
		        tg.id, tg.team_id AS "teamId", t.name AS "teamName", tg.title AS "title",
		        k.first_name || ' ' || k.last_name AS "assigner", COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) AS "at"
		 FROM team_tasks tg
		 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(tg.activities, '[]'::jsonb)) AS elem
		 JOIN teams t ON t.id = tg.team_id
		 LEFT JOIN users k ON k.id = (elem->>'actorId')
		 WHERE COALESCE(elem->>'type', elem->>'typeValue') = 'assigned'
		   AND (elem->'detail'->>'to') = $1
		   AND ((elem->>'actorId') IS NULL OR (elem->>'actorId') <> $1)
		   AND COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) >= $2
		   AND tg.assignee_id = $1
		   AND tg.status <> 'done'
		 ORDER BY tg.id, COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) DESC`,
		[userId, since]
	);
	return res.rows
		.map((r) => ({ ...(r as NewAssignment), at: Number(r.at) }))
		.sort((a, b) => b.at - a.at);
}
