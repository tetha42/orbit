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
const FX = JSON.parse(fs.readFileSync(arg('--fixtures', '.fixtures.json'), 'utf8'));

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
	const w = Math.floor(Date.now() / 30000);
	if (usedWindows.get(secret) === w) await new Promise((r) => setTimeout(r, 30500 - (Date.now() % 30000)));
	usedWindows.set(secret, Math.floor(Date.now() / 30000));
	return generate({ secret });
}

async function login(eposta, sifre, totp) {
	const c = client();
	const r = await c.call('POST', '/api/auth/login', { eposta, sifre });
	if (r.json?.require2fa) {
		const v = await c.call('POST', '/api/auth/2fa/challenge', { challengeToken: r.json.challengeToken, code: await code(totp) });
		if (v.status !== 200) throw new Error(`2FA ${eposta}: ${v.status}`);
	} else if (r.status !== 200) throw new Error(`login ${eposta}: ${r.status} ${JSON.stringify(r.json)}`);
	return c;
}

const U = FX.users;
const R = FX.roles;
const teamId = FX.content.team.team.id;
const admin = await login(FX.admin.eposta, FX.admin.sifre, FX.adminTotp);
const zeynep = await login(U.zeynep.eposta, U.zeynep.sifre, U.zeynep.totp);
const ege = await login(U.ege.eposta, U.ege.sifre);
const can = await login(U.can.eposta, U.can.sifre);
const okur = await login(U.okur.eposta, U.okur.sifre);

// ---- session carries the role ------------------------------------------------
{
	const me = (await okur.call('GET', '/api/auth/me')).json.user;
	ok(me.rolBilgi?.ad === 'Sadece Haberler' && me.izinler.news === 'kullan' && !me.izinler.events && me.admin === false, 'okur: session has role + permissions');
	const am = (await admin.call('GET', '/api/auth/me')).json.user;
	ok(am.admin === true && am.izinler.budget === 'yonet' && am.twoFactorRequired && !am.mustSetup2fa, 'admin: full permissions, 2FA enrolled');
}

// ---- per-app reads ------------------------------------------------------------
const st = async (c, m, p, b) => (await c.call(m, p, b)).status;
ok((await st(okur, 'GET', '/api/news')) === 200, 'okur reads news');
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
	ok((await st(okur, 'GET', path)) === 403, `okur → ${name} 403`);
}
ok((await st(can, 'GET', '/api/events')) === 200, 'üye reads events');
ok((await st(can, 'GET', '/api/budget/vaults')) === 403, 'üye (not captain) → kasa list 403');
ok((await st(can, 'POST', '/api/terminal/session', {})) === 403, 'üye → terminal 403');
ok((await st(zeynep, 'POST', '/api/terminal/session', {})) === 403, 'kurul (terminal yok) → terminal 403');

// ---- kasa: manager / captain / reader ----------------------------------------
{
	const list = (await ege.call('GET', '/api/budget/vaults')).json;
	ok(list?.kasalar?.length === 1 && list.kasalar[0].takimId === teamId, 'captain sees only own project kasa', JSON.stringify(list));
	ok((await st(ege, 'GET', '/api/budget')) === 403, 'captain → general kasa 403');
	const own = (await ege.call('GET', `/api/budget?takimId=${teamId}`)).json;
	ok(own?.izin?.yaz === true && own.izin.yonet === false, 'captain may write own kasa, not transfer');
	ok((await st(ege, 'POST', '/api/budget', { takimId: teamId, tur: 'gelir', kategori: 'Diğer', tutarKurus: 1000, aciklama: 'Kaptan geliri' })) < 300, 'captain adds income to own kasa');
	ok((await st(ege, 'POST', '/api/budget', { tur: 'gelir', kategori: 'Diğer', tutarKurus: 1000, aciklama: 'Genel kasaya' })) === 403, 'captain → general kasa write 403');
	ok((await st(ege, 'POST', '/api/budget', { action: 'aktar', kaynak: null, hedef: teamId, tutarKurus: 100, aciklama: 'aktarım' })) === 403, 'captain → transfer 403');
	const z = (await zeynep.call('GET', '/api/budget')).json;
	ok(z?.izin?.yaz === true && z.izin.yonet === true, 'kurul manages general kasa');
}

