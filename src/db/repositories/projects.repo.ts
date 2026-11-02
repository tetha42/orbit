import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { slugify, uniqueSlug } from '@/lib/text';
import type { Project } from '@/db/schema';
import type { ProjectStatus } from '@/lib/projects';

const PROJECT_SELECT = `
	SELECT p.*,
	       t.ad AS "takimAdi",
	       k.first_name || ' ' || k.last_name AS "olusturanAdSoyad",
	       ot.ad AS "ownerTeamAd",
	       ou.first_name || ' ' || ou.last_name AS "ownerUserAdSoyad",
	       (SELECT COUNT(*) FROM project_likes b WHERE b.projeId = p.id)::int AS "begeniSayisi",
	       EXISTS (SELECT 1 FROM project_likes b WHERE b.projeId = p.id AND b.userId = $1) AS "begendimMi"
	FROM projects p
	LEFT JOIN teams t ON t.id = p.teamId
	LEFT JOIN users k ON k.id = p.olusturanId
	LEFT JOIN teams ot ON ot.id = p.owner_team_id
	LEFT JOIN users ou ON ou.id = p.owner_user_id
`;

function toProject(row: Record<string, unknown>): Project {
	let teknolojiler: string[] = [];
	try {
		const parsed = JSON.parse(String(row.teknolojiler ?? '[]'));
		if (Array.isArray(parsed)) teknolojiler = parsed.filter((x): x is string => typeof x === 'string');
	} catch {
		teknolojiler = [];
	}
	return { ...(row as unknown as Project), teknolojiler, begendimMi: Boolean(row.begendimMi) };
}

/**
 * What one member may see: everything in the showcase and their own proposals.
 * Management also sees every proposal and the archive.
 */
export async function getProjects(viewerId: string, includeAll: boolean): Promise<Project[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`${PROJECT_SELECT}
		 WHERE $2::boolean OR p.status = 'yayinda' OR p.olusturanId = $1
		 ORDER BY p.oneCikan DESC, p.olusturma DESC`,
		[viewerId, includeAll]
	);
	return res.rows.map(toProject);
}

export async function getProjectById(id: string, viewerId: string): Promise<Project | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${PROJECT_SELECT} WHERE p.id = $2`, [viewerId, id]);
	return res.rows[0] ? toProject(res.rows[0]) : null;
}

export interface ProjectInput {
	baslik: string;
	ozet: string;
	aciklama: string;
	repoUrl: string | null;
	canliUrl: string | null;
	teknolojiler: string[];
	teamId: string | null;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
}

export async function createProject(input: ProjectInput & { olusturanId: string; status: ProjectStatus }): Promise<Project> {
	await ensurePostgresInit();
	const db = getPgPool();
	const id = randomUUID();
	const now = Date.now();
	const slug = await uniqueSlug(
		slugify(input.baslik),
		async (candidate) => ((await db.query('SELECT 1 FROM projects WHERE slug = $1', [candidate])).rowCount ?? 0) > 0,
		'proje'
	);
	await db.query(
		`INSERT INTO projects
			(id, slug, baslik, ozet, aciklama, repoUrl, canliUrl, teknolojiler, teamId, olusturanId,
			 status, oneCikan, olusturma, guncellenme, owner_team_id, owner_user_id, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $12, $13, $14, $10)`,
		[
			id,
			slug,
			input.baslik,
			input.ozet,
			input.aciklama,
			input.repoUrl,
			input.canliUrl,
			JSON.stringify(input.teknolojiler),
			input.teamId,
			input.olusturanId,
			input.status,
			now,
			input.ownerTeamId ?? input.teamId,
			input.ownerUserId ?? input.olusturanId,
		]
	);
	return (await getProjectById(id, input.olusturanId)) as Project;
}

/** Applies the given fields; omitted ones stay. Returns false when the project is gone. */
export async function updateProject(
	id: string,
	patch: Partial<ProjectInput> & { status?: ProjectStatus; oneCikan?: boolean }
): Promise<boolean> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};
	if (patch.baslik !== undefined) set('baslik', patch.baslik);
	if (patch.ozet !== undefined) set('ozet', patch.ozet);
	if (patch.aciklama !== undefined) set('aciklama', patch.aciklama);
	if (patch.repoUrl !== undefined) set('repoUrl', patch.repoUrl);
	if (patch.canliUrl !== undefined) set('canliUrl', patch.canliUrl);
	if (patch.teknolojiler !== undefined) set('teknolojiler', JSON.stringify(patch.teknolojiler));
	if (patch.teamId !== undefined) set('teamId', patch.teamId);
	if (patch.ownerTeamId !== undefined) set('owner_team_id', patch.ownerTeamId);
	if (patch.ownerUserId !== undefined) set('owner_user_id', patch.ownerUserId);
	if (patch.status !== undefined) set('status', patch.status);
	if (patch.oneCikan !== undefined) set('oneCikan', patch.oneCikan ? 1 : 0);
	set('guncellenme', Date.now());
	values.push(id);
	const res = await getPgPool().query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
	return (res.rowCount ?? 0) > 0;
}

export async function deleteProject(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM projects WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}

/** Stars or un-stars a project for one member; returns the new state and count. */
export async function toggleProjectLike(
	projeId: string,
	userId: string
): Promise<{ begendimMi: boolean; begeniSayisi: number }> {
	return withTransaction(async (client) => {
		const removed = await client.query('DELETE FROM project_likes WHERE projeId = $1 AND userId = $2', [
			projeId,
			userId,
		]);
		const begendimMi = (removed.rowCount ?? 0) === 0;
		if (begendimMi) {
			await client.query(
				'INSERT INTO project_likes (projeId, userId, olusturma) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
				[projeId, userId, Date.now()]
			);
		}
		const count = await client.query('SELECT COUNT(*)::int AS n FROM project_likes WHERE projeId = $1', [projeId]);
		return { begendimMi, begeniSayisi: Number(count.rows[0]?.n ?? 0) };
	});
}
