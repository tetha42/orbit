import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool, withTransaction } from '@/db/index';
import type { Team, TeamMember } from '@/db/schema';
import { PENDING_APPLICATION_MAX, CAPTAIN_ROLE, TEAM_LIMIT } from '@/lib/teams';
import { slugify, uniqueSlug } from '@/lib/text';
import { unassignTeamMemberTasks } from './kanban.repo';

export * from './kanban.repo';

export type TeamJoinResult =
	| { ok: true; status: 'aktif' | 'basvurdu'; message: string }
	| { ok: false; status?: number; message: string };

export interface TeamPatch {
	name?: string;
	description?: string;
	category?: string;
	capacity?: number;
	repoUrl?: string | null;
	status?: 'aktif' | 'askida' | 'tamamlandi';
	participationType?: 'acik' | 'onayli';
	leadId?: string;
}

const TEAM_COLUMNS = `
	t.id, t.name AS "ad", t.slug, t.description AS "aciklama", t.category AS "kategori", t.lead_id AS "leadId",
	t.capacity AS "kontenjan", t.repo_url AS "repoUrl", t.status, t.join_policy AS "katilimTuru",
	t.type, t.quorum, t.created_at AS "olusturma"
`;

const TEAM_QUERY = `
	SELECT ${TEAM_COLUMNS}, k.first_name || ' ' || k.last_name as "leaderNameSurname",
	       (SELECT COUNT(*) FROM team_members tu WHERE tu.team_id = t.id AND tu.status = 'aktif')::int as "activeMemberCount"
	FROM teams t LEFT JOIN users k ON t.lead_id = k.id
`;

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
		        tu.status, tu.application_note AS "applicationNote", tu.joined_at AS "participationDate",
		        tu.voting_right, tu.term_start, tu.term_end,
		        k.first_name || ' ' || k.last_name as "userNameSurname", k.avatar_url as "userProfilePhoto",
		        k.department as "userDepartment", k.grade as "userGrade"
		FROM team_members tu JOIN users k ON tu.user_id = k.id
		WHERE tu.team_id = $1 AND tu.status IN ('aktif', 'basvurdu')
		ORDER BY tu.joined_at ASC`,
		[teamId]
	);
	return res.rows;
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query('SELECT team_id AS "teamId" FROM team_members WHERE user_id = $1 AND status = \'aktif\'', [userId]);
	return res.rows.map((r) => r.teamId);
}

export async function getLedTeams(userId: string): Promise<Team[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.lead_id = $1 ORDER BY t.name`, [userId]);
	return res.rows;
}

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
		const team = (await client.query(`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.id = $1 FOR UPDATE`, [params.teamId])).rows[0];
		if (!team) return { ok: false, status: 404, message: 'Takım bulunamadı.' };
		if (team.status !== 'aktif') return { ok: false, status: 409, message: 'Bu takım şu anda yeni üye almıyor.' };

		const existing = (await client.query('SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2', [params.teamId, params.userId])).rows[0];
		const current = existing?.status as string | undefined;
		if (current === 'aktif') return { ok: false, status: 409, message: 'Bu takıma zaten üyesiniz.' };
		if (current === 'basvurdu' && !params.direct) return { ok: false, status: 409, message: 'Başvurunuz zaten değerlendirmede.' };

		const asApp = (team.participationType === 'onayli' || !!params.applicationRequired) && !params.direct;
		// A direct join takes a seat now. A normal application waits for the captain, who is
		// held to the quota when accepting; the onboarding application is refused up front.
		if (!asApp || params.applicationRequired) {
			const count = await client.query("SELECT COUNT(*)::int AS n FROM team_members WHERE team_id = $1 AND status = 'aktif'", [params.teamId]);
			if (Number(count.rows[0].n) >= Number(team.capacity)) return { ok: false, status: 409, message: 'Takım kontenjanı dolu.' };
		}
		const mine = await client.query("SELECT COUNT(*)::int AS n FROM team_members WHERE user_id = $1 AND status = 'aktif'", [params.userId]);
		if (Number(mine.rows[0].n) >= TEAM_LIMIT) {
			return { ok: false, status: 409, message: `Aynı anda en fazla ${TEAM_LIMIT} takımda yer alabilirsiniz.` };
		}

		if (params.applicationRequired) {
			const pending = await client.query("SELECT COUNT(*)::int AS n FROM team_members WHERE user_id = $1 AND status = 'basvurdu'", [params.userId]);
			if (Number(pending.rows[0].n) >= PENDING_APPLICATION_MAX) {
				return { ok: false, status: 429, message: `Aynı anda en fazla ${PENDING_APPLICATION_MAX} başvurunuz bekleyebilir.` };
			}
		}

		const status = asApp ? 'basvurdu' : 'aktif';
		// A new try starts from a clean slate: the previous answer no longer applies.
		if (current) {
			await client.query(
				'UPDATE team_members SET status = $1, role_title = COALESCE($2, role_title), application_note = COALESCE($3, application_note), decision = NULL, decided_by = NULL, decided_at = NULL, joined_at = $4 WHERE team_id = $5 AND user_id = $6',
				[status, params.teamRole || null, params.applicationNote ?? null, Date.now(), params.teamId, params.userId]
			);
		} else {
			await client.query(
				`INSERT INTO team_members (id, team_id, user_id, role_title, status, application_note, joined_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[randomUUID(), params.teamId, params.userId, params.teamRole || 'Developer', status, params.applicationNote || null, Date.now()]
			);
		}
		return { ok: true, status, message: asApp ? 'Başvurunuz takım kaptanına iletildi.' : 'Takıma katıldınız.' };
	});
}

export async function leaveTeam(params: { teamId: string; userId: string; actorId?: string }): Promise<{ success: boolean; status?: number; message: string }> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (await client.query('SELECT lead_id AS "leadId" FROM teams WHERE id = $1', [params.teamId])).rows[0];
		if (!team) return { success: false, status: 404, message: 'Takım bulunamadı.' };
		if (team.leadId === params.userId) return { success: false, status: 409, message: 'Kaptan takımdan çıkarılamaz; önce kaptanlığı devredin.' };

		const res = await client.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING status', [params.teamId, params.userId]);
		if (!res.rowCount) return { success: false, status: 404, message: 'Takım üyeliği bulunamadı.' };

		await unassignTeamMemberTasks(client, params.teamId, params.userId, params.actorId ?? params.userId);
		return { success: true, message: res.rows[0].status === 'basvurdu' ? 'Başvurunuz geri çekildi.' : 'Takımdan ayrıldınız.' };
	});
}

export type ApplicationDecision = 'kabul' | 'red';

/** A team as the onboarding showcase lists it for one member. */
export interface TeamShowcaseRecord {
	id: string;
	name: string;
	slug: string;
	description: string;
	category: string;
	capacity: number;
	leaderNameSurname: string | null;
	participationType: 'acik' | 'onayli';
	activeMemberCount: number;
	remainingCapacity: number;
	/** The member's own standing in the team. */
	myMyStatus: 'aktif' | 'basvurdu' | null;
	/** The captain's last answer to this member's application, if any. */
	myMyDecision: ApplicationDecision | null;
	decisionDate: number | null;
}

/** The teams that are taking members, with the caller's own standing in each. No rosters, tasks or notes. */
export async function getTeamShowcase(userId: string): Promise<TeamShowcaseRecord[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT t.id, t.name AS "name", t.slug, t.description AS "description", t.category AS "category",
		        t.capacity AS "capacity", t.join_policy AS "participationType",
		        k.first_name || ' ' || k.last_name AS "leaderNameSurname",
		        (SELECT COUNT(*) FROM team_members a WHERE a.team_id = t.id AND a.status = 'aktif')::int AS "activeMemberCount",
		        CASE WHEN me.status IN ('aktif', 'basvurdu') THEN me.status ELSE NULL END AS "myMyStatus",
		        me.decision AS "myMyDecision",
		        me.decided_at AS "decisionDate"
		 FROM teams t
		 LEFT JOIN users k ON k.id = t.lead_id
		 LEFT JOIN team_members me ON me.team_id = t.id AND me.user_id = $1
		 WHERE t.status = 'aktif' OR me.status IN ('aktif', 'basvurdu') OR me.decision IS NOT NULL
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
		`SELECT d.team_id AS "teamId", t.name AS "teamName", d.decision AS "decision", d.decided_at AS "date"
		 FROM team_members d JOIN teams t ON t.id = d.team_id
		 WHERE d.user_id = $1 AND d.decision IS NOT NULL AND d.decided_at >= $2
		 ORDER BY d.decided_at DESC LIMIT 10`,
		[userId, since]
	);
	return res.rows;
}

export async function decideTeamApplication(params: { teamId: string; userId: string; accept: boolean; decidedBy?: string | null }): Promise<{ success: boolean; status?: number; message: string }> {
	await ensurePostgresInit();
	return withTransaction(async (client) => {
		const team = (await client.query(`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.id = $1 FOR UPDATE`, [params.teamId])).rows[0];
		if (!team) return { success: false, status: 404, message: 'Takım bulunamadı.' };
		const app = await client.query("SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'basvurdu'", [params.teamId, params.userId]);
		if (!app.rowCount) return { success: false, status: 404, message: 'Bekleyen başvuru bulunamadı.' };
		const now = Date.now();
		const decidedBy = params.decidedBy ?? team.leadId ?? null;
		if (!params.accept) {
			await client.query(
				"UPDATE team_members SET status = 'reddedildi', decision = 'red', decided_by = $3, decided_at = $4 WHERE team_id = $1 AND user_id = $2",
				[params.teamId, params.userId, decidedBy, now]
			);
			return { success: true, message: 'Başvuru reddedildi.' };
		}
		const count = await client.query("SELECT COUNT(*)::int AS n FROM team_members WHERE team_id = $1 AND status = 'aktif'", [params.teamId]);
		if (Number(count.rows[0].n) >= Number(team.capacity)) return { success: false, status: 409, message: 'Takım kontenjanı dolu.' };
		const mine = await client.query("SELECT COUNT(*)::int AS n FROM team_members WHERE user_id = $1 AND status = 'aktif'", [params.userId]);
		if (Number(mine.rows[0].n) >= TEAM_LIMIT) return { success: false, status: 409, message: `Bu üye zaten ${TEAM_LIMIT} takımda.` };
		await client.query(
			"UPDATE team_members SET status = 'aktif', joined_at = $3, decision = 'kabul', decided_by = $4, decided_at = $3 WHERE team_id = $1 AND user_id = $2",
			[params.teamId, params.userId, now, decidedBy]
		);
		return { success: true, message: 'Başvuru kabul edildi.' };
	});
}

export async function setTeamMemberRole(teamId: string, userId: string, role: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query("UPDATE team_members SET role_title = $3 WHERE team_id = $1 AND user_id = $2 AND status = 'aktif'", [teamId, userId, role]);
	return (res.rowCount ?? 0) > 0;
}

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
		const team = (await client.query(`SELECT ${TEAM_COLUMNS} FROM teams t WHERE t.id = $1 FOR UPDATE`, [id])).rows[0];
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
				`INSERT INTO team_members (id, team_id, user_id, role_title, status, joined_at) VALUES ($1, $2, $3, $4, 'aktif', $5)
				 ON CONFLICT (team_id, user_id) DO UPDATE SET status = 'aktif', role_title = $4`,
				[randomUUID(), id, patch.leadId, CAPTAIN_ROLE, Date.now()]
			);
			if (team.leadId) {
				await client.query(`UPDATE team_members SET role_title = 'R&D Member' WHERE team_id = $1 AND user_id = $2 AND role_title = $3`, [id, team.leadId, CAPTAIN_ROLE]);
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
	participationType?: 'acik' | 'onayli';
	type?: 'working_group' | 'committee';
	quorum?: number;
}): Promise<Team> {
	await ensurePostgresInit();
	const id = `tkm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
	const slug = await uniqueSlug(slugify(params.name), async (c) => ((await getPgPool().query('SELECT 1 FROM teams WHERE slug = $1', [c])).rowCount ?? 0) > 0, 'takim');
	const now = Date.now();
	const capacity = Number(params.capacity) || 6;
	const type = params.type ?? 'working_group';

	await getPgPool().query(
		`INSERT INTO teams (id, name, slug, category, description, lead_id, capacity, repo_url, status, created_at, join_policy, type, quorum)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'aktif', $9, $10, $11, $12)`,
		[id, params.name.trim(), slug, params.category.trim(), params.description.trim(), params.leadId || null, capacity, params.repoUrl?.trim() || null, now, params.participationType ?? 'acik', type, Number(params.quorum) || 0]
	);

	if (params.leadId) {
		const tuId = `tu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
		await getPgPool().query(
			`INSERT INTO team_members (id, team_id, user_id, role_title, status, joined_at, voting_right)
			 VALUES ($1, $2, $3, $4, 'aktif', $5, $6) ON CONFLICT (team_id, user_id) DO NOTHING`,
			[tuId, id, params.leadId, CAPTAIN_ROLE, now, type === 'committee' ? 1 : 0]
		);
	}
	const team = await getTeamById(id);
	if (!team) throw new Error('Takım oluşturulamadı');
	return team;
}

export async function deleteTeam(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM teams WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}

export async function getPendingTeamApplications(
	userId: string,
	allTeams: boolean
): Promise<{ teamId: string; teamName: string; userId: string; nameSurname: string; department: string; creation: number }[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT tu.team_id AS "teamId", t.name AS "teamName", tu.user_id AS "userId",
		        k.first_name || ' ' || k.last_name AS "nameSurname", k.department AS "department", tu.joined_at AS "creation"
		 FROM team_members tu JOIN teams t ON t.id = tu.team_id JOIN users k ON k.id = tu.user_id
		 WHERE tu.status = 'basvurdu' AND ($2::boolean OR t.lead_id = $1)
		 ORDER BY tu.joined_at DESC LIMIT 20`,
		[userId, allTeams]
	);
	return res.rows;
}