// ---- members: what a reader sees ---------------------------------------------
{
	const pend = client();
	const reg = await pend.call('POST', '/api/auth/register', { ad: 'Bekleyen', soyad: 'Aday', eposta: `aday${Date.now()}@kulup.test`, sifre: 'Aday-Sifre-2026!', bolum: 'İşletme', sinif: 1 });
	ok(reg.status < 300, 'registration accepted', JSON.stringify(reg.json));
	const asMember = (await can.call('GET', '/api/members')).json.members;
	ok(asMember.every((m) => m.durum === 'aktif' || m.durum === 'mezun'), 'üye does not see applications');
	const asManager = (await zeynep.call('GET', '/api/members')).json.members;
	const aday = asManager.find((m) => m.ad === 'Bekleyen' && m.durum === 'beklemede');
	ok(!!aday && aday.rolId === null, 'kurul sees the pending applicant (no role yet)');
	ok((await st(can, 'POST', '/api/admin/approve', { kullaniciId: aday?.id, aksiyon: 'onayla' })) === 403, 'üye cannot approve');
	ok((await st(zeynep, 'POST', '/api/admin/approve', { kullaniciId: aday?.id, aksiyon: 'onayla' })) === 200, 'kurul approves');
	const after = (await admin.call('GET', '/api/members')).json.members.find((m) => m.id === aday?.id);
	ok(after?.durum === 'aktif' && after.rolId === R.uye && after.rolAd === 'Üye', 'approved member gets the default role');
	ok((await st(zeynep, 'POST', '/api/admin/approve', { kullaniciId: aday?.id, aksiyon: 'reddet' })) === 409, 'approval endpoint refuses non-pending accounts');
}

// ---- roles: who may manage them, escalation, admin role ----------------------
{
	const zr = await zeynep.call('GET', '/api/roles');
	ok(zr.status === 200 && (zr.json.roles ?? zr.json.roller).every((r) => r.izinler === undefined) && zr.json.benimIzinlerim === undefined, 'members manager gets names/colours only');
	ok((zr.json.roles ?? zr.json.roller).find((r) => r.id === 'rol_admin')?.atanabilir === false, 'kurul may not hand out Admin');
	ok((await st(zeynep, 'POST', '/api/roles', { ad: 'Yeni', renk: '#30d158', izinler: {} })) === 403, 'settings:kullan cannot create roles');
	ok((await st(can, 'GET', '/api/roles')) === 403, 'üye cannot list roles');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: U.ege.id, rolId: 'rol_admin' })) === 403, 'kurul cannot make someone admin');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: U.can.id, rolId: R.yonetim })) === 200, 'kurul may give an equal role');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: U.can.id, rolId: R.uye })) === 200, '…and take it back');
	const adminId = (await admin.call('GET', '/api/auth/me')).json.user.id;
	ok((await st(zeynep, 'DELETE', `/api/members?id=${adminId}`)) === 403, 'kurul cannot delete the admin');
	ok((await st(zeynep, 'PATCH', '/api/members', { id: adminId, durum: 'mezun' })) === 403, 'kurul cannot deactivate the admin');
	ok((await st(admin, 'PATCH', '/api/members', { id: adminId, rolId: R.uye })) === 409, 'last admin cannot drop the role');
	ok((await st(admin, 'PATCH', '/api/members', { id: adminId, durum: 'mezun' })) === 409, 'last admin cannot be deactivated');
	ok((await st(admin, 'DELETE', `/api/members?id=${adminId}`)) === 400, 'admin cannot delete self');
	ok((await st(admin, 'PATCH', '/api/roles', { id: 'rol_admin', ad: 'X', renk: '#000000', izinler: {} })) === 409, 'Admin role is fixed');
	ok((await st(admin, 'DELETE', '/api/roles', { id: 'rol_admin' })) === 409, 'Admin role cannot be deleted');
	ok((await st(admin, 'POST', '/api/roles', { ad: 'üye', renk: '#000000', izinler: {} })) === 409, 'role names are unique (case-insensitive)');
	ok((await st(admin, 'POST', '/api/roles', { ad: 'Kötü', renk: '#000000', izinler: { hack: 'yonet' } })) === 400, 'unknown app rejected');
	ok((await st(admin, 'POST', '/api/roles', { action: 'varsayilan', rolId: 'rol_admin' })) === 400, 'Admin cannot be the default role');
}

