// Teams and tasks a suite builds through the API, and takes down again when it ends.
import { runTag } from './membership.mjs';

/**
 * Removes what an earlier run of these suites left behind when it was killed before its
 * cleanup ran: teams named "E2E …" and the throw-away members ("Test …@e2e.test").
 */
export async function sweepStale(admin) {
	const teams = (await admin.get('/api/teams')).json ?? [];
	for (const tm of teams) if (/^E2E /.test(tm.name)) await admin.post('/api/teams', { action: 'deleteTeam', teamId: tm.id });
	const roster = (await admin.get('/api/members')).json?.members ?? [];
	for (const m of roster) if (m.name === 'Test' && /@e2e\.test$/.test(m.email)) await admin.del(`/api/members?id=${encodeURIComponent(m.id)}`);
}

const DESC ='E2E sınaması için kurulan geçici takım; paket bitince silinir.';

/** Creates a team (management's `createTeam`) and deletes it when the suite ends. Returns the team row. */
export async function makeTeam(t, admin, { label, leadId, capacity = 6, participationType = 'open', category = 'Web & Mobil' }) {
	const res = await admin.post('/api/teams', {
		action: 'createTeam',
		name: `E2E ${label} ${runTag()}`,
		category,
		description: DESC,
		capacity,
		leadId,
		participationType,
	});
	if (!res.json?.team) throw new Error(`createTeam ${label}: ${res.status} ${JSON.stringify(res.json)}`);
	const team = res.json.team;
	t.cleanup(async () => {
		await admin.post('/api/teams', { action: 'deleteTeam', teamId: team.id });
	});
	return team;
}

/** The team as `/api/teams` shows it to `who` (an API client). */
export async function readTeam(who, teamId) {
	const res = await who.get(`/api/teams?teamId=${encodeURIComponent(teamId)}`);
	if (res.status !== 200) throw new Error(`team ${teamId}: ${res.status} ${JSON.stringify(res.json)}`);
	return res.json;
}

/** Adds a task through the API; returns the stored task. */
export async function addTask(who, teamId, fields = {}) {
	const res = await who.post('/api/teams', { action: 'addTask', teamId: teamId, title: `Görev ${runTag()}`, ...fields });
	if (!res.json?.task) throw new Error(`addTask: ${res.status} ${JSON.stringify(res.json)}`);
	return res.json.task;
}

/** One task with its checklist, comments and history (the sheet's data). */
export async function readTask(who, taskId) {
	const res = await who.get(`/api/teams/tasks/${encodeURIComponent(taskId)}`);
	return res;
}

/** A member's XP, as their own profile reports it. */
export async function xpOf(api) {
	const res = await api.get('/api/auth/me');
	return Number(res.json?.user?.xp ?? 0);
}
