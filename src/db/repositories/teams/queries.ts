import { ensurePostgresInit, getPgPool } from '@/db/index';
import type { Team, TeamMember } from '@/db/schema';
import {
	TEAM_COLUMNS,
	TEAM_QUERY,
	type ApplicationDecision,
	type TeamShowcaseRecord,
} from './types';

export async function getTeams(): Promise<Team[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${TEAM_QUERY} ORDER BY t.created_at DESC`);
	return res.rows;
}

export async function getTeamById(id: string): Promise<Team | null> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`${TEAM_QUERY} WHERE t.id = $1 OR t.slug = $2`, [id, id]);
	return res.rows[0] || null;
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT tu.id, tu.team_id AS "teamId", tu.user_id AS "userId", tu.role_title AS "teamRole",
		        tu.status, tu.application_note AS "applicationNote", tu.joined_at AS "joinedAt",
		        tu.voting_right, tu.term_start, tu.term_end,
		        k.first_name || ' ' || k.last_name AS "userName", k.avatar_url AS "avatarUrl",
		        k.department AS "userDepartment", k.grade AS "userGrade"
		FROM team_members tu JOIN users k ON tu.user_id = k.id
		WHERE tu.team_id = $1 AND tu.status IN ('active', 'applied')
		ORDER BY tu.joined_at ASC`,
		[teamId]
	);
	return res.rows;
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		'SELECT team_id AS "teamId" FROM team_members WHERE user_id = $1 AND status = \'active\'',
		[userId]
	);
	return res.rows.map((r) => r.teamId);
}

export async function getLedTeams(userId: string): Promise<Team[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.lead_id = $1 ORDER BY t.name`,
		[userId]
	);
	return res.rows;
}

/** The teams that are taking members, with the caller's own standing in each. No rosters, tasks or notes. */
export async function getTeamShowcase(userId: string): Promise<TeamShowcaseRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT t.id, t.name AS "name", t.slug, t.description AS "description", t.category AS "category",
		        t.capacity AS "capacity", t.join_policy AS "participationType",
		        k.first_name || ' ' || k.last_name AS "leaderName",
		        (SELECT COUNT(*) FROM team_members a WHERE a.team_id = t.id AND a.status = 'active')::int AS "activeMemberCount",
		        CASE WHEN me.status IN ('active', 'applied') THEN me.status ELSE NULL END AS "myStatus",
		        CASE WHEN me.decision = 'red' THEN 'rejected' ELSE me.decision END AS "myDecision",
		        me.decided_at AS "decisionDate"
		 FROM teams t
		 LEFT JOIN users k ON k.id = t.lead_id
		 LEFT JOIN team_members me ON me.team_id = t.id AND me.user_id = $1
		 WHERE t.status = 'active' OR me.status IN ('active', 'applied') OR me.decision IS NOT NULL
		 ORDER BY t.created_at DESC`,
		[userId]
	);
	return res.rows.map((r) => ({
		...r,
		remainingCapacity: Math.max(0, Number(r.capacity) - Number(r.activeMemberCount)),
	}));
}

/** Answers to this member's applications since `since`, newest first — for the notification feed. */
export async function getUserApplicationDecisions(
	userId: string,
	since: number
): Promise<{ teamId: string; teamName: string; decision: ApplicationDecision; date: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT d.team_id AS "teamId", t.name AS "teamName",
		        CASE WHEN d.decision = 'red' THEN 'rejected' ELSE d.decision END AS "decision",
		        d.decided_at AS "date"
		 FROM team_members d JOIN teams t ON t.id = d.team_id
		 WHERE d.user_id = $1 AND d.decision IS NOT NULL AND d.decided_at >= $2
		 ORDER BY d.decided_at DESC LIMIT 10`,
		[userId, since]
	);
	return res.rows;
}

export async function getPendingTeamApplications(
	userId: string,
	allTeams: boolean
): Promise<
	{
		teamId: string;
		teamName: string;
		userId: string;
		applicantName: string;
		department: string;
		createdAt: number;
	}[]
> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT tu.team_id AS "teamId", t.name AS "teamName", tu.user_id AS "userId",
		        k.first_name || ' ' || k.last_name AS "applicantName", k.department AS "department",
		        tu.joined_at AS "createdAt"
		 FROM team_members tu JOIN teams t ON t.id = tu.team_id JOIN users k ON k.id = tu.user_id
		 WHERE tu.status = 'applied' AND ($2::boolean OR t.lead_id = $1)
		 ORDER BY tu.joined_at DESC LIMIT 20`,
		[userId, allTeams]
	);
	return res.rows;
}
