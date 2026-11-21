import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import { PENDING_APPLICATION_MAX, TEAM_LIMIT } from '@/lib/teams';
import { unassignTeamMemberTasks } from '../kanban.repo';
import { TEAM_COLUMNS, type TeamJoinResult } from './types';

export async function joinTeam(params: {
	teamId: string;
	userId: string;
	teamRole?: string;
	applicationNote?: string | null;
	direct?: boolean;
	/**
	 * Treat the join as an application even in an open team — for members who hold no role
	 * yet (onboarding), whom nobody has vetted. Also refuses a full team and caps pending applications.
	 */
	applicationRequired?: boolean;
}): Promise<TeamJoinResult> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (
			await client.query(`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.id = $1 FOR UPDATE`, [params.teamId])
		).rows[0];
		if (!team) return { ok: false, status: 404, message: 'Team not found.' };
		if (team.status !== 'active')
			return { ok: false, status: 409, message: 'This team is not currently accepting new members.' };

		const existing = (
			await client.query('SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2', [
				params.teamId,
				params.userId,
			])
		).rows[0];
		const current = existing?.status as string | undefined;
		if (current === 'active') return { ok: false, status: 409, message: 'You are already a member of this team.' };
		if (current === 'applied' && !params.direct)
			return { ok: false, status: 409, message: 'Your application is already pending review.' };

		const asApp = (team.participationType === 'approval' || !!params.applicationRequired) && !params.direct;
		if (!asApp || params.applicationRequired) {
			const count = await client.query(
				"SELECT COUNT(*)::int AS n FROM team_members WHERE team_id = $1 AND status = 'active'",
				[params.teamId]
			);
			if (Number(count.rows[0].n) >= Number(team.capacity))
				return { ok: false, status: 409, message: 'Team is at full capacity.' };
		}
		const mine = await client.query(
			"SELECT COUNT(*)::int AS n FROM team_members WHERE user_id = $1 AND status = 'active'",
			[params.userId]
		);
		if (Number(mine.rows[0].n) >= TEAM_LIMIT) {
			return {
				ok: false,
				status: 409,
				message: `You can be a member of at most ${TEAM_LIMIT} teams simultaneously.`,
			};
		}

		if (params.applicationRequired) {
			const pending = await client.query(
				"SELECT COUNT(*)::int AS n FROM team_members WHERE user_id = $1 AND status = 'applied'",
				[params.userId]
			);
			if (Number(pending.rows[0].n) >= PENDING_APPLICATION_MAX) {
				return {
					ok: false,
					status: 429,
					message: `You can have at most ${PENDING_APPLICATION_MAX} pending applications simultaneously.`,
				};
			}
		}

		const status = asApp ? 'applied' : 'active';
		if (current) {
			await client.query(
				'UPDATE team_members SET status = $1, role_title = COALESCE($2, role_title), ' +
					'application_note = COALESCE($3, application_note), decision = NULL, ' +
					'decided_by = NULL, decided_at = NULL, joined_at = $4 ' +
					'WHERE team_id = $5 AND user_id = $6',
				[status, params.teamRole || null, params.applicationNote ?? null, Date.now(), params.teamId, params.userId]
			);
		} else {
			await client.query(
				`INSERT INTO team_members (id, team_id, user_id, role_title, status, application_note, joined_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					randomUUID(),
					params.teamId,
					params.userId,
					params.teamRole || 'Developer',
					status,
					params.applicationNote || null,
					Date.now(),
				]
			);
		}
		return {
			ok: true,
			status,
			message: asApp ? 'Your application was submitted to the team captain.' : 'You joined the team.',
		};
	});
}

export async function leaveTeam(params: {
	teamId: string;
	userId: string;
	actorId?: string;
}): Promise<{ success: boolean; status?: number; message: string }> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (await client.query('SELECT lead_id AS "leadId" FROM teams WHERE id = $1', [params.teamId])).rows[0];
		if (!team) return { success: false, status: 404, message: 'Team not found.' };
		if (team.leadId === params.userId)
			return { success: false, status: 409, message: 'The captain cannot be removed; transfer captaincy first.' };

		const res = await client.query(
			'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING status',
			[params.teamId, params.userId]
		);
		if (!res.rowCount) return { success: false, status: 404, message: 'Team membership not found.' };

		await unassignTeamMemberTasks(client, params.teamId, params.userId, params.actorId ?? params.userId);
		return {
			success: true,
			message: res.rows[0].status === 'applied' ? 'Your application has been withdrawn.' : 'You have left the team.',
		};
	});
}

export async function decideTeamApplication(params: {
	teamId: string;
	userId: string;
	accept: boolean;
	decidedBy?: string | null;
}): Promise<{ success: boolean; status?: number; message: string }> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (
			await client.query(`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.id = $1 FOR UPDATE`, [params.teamId])
		).rows[0];
		if (!team) return { success: false, status: 404, message: 'Team not found.' };
		const app = await client.query(
			"SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'applied'",
			[params.teamId, params.userId]
		);
		if (!app.rowCount) return { success: false, status: 404, message: 'Pending application not found.' };
		const now = Date.now();
		const decidedBy = params.decidedBy ?? team.leadId ?? null;
		if (!params.accept) {
			await client.query(
				"UPDATE team_members SET status = 'rejected', decision = 'rejected', decided_by = $3, decided_at = $4 WHERE team_id = $1 AND user_id = $2",
				[params.teamId, params.userId, decidedBy, now]
			);
			return { success: true, message: 'Application rejected.' };
		}
		const count = await client.query(
			"SELECT COUNT(*)::int AS n FROM team_members WHERE team_id = $1 AND status = 'active'",
			[params.teamId]
		);
		if (Number(count.rows[0].n) >= Number(team.capacity))
			return { success: false, status: 409, message: 'Team is at full capacity.' };
		const mine = await client.query(
			"SELECT COUNT(*)::int AS n FROM team_members WHERE user_id = $1 AND status = 'active'",
			[params.userId]
		);
		if (Number(mine.rows[0].n) >= TEAM_LIMIT)
			return { success: false, status: 409, message: `This member is already in ${TEAM_LIMIT} teams.` };
		await client.query(
			"UPDATE team_members SET status = 'active', joined_at = $3, decision = 'accepted', decided_by = $4, decided_at = $3 WHERE team_id = $1 AND user_id = $2",
			[params.teamId, params.userId, now, decidedBy]
		);
		return { success: true, message: 'Application accepted.' };
	});
}

export async function setTeamMemberRole(teamId: string, userId: string, role: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		"UPDATE team_members SET role_title = $3 WHERE team_id = $1 AND user_id = $2 AND status = 'active'",
		[teamId, userId, role]
	);
	return (res.rowCount ?? 0) > 0;
}
