// Role-based access, end to end over HTTP: what each role may read and change,
// privilege escalation, the last admin, notifications and search per role, the
// second-factor rule, and how fast an edited role reaches an open session.
//
//   node scripts/dev-fixtures.mjs --out F.json && node tests/e2e/rbac-api.mjs --fixtures F.json [--base URL]
//
// Fixture accounts: admin (Admin), zeynep (Yönetim Kurulu, 2FA), ege (Üye, team
// captain), can (Üye), okur (Sadece Haberler). Never run against production.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generate } = require('otplib');
const arg = (n, d) => (process.argv.indexOf(n) > 0 ? process.argv[process.argv.indexOf(n) + 1] : d);
const BASE = arg('--base', 'http://localhost:3000');
const FIXTURES_FILE = arg('--fixtures', '.fixtures.json');
const FX = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8'));

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
		if (set && set.includes('kulup_session_token=')) cookie = set.split(';')[0];
		return { status: res.status, json: await res.json().catch(() => null) };
	};
	return { call };
}

const usedWindows = new Map();
async function code(secret) {
	let lastUsed = usedWindows.get(secret);
	try {
		if (fs.existsSync(FIXTURES_FILE)) {
			const data = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8'));
			if (data.totpUsedAt) {
				const diskWindow = Math.floor(data.totpUsedAt / 30000);
				if (lastUsed === undefined || diskWindow > lastUsed) {
					lastUsed = diskWindow;
				}
			}
		}
	} catch {}

	const currentWindow = Math.floor(Date.now() / 30000);
	if (lastUsed === currentWindow) {
		const waitMs = 30500 - (Date.now() % 30000);
		await new Promise((r) => setTimeout(r, waitMs));
	}
	const now = Date.now();
	const newWindow = Math.floor(now / 30000);
	usedWindows.set(secret, newWindow);
	try {
		if (fs.existsSync(FIXTURES_FILE)) {
			const data = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8'));
			data.totpUsedAt = now;
			fs.writeFileSync(FIXTURES_FILE, JSON.stringify(data, null, 2));
		}
	} catch {}
	return generate({ secret });
}

