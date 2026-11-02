import { randomUUID } from 'crypto';
import { ensurePostgresInit, getPgPool } from '@/db';
import type { Decision, Team, TeamMember } from '@/db/schema';
import { createTeam, getTeamById } from './teams.repo';

export interface CommitteeMeeting {
	id: string;
	committeeId: string;
	title: string;
	date: number;
	agenda: string;
	minutes: string;
	status: string;
	createdBy: string | null;
	createdAt: number;
	updatedAt: number;
}

export interface CommitteeDetail {
	committee: Team;
	members: Array<TeamMember & { votingRight: number; termStart: number | null; termEnd: number | null }>;
	meetings: CommitteeMeeting[];
	decisions: Decision[];
}

const MEETING_COLUMNS = `id, committee_id AS "committeeId", title, date, agenda, minutes,
	status, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`;

function mapMeeting(row: Record<string, unknown>): CommitteeMeeting {
	return {
		id: String(row.id),
		committeeId: String(row.committeeId),
		title: String(row.title ?? ''),
		date: Number(row.date) || 0,
		agenda: String(row.agenda ?? ''),
		minutes: String(row.minutes ?? ''),
		status: String(row.status ?? 'planned'),
		createdBy: row.createdBy ? String(row.createdBy) : null,
		createdAt: Number(row.createdAt) || 0,
		updatedAt: Number(row.updatedAt) || 0,
	};
}

export async function listCommittees(): Promise<Team[]> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		`SELECT t.*, k.first_name || ' ' || k.last_name AS "liderAdSoyad",
		        (SELECT COUNT(*) FROM team_members tu WHERE tu.teamId = t.id AND tu.status = 'aktif')::int AS "aktifUyeSayisi"
		 FROM teams t LEFT JOIN users k ON k.id = t.liderId
		 WHERE t.type = 'committee'
		 ORDER BY t.olusturma DESC`
	);
	return res.rows as Team[];
}

export async function getCommitteeDetail(id: string): Promise<CommitteeDetail | null> {
	const committee = await getTeamById(id);
	if (!committee || committee.type !== 'committee') return null;
	const [members, meetings, decisions] = await Promise.all([
		getPgPool().query(
			`SELECT tu.*, k.first_name || ' ' || k.last_name AS "kullaniciAdSoyad",
			        k.department AS "kullaniciBolum", k.avatar_url AS "kullaniciProfilFoto",
			        tu.voting_right AS "votingRight", tu.term_start AS "termStart", tu.term_end AS "termEnd"
			 FROM team_members tu JOIN users k ON tu.userId = k.id
			 WHERE tu.teamId = $1 AND tu.status = 'aktif'
			 ORDER BY tu.voting_right DESC, tu.katilimTarihi ASC`,
			[id]
		),
		getPgPool().query(
			`SELECT ${MEETING_COLUMNS} FROM committee_meetings
			 WHERE committee_id = $1 ORDER BY date DESC`,
			[id]
		),
		getPgPool().query(
			`SELECT d.*, b.ad AS "bodyAd", k.first_name || ' ' || k.last_name AS "olusturanAdSoyad"
			 FROM decisions d
			 LEFT JOIN teams b ON b.id = d.body_id
			 LEFT JOIN users k ON k.id = d.olusturanId
			 WHERE d.body_id = $1 ORDER BY d.date DESC`,
			[id]
		),
	]);
	return {
		committee,
		members: members.rows as CommitteeDetail['members'],
		meetings: meetings.rows.map(mapMeeting),
		decisions: decisions.rows.map((row) => ({
			...row,
			kamuyaAcikMi: Number(row.kamuyaAcikMi),
			kilitliMi: Number(row.kilitliMi),
		})) as Decision[],
	};
}

export async function createCommittee(input: {
	ad: string;
	kategori: string;
	aciklama: string;
	quorum?: number;
	liderId?: string;
	kontenjan?: number;
}): Promise<Team> {
	return createTeam({
		...input,
		type: 'committee',
		katilimTuru: 'onayli',
	});
}

export async function addCommitteeMember(input: {
	committeeId: string;
	userId: string;
	role?: string;
	votingRight?: boolean;
	termStart?: number | null;
	termEnd?: number | null;
}): Promise<boolean> {
	await ensurePostgresInit();
	const committee = await getCommitteeDetail(input.committeeId);
	if (!committee) return false;
	const now = Date.now();
	const id = `tu_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
	const res = await getPgPool().query(
		`INSERT INTO team_members (id, teamId, userId, takimRolu, status, katilimTarihi, voting_right, term_start, term_end)
		 VALUES ($1, $2, $3, $4, 'aktif', $5, $6, $7, $8)
		 ON CONFLICT (teamId, userId) DO UPDATE SET
			takimRolu = EXCLUDED.takimRolu, status = 'aktif',
			voting_right = EXCLUDED.voting_right, term_start = EXCLUDED.term_start, term_end = EXCLUDED.term_end`,
		[
			id,
			input.committeeId,
			input.userId,
			input.role?.trim() || 'Member',
			now,
			input.votingRight === false ? 0 : 1,
			input.termStart ?? null,
			input.termEnd ?? null,
		]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function removeCommitteeMember(committeeId: string, userId: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query(
		"DELETE FROM team_members WHERE teamId = $1 AND userId = $2 AND takimRolu <> 'Team Captain'",
		[committeeId, userId]
	);
	return (res.rowCount ?? 0) > 0;
}

export async function createCommitteeMeeting(input: {
	committeeId: string;
	title: string;
	date: number;
	agenda?: string;
	minutes?: string;
	status?: string;
	createdBy: string;
}): Promise<CommitteeMeeting> {
	await ensurePostgresInit();
	const now = Date.now();
	const id = `cm_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
	const res = await getPgPool().query(
		`INSERT INTO committee_meetings
			(id, committee_id, title, date, agenda, minutes, status, created_by, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
		 RETURNING ${MEETING_COLUMNS}`,
		[
			id,
			input.committeeId,
			input.title.trim(),
			input.date,
			(input.agenda ?? '').trim(),
			(input.minutes ?? '').trim(),
			input.status ?? 'planned',
			input.createdBy,
			now,
		]
	);
	return mapMeeting(res.rows[0]);
}

export async function updateCommitteeMeeting(
	id: string,
	patch: { title?: string; date?: number; agenda?: string; minutes?: string; status?: string }
): Promise<boolean> {
	await ensurePostgresInit();
	const sets: string[] = [];
	const values: unknown[] = [];
	const set = (column: string, value: unknown) => {
		values.push(value);
		sets.push(`${column} = $${values.length}`);
	};
	if (patch.title !== undefined) set('title', patch.title);
	if (patch.date !== undefined) set('date', patch.date);
	if (patch.agenda !== undefined) set('agenda', patch.agenda);
	if (patch.minutes !== undefined) set('minutes', patch.minutes);
	if (patch.status !== undefined) set('status', patch.status);
	if (!sets.length) return true;
	values.push(Date.now());
	sets.push(`updated_at = $${values.length}`);
	values.push(id);
	const res = await getPgPool().query(
		`UPDATE committee_meetings SET ${sets.join(', ')} WHERE id = $${values.length}`,
		values
	);
	return (res.rowCount ?? 0) > 0;
}

export async function deleteCommitteeMeeting(id: string): Promise<boolean> {
	await ensurePostgresInit();
	const res = await getPgPool().query('DELETE FROM committee_meetings WHERE id = $1', [id]);
	return (res.rowCount ?? 0) > 0;
}
