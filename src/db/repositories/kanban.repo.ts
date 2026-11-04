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
import { SIRA_ADIMI } from '@/lib/kanban';

export interface TeamTaskPatch {
	baslik?: string;
	aciklama?: string;
	oncelik?: TaskPriority;
	atananUyeId?: string | null;
	teslimTarihi?: number | null;
	etiketler?: string[];
}

export interface YeniAtama {
	id: string;
	teamId: string;
	takimAdi: string;
	baslik: string;
	atayan: string | null;
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
	       COALESCE(tg.position, -tg.created_at) AS sira,
	       k.first_name || ' ' || k.last_name AS "atananAdSoyad",
	       o.first_name || ' ' || o.last_name AS "olusturanAdSoyad",
	       jsonb_array_length(COALESCE(tg.checklist, '[]'::jsonb))::int AS "maddeSayisi",
	       (SELECT COUNT(*)::int FROM jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem WHERE COALESCE((elem->>'tamamMi')::int, 0) = 1) AS "tamamMaddeSayisi",
	       jsonb_array_length(COALESCE(tg.comments, '[]'::jsonb))::int AS "yorumSayisi"
	FROM team_tasks tg
	LEFT JOIN users k ON tg.assignee_id = k.id
	LEFT JOIN users o ON tg.created_by = o.id
`;

export function parseEtiketler(raw: unknown): string[] {
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
	return { ...(row as unknown as TeamTask), etiketler: parseEtiketler(row.etiketler) };
}

export async function logTaskActivity(
	db: TaskWriter,
	gorevId: string,
	aktorId: string | null | undefined,
	tur: TaskActivityType,
	detay?: Record<string, string | number | null>
): Promise<void> {
	const entry = {
		id: randomUUID(),
		gorevId,
		aktorId: aktorId || null,
		tur,
		detay: detay ?? null,
		olusturma: Date.now(),
	};
	await db.query(
		`UPDATE team_tasks
		 SET activities = COALESCE(activities, '[]'::jsonb) || jsonb_build_array($1::jsonb)
		 WHERE id = $2`,
		[JSON.stringify(entry), gorevId]
	);
}

export async function touchTask(db: TaskWriter, gorevId: string): Promise<void> {
	await db.query('UPDATE team_tasks SET updated_at = $1 WHERE id = $2', [Date.now(), gorevId]);
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
		`SELECT tg.id, tg.team_id AS "teamId", tg.title AS "baslik", tg.priority AS "oncelik", tg.due_at AS "teslimTarihi", t.name AS "takimAdi"
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
	baslik: string;
	aciklama?: string;
	oncelik?: TaskPriority;
	atananUyeId?: string;
	teslimTarihi?: number;
	etiketler?: string[];
	status?: TaskStatus;
	olusturanId?: string;
}): Promise<TeamTask> {
	await ensurePostgresInit();
	const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const now = Date.now();
	const status = params.status ?? 'yapilacak';
	const task: TeamTask = {
		id,
		teamId: params.teamId,
		baslik: params.baslik.trim(),
		aciklama: params.aciklama?.trim() || '',
		status,
		oncelik: params.oncelik || 'orta',
		atananUyeId: params.atananUyeId || undefined,
		teslimTarihi: params.teslimTarihi,
		etiketler: params.etiketler ?? [],
		sira: -now,
		olusturanId: params.olusturanId ?? null,
		guncellenme: now,
		tamamlanma: status === 'tamamlandi' ? now : null,
		olusturma: now,
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
				task.baslik,
				task.aciklama,
				task.status,
				task.oncelik,
				task.atananUyeId || null,
				task.teslimTarihi || null,
				task.olusturma,
				task.sira,
				JSON.stringify(task.etiketler),
				task.olusturanId,
				task.guncellenme,
				task.tamamlanma,
			]
		);
		await logTaskActivity(client, id, params.olusturanId, 'olusturuldu', { status });
		if (task.atananUyeId) {
			await logTaskActivity(client, id, params.olusturanId, 'atandi', { to: task.atananUyeId });
			await publishEvent(client, notificationEvents([task.atananUyeId]));
		}
	});

	return task;
}

