import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { TeamTaskComment, TeamTaskItem } from '@/db/schema';
import { logTaskActivity } from './shared';

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
		const now = Date.now();
		const item: TeamTaskItem = {
			id: randomUUID(),
			taskId,
			text,
			isDone: 0,
			order: Number(max.rows[0]?.m ?? 0) + 1,
			createdAt: now,
		};
		await client.query(
			`UPDATE team_tasks
			 SET checklist = COALESCE(checklist, '[]'::jsonb) || jsonb_build_array($1::jsonb),
			     updated_at = $2
			 WHERE id = $3`,
			[JSON.stringify(item), now, taskId]
		);
		await logTaskActivity(client, taskId, actorId, 'item_added', { text: text.slice(0, 80) });
		return item;
	});
}

export async function getTaskItem(id: string): Promise<TeamTaskItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        tg.id AS "taskId",
		        COALESCE(elem->>'text', '') AS text,
		        COALESCE((elem->>'isDone')::int, 0) AS "isDone",
		        COALESCE((elem->>'order')::float8, 0) AS "order",
		        COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) AS "createdAt"
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
		isDone: Number(r.isDone),
		order: Number(r.order),
		createdAt: Number(r.createdAt),
	};
}

export async function updateTaskItem(
	id: string,
	patch: { text?: string; isDone?: boolean },
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
		const prevIsDone = Number(currentItem.isDone ?? 0);
		const text = patch.text ?? String(currentItem.text ?? '');
		const isDone = patch.isDone === undefined ? prevIsDone : patch.isDone ? 1 : 0;

		const nextChecklist = [...checklist];
		nextChecklist[idx] = {
			...currentItem,
			taskId,
			text,
			isDone,
		};

		await client.query(
			'UPDATE team_tasks SET checklist = $1::jsonb, updated_at = $2 WHERE id = $3',
			[JSON.stringify(nextChecklist), Date.now(), taskId]
		);
		if (isDone === 1 && prevIsDone !== 1) {
			await logTaskActivity(client, taskId, actorId, 'item_completed', {
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
		const now = Date.now();
		const comment: TeamTaskComment = {
			id: randomUUID(),
			taskId,
			userId,
			content,
			createdAt: now,
		};
		await client.query(
			`UPDATE team_tasks
			 SET comments = COALESCE(comments, '[]'::jsonb) || jsonb_build_array($1::jsonb),
			     updated_at = $2
			 WHERE id = $3`,
			[JSON.stringify(comment), now, taskId]
		);
		await logTaskActivity(client, taskId, userId, 'comment');
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
		        COALESCE((elem->>'createdAt')::bigint, (elem->>'creation')::bigint, 0) AS "createdAt"
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
		createdAt: Number(r.createdAt),
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