// ---- notifications and search follow the apps the role opens -----------------
{
	const kinds = (j) => [...new Set((j?.items ?? []).map((i) => i.kind))].sort();
	const okurN = (await okur.call('GET', '/api/notifications')).json;
	ok(kinds(okurN).join() === 'news', 'okur gets only news notifications', kinds(okurN).join());
	const adminN = (await admin.call('GET', '/api/notifications')).json;
	ok(kinds(adminN).includes('news') && kinds(adminN).includes('event'), 'admin gets news and events', kinds(adminN).join());
	const hits = async (c, q) => ((await c.call('GET', `/api/search?q=${encodeURIComponent(q)}`)).json?.hits ?? []).map((h) => h.kind);
	ok((await hits(okur, 'Raspberry')).length === 0, 'okur: inventory not searchable');
	ok((await hits(can, 'Raspberry')).includes('item'), 'üye finds the inventory item');
	ok((await hits(okur, 'tanışma')).includes('news'), 'okur finds the news');
	ok((await hits(okur, 'Atölyesi')).length === 0, 'okur: events not searchable');
	ok((await hits(can, 'Sponsorluk')).length === 0 && (await hits(zeynep, 'sponsorluk')).includes('ledger'), 'kasa entries only for kasa readers');
}

// ---- Posta: portal mail follows mail:kullan ---------------------------------------
{
	const tag = Date.now().toString(36);
	ok((await st(zeynep, 'GET', '/api/messages')) === 200, 'kurul (mail: yonet) reads mail');
	ok((await st(can, 'GET', '/api/messages')) === 200, 'üye (mail: kullan) reads mail');
	ok((await st(okur, 'POST', '/api/messages', { konu: 'x', govde: 'y', alicilar: [U.can.id] })) === 403, 'okur (mail yok) cannot send');
	ok((await st(okur, 'PATCH', '/api/messages/baska', { action: 'okundu' })) === 403, 'okur → mail thread action 403');
	const lookup = (await can.call('GET', `/api/messages/recipients?q=${encodeURIComponent('okur')}`)).json?.recipients ?? (await can.call('GET', `/api/messages/recipients?q=${encodeURIComponent('okur')}`)).json?.alicilar ?? [];
	const okurHit = lookup.find((a) => a.id === U.okur.id);
	ok(!!okurHit && okurHit.ulasilabilir === false && Object.keys(okurHit).sort().join() === 'ad,id,soyad,ulasilabilir', 'recipient lookup: id and name only, flags a role without Mail');
	// Finding people: by name, e-mail (from its start), department and student number; the answer is names only.
	for (const path of ['/api/messages/recipients', '/api/messages/recipients?q=zeynep', `/api/messages/recipients?id=${U.zeynep.id}`, '/api/messages/recipients?ulasilabilir=1']) {
		ok((await st(okur, 'GET', path)) === 403, `okur (mail yok) → ${path} 403`);
	}
	const zeynepNo = ((await admin.call('GET', '/api/members')).json?.members ?? []).find((m) => m.id === U.zeynep.id)?.ogrenciNo ?? '';
	const find = async (q) => (await can.call('GET', `/api/messages/recipients?q=${encodeURIComponent(q)}`)).json?.recipients ?? (await can.call('GET', `/api/messages/recipients?q=${encodeURIComponent(q)}`)).json?.alicilar ?? [];
	ok((await find('zeynep kaya')).some((a) => a.id === U.zeynep.id), 'recipient search finds a member by name');
	ok((await find('KILIC')).some((a) => a.id === U.ege.id), 'recipient search folds Turkish letters (KILIC → Kılıç)');
	ok((await find(U.zeynep.eposta)).map((a) => a.id).join() === U.zeynep.id, 'recipient search finds a member by e-mail address');
	ok((await find('Yazılım Mühendisliği')).some((a) => a.id === U.ege.id), 'recipient search finds a member by department');
	ok(zeynepNo !== '' && (await find(zeynepNo)).map((a) => a.id).join() === U.zeynep.id, 'recipient search finds a member by student number');
	const leak = JSON.stringify([await find(U.zeynep.eposta), await find(zeynepNo), await find('Bilgisayar')]);
	ok(!leak.includes(U.zeynep.eposta) && !leak.includes(zeynepNo) && !/bolum|ogrenciNo|eposta|sifre|rolId/i.test(leak), 'recipient search never returns e-mail, student number, department, role or secrets');
	ok((await find('%')).length === 0 && (await find('_')).length === 0, 'recipient search: % and _ are not wildcards');
	ok((await find('zeynep'.repeat(40))).length === 0, 'recipient search: oversized text is cut, not an error');
	ok((await find('e')).length <= 20, 'recipient search returns at most 20 people');
	const reach = (await can.call('GET', '/api/messages/recipients?reachable=1')).json;
	const reachableList = reach?.ids ?? reach?.idler ?? [];
	ok(reachableList.includes(U.zeynep.id) && !reachableList.includes(U.okur.id), 'reachable ids list holds only ids, without the Mail-less role');
	const composeHit = async (c, q) => ((await c.call('GET', `/api/search?q=${encodeURIComponent(q)}`)).json?.hits ?? []).filter((h) => h.id.startsWith('compose:'));
	ok((await composeHit(can, 'Zeynep Kaya')).some((h) => h.id === `compose:${U.zeynep.id}` && h.appId === 'mail' && h.target.section === 'compose'), 'search offers "send a message" to a person for a Mail role');
	ok((await composeHit(can, 'Okur Haber')).length === 0, 'search does not offer a message to someone whose role has no Mail');
	ok((await composeHit(okur, 'Zeynep Kaya')).length === 0, 'okur (mail yok): search offers no "send a message"');
	const sent = await can.call('POST', '/api/messages', { konu: `RBAC posta ${tag}`, govde: 'Rol testi.', alicilar: [U.zeynep.id, U.okur.id] });
	ok(sent.status === 201 && (sent.json.skipped ?? sent.json.atlananlar).length === 1 && (sent.json.skipped ?? sent.json.atlananlar)[0].id === U.okur.id && (sent.json.skipped ?? sent.json.atlananlar)[0].neden === 'rol', 'send reaches the Mail role and reports the one without', JSON.stringify(sent.json));
	const only = await can.call('POST', '/api/messages', { konu: 'x', govde: 'y', alicilar: [U.okur.id] });
	ok(only.status === 422 && /Posta'yı açmıyor/.test(only.json?.error ?? ''), 'only a Mail-less recipient: 422 with the reason');
	const id = sent.json.threadId ?? sent.json.konuId;
	ok((await st(zeynep, 'GET', `/api/messages/${id}`)) === 200, 'recipient opens the conversation');
	ok((await st(ege, 'GET', `/api/messages/${id}`)) === 404, "someone else's conversation is 404 (not 403)");
	ok((await st(ege, 'POST', `/api/messages/${id}`, { govde: 'sızma' })) === 404, "…also for replying");
	const kinds = (j) => [...new Set((j?.items ?? []).map((i) => i.kind))];
	const zN = (await zeynep.call('GET', '/api/notifications')).json;
	ok(zN.items.some((i) => i.id === `message:${id}` && i.kind === 'message') && zN.counts.unreadMessages >= 1, 'recipient gets a message notification');
	ok(!kinds((await okur.call('GET', '/api/notifications')).json).includes('message'), 'okur gets no message notification');
	ok(!kinds((await ege.call('GET', '/api/notifications')).json).includes('message'), 'a bystander gets no message notification');
	const found = async (c) => ((await c.call('GET', `/api/search?q=${encodeURIComponent(`RBAC posta ${tag}`)}`)).json?.hits ?? []).map((h) => h.kind);
	ok((await found(zeynep)).includes('message') && !(await found(ege)).includes('message') && !(await found(okur)).includes('message'), 'search finds only your own conversations');
	// Tidy: each side trashes and removes its copy.
	for (const c of [can, zeynep]) {
		await c.call('PATCH', `/api/messages/${id}`, { action: 'cope' });
		await c.call('PATCH', `/api/messages/${id}`, { action: 'sil' });
	}
}

// ---- an edited role reaches open sessions -------------------------------------
{
	const roller = (await admin.call('GET', '/api/roles')).json.roles ?? (await admin.call('GET', '/api/roles')).json.roller;
	const haber = roller.find((r) => r.id === R.haber);
	const edit = (izinler) => admin.call('PATCH', '/api/roles', { id: haber.id, ad: haber.ad, renk: haber.renk, aciklama: haber.aciklama, ikiAdimZorunlu: false, izinler });
	ok((await edit({ news: 'kullan', events: 'kullan', settings: 'kullan' })).status === 200, 'admin adds Etkinlikler to the role');
	await new Promise((r) => setTimeout(r, 5500)); // permission cache TTL
	ok((await st(okur, 'GET', '/api/events')) === 200, 'okur now reads events (same session)');
	ok((await okur.call('GET', '/api/auth/me')).json.user.izinler.events === 'kullan', 'session payload updated');
	await edit({ news: 'kullan', settings: 'kullan' });
	await new Promise((r) => setTimeout(r, 5500));
	ok((await st(okur, 'GET', '/api/events')) === 403, 'and loses it again');
}

// ---- the role's second-factor rule ---------------------------------------------
{
	const created = (await admin.call('POST', '/api/members', { ad: 'Yeni', soyad: 'Kurul', eposta: `kurul${Date.now()}@kulup.test`, bolum: 'İşletme', sinif: 2, rolId: R.yonetim })).json;
	const k = client();
	await k.call('POST', '/api/auth/login', { eposta: created.member.eposta, sifre: created.geciciSifre });
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
