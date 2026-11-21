import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { Team } from '@/db/schema';
import { CAPTAIN_ROLE } from '@/lib/teams';
import { slugify, uniqueSlug } from '@/lib/text';
import { getTeamById } from './queries';
import { TEAM_COLUMNS, type TeamPatch } from './types';

const PATCH_COLUMN_MAP: Record<string, string> = {
	name: 'name',
	description: 'description',
	category: 'category',
	capacity: 'capacity',
	repoUrl: 'repo_url',
	status: 'status',
	participationType: 'join_policy',
};

export async function updateTeam(id: string, patch: TeamPatch): Promise<boolean> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (
			await client.query(`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.id = $1 FOR UPDATE`, [id])
		).rows[0];
		if (!team) return false;
		const sets: string[] = [];
		const values: unknown[] = [];
		const set = (col: string, val: unknown) => {
			values.push(val);
			sets.push(`${col} = $${values.length}`);
		};
		for (const key of ['name', 'description', 'category', 'capacity', 'repoUrl', 'status', 'participationType'] as const) {
			if (patch[key] !== undefined) set(PATCH_COLUMN_MAP[key], patch[key]);
		}
		if (patch.leadId !== undefined && patch.leadId !== team.leadId) {
			set('lead_id', patch.leadId);
			await client.query(
				`INSERT INTO team_members (id, team_id, user_id, role_title, status, joined_at) VALUES ($1, $2, $3, $4, 'active', $5)
				 ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'active', role_title = $4`,
				[randomUUID(), id, patch.leadId, CAPTAIN_ROLE, Date.now()]
			);
			if (team.leadId) {
				await client.query(
					`UPDATE team_members SET role_title = 'R&D Member' WHERE team_id = $1 AND user_id = $2 AND role_title = $3`,
					[id, team.leadId, CAPTAIN_ROLE]
				);
			}
		}
		if (!sets.length) return true;
		values.push(id);
		await client.query(`UPDATE teams SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
		return true;
	});
}

export async function createTeam(params: {
	name: string;
	category: string;
	description: string;
	capacity?: number;
	repoUrl?: string;
	leadId?: string;
	participationType?: 'open' | 'approval';
	type?: 'working_group' | 'committee';
	quorum?: number;
}): Promise<Team> {
	await ensurePostgresInit();
	const id = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const slug = await uniqueSlug(
		slugify(params.name),
		async (c) => ((await getPgPool().query('SELECT 1 FROM teams WHERE slug = $1', [c])).rowCount ?? 0) > 0,
		'team'
	);
	const now = Date.now();
	const capacity = Number(params.capacity) || 6;
	const type = params.type ?? 'working_group';

	await getPgPool().query(
		`INSERT INTO teams (id, name, slug, category, description, lead_id, capacity, repo_url, status, created_at, join_policy, type, quorum)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, $12)`,
		[
			id,
			params.name.trim(),
			slug,
			params.category.trim(),
			params.description.trim(),
			params.leadId || null,
			capacity,
			params.repoUrl?.trim() || null,
			now,
			params.participationType ?? 'open',
			type,
			Number(params.quorum) || 0,
		]
	);

	if (params.leadId) {
		const tmId = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
		await getPgPool().query(
			`INSERT INTO team_members (id, team_id, user_id, role_title, status, joined_at, voting_right)
			 VALUES ($1, $2, $3, $4, 'active', $5, $6) ON CONFLICT (team_id, user_id) DO NOTHING`,
			[tmId, id, params.leadId, CAPTAIN_ROLE, now, type === 'committee' ? 1 : 0]
		);
	}
	const team = await getTeamById(id);
	if (!team) throw new Error('Could not create team.');
	return team;
}

export async function deleteTeam(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM teams WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