export async function getTeamTaskById(gorevId: string): Promise<TeamTask | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${TASK_SELECT} WHERE tg.id = $1`, [gorevId]);
	const row = res.rows[0];
	return row ? toTask(row) : null;
}

export async function updateTeamTaskStatus(params: {
	gorevId: string;
	status: TaskStatus;
	sira?: number;
	sirala?: string[];
	aktorId?: string;
}): Promise<{ xpVerildi: boolean }> {
	return withTransaction(async (client) => {
		const prev = await client.query(
			'SELECT team_id AS "teamId", status, assignee_id AS "atananUyeId", xp_awarded AS "xpVerildi" FROM team_tasks WHERE id = $1 FOR UPDATE',
			[params.gorevId]
		);
		const row = prev.rows[0];
		if (!row) return { xpVerildi: false };

		const now = Date.now();
		const statusChanged = row.status !== params.status;
		await client.query(
			`UPDATE team_tasks
			 SET status = $1,
			     position = COALESCE($2, position),
			     updated_at = $3,
			     completed_at = CASE WHEN $1 = 'tamamlandi' THEN COALESCE(CASE WHEN status = 'tamamlandi' THEN completed_at END, $3) ELSE NULL END
			 WHERE id = $4`,
			[params.status, Number.isFinite(params.sira) ? params.sira : null, now, params.gorevId]
		);
		if (params.sirala?.length) {
			await client.query(
				`UPDATE team_tasks t
				 SET position = v.idx * ${SIRA_ADIMI}
				 FROM unnest($1::text[]) WITH ORDINALITY AS v(id, idx)
				 WHERE t.id = v.id AND t.team_id = $2 AND t.status = $3`,
				[params.sirala, row.teamId, params.status]
			);
		}
		if (statusChanged) {
			await logTaskActivity(client, params.gorevId, params.aktorId, 'tasindi', {
				from: row.status,
				to: params.status,
			});
		}

		if (params.status === 'tamamlandi' && row.atananUyeId && !Number(row.xpVerildi)) {
			await client.query('UPDATE team_tasks SET xp_awarded = 1 WHERE id = $1', [params.gorevId]);
			await client.query('UPDATE users SET xp = COALESCE(xp, 0) + 100 WHERE id = $1', [
				row.atananUyeId,
			]);
			return { xpVerildi: true };
		}
		return { xpVerildi: false };
	});
}

export async function updateTeamTask(
	gorevId: string,
	patch: TeamTaskPatch,
	aktorId?: string
): Promise<TeamTask | null> {
	await ensurePostgresInit();
	const found = await withTransaction(async (client) => {
		const prev = await client.query(`SELECT ${TASK_COLUMNS} FROM team_tasks tg WHERE tg.id = $1 FOR UPDATE`, [gorevId]);
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

		if (patch.baslik !== undefined && patch.baslik !== row.baslik) set('title', patch.baslik, 'baslik');
		if (patch.aciklama !== undefined && patch.aciklama !== (row.aciklama ?? '')) set('description', patch.aciklama, 'aciklama');
		if (patch.oncelik !== undefined && patch.oncelik !== row.oncelik) set('priority', patch.oncelik, 'oncelik');
		if (patch.teslimTarihi !== undefined && (patch.teslimTarihi ?? null) !== (row.teslimTarihi ?? null)) {
			set('due_at', patch.teslimTarihi, 'teslimTarihi');
		}
		if (patch.etiketler !== undefined) {
			const next = JSON.stringify(patch.etiketler);
			if (next !== JSON.stringify(parseEtiketler(row.etiketler))) set('labels', next, 'etiketler');
		}
		const assigneeChanged =
			patch.atananUyeId !== undefined && (patch.atananUyeId ?? null) !== (row.atananUyeId ?? null);
		if (assigneeChanged) set('assignee_id', patch.atananUyeId, 'atananUyeId');

		if (sets.length === 0) return true;

		values.push(Date.now());
		sets.push(`updated_at = $${values.length}`);
		values.push(gorevId);
		await client.query(`UPDATE team_tasks SET ${sets.join(', ')} WHERE id = $${values.length}`, values);

		const edited = changed.filter((f) => f !== 'atananUyeId');
		if (edited.length) {
			await logTaskActivity(client, gorevId, aktorId, 'duzenlendi', { alanlar: edited.join(',') });
		}
		if (assigneeChanged) {
			await logTaskActivity(client, gorevId, aktorId, 'atandi', {
				from: row.atananUyeId ?? null,
				to: patch.atananUyeId ?? null,
			});
			await publishEvent(client, notificationEvents([patch.atananUyeId]));
		}
		return true;
	});
	return found ? getTeamTaskById(gorevId) : null;
}

export async function getTeamTaskDetail(gorevId: string): Promise<TeamTaskDetail | null> {
	const task = await getTeamTaskById(gorevId);
	if (!task) return null;
	const db = getPgPool();
	const [maddeler, yorumlar, aktivite] = await Promise.all([
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "gorevId",
			        COALESCE(elem->>'metin', '') AS metin,
			        COALESCE((elem->>'tamamMi')::int, 0) AS "tamamMi",
			        COALESCE((elem->>'sira')::float8, 0) AS sira,
			        COALESCE((elem->>'olusturma')::bigint, 0) AS olusturma
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'sira')::float8, 0) ASC, COALESCE((elem->>'olusturma')::bigint, 0) ASC`,
			[gorevId]
		),
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "gorevId",
			        elem->>'userId' AS "userId",
			        COALESCE(elem->>'icerik', '') AS icerik,
			        COALESCE((elem->>'olusturma')::bigint, 0) AS olusturma,
			        k.first_name || ' ' || k.last_name AS "kullaniciAdSoyad"
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.comments, '[]'::jsonb)) AS elem
			 LEFT JOIN users k ON k.id = (elem->>'userId')
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'olusturma')::bigint, 0) ASC`,
			[gorevId]
		),
		db.query(
			`SELECT elem->>'id' AS id,
			        tg.id AS "gorevId",
			        elem->>'aktorId' AS "aktorId",
			        elem->>'tur' AS tur,
			        elem->'detay' AS detay,
			        COALESCE((elem->>'olusturma')::bigint, 0) AS olusturma,
			        k.first_name || ' ' || k.last_name AS "aktorAdSoyad"
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.activities, '[]'::jsonb)) AS elem
			 LEFT JOIN users k ON k.id = (elem->>'aktorId')
			 WHERE tg.id = $1
			 ORDER BY COALESCE((elem->>'olusturma')::bigint, 0) DESC
			 LIMIT 50`,
			[gorevId]
		),
	]);
	return {
		task,
		maddeler: maddeler.rows.map((r) => ({
			...r,
			tamamMi: Number(r.tamamMi),
			sira: Number(r.sira),
			olusturma: Number(r.olusturma),
		})) as TeamTaskItem[],
		yorumlar: yorumlar.rows.map((r) => ({
			...r,
			olusturma: Number(r.olusturma),
		})) as TeamTaskComment[],
		aktivite: aktivite.rows.map((r) => {
			let detay: TeamTaskActivity['detay'] = null;
			if (typeof r.detay === 'string') {
				try {
					detay = JSON.parse(r.detay);
				} catch {
					detay = null;
				}
			} else if (r.detay && typeof r.detay === 'object') {
				detay = r.detay as TeamTaskActivity['detay'];
			}
			return {
				...(r as unknown as TeamTaskActivity),
				olusturma: Number(r.olusturma),
				detay,
			};
		}),
	};
}

export async function addTaskItem(gorevId: string, metin: string, aktorId?: string): Promise<TeamTaskItem> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const max = await client.query(
			`SELECT COALESCE(MAX((elem->>'sira')::float8), 0) AS m
			 FROM team_tasks tg,
			      jsonb_array_elements(COALESCE(tg.checklist, '[]'::jsonb)) AS elem
			 WHERE tg.id = $1`,
			[gorevId]
		);
		const madde: TeamTaskItem = {
			id: randomUUID(),
			gorevId,
			metin,
			tamamMi: 0,
			sira: Number(max.rows[0]?.m ?? 0) + 1,
			olusturma: Date.now(),
		};
		await client.query(
			`UPDATE team_tasks
			 SET checklist = COALESCE(checklist, '[]'::jsonb) || jsonb_build_array($1::jsonb),
			     updated_at = $2
			 WHERE id = $3`,
			[JSON.stringify(madde), madde.olusturma, gorevId]
		);
		await logTaskActivity(client, gorevId, aktorId, 'madde_eklendi', { metin: metin.slice(0, 80) });
		return madde;
	});
}

export async function getTaskItem(id: string): Promise<TeamTaskItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        tg.id AS "gorevId",
		        COALESCE(elem->>'metin', '') AS metin,
		        COALESCE((elem->>'tamamMi')::int, 0) AS "tamamMi",
		        COALESCE((elem->>'sira')::float8, 0) AS sira,
		        COALESCE((elem->>'olusturma')::bigint, 0) AS olusturma
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
		gorevId: String(r.gorevId),
		metin: String(r.metin),
		tamamMi: Number(r.tamamMi),
		sira: Number(r.sira),
		olusturma: Number(r.olusturma),
	};
}

export async function updateTaskItem(
	id: string,
	patch: { metin?: string; tamamMi?: boolean },
	aktorId?: string
): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const prev = await client.query(
			`SELECT tg.id AS "gorevId", tg.checklist
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
		const gorevId = String(row.gorevId);
		const checklist: Array<Record<string, unknown>> = Array.isArray(row.checklist) ? row.checklist : [];
		const idx = checklist.findIndex((item) => String(item.id) === id);
		if (idx === -1) return false;

		const currentItem = checklist[idx];
		const prevTamamMi = Number(currentItem.tamamMi ?? 0);
		const metin = patch.metin ?? String(currentItem.metin ?? '');
		const tamamMi = patch.tamamMi === undefined ? prevTamamMi : patch.tamamMi ? 1 : 0;

		const nextChecklist = [...checklist];
		nextChecklist[idx] = {
			...currentItem,
			gorevId,
			metin,
			tamamMi,
		};

		await client.query(
			'UPDATE team_tasks SET checklist = $1::jsonb, updated_at = $2 WHERE id = $3',
			[JSON.stringify(nextChecklist), Date.now(), gorevId]
		);
		if (tamamMi === 1 && prevTamamMi !== 1) {
			await logTaskActivity(client, gorevId, aktorId, 'madde_tamamlandi', {
				metin: String(metin).slice(0, 80),
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

export async function addTaskComment(gorevId: string, userId: string, icerik: string): Promise<TeamTaskComment> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const yorum: TeamTaskComment = {
			id: randomUUID(),
			gorevId,
			userId,
			icerik,
			olusturma: Date.now(),
		};
		await client.query(
			`UPDATE team_tasks
			 SET comments = COALESCE(comments, '[]'::jsonb) || jsonb_build_array($1::jsonb),
			     updated_at = $2
			 WHERE id = $3`,
			[JSON.stringify(yorum), yorum.olusturma, gorevId]
		);
		await logTaskActivity(client, gorevId, userId, 'yorum');
		return yorum;
	});
}

