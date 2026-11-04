import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { slugify, uniqueSlug } from '@/lib/text';
import type { Project } from '@/db/schema';
import type { ProjectStatus } from '@/lib/projects';

const PROJECT_SELECT = `
	SELECT p.id, p.slug, p.title AS title, p.summary AS summary, p.description AS description,
	       p.repo_url AS "repoUrl", p.live_url AS "liveUrl", p.tech_stack AS technologies,
	       p.team_id AS "teamId", p.created_by AS "creatorId", p.status,
	       p.is_featured AS "oneLeaving", p.created_at AS creation, p.updated_at AS update,
	       p.owner_team_id, p.owner_user_id, p.created_by,
	       t.name AS "teamName",
	       k.first_name || ' ' || k.last_name AS "creatorNameSurname",
	       ot.name AS "ownerTeamName",
	       ou.first_name || ' ' || ou.last_name AS "ownerUserNameSurname",
	       jsonb_array_length(COALESCE(p.starred_by, '[]'::jsonb)) AS "likeCount",
	       (COALESCE(p.starred_by, '[]'::jsonb) ? $1::text) AS "likedByMe"
	FROM projects p
	LEFT JOIN teams t ON t.id = p.team_id
	LEFT JOIN users k ON k.id = p.created_by
	LEFT JOIN teams ot ON ot.id = p.owner_team_id
	LEFT JOIN users ou ON ou.id = p.owner_user_id
`;

function toProject(row: Record<string, unknown>): Project {
	let technologies: string[] = [];
	try {
		const raw = row.technologies;
		const parsed = Array.isArray(raw) ? raw : JSON.parse(String(raw ?? '[]'));
		if (Array.isArray(parsed)) technologies = parsed.filter((x): x is string => typeof x === 'string');
	} catch {
		technologies = [];
	}
	return { ...(row as unknown as Project), technologies, likedByMe: Boolean(row.likedByMe) };
}

/**
 * What one member may see: everything in the showcase and their own proposals.
 * Management also sees every proposal and the archive.
 */
export async function getProjects(viewerId: string, includeAll: boolean): Promise<Project[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`${PROJECT_SELECT}
		 WHERE $2::boolean OR p.status = 'published' OR p.created_by = $1
		 ORDER BY p.is_featured DESC, p.created_at DESC`,
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
	title: string;
	summary: string;
	description: string;
	repoUrl: string | null;
	liveUrl: string | null;
	technologies: string[];
	teamId: string | null;
	ownerTeamId?: string | null;
	ownerUserId?: string | null;
}

export async function createProject(input: ProjectInput & { creatorId: string; status: ProjectStatus }): Promise<Project> {
	await ensurePostgresInit();
	const db = getPgPool();
	const id = randomUUID();
	const now = Date.now();
	const slug = await uniqueSlug(
		slugify(input.title),
		async (candidate) => ((await db.query('SELECT 1 FROM projects WHERE slug = $1', [candidate])).rowCount ?? 0) > 0,
		'project'
	);
	await db.query(
		`INSERT INTO projects
			(id, slug, title, summary, description, repo_url, live_url, tech_stack, team_id,
			 status, is_featured, created_at, updated_at, owner_team_id, owner_user_id, created_by, starred_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $11, $12, $13, $14, '[]'::jsonb)`,
		[
			id,
			slug,
			input.title,
			input.summary,
			input.description,
			input.repoUrl,
			input.liveUrl,
			JSON.stringify(input.technologies),
			input.teamId,
			input.status,
			now,
			input.ownerTeamId ?? input.teamId,
			input.ownerUserId ?? input.creatorId,
			input.creatorId,
		]
	);
	return (await getProjectById(id, input.creatorId)) as Project;
}

/** Applies the given fields; omitted ones stay. Returns false when the project is gone. */
export async function updateProject(
	id: string,
	patch: Partial<ProjectInput> & { status?: ProjectStatus; oneLeaving?: boolean }
): Promise<boolean> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};
	if (patch.title !== undefined) set('title', patch.title);
	if (patch.summary !== undefined) set('summary', patch.summary);
	if (patch.description !== undefined) set('description', patch.description);
	if (patch.repoUrl !== undefined) set('repo_url', patch.repoUrl);
	if (patch.liveUrl !== undefined) set('live_url', patch.liveUrl);
	if (patch.technologies !== undefined) set('tech_stack', JSON.stringify(patch.technologies));
	if (patch.teamId !== undefined) set('team_id', patch.teamId);
	if (patch.ownerTeamId !== undefined) set('owner_team_id', patch.ownerTeamId);
	if (patch.ownerUserId !== undefined) set('owner_user_id', patch.ownerUserId);
	if (patch.status !== undefined) set('status', patch.status);
	if (patch.oneLeaving !== undefined) set('is_featured', patch.oneLeaving ? 1 : 0);
	set('updated_at', Date.now());
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
	projectId: string,
	userId: string
): Promise<{ likedByMe: boolean; likeCount: number }> {
	return withTransaction(async (client) => {
		const cur = await client.query(
			`SELECT COALESCE(starred_by, '[]'::jsonb) AS starred_by FROM projects WHERE id = $1 FOR UPDATE`,
			[projectId]
		);
		const rawList = cur.rows[0]?.starredBy ?? cur.rows[0]?.starred_by;
		const currentList: string[] = Array.isArray(rawList) ? rawList.map(String) : [];
		const alreadyStarred = currentList.includes(userId);
		const nextList = alreadyStarred
			? currentList.filter((id) => id !== userId)
			: [...currentList, userId];
		await client.query(
			`UPDATE projects SET starred_by = $2::jsonb WHERE id = $1`,
			[projectId, JSON.stringify(nextList)]
		);
		return { likedByMe: !alreadyStarred, likeCount: nextList.length };
	});
}
