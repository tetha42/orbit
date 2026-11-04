// Onboarding, end to end over HTTP: the team showcase for a member with no role, the
// application (always reviewed by the captain), the captain's answer reaching the
// applicant live and in their feed, and the guards around all of it.
//
//   node scripts/dev-fixtures.mjs --out F.json && node tests/e2e/onboarding-api.mjs --fixtures F.json [--base URL]
//
// Needs the fixture accounts (admin, ege = captain of the fixture team, can = Üye) and
// DATABASE_URL (or config.ini) to strip the new member's role / graduate them.
// Creates its own members and teams (named "ob-test-…") and removes the teams again. Never run against production.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import { loadConfigIni } from '../../scripts/ini-loader.mjs';

const require = createRequire(import.meta.url);
const { generate } = require('otplib');
const arg = (n, d) => (process.argv.indexOf(n) > 0 ? process.argv[process.argv.indexOf(n) + 1] : d);
const BASE = arg('--base', 'http://localhost:3000');
const FX = JSON.parse(fs.readFileSync(arg('--fixtures', '.fixtures.json'), 'utf8'));
const ini = loadConfigIni(process.cwd());
const DATABASE_URL = process.env.DATABASE_URL || ini?.database?.url;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is required for tests/e2e/onboarding-api.mjs');
	process.exit(1);
}
const db = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });

const userTable = 'users';
const roleCol = 'role_id';
const statusCol = 'status';
const teamsTable = 'teams';
const teamMembersTable = 'team_members';
const teamDecisionsTable = 'team_application_decisions';