export async function getTaskComment(id: string): Promise<TeamTaskComment | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT elem->>'id' AS id,
		        tg.id AS "gorevId",
		        elem->>'userId' AS "userId",
		        COALESCE(elem->>'icerik', '') AS icerik,
		        COALESCE((elem->>'olusturma')::bigint, 0) AS olusturma
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
		gorevId: String(r.gorevId),
		userId: r.userId ? String(r.userId) : null,
		icerik: String(r.icerik),
		olusturma: Number(r.olusturma),
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

export async function deleteTeamTask(gorevId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM team_tasks WHERE id = $1', [gorevId]);
	return (res.rowCount ?? 0) > 0;
}

export async function unassignTeamMemberTasks(
	db: Pick<PoolClient, 'query'>,
	teamId: string,
	userId: string,
	aktorId?: string
): Promise<void> {
	const open = await db.query(
		`UPDATE team_tasks SET assignee_id = NULL, updated_at = $3
		 WHERE team_id = $1 AND assignee_id = $2 AND status <> 'tamamlandi'
		 RETURNING id`,
		[teamId, userId, Date.now()]
	);
	for (const row of open.rows) {
		await logTaskActivity(db, row.id as string, aktorId, 'atandi', {
			from: userId,
			to: null,
		});
	}
}

export async function getUserNewAssignments(userId: string, since: number): Promise<YeniAtama[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT DISTINCT ON (tg.id)
		        tg.id, tg.team_id AS "teamId", t.name AS "takimAdi", tg.title AS "baslik",
		        k.first_name || ' ' || k.last_name AS "atayan", COALESCE((elem->>'olusturma')::bigint, 0) AS "at"
		 FROM team_tasks tg
		 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(tg.activities, '[]'::jsonb)) AS elem
		 JOIN teams t ON t.id = tg.team_id
		 LEFT JOIN users k ON k.id = (elem->>'aktorId')
		 WHERE elem->>'tur' = 'atandi'
		   AND (elem->'detay'->>'to') = $1
		   AND ((elem->>'aktorId') IS NULL OR (elem->>'aktorId') <> $1)
		   AND COALESCE((elem->>'olusturma')::bigint, 0) >= $2
		   AND tg.assignee_id = $1
		   AND tg.status <> 'tamamlandi'
		 ORDER BY tg.id, COALESCE((elem->>'olusturma')::bigint, 0) DESC`,
		[userId, since]
	);
	return res.rows
		.map((r) => ({ ...(r as YeniAtama), at: Number(r.at) }))
		.sort((a, b) => b.at - a.at);
}

