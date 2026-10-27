// Teams and tasks a suite builds through the API, and takes down again when it ends.
import { runTag } from './uyelik.mjs';

/**
 * Removes what an earlier run of these suites left behind when it was killed before its
 * cleanup ran: teams named "E2E …" and the throw-away members ("Test …@e2e.test").
 */
export async function sweepStale(admin) {
	const teams = (await admin.get('/api/takimlar')).json ?? [];
	for (const tm of teams) if (/^E2E /.test(tm.ad)) await admin.post('/api/takimlar', { action: 'deleteTeam', takimId: tm.id });
	const roster = (await admin.get('/api/uyeler')).json?.members ?? [];
	for (const m of roster) if (m.ad === 'Test' && /@e2e\.test$/.test(m.eposta)) await admin.del(`/api/uyeler?id=${encodeURIComponent(m.id)}`);
}

const DESC ='E2E sınaması için kurulan geçici takım; paket bitince silinir.';

/** Creates a team (management's `createTeam`) and deletes it when the suite ends. Returns the team row. */
export async function makeTeam(t, admin, { label, liderId, kontenjan = 6, katilimTuru = 'acik', kategori = 'Web & Mobil' }) {
	const res = await admin.post('/api/takimlar', {
		action: 'createTeam',
		ad: `E2E ${label} ${runTag()}`,
		kategori,
		aciklama: DESC,
		kontenjan,
		liderId,
		katilimTuru,
	});
	if (!res.json?.team) throw new Error(`createTeam ${label}: ${res.status} ${JSON.stringify(res.json)}`);
	const team = res.json.team;
	t.cleanup(async () => {
		await admin.post('/api/takimlar', { action: 'deleteTeam', takimId: team.id });
	});
	return team;
}

/** The team as `/api/takimlar` shows it to `who` (an API client). */
export async function readTeam(who, teamId) {
	const res = await who.get(`/api/takimlar?takimId=${encodeURIComponent(teamId)}`);
	if (res.status !== 200) throw new Error(`team ${teamId}: ${res.status} ${JSON.stringify(res.json)}`);
	return res.json;
}

/** Adds a task through the API; returns the stored task. */
export async function addTask(who, teamId, fields = {}) {
	const res = await who.post('/api/takimlar', { action: 'addTask', takimId: teamId, baslik: `Görev ${runTag()}`, ...fields });
	if (!res.json?.gorev) throw new Error(`addTask: ${res.status} ${JSON.stringify(res.json)}`);
	return res.json.gorev;
}

/** One task with its checklist, comments and history (the sheet's data). */
export async function readTask(who, taskId) {
	const res = await who.get(`/api/takimlar/gorevler/${encodeURIComponent(taskId)}`);
	return res;
}

/** A member's XP, as their own profile reports it. */
export async function xpOf(api) {
	const res = await api.get('/api/auth/me');
	return Number(res.json?.user?.xp ?? 0);
}
