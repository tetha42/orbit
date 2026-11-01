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

const TASK_SELECT = `
	SELECT tg.*,
	       COALESCE(tg.sira, -tg.olusturma) AS sira,
	       k.first_name || ' ' || k.last_name AS "atananAdSoyad",
	       o.first_name || ' ' || o.last_name AS "olusturanAdSoyad",
	       (SELECT COUNT(*) FROM team_task_items m WHERE m.gorevId = tg.id)::int AS "maddeSayisi",
	       (SELECT COUNT(*) FROM team_task_items m WHERE m.gorevId = tg.id AND m.tamamMi = 1)::int AS "tamamMaddeSayisi",
	       (SELECT COUNT(*) FROM team_task_comments y WHERE y.gorevId = tg.id)::int AS "yorumSayisi"
	FROM team_tasks tg
	LEFT JOIN users k ON tg.atananUyeId = k.id
	LEFT JOIN users o ON tg.olusturanId = o.id
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
	await db.query(
		`INSERT INTO team_task_activities (id, gorevId, aktorId, tur, detay, olusturma)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		[randomUUID(), gorevId, aktorId || null, tur, detay ? JSON.stringify(detay) : null, Date.now()]
	);
}

export async function touchTask(db: TaskWriter, gorevId: string): Promise<void> {
	await db.query('UPDATE team_tasks SET guncellenme = $1 WHERE id = $2', [Date.now(), gorevId]);
}