async function login(email, password, totp, retry = 1) {
	const c = client();
	const r = await c.call('POST', '/api/auth/login', { email, password });
	if (r.json?.require2fa) {
		const cde = await code(totp);
		const v = await c.call('POST', '/api/auth/2fa/challenge', { challengeToken: r.json.challengeToken, code: cde });
		if (v.status !== 200) {
			if (retry > 0) {
				await new Promise((r) => setTimeout(r, 30500 - (Date.now() % 30000)));
				return login(email, password, totp, retry - 1);
			}
			throw new Error(`2FA ${email}: ${v.status}`);
		}
	} else if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(r.json)}`);
	return c;
}

const U = FX.users;
const R = FX.roles;
const teamId = FX.content.team.team.id;
const admin = await login(FX.admin.email, FX.admin.password, FX.adminTotp);
const zeynep = await login(U.zeynep.email, U.zeynep.password, U.zeynep.totp);
const ege = await login(U.ege.email, U.ege.password);
const can = await login(U.can.email, U.can.password);
const reader = await login(U.reader.email, U.reader.password);

// ---- session carries the role ------------------------------------------------
{
	const me = (await reader.call('GET', '/api/auth/me')).json.user;
	ok(me.roleInfo?.name === 'Sadece Haberler' && me.permissions.news === 'kullan' && !me.permissions.events && me.admin === false, 'okur: session has role + permissions');
	const am = (await admin.call('GET', '/api/auth/me')).json.user;
	ok(am.admin === true && am.permissions.budget === 'yonet' && am.twoFactorRequired && !am.mustSetup2fa, 'admin: full permissions, 2FA enrolled');
}

// ---- per-app reads ------------------------------------------------------------
const st = async (c, m, p, b) => (await c.call(m, p, b)).status;
ok((await st(reader, 'GET', '/api/news')) === 200, 'okur reads news');
for (const [path, name] of [
	['/api/events', 'events'],
	['/api/teams', 'teams'],
	['/api/decisions', 'decisions'],
	['/api/inventory', 'inventory'],
	['/api/members', 'members'],
	['/api/certificates', 'certificates'],
	['/api/projects', 'projects'],
	['/api/notes', 'notes'],
	['/api/budget/vaults', 'kasa list'],
	['/api/messages', 'mail inbox'],
	['/api/messages/unread', 'mail unread count'],
	['/api/messages/recipients', 'mail recipients'],
]) {
	ok((await st(reader, 'GET', path)) === 403, `okur → ${name} 403`);
}
ok((await st(can, 'GET', '/api/events')) === 200, 'üye reads events');
ok((await st(can, 'GET', '/api/budget/vaults')) === 403, 'üye (not captain) → kasa list 403');
ok((await st(can, 'POST', '/api/terminal/session', {})) === 403, 'üye → terminal 403');
ok((await st(zeynep, 'POST', '/api/terminal/session', {})) === 403, 'kurul (terminal yok) → terminal 403');

// ---- kasa: manager / captain / reader ----------------------------------------
{
	const list = (await ege.call('GET', '/api/budget/vaults')).json;
	ok(list?.vaults?.length === 1 && list.vaults[0].teamId === teamId, 'captain sees only own project kasa', JSON.stringify(list));
	ok((await st(ege, 'GET', '/api/budget')) === 403, 'captain → general kasa 403');
	const own = (await ege.call('GET', `/api/budget?teamId=${teamId}`)).json;
	ok(own?.permission?.yaz === true && own.permission.yonet === false, 'captain may write own kasa, not transfer');
	ok((await st(ege, 'POST', '/api/budget', { teamId: teamId, typeValue: 'gelir', category: 'Diğer', amountMinor: 1000, description: 'Kaptan geliri' })) < 300, 'captain adds income to own kasa');
	ok((await st(ege, 'POST', '/api/budget', { typeValue: 'gelir', category: 'Diğer', amountMinor: 1000, description: 'Genel kasaya' })) === 403, 'captain → general kasa write 403');
	ok((await st(ege, 'POST', '/api/budget', { action: 'aktar', source: null, target: teamId, amountMinor: 100, description: 'aktarım' })) === 403, 'captain → transfer 403');
	const z = (await zeynep.call('GET', '/api/budget')).json;
	ok(z?.permission?.yaz === true && z.permission.yonet === true, 'kurul manages general kasa');
}

// ---- members: what a reader sees ---------------------------------------------
{
	const pend = client();
	const reg = await pend.call('POST', '/api/auth/register', { name: 'Bekleyen', surname: 'Aday', email: `aday${Date.now()}@kulup.test`, password: 'Aday-Sifre-2026!', department: 'İşletme', grade: 1 });
	ok(reg.status < 300, 'registration accepted', JSON.stringify(reg.json));
	const asMember = (await can.call('GET', '/api/members')).json.members;
	ok(asMember.every((m) => m.status === 'aktif' || m.status === 'mezun'), 'üye does not see applications');
	const asManager = (await zeynep.call('GET', '/api/members')).json.members;
	const candidate = asManager.find((m) => m.name === 'Bekleyen' && m.status === 'beklemede');
	ok(!!candidate && candidate.roleId === null, 'kurul sees the pending applicant (no role yet)');
	ok((await st(can, 'POST', '/api/admin/approve', { userId: candidate?.id, action: 'onayla' })) === 403, 'üye cannot approve');
	ok((await st(zeynep, 'POST', '/api/admin/approve', { userId: candidate?.id, action: 'onayla' })) === 200, 'kurul approves');
	const after = (await admin.call('GET', '/api/members')).json.members.find((m) => m.id === candidate?.id);
	ok(after?.status === 'aktif' && after.roleId === R.member && after.roleName === 'Üye', 'approved member gets the default role');
	ok((await st(zeynep, 'POST', '/api/admin/approve', { userId: candidate?.id, action: 'reddet' })) === 409, 'approval endpoint refuses non-pending accounts');
}

// ---- roles: who may manage them, escalation, admin role ----------------------
{
	const zr = await zeynep.call('GET', '/api/roles');
	ok(zr.status === 200 && zr.json.roles.every((r) => r.permissions === undefined) && zr.json.myPermissions === undefined, 'members manager gets names/colours only');
	ok(zr.json.roles.find((r) => r.id === 'role_admin')?.assignable === false, 'kurul may not hand out Admin');
	ok((await st(zeynep, 'POST', '/api/roles', { name: 'Yeni', color: '#30d158', permissions: {} })) === 403, 'settings:kullan cannot create roles');
	ok((await st(can, 'GET', '/api/roles')) === 403, 'üye cannot list roles');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: U.ege.id, roleId: 'rol_admin' })) === 403, 'kurul cannot make someone admin');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: U.can.id, roleId: R.management })) === 200, 'kurul may give an equal role');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: U.can.id, roleId: R.member })) === 200, '…and take it back');
	const adminId = (await admin.call('GET', '/api/auth/me')).json.user.id;
	ok((await st(zeynep, 'DELETE', `/api/members?id=${adminId}`)) === 403, 'kurul cannot delete the admin');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: adminId, status: 'mezun' })) === 403, 'kurul cannot deactivate the admin');
	ok((await st(admin, 'PATCH', '/api/members', { id: adminId, roleId: R.member })) === 409, 'last admin cannot drop the role');
	ok((await st(admin, 'PATCH', '/api/members', { id: adminId, status: 'mezun' })) === 409, 'last admin cannot be deactivated');
	ok((await st(admin, 'DELETE', `/api/members?id=${adminId}`)) === 400, 'admin cannot delete self');
	ok((await st(admin, 'PATCH', '/api/roles', { id: 'rol_admin', name: 'X', color: '#000000', permissions: {} })) === 409, 'Admin role is fixed');
	ok((await st(admin, 'DELETE', '/api/roles', { id: 'rol_admin' })) === 409, 'Admin role cannot be deleted');
	ok((await st(admin, 'POST', '/api/roles', { name: 'üye', color: '#000000', permissions: {} })) === 409, 'role names are unique (case-insensitive)');
	ok((await st(admin, 'POST', '/api/roles', { name: 'Kötü', color: '#000000', permissions: { hack: 'yonet' } })) === 400, 'unknown app rejected');
	ok((await st(admin, 'POST', '/api/roles', { action: 'setDefault', roleId: 'role_admin' })) === 400, 'Admin cannot be the default role');
}

// ---- notifications and search follow the apps the role opens -----------------
{
	const kinds = (j) => [...new Set((j?.items ?? []).map((i) => i.kind))].sort();
	const readerN = (await reader.call('GET', '/api/notifications')).json;
	ok(kinds(readerN).join() === 'news', 'okur gets only news notifications', kinds(readerN).join());
	const adminN = (await admin.call('GET', '/api/notifications')).json;
	ok(kinds(adminN).includes('news') && kinds(adminN).includes('event'), 'admin gets news and events', kinds(adminN).join());
	const hits = async (c, q) => ((await c.call('GET', `/api/search?q=${encodeURIComponent(q)}`)).json?.hits ?? []).map((h) => h.kind);
	ok((await hits(reader, 'Raspberry')).length === 0, 'okur: inventory not searchable');
	ok((await hits(can, 'Raspberry')).includes('item'), 'üye finds the inventory item');
	ok((await hits(reader, 'tanışma')).includes('news'), 'okur finds the news');
	ok((await hits(reader, 'Atölyesi')).length === 0, 'okur: events not searchable');
	ok((await hits(can, 'Sponsorluk')).length === 0 && (await hits(zeynep, 'sponsorluk')).includes('ledger'), 'kasa entries only for kasa readers');
}

// ---- Posta: portal mail follows mail:kullan ---------------------------------------
{
	const tag = Date.now().toString(36);
	ok((await st(zeynep, 'GET', '/api/messages')) === 200, 'kurul (mail: yonet) reads mail');
	ok((await st(can, 'GET', '/api/messages')) === 200, 'üye (mail: kullan) reads mail');
	ok((await st(reader, 'POST', '/api/messages', { subject: 'x', body: 'y', recipients: [U.can.id] })) === 403, 'okur (mail yok) cannot send');
	ok((await st(reader, 'PATCH', '/api/messages/baska', { action: 'okundu' })) === 403, 'okur → mail thread action 403');
	const lookup = (await can.call('GET', `/api/messages/recipients?q=${encodeURIComponent('okur')}`)).json?.recipients ?? [];
	const readerHit = lookup.find((a) => a.id === U.reader.id);
	ok(!!readerHit && readerHit.reachable === false && Object.keys(readerHit).sort().join() === 'ad,id,soyad,ulasilabilir', 'recipient lookup: id and name only, flags a role without Mail');
	// Finding people: by name, e-mail (from its start), department and student number; the answer is names only.
	for (const path of ['/api/messages/recipients', '/api/messages/recipients?q=zeynep', `/api/messages/recipients?id=${U.zeynep.id}`, '/api/messages/recipients?ulasilabilir=1']) {
		ok((await st(reader, 'GET', path)) === 403, `okur (mail yok) → ${path} 403`);
	}
	const zeynepNo = ((await admin.call('GET', '/api/members')).json?.members ?? []).find((m) => m.id === U.zeynep.id)?.studentNo ?? '';
	const find = async (q) => (await can.call('GET', `/api/messages/recipients?q=${encodeURIComponent(q)}`)).json?.recipients ?? [];
	ok((await find('zeynep kaya')).some((a) => a.id === U.zeynep.id), 'recipient search finds a member by name');
	ok((await find('KILIC')).some((a) => a.id === U.ege.id), 'recipient search folds Turkish letters (KILIC → Kılıç)');
	ok((await find(U.zeynep.email)).map((a) => a.id).join() === U.zeynep.id, 'recipient search finds a member by e-mail address');
	ok((await find('Yazılım Mühendisliği')).some((a) => a.id === U.ege.id), 'recipient search finds a member by department');
	ok(zeynepNo !== '' && (await find(zeynepNo)).map((a) => a.id).join() === U.zeynep.id, 'recipient search finds a member by student number');
	const leak = JSON.stringify([await find(U.zeynep.email), await find(zeynepNo), await find('Bilgisayar')]);
	ok(!leak.includes(U.zeynep.email) && !leak.includes(zeynepNo) && !/bolum|ogrenciNo|eposta|sifre|rolId/i.test(leak), 'recipient search never returns e-mail, student number, department, role or secrets');
	ok((await find('%')).length === 0 && (await find('_')).length === 0, 'recipient search: % and _ are not wildcards');
	ok((await find('zeynep'.repeat(40))).length === 0, 'recipient search: oversized text is cut, not an error');
	ok((await find('e')).length <= 20, 'recipient search returns at most 20 people');
	const reach = (await can.call('GET', '/api/messages/recipients?reachable=1')).json;
	const reachableList = reach?.ids ?? [];
	ok(reachableList.includes(U.zeynep.id) && !reachableList.includes(U.reader.id), 'reachable ids list holds only ids, without the Mail-less role');
	const composeHit = async (c, q) => ((await c.call('GET', `/api/search?q=${encodeURIComponent(q)}`)).json?.hits ?? []).filter((h) => h.id.startsWith('compose:'));
	ok((await composeHit(can, 'Zeynep Kaya')).some((h) => h.id === `compose:${U.zeynep.id}` && h.appId === 'mail' && h.target.section === 'compose'), 'search offers "send a message" to a person for a Mail role');
	ok((await composeHit(can, 'Okur Haber')).length === 0, 'search does not offer a message to someone whose role has no Mail');
	ok((await composeHit(reader, 'Zeynep Kaya')).length === 0, 'okur (mail yok): search offers no "send a message"');
	const sent = await can.call('POST', '/api/messages', { subject: `RBAC posta ${tag}`, body: 'Rol testi.', recipients: [U.zeynep.id, U.reader.id] });
	ok(sent.status === 201 && sent.json.skipped.length === 1 && sent.json.skipped[0].id === U.reader.id && sent.json.skipped[0].reason === 'role', 'send reaches the Mail role and reports the one without', JSON.stringify(sent.json));
	const only = await can.call('POST', '/api/messages', { subject: 'x', body: 'y', recipients: [U.reader.id] });
	ok(only.status === 422 && /Posta'yı açmıyor/.test(only.json?.error ?? ''), 'only a Mail-less recipient: 422 with the reason');
	const id = sent.json.threadId;
	ok((await st(zeynep, 'GET', `/api/messages/${id}`)) === 200, 'recipient opens the conversation');
	ok((await st(ege, 'GET', `/api/messages/${id}`)) === 404, "someone else's conversation is 404 (not 403)");
	ok((await st(ege, 'POST', `/api/messages/${id}`, { body: 'sızma' })) === 404, "…also for replying");
	const kinds = (j) => [...new Set((j?.items ?? []).map((i) => i.kind))];
	const zN = (await zeynep.call('GET', '/api/notifications')).json;
	ok(zN.items.some((i) => i.id === `message:${id}` && i.kind === 'message') && zN.counts.unreadMessages >= 1, 'recipient gets a message notification');
	ok(!kinds((await reader.call('GET', '/api/notifications')).json).includes('message'), 'okur gets no message notification');
	ok(!kinds((await ege.call('GET', '/api/notifications')).json).includes('message'), 'a bystander gets no message notification');
	const found = async (c) => ((await c.call('GET', `/api/search?q=${encodeURIComponent(`RBAC posta ${tag}`)}`)).json?.hits ?? []).map((h) => h.kind);
	ok((await found(zeynep)).includes('message') && !(await found(ege)).includes('message') && !(await found(reader)).includes('message'), 'search finds only your own conversations');
	// Tidy: each side trashes and removes its copy.
	for (const c of [can, zeynep]) {
		await c.call('PATCH', `/api/messages/${id}`, { action: 'cope' });
		await c.call('PATCH', `/api/messages/${id}`, { action: 'sil' });
	}
}

// ---- an edited role reaches open sessions -------------------------------------
{
	const roles = (await admin.call('GET', '/api/roles')).json.roles;
	const news = roles.find((r) => r.id === R.news);
	const edit = (permissions) => admin.call('PATCH', '/api/roles', { id: news.id, name: news.name, color: news.color, description: news.description, twoStepRequired: false, permissions });
	ok((await edit({ news: 'kullan', events: 'kullan', settings: 'kullan' })).status === 200, 'admin adds Etkinlikler to the role');
	await new Promise((r) => setTimeout(r, 5500)); // permission cache TTL
	ok((await st(reader, 'GET', '/api/events')) === 200, 'okur now reads events (same session)');
	ok((await reader.call('GET', '/api/auth/me')).json.user.permissions.events === 'kullan', 'session payload updated');
	await edit({ news: 'kullan', settings: 'kullan' });
	await new Promise((r) => setTimeout(r, 5500));
	ok((await st(reader, 'GET', '/api/events')) === 403, 'and loses it again');
}

// ---- the role's second-factor rule ---------------------------------------------
{
	const created = (await admin.call('POST', '/api/members', { name: 'Yeni', surname: 'Kurul', email: `kurul${Date.now()}@kulup.test`, department: 'İşletme', grade: 2, roleId: R.management })).json;
	const k = client();
	await k.call('POST', '/api/auth/login', { email: created.member.email, password: created.temporaryPassword });
	const me = (await k.call('GET', '/api/auth/me')).json.user;
	ok(me.mustSetup2fa === true, 'strict role without 2FA: mustSetup2fa');
	const r = await k.call('GET', '/api/news');
	ok(r.status === 403 && r.json?.code === '2FA_SETUP_REQUIRED', 'apps refused until enrolled');
	ok((await st(k, 'GET', '/api/auth/2fa/status')) === 200, 'enrolment still reachable');
	ok(((await k.call('GET', '/api/notifications')).json?.items ?? []).length === 0, 'no notifications until enrolled');
	ok((await st(zeynep, 'POST', '/api/auth/2fa/disable', { code: '000000' })) === 403, 'strict role cannot switch 2FA off');
	await admin.call('DELETE', `/api/members?id=${created.member.id}`);
}

console.log(`\nrbac-api: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