let pass = 0;
let fail = 0;
const ok = (cond, name, extra = '') => {
	if (cond) pass++;
	else fail++;
	console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && extra ? ` — ${extra}` : ''}`);
};

function client() {
	let cookie = '';
	const call = async (method, path, body) => {
		const res = await fetch(BASE + path, {
			method,
			headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
		const set = res.headers.get('set-cookie');
		if (set && set.includes('club_session_token=')) cookie = set.split(';')[0];
		return { status: res.status, json: await res.json().catch(() => null) };
	};
	/** The live stream: resolves with the event names heard until `stop()`. */
	const listen = async () => {
		const ctrl = new AbortController();
		const res = await fetch(BASE + '/api/stream', { headers: { cookie }, signal: ctrl.signal });
		const heard = [];
		(async () => {
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					for (const m of dec.decode(value).matchAll(/event: (\S+)/g)) heard.push(m[1]);
				}
			} catch {
				// aborted
			}
		})();
		return { heard, stop: () => ctrl.abort(), status: res.status };
	};
	return { call, listen };
}

const usedWindows = new Map();
async function code(secret) {
	const w = Math.floor(Date.now() / 30000);
	if (usedWindows.get(secret) === w) await new Promise((r) => setTimeout(r, 30500 - (Date.now() % 30000)));
	usedWindows.set(secret, Math.floor(Date.now() / 30000));
	return generate({ secret });
}
async function login(email, password, totp) {
	const c = client();
	const r = await c.call('POST', '/api/auth/login', { email, password });
	if (r.json?.require2fa) {
		const v = await c.call('POST', '/api/auth/2fa/challenge', { challengeToken: r.json.challengeToken, code: await code(totp) });
		if (v.status !== 200) throw new Error(`2FA ${email}: ${v.status}`);
	} else if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
	return c;
}
const until = async (fn, ms = 4000) => {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (await fn()) return true;
		await new Promise((r) => setTimeout(r, 100));
	}
	return false;
};

const U = FX.users;
const teamId = FX.content.team.team.id; // open team, captain: ege
const admin = await login(FX.admin.email, FX.admin.password, FX.adminTotp);
const ege = await login(U.ege.email, U.ege.password);
const can = await login(U.can.email, U.can.password);
const anon = client();

// A fresh member nobody has given a role.
const suffix = Date.now().toString(36);
const created = (await admin.call('POST', '/api/members', { name: 'Yeni', surname: 'Öğrenci', email: `ob-${suffix}@club.test`, department: 'Bilgisayar Mühendisliği', grade: 1, roleId: FX.roles.member })).json;
const newId = created.member.id;
const newUser = client();
await newUser.call('POST', '/api/auth/login', { email: `ob-${suffix}@club.test`, password: created.temporaryPassword });
await newUser.call('POST', '/api/profile/password', { current: created.temporaryPassword, fresh: 'Kulup-Test-2026!' });
await db.query(`UPDATE ${userTable} SET ${roleCol} = NULL WHERE id = $1`, [newId]);
const me = (await newUser.call('GET', '/api/auth/me')).json?.user;
ok(me && me.roleInfo === null, 'fixture: the new member has no role');

const teamsToDelete = [];
try {
	// ---- access ------------------------------------------------------------------
	ok((await anon.call('GET', '/api/teams/discover')).status === 401, 'showcase: signed-out → 401');
	ok((await anon.call('POST', '/api/teams/discover', { action: 'apply', teamId: teamId })).status === 401, 'apply: signed-out → 401');
	ok((await newUser.call('GET', '/api/teams')).status === 403, 'role-less member has no Teams app (control)');

	const showcase = await newUser.call('GET', '/api/teams/discover');
	ok(showcase.status === 200, 'showcase: role-less member may read it', `status ${showcase.status}`);
	const card = showcase.json?.teams?.find((t) => t.id === teamId);
	ok(!!card && card.myMyStatus === null && card.myMyDecision === null, 'showcase: fixture team listed, no standing yet');
	ok(card && card.leaderNameSurname && card.remainingCapacity === card.capacity - card.activeMemberCount, 'showcase: captain name and free seats');
	const leaked = JSON.stringify(showcase.json);
	ok(!/"uyeler"|"gorevler"|"basvurular"|basvuruNotu/.test(leaked), 'showcase: no roster, tasks or notes in the payload');
	ok(showcase.json.saltReadable === false && showcase.json.limits.team === 3, 'showcase: limits and read-only flag');

	// ---- validation ----------------------------------------------------------------
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'apply' })).status === 400, 'apply: missing team → 400');
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'join', teamId: teamId })).status === 400, 'apply: unknown action → 400');
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'apply', teamId: 'tkm_yok' })).status === 404, 'apply: unknown team → 404');
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'withdraw', teamId: teamId })).status === 404, 'withdraw: nothing to withdraw → 404');

	// ---- apply: always an application, even to an open team ---------------------------------
	const live = await newUser.listen();
	ok(live.status === 200, 'live stream opens for the applicant');
	const note = 'Gömülü sistemlerde çalışıyorum. ' + 'x'.repeat(800);
	const applied = await newUser.call('POST', '/api/teams/discover', { action: 'apply', teamId: teamId, expertise: ['C++', 'ROS2', 'c++', 7], applicationNote: note });
	ok(applied.status === 200 && applied.json.status === 'applied', 'apply: open team still takes it as an application', JSON.stringify(applied.json));
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'apply', teamId: teamId })).status === 409, 'apply: a second time → 409');
	const after = (await newUser.call('GET', '/api/teams/discover')).json.teams.find((t) => t.id === teamId);
	ok(after.myMyStatus === 'applied', 'showcase: shows the application as waiting');

	const board = (await ege.call('GET', `/api/teams?teamId=${teamId}`)).json;
	ok(!board.members.some((u) => u.userId === newId), 'captain: applicant is not on the roster yet');
	const app = board.applications.find((b) => b.userId === newId);
	ok(!!app, 'captain: sees the application');
	ok(app?.applicationNote?.startsWith('Uzmanlık: C++, ROS2\nGömülü sistemlerde') && app.applicationNote.length <= 500, 'captain: note = skills line + text, de-duplicated and capped', app?.applicationNote?.slice(0, 60));

	// ---- the captain accepts: the applicant hears it live ---------------------------------
	live.heard.length = 0;
	const accepted = await ege.call('POST', '/api/teams', { action: 'approve', teamId: teamId, userId: newId });
	ok(accepted.status === 200, 'captain: approves', JSON.stringify(accepted.json));
	ok(await until(() => live.heard.includes('team_updated') && live.heard.includes('notification')), 'applicant: live stream gets team_updated + notification', live.heard.join(','));
	live.stop();
	const member = (await newUser.call('GET', '/api/teams/discover')).json.teams.find((t) => t.id === teamId);
	ok(member.myMyStatus === 'active' && member.myMyDecision === 'accepted', 'showcase: member, application accepted');
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'withdraw', teamId: teamId })).status === 404, 'withdraw: cannot leave an active team through the showcase');

	// ---- reject → feed item for a member who has the Teams app ------------------------------
	const canLive = await can.listen();
	ok((await can.call('POST', '/api/teams/discover', { action: 'apply', teamId: teamId, applicationNote: 'Merhaba' })).status === 200, 'apply: member with the Teams app');
	const canBefore = (await can.call('GET', '/api/notifications')).json.items.filter((i) => i.kind === 'teamDecision');
	ok(canBefore.length === 0, 'feed: no decision yet');
	ok((await ege.call('POST', '/api/teams', { action: 'reject', teamId: teamId, userId: U.can.id })).status === 200, 'captain: rejects');
	ok(await until(() => canLive.heard.includes('notification')), 'rejected member: live notification');
	canLive.stop();
	const feed = (await can.call('GET', '/api/notifications')).json.items.find((i) => i.kind === 'teamDecision');
	ok(feed && feed.data.accepted === false && feed.data.title === FX.content.team.team.name && feed.priority === 'info', 'feed: teamDecision (rejected) with the team name', JSON.stringify(feed));
	ok(feed?.target?.appId === 'teams' && feed.target.itemId === teamId, 'feed: opens the team');
	const rejected = (await can.call('GET', '/api/teams/discover')).json.teams.find((t) => t.id === teamId);
	ok(rejected.myMyStatus === null && rejected.myMyDecision === 'red', 'showcase: not a member, last answer "red"');
	// A new try wipes the old answer.
	ok((await can.call('POST', '/api/teams/discover', { action: 'apply', teamId: teamId })).status === 200, 'apply again after a rejection');
	const retried = (await can.call('GET', '/api/teams/discover')).json.teams.find((t) => t.id === teamId);
	ok(retried.myMyStatus === 'applied' && retried.myMyDecision === null, 'showcase: old answer cleared by the new application');
	ok((await can.call('GET', '/api/notifications')).json.items.every((i) => i.kind !== 'teamDecision'), 'feed: old answer gone with it');
	ok((await can.call('POST', '/api/teams/discover', { action: 'withdraw', teamId: teamId })).status === 200, 'withdraw: own application');
	ok((await can.call('GET', '/api/teams/discover')).json.teams.find((t) => t.id === teamId).myMyStatus === null, 'showcase: back to no standing');

	// ---- a full team refuses at the door; the pending cap ----------------------------------------------
	const mk = async (name, capacity) => {
		const r = await admin.call('POST', '/api/teams', { action: 'createTeam', name: name, category: 'Web & Mobil', description: 'Onboarding test takımı', capacity, leadId: U.ege.id });
		teamsToDelete.push(r.json.team.id);
		return r.json.team.id;
	};
	const tiny = await mk(`ob-test-${suffix}-dolu`, 1); // the captain fills the only seat
	const fullTry = await can.call('POST', '/api/teams/discover', { action: 'apply', teamId: tiny });
	ok(fullTry.status === 409 && /kontenjan/i.test(fullTry.json.error), 'apply: full team → 409', JSON.stringify(fullTry.json));
	ok((await can.call('GET', '/api/teams/discover')).json.teams.find((t) => t.id === tiny).remainingCapacity === 0, 'showcase: shows 0 free seats');

	const many = [];
	for (let i = 0; i < 6; i++) many.push(await mk(`ob-test-${suffix}-${i}`, 6));
	let last;
	for (const id of many) last = await can.call('POST', '/api/teams/discover', { action: 'apply', teamId: id });
	ok(last.status === 429, 'apply: 6th pending application → 429', `status ${last.status}`);
	const pending = (await db.query(`SELECT COUNT(*)::int AS n FROM ${teamMembersTable} WHERE userId = $1 AND status = 'applied'`, [U.can.id])).rows[0].n;
	ok(pending === 5, 'pending applications stay at the cap of 5', `${pending}`);

	// ---- a paused team takes no applications ------------------------------------------------------------
	const paused = many[0];
	await db.query(`UPDATE ${teamsTable} SET status = 'suspended' WHERE id = $1`, [paused]);
	ok(!(await newUser.call('GET', '/api/teams/discover')).json.teams.some((t) => t.id === paused), 'showcase: paused teams are not listed');
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'apply', teamId: paused })).status === 409, 'apply: paused team → 409');

	// ---- graduates are read-only ----------------------------------------------------------------------------
	await db.query(`UPDATE ${userTable} SET ${statusCol} = 'alumni' WHERE id = $1`, [newId]);
	const grad = await newUser.call('GET', '/api/teams/discover');
	ok(grad.status === 200 && grad.json.saltReadable === true, 'graduate: may look (read-only flag set)');
	ok((await newUser.call('POST', '/api/teams/discover', { action: 'apply', teamId: many[1] })).status === 403, 'graduate: apply → 403');
} finally {
	for (const id of teamsToDelete) await admin.call('POST', '/api/teams', { action: 'deleteTeam', teamId: id });
	await db.query(`DELETE FROM ${teamMembersTable} WHERE userId = $1 AND teamId = $2`, [U.can.id, teamId]);
	await db.query(`DELETE FROM ${teamDecisionsTable} WHERE userId IN ($1, $2)`, [U.can.id, newId]);
	await db.query(`DELETE FROM ${teamMembersTable} WHERE userId = $1`, [newId]);
	await db.end();
}

console.log(`\n${fail ? 'FAILED' : 'OK'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