export async function getTeamTasks(teamId: string): Promise<TeamTask[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`${TASK_SELECT}
		WHERE tg.teamId = $1
		ORDER BY COALESCE(tg.sira, -tg.olusturma) ASC, tg.olusturma DESC`,
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
		`SELECT tg.id, tg.teamId, tg.baslik, tg.oncelik, tg.teslimTarihi, t.ad AS "takimAdi"
		FROM team_tasks tg
		JOIN teams t ON t.id = tg.teamId
		WHERE tg.atananUyeId = $1
		  AND tg.status <> 'tamamlandi'
		  AND tg.teslimTarihi IS NOT NULL
		  AND tg.teslimTarihi <= $2
		ORDER BY tg.teslimTarihi ASC
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
			   (id, teamId, baslik, aciklama, status, oncelik, atananUyeId, teslimTarihi, olusturma,
			    sira, etiketler, olusturanId, guncellenme, tamamlanma)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
			'SELECT teamId, status, atananUyeId, xpVerildi FROM team_tasks WHERE id = $1 FOR UPDATE',
			[params.gorevId]
		);
		const row = prev.rows[0];
		if (!row) return { xpVerildi: false };

		const now = Date.now();
		const statusChanged = row.status !== params.status;
		await client.query(
			`UPDATE team_tasks
			 SET status = $1,
			     sira = COALESCE($2, sira),
			     guncellenme = $3,
			     tamamlanma = CASE WHEN $1 = 'tamamlandi' THEN COALESCE(CASE WHEN status = 'tamamlandi' THEN tamamlanma END, $3) ELSE NULL END
			 WHERE id = $4`,
			[params.status, Number.isFinite(params.sira) ? params.sira : null, now, params.gorevId]
		);
		if (params.sirala?.length) {
			await client.query(
				`UPDATE team_tasks t
				 SET sira = v.idx * ${SIRA_ADIMI}
				 FROM unnest($1::text[]) WITH ORDINALITY AS v(id, idx)
				 WHERE t.id = v.id AND t.teamId = $2 AND t.status = $3`,
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
			await client.query('UPDATE team_tasks SET xpVerildi = 1 WHERE id = $1', [params.gorevId]);
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
		const prev = await client.query('SELECT * FROM team_tasks WHERE id = $1 FOR UPDATE', [gorevId]);
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

		if (patch.baslik !== undefined && patch.baslik !== row.baslik) set('baslik', patch.baslik, 'baslik');
		if (patch.aciklama !== undefined && patch.aciklama !== (row.aciklama ?? '')) set('aciklama', patch.aciklama, 'aciklama');
		if (patch.oncelik !== undefined && patch.oncelik !== row.oncelik) set('oncelik', patch.oncelik, 'oncelik');
		if (patch.teslimTarihi !== undefined && (patch.teslimTarihi ?? null) !== (row.teslimTarihi ?? null)) {
			set('teslimTarihi', patch.teslimTarihi, 'teslimTarihi');
		}
		if (patch.etiketler !== undefined) {
			const next = JSON.stringify(patch.etiketler);
			if (next !== JSON.stringify(parseEtiketler(row.etiketler))) set('etiketler', next, 'etiketler');
		}
		const assigneeChanged =
			patch.atananUyeId !== undefined && (patch.atananUyeId ?? null) !== (row.atananUyeId ?? null);
		if (assigneeChanged) set('atananUyeId', patch.atananUyeId, 'atananUyeId');

		if (sets.length === 0) return true;

		values.push(Date.now());
		sets.push(`guncellenme = $${values.length}`);
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
			'SELECT * FROM team_task_items WHERE gorevId = $1 ORDER BY sira ASC, olusturma ASC',
			[gorevId]
		),
		db.query(
			`SELECT y.*, k.first_name || ' ' || k.last_name AS "kullaniciAdSoyad"
			 FROM team_task_comments y
			 LEFT JOIN users k ON k.id = y.userId
			 WHERE y.gorevId = $1
			 ORDER BY y.olusturma ASC`,
			[gorevId]
		),
		db.query(
			`SELECT a.*, k.first_name || ' ' || k.last_name AS "aktorAdSoyad"
			 FROM team_task_activities a
			 LEFT JOIN users k ON k.id = a.aktorId
			 WHERE a.gorevId = $1
			 ORDER BY a.olusturma DESC
			 LIMIT 50`,
			[gorevId]
		),
	]);
	return {
		task,
		maddeler: maddeler.rows as TeamTaskItem[],
		yorumlar: yorumlar.rows as TeamTaskComment[],
		aktivite: aktivite.rows.map((r) => {
			let detay: TeamTaskActivity['detay'] = null;
			try {
				detay = r.detay ? JSON.parse(r.detay as string) : null;
			} catch {
				detay = null;
			}
			return { ...(r as unknown as TeamTaskActivity), detay };
		}),
	};
}

export async function addTaskItem(gorevId: string, metin: string, aktorId?: string): Promise<TeamTaskItem> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const max = await client.query(
			'SELECT COALESCE(MAX(sira), 0) AS m FROM team_task_items WHERE gorevId = $1',
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
			`INSERT INTO team_task_items (id, gorevId, metin, tamamMi, sira, olusturma)
			 VALUES ($1, $2, $3, 0, $4, $5)`,
			[madde.id, gorevId, metin, madde.sira, madde.olusturma]
		);
		await touchTask(client, gorevId);
		await logTaskActivity(client, gorevId, aktorId, 'madde_eklendi', { metin: metin.slice(0, 80) });
		return madde;
	});
}

export async function getTaskItem(id: string): Promise<TeamTaskItem | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM team_task_items WHERE id = $1', [id]);
	return (res.rows[0] as TeamTaskItem | undefined) ?? null;
}

export async function updateTaskItem(
	id: string,
	patch: { metin?: string; tamamMi?: boolean },
	aktorId?: string
): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const prev = await client.query('SELECT * FROM team_task_items WHERE id = $1 FOR UPDATE', [id]);
		const row = prev.rows[0];
		if (!row) return false;
		const metin = patch.metin ?? row.metin;
		const tamamMi = patch.tamamMi === undefined ? Number(row.tamamMi) : patch.tamamMi ? 1 : 0;
		await client.query('UPDATE team_task_items SET metin = $1, tamamMi = $2 WHERE id = $3', [metin, tamamMi, id]);
		await touchTask(client, row.gorevId as string);
		if (tamamMi === 1 && Number(row.tamamMi) !== 1) {
			await logTaskActivity(client, row.gorevId as string, aktorId, 'madde_tamamlandi', {
				metin: String(metin).slice(0, 80),
			});
		}
		return true;
	});
}

export async function deleteTaskItem(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM team_task_items WHERE id = $1', [id]);
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
			`INSERT INTO team_task_comments (id, gorevId, userId, icerik, olusturma)
			 VALUES ($1, $2, $3, $4, $5)`,
			[yorum.id, gorevId, userId, icerik, yorum.olusturma]
		);
		await touchTask(client, gorevId);
		await logTaskActivity(client, gorevId, userId, 'yorum');
		return yorum;
	});
}

export async function getTaskComment(id: string): Promise<TeamTaskComment | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT * FROM team_task_comments WHERE id = $1', [id]);
	return (res.rows[0] as TeamTaskComment | undefined) ?? null;
}

export async function deleteTaskComment(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM team_task_comments WHERE id = $1', [id]);
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
		`UPDATE team_tasks SET atananUyeId = NULL, guncellenme = $3
		 WHERE teamId = $1 AND atananUyeId = $2 AND status <> 'tamamlandi'
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
		        tg.id, tg.teamId AS "teamId", t.ad AS "takimAdi", tg.baslik,
		        k.first_name || ' ' || k.last_name AS "atayan", a.olusturma AS "at"
		 FROM team_task_activities a
		 JOIN team_tasks tg ON tg.id = a.gorevId
		 JOIN teams t ON t.id = tg.teamId
		 LEFT JOIN users k ON k.id = a.aktorId
		 WHERE a.tur = 'atandi'
		   AND a.detay::jsonb ->> 'to' = $1
		   AND (a.aktorId IS NULL OR a.aktorId <> $1)
		   AND a.olusturma >= $2
		   AND tg.atananUyeId = $1
		   AND tg.status <> 'tamamlandi'
		 ORDER BY tg.id, a.olusturma DESC`,
		[userId, since]
	);
	return (res.rows as YeniAtama[]).sort((a, b) => b.at - a.at);
}

