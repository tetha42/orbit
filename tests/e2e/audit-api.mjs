// The audit log, end to end over HTTP (issue #12): every audited operation leaves
// exactly one record with the right before/after, the list is for Settings
// managers only, no record ever holds a credential, and a record exists only when
// its operation was committed (rollback checks need DATABASE_URL — the test
// creates and drops a few throw-away triggers in that database).
//
//   node scripts/dev-fixtures.mjs --out F.json
//   DATABASE_URL=postgresql://… node tests/e2e/audit-api.mjs --fixtures F.json [--base URL]
//
// Never run against production: it creates roles and members, edits the SMTP
// settings and installs triggers.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generate } = require('otplib');
const arg = (n, d) => (process.argv.indexOf(n) > 0 ? process.argv[process.argv.indexOf(n) + 1] : d);
const BASE = arg('--base', 'http://localhost:3000');
const FX = JSON.parse(fs.readFileSync(arg('--fixtures', '.fixtures.json'), 'utf8'));
const DATABASE_URL = process.env.DATABASE_URL;

let pass = 0;
let fail = 0;
const ok = (cond, name, extra = '') => {
	if (cond) pass++;
	else fail++;
	console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && extra ? ` — ${extra}` : ''}`);
};

function client() {
	let cookie = '';
	const call = async (method, path, body, headers = {}) => {
		const res = await fetch(BASE + path, {
			method,
			headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
			body: body ? JSON.stringify(body) : undefined,
		});
		const set = res.headers.get('set-cookie');
		if (set && set.includes('kulup_session_token=')) cookie = set.split(';')[0];
		return { status: res.status, json: await res.json().catch(() => null) };
	};
	return { call, cookie: () => cookie };
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
const admin = await login(FX.admin.eposta, FX.admin.sifre, FX.adminTotp);
const zeynep = await login(U.zeynep.eposta, U.zeynep.sifre, U.zeynep.totp);
const can = await login(U.can.eposta, U.can.sifre);
const okur = await login(U.okur.eposta, U.okur.sifre);
const adminMe = (await admin.call('GET', '/api/auth/me')).json.user;
const startCount = ((await admin.call('GET', '/api/denetim?boyut=1')).json).toplam;
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const sameKeys = (o, keys) => !!o && JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...keys].sort());

/** Everything the log holds (newest first). */
const everything = async (q = '') => (await admin.call('GET', `/api/denetim?tum=1${q}`)).json;
/** Runs `fn` and returns its result plus the records it added. */
async function recorded(fn) {
	const before = (await everything()).toplam;
	const res = await fn();
	const after = await everything();
	return { res, yeni: after.kayitlar.slice(0, after.toplam - before) };
}
const rolPayload = (izinler, extra = {}) => ({ ad: 'Denetim Rolü', renk: '#30d158', aciklama: 'test', ikiAdimZorunlu: false, izinler, ...extra });

// ---- who may read the log -----------------------------------------------------
{
	ok((await client().call('GET', '/api/denetim')).status === 401, 'anonymous → 401');
	ok((await zeynep.call('GET', '/api/denetim')).status === 403, 'Yönetim Kurulu (settings: kullan) → 403');
	ok((await can.call('GET', '/api/denetim')).status === 403, 'üye → 403');
	ok((await okur.call('GET', '/api/denetim')).status === 403, 'okur → 403');
	ok((await zeynep.call('GET', '/api/denetim?tum=1')).status === 403, 'export → 403 for them too');
	ok((await admin.call('GET', '/api/denetim')).status === 200, 'admin (settings: yonet) → 200');
	ok((await admin.call('POST', '/api/denetim', {})).status === 405, 'the log is read-only (POST → 405)');
}

// ---- roles: create, edit (permission diff), default role, delete -------------
let rolId;
{
	const { res, yeni } = await recorded(() => admin.call('POST', '/api/roller', rolPayload({ news: 'kullan', settings: 'kullan', budget: 'kullan' })));
	rolId = res.json?.id;
	const k = yeni[0];
	ok(res.status === 201 && yeni.length === 1, 'create role → exactly one record', `status ${res.status}, ${yeni.length} records`);
	ok(k?.islem === 'rol.olustur' && k.hedefTur === 'rol' && k.hedefId === rolId && k.hedefAd === 'Denetim Rolü', 'create: action / target');
	ok(k?.yapanId === adminMe.id && k.yapanAd === `${adminMe.ad} ${adminMe.soyad}`.trim() && !!k.ip && k.ip !== 'unknown', 'create: actor and address recorded', JSON.stringify(k));
	ok(k?.onceki === null && canon(k?.sonraki?.izinler) === canon({ budget: 'kullan', news: 'kullan', settings: 'kullan' }), 'create: after = the permission matrix', JSON.stringify(k?.sonraki));
	ok(Math.abs(k.zaman - Date.now()) < 60000, 'create: timestamp is now');
}
{
	const { res, yeni } = await recorded(() => admin.call('PATCH', '/api/roller', { id: rolId, ...rolPayload({ news: 'yok', settings: 'kullan', budget: 'yonet', events: 'kullan' }, { ad: 'Denetim Rolü 2' }) }));
	const k = yeni[0];
	ok(res.status === 200 && yeni.length === 1 && k.islem === 'rol.duzenle', 'edit role → exactly one record');
	ok(
		k?.hedefId === rolId &&
			canon(k.onceki) === canon({ ad: 'Denetim Rolü', izinler: { budget: 'kullan', events: 'yok', news: 'kullan' } }) &&
			canon(k.sonraki) === canon({ ad: 'Denetim Rolü 2', izinler: { budget: 'yonet', events: 'kullan', news: 'yok' } }),
		'edit: before/after hold only what changed (name + permission diff)',
		JSON.stringify([k?.onceki, k?.sonraki])
	);
	const same = await recorded(() => admin.call('PATCH', '/api/roller', { id: rolId, ...rolPayload({ budget: 'yonet', events: 'kullan', settings: 'kullan' }, { ad: 'Denetim Rolü 2' }) }));
	ok(same.res.status === 200 && same.yeni.length === 0, 'edit without a change → no record');
}
{
	const a = await recorded(() => admin.call('POST', '/api/roller', { action: 'varsayilan', rolId }));
	ok(a.res.status === 200 && a.yeni.length === 1 && a.yeni[0].islem === 'rol.varsayilan', 'default role change → one record');
	ok(a.yeni[0]?.onceki?.rolId === R.uye && a.yeni[0]?.sonraki?.rolId === rolId && a.yeni[0]?.sonraki?.rolAd === 'Denetim Rolü 2', 'default: before = Üye, after = new role', JSON.stringify(a.yeni[0]));
	const again = await recorded(() => admin.call('POST', '/api/roller', { action: 'varsayilan', rolId }));
	ok(again.yeni.length === 0, 'default role set to the same role → no record');
	const back = await recorded(() => admin.call('POST', '/api/roller', { action: 'varsayilan', rolId: R.uye }));
	ok(back.yeni.length === 1 && back.yeni[0].sonraki.rolId === R.uye, 'default role restored → one record');
}

// ---- members: role grant / removal, status, applications ----------------------
{
	const canId = U.can.id;
	const grant = await recorded(() => admin.call('PATCH', '/api/uyeler', { id: canId, rolId }));
	const k = grant.yeni[0];
	ok(grant.res.status === 200 && grant.yeni.length === 1 && k.islem === 'uye.rol_ata', 'give a role → one record', JSON.stringify(grant.yeni));
	ok(k?.hedefTur === 'uye' && k.hedefId === canId && k.onceki?.rolId === R.uye && k.sonraki?.rolId === rolId && k.sonraki?.rolAd === 'Denetim Rolü 2', 'give a role: before/after', JSON.stringify(k));
	ok(grant.yeni[0]?.hedefAd.includes(U.can.eposta), 'target names the member (name and e-mail)');
	const again = await recorded(() => admin.call('PATCH', '/api/uyeler', { id: canId, rolId }));
	ok(again.yeni.length === 0, 'giving the same role again → no record');
	const del = await recorded(() => admin.call('DELETE', '/api/roller', { id: rolId, tasi: R.uye }));
	const d = del.yeni[0];
	ok(del.res.status === 200 && del.yeni.length === 1 && d.islem === 'rol.sil', 'delete role → exactly one record', JSON.stringify(del.res));
	ok(d?.hedefId === rolId && d.onceki?.ad === 'Denetim Rolü 2' && d.onceki?.izinler?.budget === 'yonet' && d.sonraki?.tasinanUyeSayisi === 1 && d.sonraki?.tasinanRolId === R.uye && d.sonraki?.tasinanRolAd === 'Üye', 'delete: the role as it was + number of members moved', JSON.stringify(d));
	const me = (await admin.call('GET', '/api/uyeler')).json.members.find((m) => m.id === canId);
	ok(me?.rolId === R.uye, 'the member really moved to the target role');

	const remove = await recorded(() => admin.call('PATCH', '/api/uyeler', { id: canId, rolId: '' }));
	const r = remove.yeni[0];
	ok(remove.res.status === 200 && remove.yeni.length === 1 && r.islem === 'uye.rol_kaldir' && r.onceki?.rolId === R.uye && r.sonraki?.rolId === null, 'take the role away → one record', JSON.stringify(remove.yeni));
	await admin.call('PATCH', '/api/uyeler', { id: canId, rolId: R.uye });

	const mezun = await recorded(() => admin.call('PATCH', '/api/uyeler', { id: canId, durum: 'mezun' }));
	ok(mezun.yeni.length === 1 && mezun.yeni[0].islem === 'uye.mezun' && mezun.yeni[0].onceki?.durum === 'aktif' && mezun.yeni[0].sonraki?.durum === 'mezun', 'graduate → one record', JSON.stringify(mezun.yeni));
	const aktif = await recorded(() => admin.call('PATCH', '/api/uyeler', { id: canId, durum: 'aktif' }));
	ok(aktif.yeni.length === 1 && aktif.yeni[0].islem === 'uye.aktif' && aktif.yeni[0].onceki?.durum === 'mezun' && aktif.yeni[0].sonraki?.durum === 'aktif', 'back to active → one record', JSON.stringify(aktif.yeni));
	const nochange = await recorded(() => admin.call('PATCH', '/api/uyeler', { id: canId, durum: 'aktif' }));
	ok(nochange.yeni.length === 0, 'same status again → no record');
}
{
	const apply = async (ad) => {
		const reg = await client().call('POST', '/api/auth/register', { ad, soyad: 'Aday', eposta: `${ad.toLowerCase()}${Date.now()}@kulup.test`, sifre: 'Aday-Sifre-2026!', bolum: 'İşletme', sinif: 1 });
		if (reg.status >= 300) throw new Error(`register: ${JSON.stringify(reg.json)}`);
		return (await admin.call('GET', '/api/uyeler')).json.members.find((m) => m.ad === ad && m.durum === 'beklemede');
	};
	const a = await apply('Onayli');
	const onay = await recorded(() => admin.call('POST', '/api/admin/onay-ver', { kullaniciId: a.id, aksiyon: 'onayla' }));
	const k = onay.yeni[0];
	ok(onay.res.status === 200 && onay.yeni.length === 1 && k.islem === 'basvuru.onayla', 'approve application → exactly ONE record (the default role is part of it)', JSON.stringify(onay.yeni));
	ok(k?.onceki?.durum === 'beklemede' && k.onceki.rolId === null && k.sonraki?.durum === 'aktif' && k.sonraki.rolId === R.uye && k.sonraki.rolAd === 'Üye', 'approve: before/after (status and default role)', JSON.stringify(k));
	const b = await apply('Redli');
	const red = await recorded(() => admin.call('POST', '/api/admin/onay-ver', { kullaniciId: b.id, aksiyon: 'reddet' }));
	ok(red.yeni.length === 1 && red.yeni[0].islem === 'basvuru.reddet' && red.yeni[0].sonraki?.durum === 'reddedildi' && red.yeni[0].hedefId === b.id, 'reject application → one record', JSON.stringify(red.yeni));
	const refused = await recorded(() => admin.call('POST', '/api/admin/onay-ver', { kullaniciId: a.id, aksiyon: 'reddet' }));
	ok(refused.res.status === 409 && refused.yeni.length === 0, 'refused decision (not pending) → no record');
	// Approving through the member endpoint with an explicit role keeps that role.
	const c = await apply('Acik');
	const via = await recorded(() => admin.call('PATCH', '/api/uyeler', { id: c.id, rolId: R.haber, durum: 'aktif' }));
	const after = (await admin.call('GET', '/api/uyeler')).json.members.find((m) => m.id === c.id);
	ok(via.res.status === 200 && after?.rolId === R.haber, 'approve via members + explicit role: the explicit role wins over the default');
	ok(via.yeni.length === 2 && via.yeni.map((x) => x.islem).sort().join() === 'basvuru.onayla,uye.rol_ata', 'that request is two operations → two records', JSON.stringify(via.yeni.map((x) => x.islem)));
	await admin.call('DELETE', `/api/uyeler?id=${a.id}`);
	await admin.call('DELETE', `/api/uyeler?id=${b.id}`);
	await admin.call('DELETE', `/api/uyeler?id=${c.id}`);
}

// ---- deleting a member keeps only name and e-mail of the target ----------------
{
	const eposta = `silinecek${Date.now()}@kulup.test`;
	const add = await recorded(() => admin.call('POST', '/api/uyeler', { ad: 'Silinecek', soyad: 'Üye', eposta, bolum: 'Mimarlık', sinif: 3, ogrenciNo: '2401099', rolId: R.uye, bio: 'özel bilgi' }));
	const m = add.res.json?.member;
	ok(add.yeni.length === 1 && add.yeni[0].islem === 'uye.rol_ata' && add.yeni[0].sonraki?.uyeEklendi === true && add.yeni[0].sonraki?.rolId === R.uye, 'adding a member with a role → the grant is recorded', JSON.stringify(add.yeni));
	const del = await recorded(() => admin.call('DELETE', `/api/uyeler?id=${m.id}`));
	const k = del.yeni[0];
	ok(del.res.status === 200 && del.yeni.length === 1 && k.islem === 'uye.sil' && k.hedefId === m.id, 'delete member → exactly one record');
	ok(sameKeys(k?.onceki, ['ad', 'eposta', 'durum', 'rolId', 'rolAd']) && k.onceki.ad === 'Silinecek Üye' && k.onceki.eposta === eposta && k.onceki.rolAd === 'Üye' && k.sonraki === null, 'delete: only name, e-mail, status, role — nothing else', JSON.stringify(k?.onceki));
	const text = JSON.stringify(k);
	ok(!text.includes('2401099') && !text.includes('Mimarlık') && !text.includes('özel bilgi'), 'delete: no student number, department or bio');
	const gone = await recorded(() => admin.call('DELETE', `/api/uyeler?id=${m.id}`));
	ok(gone.res.status === 404 && gone.yeni.length === 0, 'deleting a member who is gone → no record');
}

// ---- SMTP settings: the password is never recorded -----------------------------
const SMTP_SECRET = 'GizliUygulamaSifresi-9f8e7d6c';
{
	const body = { smtp_host: 'smtp.audit.test', smtp_port: 587, smtp_secure: false, smtp_user: 'audit@kulup.test', smtp_from: 'Denetim <audit@kulup.test>' };
	const a = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_pass: SMTP_SECRET }));
	const k = a.yeni[0];
	ok(a.res.status === 200 && a.yeni.length === 1 && k.islem === 'ayar.smtp', 'SMTP change → exactly one record', JSON.stringify(a.res));
	ok(k?.sonraki?.smtp_host === 'smtp.audit.test' && k.sonraki.smtp_port === '587' && k.sonraki.smtp_user === 'audit@kulup.test' && k.sonraki.uygulamaAnahtari === 'degisti' && k.onceki?.uygulamaAnahtari === 'yok', 'SMTP: changed fields, password only as "degisti"', JSON.stringify(k));
	ok(!JSON.stringify(a.yeni).includes(SMTP_SECRET), 'SMTP: the password is not in the record');
	const same = await recorded(() => admin.call('POST', '/api/settings/smtp', body));
	ok(same.res.status === 200 && same.yeni.length === 0, 'saving the same SMTP settings again → no record');
	const host = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_host: 'smtp2.audit.test' }));
	ok(host.yeni.length === 1 && JSON.stringify(host.yeni[0].onceki) === '{"smtp_host":"smtp.audit.test"}' && JSON.stringify(host.yeni[0].sonraki) === '{"smtp_host":"smtp2.audit.test"}', 'SMTP: a host change records just the host', JSON.stringify(host.yeni));
	const clear = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_host: 'smtp2.audit.test', clearPassword: true }));
	ok(clear.yeni.length === 1 && clear.yeni[0].onceki?.uygulamaAnahtari === 'var' && clear.yeni[0].sonraki?.uygulamaAnahtari === 'silindi', 'SMTP: removing the password → "silindi"', JSON.stringify(clear.yeni));
	// The IMAP mailbox is gone; fields an old client may still send are ignored and leave no record.
	const legacy = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_host: 'smtp2.audit.test', imap_host: 'imap.audit.test', imap_port: 143, imap_secure: false }));
	ok(legacy.res.status === 200 && legacy.yeni.length === 0, 'legacy imap_* fields in a save are ignored (no record)', JSON.stringify(legacy.yeni));
	ok((await zeynep.call('POST', '/api/settings/smtp', body)).status === 403, 'SMTP: settings: kullan cannot change it');
}

// ---- 2FA off ---------------------------------------------------------------------
let twoFaSecret;
{
	const eposta = `iki${Date.now()}@kulup.test`;
	const created = (await admin.call('POST', '/api/uyeler', { ad: 'İki', soyad: 'Adım', eposta, bolum: 'Fizik', sinif: 1, rolId: R.uye })).json;
	const u = await login(created.member.eposta, created.geciciSifre);
	const setup = (await u.call('POST', '/api/auth/2fa/setup', {})).json;
	twoFaSecret = setup.secret;
	const enable = await u.call('POST', '/api/auth/2fa/enable', { code: await code(setup.secret) });
	ok(enable.status === 200, 'member enrols 2FA');
	const wrong = await recorded(() => u.call('POST', '/api/auth/2fa/disable', { code: '000000' }));
	ok(wrong.res.status === 400 && wrong.yeni.length === 0, 'disable with a wrong code → refused, no record');
	const offCode = await code(setup.secret);
	const off = await recorded(() => u.call('POST', '/api/auth/2fa/disable', { code: offCode }));
	const k = off.yeni[0];
	ok(off.res.status === 200 && off.yeni.length === 1 && k.islem === 'guvenlik.2fa_kapat', 'turn 2FA off → exactly one record', JSON.stringify(off.res));
	ok(k?.hedefId === created.member.id && k.yapanId === created.member.id && k.onceki?.ikiAdim === 'acik' && k.sonraki?.ikiAdim === 'kapali', '2FA: actor = target, before on / after off', JSON.stringify(k));
	ok(!JSON.stringify(k).includes(setup.secret), '2FA: the TOTP secret is not in the record');
	await admin.call('DELETE', `/api/uyeler?id=${created.member.id}`);
}

// ---- the address: the first X-Forwarded-For entry, like the rate limiter ----------
{
	const r = await recorded(() => admin.call('POST', '/api/roller', { action: 'varsayilan', rolId: R.haber }, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
	ok(r.yeni.length === 1 && r.yeni[0].ip === '203.0.113.9', 'address = first X-Forwarded-For entry (same helper as the rate limiter)', r.yeni[0]?.ip);
	const evil = await recorded(() => admin.call('POST', '/api/roller', { action: 'varsayilan', rolId: R.uye }, { 'x-forwarded-for': `${'9'.repeat(200)}` }));
	ok(evil.yeni.length === 1 && evil.yeni[0].ip.length <= 64, 'an oversized address header is bounded', String(evil.yeni[0]?.ip?.length));
}

// ---- filters, paging, export ------------------------------------------------------
{
	const all = await everything();
	ok(all.toplam >= 20 && all.kayitlar.length === all.toplam, 'export returns every record', `${all.kayitlar.length}/${all.toplam}`);
	ok(all.kayitlar.every((k, i, a) => i === 0 || a[i - 1].zaman >= k.zaman), 'newest first');
	const page = (await admin.call('GET', '/api/denetim?boyut=5&sayfa=2')).json;
	ok(page.kayitlar.length === 5 && page.toplam === all.toplam && page.kayitlar[0].id === all.kayitlar[5].id, 'paging: page 2 of 5 starts at the sixth record');
	const huge = (await admin.call('GET', '/api/denetim?boyut=100000')).json;
	ok(huge.boyut === 200, 'page size is capped');
	const ops = (await admin.call('GET', '/api/denetim?islem=rol.sil&boyut=200')).json;
	ok(ops.kayitlar.length >= 1 && ops.kayitlar.every((k) => k.islem === 'rol.sil'), 'filter: action');
	const byRole = (await admin.call('GET', `/api/denetim?rol=${rolId}&boyut=200`)).json;
	const rolIslemleri = new Set(byRole.kayitlar.map((k) => k.islem));
	ok(['rol.olustur', 'rol.duzenle', 'rol.sil', 'uye.rol_ata', 'rol.varsayilan'].every((i) => rolIslemleri.has(i)), 'filter: role finds its create/edit/delete, grants and default change', [...rolIslemleri].join());
	const byPerson = (await admin.call('GET', `/api/denetim?kisi=${encodeURIComponent(U.can.eposta)}&boyut=200`)).json;
	ok(byPerson.kayitlar.length >= 4 && byPerson.kayitlar.every((k) => k.hedefId === U.can.id), 'filter: person (e-mail) finds what was done to them');
	const byActor = (await admin.call('GET', `/api/denetim?kisi=${adminMe.id}&boyut=200`)).json;
	ok(byActor.toplam >= 20 && byActor.kayitlar.every((k) => k.yapanId === adminMe.id || k.hedefId === adminMe.id), 'filter: person (id) matches the actor');
	const byName = (await admin.call('GET', `/api/denetim?kisi=${encodeURIComponent('silinecek')}&boyut=200`)).json;
	ok(byName.kayitlar.length >= 2 && byName.kayitlar.every((k) => /silinecek/i.test(`${k.hedefAd}${k.yapanAd}`)), 'filter: person (part of a name), also after the member was deleted');
	const today = new Date().toLocaleDateString('sv-SE');
	const day = (await admin.call('GET', `/api/denetim?from=${today}&to=${today}&boyut=1`)).json;
	ok(day.toplam >= all.toplam - startCount, 'filter: today..today (inclusive end day) holds everything this run did', `${day.toplam} vs ${all.toplam - startCount}`);
	const old = (await admin.call('GET', '/api/denetim?from=2001-01-01&to=2001-12-31')).json;
	ok(old.toplam === 0 && old.kayitlar.length === 0, 'filter: an empty period');
	const garbage = await admin.call('GET', "/api/denetim?kisi=%27%3B%20DROP%20TABLE%20denetim_kaydi%3B--&rol=%25&islem=x&from=zz&boyut=abc&sayfa=-1");
	ok(garbage.status === 200 && garbage.json.sayfa === 1, 'malformed filters are harmless');
	ok((await everything()).toplam === all.toplam, '…and the table is still there');
}

// ---- no credential anywhere in the log -----------------------------------------------
{
	const text = JSON.stringify((await everything()).kayitlar);
	const keys = [];
	JSON.parse(text, function (k, v) {
		if (k) keys.push(k);
		return v;
	});
	const bad = keys.filter((k) => /pass|parola|sifre|hash|totp|secret|token|recovery|kurtarma|cookie|oturum/i.test(k));
	ok(bad.length === 0, 'no key in any record looks like a credential', bad.join());
	ok(!/password|hash|totp|secret|token/i.test(text.replace(/uygulamaAnahtari/g, '')), 'no record mentions password / hash / totp / secret / token', (text.match(/.{20}(password|hash|totp|secret|token).{20}/i) || [''])[0]);
	const values = [SMTP_SECRET, twoFaSecret, FX.adminTotp, FX.admin.sifre, U.can.sifre, U.zeynep.sifre, ...[admin, zeynep, can, okur].map((c) => c.cookie().split('=')[1])];
	ok(values.every((v) => v && !text.includes(v)), 'no password, TOTP secret or session token value appears in the log');
	ok(!/\$2[aby]\$/.test(text), 'no bcrypt hash');
}

// ---- a record exists exactly when its operation was committed --------------------------
if (!DATABASE_URL) {
	console.log('SKIP rollback checks: set DATABASE_URL (the test database) to run them');
} else {
	const { Client } = require('pg');
	const db = new Client({ connectionString: DATABASE_URL });
	await db.connect();
	const q = (sql, p) => db.query(sql, p).then((r) => r.rows);
	const count = async () => (await everything()).toplam;
	try {
		// 1. The operation fails at COMMIT (deferred constraint trigger) after the record was written:
		//    neither the role nor its record may remain.
		await q(`CREATE OR REPLACE FUNCTION audit_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit-test: commit refused'; END $$`);
		await q(`CREATE CONSTRAINT TRIGGER audit_test_commit AFTER INSERT ON roller DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.ad = 'GeriAlinacak') EXECUTE FUNCTION audit_test_fail()`);
		const before = await count();
		const r = await admin.call('POST', '/api/roller', rolPayload({ news: 'kullan', settings: 'kullan' }, { ad: 'GeriAlinacak' }));
		ok(r.status === 500, 'create refused at COMMIT → 500', String(r.status));
		ok((await q(`SELECT 1 FROM roller WHERE ad = 'GeriAlinacak'`)).length === 0, 'rollback: the role is not there');
		ok((await count()) === before, 'rollback: and neither is its record');
		await q('DROP TRIGGER audit_test_commit ON roller');

		// 2. Deleting a role fails at COMMIT: role, its members and the log stay as they were.
		const ok1 = await admin.call('POST', '/api/roller', rolPayload({ news: 'kullan', settings: 'kullan' }, { ad: 'SilinemezRol' }));
		await admin.call('PATCH', '/api/uyeler', { id: U.can.id, rolId: ok1.json.id });
		await q(`CREATE CONSTRAINT TRIGGER audit_test_commit AFTER DELETE ON roller DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.ad = 'SilinemezRol') EXECUTE FUNCTION audit_test_fail()`);
		const before2 = await count();
		const d = await admin.call('DELETE', '/api/roller', { id: ok1.json.id, tasi: R.uye });
		ok(d.status === 500, 'delete refused at COMMIT → 500', String(d.status));
		ok((await q(`SELECT rolId FROM kullanicilar WHERE id = $1`, [U.can.id]))[0].rolid === ok1.json.id, 'rollback: the member is still in the role');
		ok((await q(`SELECT 1 FROM roller WHERE id = $1`, [ok1.json.id])).length === 1, 'rollback: the role still exists');
		ok((await count()) === before2, 'rollback: no "rol.sil" record was left');
		await q('DROP TRIGGER audit_test_commit ON roller');
		await admin.call('DELETE', '/api/roller', { id: ok1.json.id, tasi: R.uye });

		// 3. Writing the record fails: the operation must not go through without it.
		await q(`CREATE OR REPLACE FUNCTION audit_test_block() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit-test: no record, no change'; END $$`);
		await q(`CREATE TRIGGER audit_test_block BEFORE INSERT ON denetim_kaydi FOR EACH ROW WHEN (NEW.islem = 'uye.mezun') EXECUTE FUNCTION audit_test_block()`);
		const m = await admin.call('PATCH', '/api/uyeler', { id: U.can.id, durum: 'mezun' });
		ok(m.status === 500, 'no record possible → the change fails (500)', String(m.status));
		ok((await q(`SELECT durum FROM kullanicilar WHERE id = $1`, [U.can.id]))[0].durum === 'aktif', 'and the member is still active (nothing changed without a record)');
		await q('DROP TRIGGER audit_test_block ON denetim_kaydi');

		// 4. SMTP settings: same guarantee.
		await q(`CREATE TRIGGER audit_test_block BEFORE INSERT ON denetim_kaydi FOR EACH ROW WHEN (NEW.islem = 'ayar.smtp') EXECUTE FUNCTION audit_test_block()`);
		const before4 = (await q(`SELECT deger FROM sistem_ayarlari WHERE anahtar = 'smtp_host'`))[0]?.deger;
		const s = await admin.call('POST', '/api/settings/smtp', { smtp_host: 'smtp.never.test', smtp_port: 465, smtp_user: 'x@kulup.test' });
		ok(s.status === 500 && (await q(`SELECT deger FROM sistem_ayarlari WHERE anahtar = 'smtp_host'`))[0]?.deger === before4, 'SMTP: no record possible → settings unchanged');
		await q('DROP TRIGGER audit_test_block ON denetim_kaydi');
	} finally {
		await q('DROP TRIGGER IF EXISTS audit_test_commit ON roller').catch(() => {});
		await q('DROP TRIGGER IF EXISTS audit_test_block ON denetim_kaydi').catch(() => {});
		await q('DROP FUNCTION IF EXISTS audit_test_fail()').catch(() => {});
		await q('DROP FUNCTION IF EXISTS audit_test_block()').catch(() => {});
		await db.end();
	}
}

console.log(`\naudit-api: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
