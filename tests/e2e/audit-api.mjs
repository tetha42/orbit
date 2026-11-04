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
const FIXTURES_FILE = arg('--fixtures', '.fixtures.json');
const FX = JSON.parse(fs.readFileSync(FIXTURES_FILE, 'utf8'));
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
const admin = await login(FX.admin.email, FX.admin.password, FX.adminTotp);
const zeynep = await login(U.zeynep.email, U.zeynep.password, U.zeynep.totp);
const can = await login(U.can.email, U.can.password);
const reader = await login(U.reader.email, U.reader.password);
const adminMe = (await admin.call('GET', '/api/auth/me')).json.user;
const startCount = (await admin.call('GET', '/api/audit?limit=1')).json.total;
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const sameKeys = (o, keys) => !!o && JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...keys].sort());

/** Everything the log holds (newest first). */
const everything = async (q = '') => (await admin.call('GET', `/api/audit?all=1${q}`)).json;
/** Runs `fn` and returns its result plus the records it added. */
async function recorded(fn) {
	const beforeJson = await everything();
	const before = beforeJson.total;
	const res = await fn();
	const after = await everything();
	const afterTotal = after.total;
	const afterRecords = after.records;
	return { res, fresh: afterRecords.slice(0, afterTotal - before) };
}
const rolePayload = (permissions, extra = {}) => ({ name: 'Denetim Rolü', color: '#30d158', description: 'test', twoStepRequired: false, permissions, ...extra });

// ---- who may read the log -----------------------------------------------------
{
	ok((await client().call('GET', '/api/audit')).status === 401, 'anonymous → 401');
	ok((await zeynep.call('GET', '/api/audit')).status === 403, 'Yönetim Kurulu (settings: kullan) → 403');
	ok((await can.call('GET', '/api/audit')).status === 403, 'üye → 403');
	ok((await reader.call('GET', '/api/audit')).status === 403, 'okur → 403');
	ok((await zeynep.call('GET', '/api/audit?all=1')).status === 403, 'export → 403 for them too');
	ok((await admin.call('GET', '/api/audit')).status === 200, 'admin (settings: yonet) → 200');
	ok((await admin.call('POST', '/api/audit', {})).status === 405, 'the log is read-only (POST → 405)');
}

// ---- roles: create, edit (permission diff), default role, delete -------------
let roleId;
{
	const { res, fresh } = await recorded(() => admin.call('POST', '/api/roles', rolePayload({ news: 'kullan', settings: 'kullan', budget: 'kullan' })));
	roleId = res.json?.id;
	const k = fresh[0];
	ok(res.status === 201 && fresh.length === 1, 'create role → exactly one record', `status ${res.status}, ${fresh.length} records`);
	ok(k?.action === 'role.create' && k?.targetType === 'role' && k?.targetId === roleId && k?.targetName === 'Denetim Rolü', 'create: action / target');
	ok(k?.actorId === adminMe.id && k?.actorName === `${adminMe.name} ${adminMe.surname}`.trim() && !!k.ip && k.ip !== 'unknown', 'create: actor and address recorded', JSON.stringify(k));
	ok(k?.before === null && canon(k?.after?.permissions) === canon({ budget: 'kullan', news: 'kullan', settings: 'kullan' }), 'create: after = the permission matrix', JSON.stringify(k?.after));
	ok(Math.abs((k.timestamp) - Date.now()) < 60000, 'create: timestamp is now');
}
{
	const { res, fresh } = await recorded(() => admin.call('PATCH', '/api/roles', { id: roleId, ...rolePayload({ news: 'yok', settings: 'kullan', budget: 'yonet', events: 'kullan' }, { name: 'Denetim Rolü 2' }) }));
	const k = fresh[0];
	ok(res.status === 200 && fresh.length === 1 && k.action === 'role.edit', 'edit role → exactly one record');
	const beforeSnap = k.before;
	const afterSnap = k.after;
	ok(
		k?.targetId === roleId &&
			canon(beforeSnap) === canon({ name: 'Denetim Rolü', permissions: { budget: 'kullan', events: 'yok', news: 'kullan' } }) &&
			canon(afterSnap) === canon({ name: 'Denetim Rolü 2', permissions: { budget: 'yonet', events: 'kullan', news: 'yok' } }),
		'edit: before/after hold only what changed (name + permission diff)',
		JSON.stringify([beforeSnap, afterSnap])
	);
	const same = await recorded(() => admin.call('PATCH', '/api/roles', { id: roleId, ...rolePayload({ budget: 'yonet', events: 'kullan', settings: 'kullan' }, { name: 'Denetim Rolü 2' }) }));
	ok(same.res.status === 200 && same.fresh.length === 0, 'edit without a change → no record');
}
{
	const a = await recorded(() => admin.call('POST', '/api/roles', { action: 'setDefault', roleId }));
	ok(a.res.status === 200 && a.fresh.length === 1 && a.fresh[0].action === 'role.default', 'default role change → one record');
	const aBefore = a.fresh[0]?.before;
	const aAfter = a.fresh[0]?.after;
	ok(aBefore?.roleId === R.member && aAfter?.roleId === roleId && aAfter?.roleName === 'Denetim Rolü 2', 'default: before = Üye, after = new role', JSON.stringify(a.fresh[0]));
	const again = await recorded(() => admin.call('POST', '/api/roles', { action: 'setDefault', roleId }));
	ok(again.fresh.length === 0, 'default role set to the same role → no record');
	const back = await recorded(() => admin.call('POST', '/api/roles', { action: 'setDefault', roleId: R.member }));
	const backAfter = back.fresh[0]?.after;
	ok(back.fresh.length === 1 && backAfter?.roleId === R.member, 'default role restored → one record');
}

// ---- members: role grant / removal, status, applications ----------------------
{
	const canId = U.can.id;
	const grant = await recorded(() => admin.call('PATCH', '/api/members', { id: canId, roleId }));
	const k = grant.fresh[0];
	ok(grant.res.status === 200 && grant.fresh.length === 1 && k.action === 'member.role_grant', 'give a role → one record', JSON.stringify(grant.fresh));
	const kBefore = k.before;
	const kAfter = k.after;
	ok(k?.targetType === 'member' && k?.targetId === canId && kBefore?.roleId === R.member && kAfter?.roleId === roleId && kAfter?.roleName === 'Denetim Rolü 2', 'give a role: before/after', JSON.stringify(k));
	ok((grant.fresh[0]?.targetName).includes(U.can.email), 'target names the member (name and e-mail)');
	const again = await recorded(() => admin.call('PATCH', '/api/members', { id: canId, roleId }));
	ok(again.fresh.length === 0, 'giving the same role again → no record');
	const del = await recorded(() => admin.call('DELETE', '/api/roles', { id: roleId, move: R.member }));
	const d = del.fresh[0];
	ok(del.res.status === 200 && del.fresh.length === 1 && d.action === 'role.delete', 'delete role → exactly one record', JSON.stringify(del.res));
	const dBefore = d.before;
	const dAfter = d.after;
	ok(d?.targetId === roleId && dBefore?.name === 'Denetim Rolü 2' && dBefore?.permissions?.budget === 'yonet' && dAfter?.movedCount === 1 && dAfter?.movedToRoleId === R.member && dAfter?.movedToRoleName === 'Üye', 'delete: the role as it was + number of members moved', JSON.stringify(d));
	const me = (await admin.call('GET', '/api/members')).json.members.find((m) => m.id === canId);
	ok(me?.roleId === R.member, 'the member really moved to the target role');

	const remove = await recorded(() => admin.call('PATCH', '/api/members', { id: canId, roleId: '' }));
	const r = remove.fresh[0];
	const rBefore = r.before;
	const rAfter = r.after;
	ok(remove.res.status === 200 && remove.fresh.length === 1 && r.action === 'member.role_revoke' && rBefore?.roleId === R.member && rAfter?.roleId === null, 'take the role away → one record', JSON.stringify(remove.fresh));
	await admin.call('PATCH', '/api/members', { id: canId, roleId: R.member });

	const mezun = await recorded(() => admin.call('PATCH', '/api/members', { id: canId, status: 'mezun' }));
	const graduateBefore = mezun.fresh[0]?.before;
	const graduateAfter = mezun.fresh[0]?.after;
	ok(mezun.fresh.length === 1 && mezun.fresh[0].action === 'member.graduate' && graduateBefore?.status === 'aktif' && graduateAfter?.status === 'mezun', 'graduate → one record', JSON.stringify(mezun.fresh));
	const aktif = await recorded(() => admin.call('PATCH', '/api/members', { id: canId, status: 'aktif' }));
	const activeBefore = aktif.fresh[0]?.before;
	const activeAfter = aktif.fresh[0]?.after;
	ok(aktif.fresh.length === 1 && aktif.fresh[0].action === 'member.activate' && activeBefore?.status === 'mezun' && activeAfter?.status === 'aktif', 'back to active → one record', JSON.stringify(aktif.fresh));
	const nochange = await recorded(() => admin.call('PATCH', '/api/members', { id: canId, status: 'aktif' }));
	ok(nochange.fresh.length === 0, 'same status again → no record');
}
{
	const apply = async (name) => {
		const reg = await client().call('POST', '/api/auth/register', { name, surname: 'Aday', email: `${name.toLowerCase()}${Date.now()}@kulup.test`, password: 'Aday-Sifre-2026!', department: 'İşletme', grade: 1 });
		if (reg.status >= 300) throw new Error(`register: ${JSON.stringify(reg.json)}`);
		return (await admin.call('GET', '/api/members')).json.members.find((m) => m.name === name && m.status === 'beklemede');
	};
	const a = await apply('Onayli');
	const approval = await recorded(() => admin.call('POST', '/api/admin/approve', { userId: a.id, action: 'onayla' }));
	const k = approval.fresh[0];
	ok(approval.res.status === 200 && approval.fresh.length === 1 && k.action === 'application.approve', 'approve application → exactly ONE record (the default role is part of it)', JSON.stringify(approval.fresh));
	const kBefore = k.before;
	const kAfter = k.after;
	ok(kBefore?.status === 'beklemede' && kBefore?.roleId === null && kAfter?.status === 'aktif' && kAfter?.roleId === R.member && kAfter?.roleName === 'Üye', 'approve: before/after (status and default role)', JSON.stringify(k));
	const b = await apply('Redli');
	const red = await recorded(() => admin.call('POST', '/api/admin/approve', { userId: b.id, action: 'reddet' }));
	const redAfter = red.fresh[0]?.after;
	ok(red.fresh.length === 1 && red.fresh[0].action === 'application.reject' && redAfter?.status === 'reddedildi' && red.fresh[0].targetId === b.id, 'reject application → one record', JSON.stringify(red.fresh));
	const refused = await recorded(() => admin.call('POST', '/api/admin/approve', { userId: a.id, action: 'reddet' }));
	ok(refused.res.status === 409 && refused.fresh.length === 0, 'refused decision (not pending) → no record');
	// Approving through the member endpoint with an explicit role keeps that role.
	const c = await apply('Acik');
	const via = await recorded(() => admin.call('PATCH', '/api/members', { id: c.id, roleId: R.news, status: 'aktif' }));
	const after = (await admin.call('GET', '/api/members')).json.members.find((m) => m.id === c.id);
	ok(via.res.status === 200 && after?.roleId === R.news, 'approve via members + explicit role: the explicit role wins over the default');
	ok(via.fresh.length === 2 && via.fresh.map((x) => x.action).sort().join() === 'application.approve,member.role_grant', 'that request is two operations → two records', JSON.stringify(via.fresh.map((x) => x.action)));
	await admin.call('DELETE', `/api/members?id=${a.id}`);
	await admin.call('DELETE', `/api/members?id=${b.id}`);
	await admin.call('DELETE', `/api/members?id=${c.id}`);
}

// ---- deleting a member keeps only name and e-mail of the target ----------------
{
	const email = `silinecek${Date.now()}@kulup.test`;
	const add = await recorded(() => admin.call('POST', '/api/members', { name: 'Silinecek', surname: 'Üye', email, department: 'Mimarlık', grade: 3, studentNo: '2401099', roleId: R.member, bio: 'özel bilgi' }));
	const m = add.res.json?.member;
	const addAfter = add.fresh[0]?.after;
	ok(add.fresh.length === 1 && add.fresh[0].action === 'member.role_grant' && addAfter?.memberAdded === true && addAfter?.roleId === R.member, 'adding a member with a role → the grant is recorded', JSON.stringify(add.fresh));
	const del = await recorded(() => admin.call('DELETE', `/api/members?id=${m.id}`));
	const k = del.fresh[0];
	ok(del.res.status === 200 && del.fresh.length === 1 && k.action === 'member.delete' && k.targetId === m.id, 'delete member → exactly one record');
	const kBefore = k.before;
	const kAfter = k.after;
	ok(sameKeys(kBefore, ['name', 'email', 'status', 'roleId', 'roleName']) && kBefore.name === 'Silinecek Üye' && kBefore.email === email && kBefore.roleName === 'Üye' && kAfter === null, 'delete: only name, e-mail, status, role — nothing else', JSON.stringify(kBefore));
	const text = JSON.stringify(k);
	ok(!text.includes('2401099') && !text.includes('Mimarlık') && !text.includes('özel bilgi'), 'delete: no student number, department or bio');
	const gone = await recorded(() => admin.call('DELETE', `/api/members?id=${m.id}`));
	ok(gone.res.status === 404 && gone.fresh.length === 0, 'deleting a member who is gone → no record');
}

// ---- SMTP settings: the password is never recorded -----------------------------
const SMTP_SECRET = 'GizliUygulamaSifresi-9f8e7d6c';
{
	const body = { smtp_host: 'smtp.audit.test', smtp_port: 587, smtp_secure: false, smtp_user: 'audit@kulup.test', smtp_from: 'Denetim <audit@kulup.test>' };
	const a = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_pass: SMTP_SECRET }));
	const k = a.fresh[0];
	ok(a.res.status === 200 && a.fresh.length === 1 && k.action === 'setting.smtp', 'SMTP change → exactly one record', JSON.stringify(a.res));
	const kAfter = k.after;
	const kBefore = k.before;
	ok(kAfter?.smtp_host === 'smtp.audit.test' && kAfter?.smtp_port === '587' && kAfter?.smtp_user === 'audit@kulup.test' && kAfter?.appKey === 'degisti' && kBefore?.appKey === 'yok', 'SMTP: changed fields, password only as "degisti"', JSON.stringify(k));
	ok(!JSON.stringify(a.fresh).includes(SMTP_SECRET), 'SMTP: the password is not in the record');
	const same = await recorded(() => admin.call('POST', '/api/settings/smtp', body));
	ok(same.res.status === 200 && same.fresh.length === 0, 'saving the same SMTP settings again → no record');
	const host = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_host: 'smtp2.audit.test' }));
	const hostBefore = host.fresh[0]?.before;
	const hostAfter = host.fresh[0]?.after;
	ok(host.fresh.length === 1 && JSON.stringify(hostBefore) === '{"smtp_host":"smtp.audit.test"}' && JSON.stringify(hostAfter) === '{"smtp_host":"smtp2.audit.test"}', 'SMTP: a host change records just the host', JSON.stringify(host.fresh));
	const clear = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_host: 'smtp2.audit.test', clearPassword: true }));
	const clearBefore = clear.fresh[0]?.before;
	const clearAfter = clear.fresh[0]?.after;
	ok(clear.fresh.length === 1 && clearBefore?.appKey === 'var' && clearAfter?.appKey === 'silindi', 'SMTP: removing the password → "silindi"', JSON.stringify(clear.fresh));
	// The IMAP mailbox is gone; fields an old client may still send are ignored and leave no record.
	const legacy = await recorded(() => admin.call('POST', '/api/settings/smtp', { ...body, smtp_host: 'smtp2.audit.test', imap_host: 'imap.audit.test', imap_port: 143, imap_secure: false }));
	ok(legacy.res.status === 200 && legacy.fresh.length === 0, 'legacy imap_* fields in a save are ignored (no record)', JSON.stringify(legacy.fresh));
	ok((await zeynep.call('POST', '/api/settings/smtp', body)).status === 403, 'SMTP: settings: kullan cannot change it');
}

// ---- 2FA off ---------------------------------------------------------------------
let twoFaSecret;
{
	const email = `iki${Date.now()}@kulup.test`;
	const created = (await admin.call('POST', '/api/members', { name: 'İki', surname: 'Adım', email, department: 'Fizik', grade: 1, roleId: R.member })).json;
	const u = await login(created.member.email, created.temporaryPassword);
	const setup = (await u.call('POST', '/api/auth/2fa/setup', {})).json;
	twoFaSecret = setup.secret;
	const enable = await u.call('POST', '/api/auth/2fa/enable', { code: await code(setup.secret) });
	ok(enable.status === 200, 'member enrols 2FA');
	const wrong = await recorded(() => u.call('POST', '/api/auth/2fa/disable', { code: '000000' }));
	ok(wrong.res.status === 400 && wrong.fresh.length === 0, 'disable with a wrong code → refused, no record');
	const offCode = await code(setup.secret);
	const off = await recorded(() => u.call('POST', '/api/auth/2fa/disable', { code: offCode }));
	const k = off.fresh[0];
	ok(off.res.status === 200 && off.fresh.length === 1 && k.action === 'security.2fa_disable', 'turn 2FA off → exactly one record', JSON.stringify(off.res));
	const kBefore = k.before;
	const kAfter = k.after;
	ok(k?.targetId === created.member.id && k?.actorId === created.member.id && (kBefore?.twoFactor === 'off' || kBefore?.twoStep === 'acik') && (kAfter?.twoFactor === 'off' || kAfter?.twoStep === 'kapali'), '2FA: actor = target, before on / after off', JSON.stringify(k));
	ok(!JSON.stringify(k).includes(setup.secret), '2FA: the TOTP secret is not in the record');
	await admin.call('DELETE', `/api/members?id=${created.member.id}`);
}

// ---- the address: the first X-Forwarded-For entry, like the rate limiter ----------
{
	const r = await recorded(() => admin.call('POST', '/api/roles', { action: 'setDefault', roleId: R.news }, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
	ok(r.fresh.length === 1 && r.fresh[0].ip === '203.0.113.9', 'address = first X-Forwarded-For entry (same helper as the rate limiter)', r.fresh[0]?.ip);
	const evil = await recorded(() => admin.call('POST', '/api/roles', { action: 'setDefault', roleId: R.member }, { 'x-forwarded-for': `${'9'.repeat(200)}` }));
	ok(evil.fresh.length === 1 && evil.fresh[0].ip.length <= 64, 'an oversized address header is bounded', String(evil.fresh[0]?.ip?.length));
}

// ---- filters, paging, export ------------------------------------------------------
{
	const all = await everything();
	const allTotal = all.total;
	const allRecords = all.records;
	ok(allTotal >= 20 && allRecords.length === allTotal, 'export returns every record', `${allRecords.length}/${allTotal}`);
	ok(allRecords.every((k, i, a) => i === 0 || a[i - 1].timestamp >= k.timestamp), 'newest first');
	const page = (await admin.call('GET', '/api/audit?limit=5&page=2')).json;
	const pageRecords = page.records;
	const pageTotal = page.total;
	ok(pageRecords.length === 5 && pageTotal === allTotal && pageRecords[0].id === allRecords[5].id, 'paging: page 2 of 5 starts at the sixth record');
	const huge = (await admin.call('GET', '/api/audit?limit=100000')).json;
	ok(huge.pageSize === 200, 'page size is capped');
	const ops = (await admin.call('GET', '/api/audit?action=role.delete&limit=200')).json;
	const opsRecords = ops.records;
	ok(opsRecords.length >= 1 && opsRecords.every((k) => k.action === 'role.delete'), 'filter: action');
	const byRole = (await admin.call('GET', `/api/audit?role=${roleId}&limit=200`)).json;
	const byRoleRecords = byRole.records;
	const roleActions = new Set(byRoleRecords.map((k) => k.action));
	ok(['role.create', 'role.edit', 'role.delete', 'member.role_grant', 'role.default'].every((i) => roleActions.has(i)), 'filter: role finds its create/edit/delete, grants and default change', [...roleActions].join());
	const byPerson = (await admin.call('GET', `/api/audit?person=${encodeURIComponent(U.can.email)}&limit=200`)).json;
	const byPersonRecords = byPerson.records;
	ok(byPersonRecords.length >= 4 && byPersonRecords.every((k) => k.targetId === U.can.id), 'filter: person (e-mail) finds what was done to them');
	const byActor = (await admin.call('GET', `/api/audit?person=${adminMe.id}&limit=200`)).json;
	const byActorRecords = byActor.records;
	const byActorTotal = byActor.total;
	ok(byActorTotal >= 20 && byActorRecords.every((k) => k.actorId === adminMe.id || k.targetId === adminMe.id), 'filter: person (id) matches the actor');
	const byName = (await admin.call('GET', `/api/audit?person=${encodeURIComponent('silinecek')}&limit=200`)).json;
	const byNameRecords = byName.records;
	ok(byNameRecords.length >= 2 && byNameRecords.every((k) => /silinecek/i.test(`${k.targetName}${k.actorName}`)), 'filter: person (part of a name), also after the member was deleted');
	const today = new Date().toLocaleDateString('sv-SE');
	const day = (await admin.call('GET', `/api/audit?from=${today}&to=${today}&limit=1`)).json;
	const dayTotal = day.total;
	ok(dayTotal >= allTotal - startCount, 'filter: today..today (inclusive end day) holds everything this run did', `${dayTotal} vs ${allTotal - startCount}`);
	const old = (await admin.call('GET', '/api/audit?from=2001-01-01&to=2001-12-31')).json;
	const oldTotal = old.total;
	const oldRecords = old.records;
	ok(oldTotal === 0 && oldRecords.length === 0, 'filter: an empty period');
	const garbage = await admin.call('GET', "/api/audit?person=%27%3B%20DROP%20TABLE%20denetim_kaydi%3B--&role=%25&action=x&from=zz&limit=abc&page=-1");
	ok(garbage.status === 200 && garbage.json.page === 1, 'malformed filters are harmless');
	const finalAll = await everything();
	ok((finalAll.total) === allTotal, '…and the table is still there');
}

// ---- no credential anywhere in the log -----------------------------------------------
{
	const text = JSON.stringify((await everything()).records);
	const keys = [];
	JSON.parse(text, function (k, v) {
		if (k) keys.push(k);
		return v;
	});
	const bad = keys.filter((k) => /pass|parola|sifre|hash|totp|secret|token|recovery|kurtarma|cookie|oturum/i.test(k));
	ok(bad.length === 0, 'no key in any record looks like a credential', bad.join());
	ok(!/password|hash|totp|secret|token/i.test(text.replace(/uygulamaAnahtari/g, '')), 'no record mentions password / hash / totp / secret / token', (text.match(/.{20}(password|hash|totp|secret|token).{20}/i) || [''])[0]);
	const values = [SMTP_SECRET, twoFaSecret, FX.adminTotp, FX.admin.password, U.can.password, U.zeynep.password, ...[admin, zeynep, can, reader].map((c) => c.cookie().split('=')[1])];
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
	const count = async () => (await everything()).total;
	const roleTable = 'roles';
	const auditTable = 'audit_logs';
	const userTable = 'users';
	const settingsTable = 'system_settings';
	try {

		// 1. The operation fails at COMMIT (deferred constraint trigger) after the record was written:
		//    neither the role nor its record may remain.
		await q(`CREATE OR REPLACE FUNCTION audit_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit-test: commit refused'; END $$`);
		await q(`CREATE CONSTRAINT TRIGGER audit_test_commit AFTER INSERT ON ${roleTable} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.name = 'GeriAlinacak') EXECUTE FUNCTION audit_test_fail()`);
		const before = await count();
		const r = await admin.call('POST', '/api/roles', rolePayload({ news: 'kullan', settings: 'kullan' }, { name: 'GeriAlinacak' }));
		ok(r.status === 500, 'create refused at COMMIT → 500', String(r.status));
		ok((await q(`SELECT 1 FROM ${roleTable} WHERE name = 'GeriAlinacak'`)).length === 0, 'rollback: the role is not there');
		ok((await count()) === before, 'rollback: and neither is its record');
		await q(`DROP TRIGGER audit_test_commit ON ${roleTable}`);

		// 2. Deleting a role fails at COMMIT: role, its members and the log stay as they were.
		const ok1 = await admin.call('POST', '/api/roles', rolePayload({ news: 'kullan', settings: 'kullan' }, { name: 'SilinemezRol' }));
		await admin.call('PATCH', '/api/members', { id: U.can.id, roleId: ok1.json.id });
		await q(`CREATE CONSTRAINT TRIGGER audit_test_commit AFTER DELETE ON ${roleTable} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.name = 'SilinemezRol') EXECUTE FUNCTION audit_test_fail()`);
		const before2 = await count();
		const d = await admin.call('DELETE', '/api/roles', { id: ok1.json.id, move: R.member });
		ok(d.status === 500, 'delete refused at COMMIT → 500', String(d.status));
		ok((await q(`SELECT role_id FROM ${userTable} WHERE id = $1`, [U.can.id]))[0].role_id === ok1.json.id, 'rollback: the member is still in the role');
		ok((await q(`SELECT 1 FROM ${roleTable} WHERE id = $1`, [ok1.json.id])).length === 1, 'rollback: the role still exists');
		ok((await count()) === before2, 'rollback: no "role.delete" record was left');
		await q(`DROP TRIGGER audit_test_commit ON ${roleTable}`);
		await admin.call('DELETE', '/api/roles', { id: ok1.json.id, move: R.member });

		// 3. Writing the record fails: the operation must not go through without it.
		await q(`CREATE OR REPLACE FUNCTION audit_test_block() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit-test: no record, no change'; END $$`);
		await q(`CREATE TRIGGER audit_test_block BEFORE INSERT ON ${auditTable} FOR EACH ROW WHEN (NEW.action = 'member.graduate') EXECUTE FUNCTION audit_test_block()`);
		const m = await admin.call('PATCH', '/api/members', { id: U.can.id, status: 'mezun' });
		ok(m.status === 500, 'no record possible → the change fails (500)', String(m.status));
		ok((await q(`SELECT status FROM ${userTable} WHERE id = $1`, [U.can.id]))[0].status === 'aktif', 'and the member is still active (nothing changed without a record)');
		await q(`DROP TRIGGER audit_test_block ON ${auditTable}`);

		// 4. SMTP settings: same guarantee.
		await q(`CREATE TRIGGER audit_test_block BEFORE INSERT ON ${auditTable} FOR EACH ROW WHEN (NEW.action = 'setting.smtp') EXECUTE FUNCTION audit_test_block()`);
		const keyCol = 'key';
		const valCol = 'value';
		const before4 = (await q(`SELECT ${valCol} AS deger FROM ${settingsTable} WHERE ${keyCol} = 'smtp_host'`))[0]?.value;
		const s = await admin.call('POST', '/api/settings/smtp', { smtp_host: 'smtp.never.test', smtp_port: 465, smtp_user: 'x@kulup.test' });
		ok(s.status === 500 && (await q(`SELECT ${valCol} AS deger FROM ${settingsTable} WHERE ${keyCol} = 'smtp_host'`))[0]?.value === before4, 'SMTP: no record possible → settings unchanged');
		await q(`DROP TRIGGER audit_test_block ON ${auditTable}`);
	} finally {
		if (roleTable) await q(`DROP TRIGGER IF EXISTS audit_test_commit ON ${roleTable}`).catch(() => {});
		if (auditTable) await q(`DROP TRIGGER IF EXISTS audit_test_block ON ${auditTable}`).catch(() => {});
		await q('DROP FUNCTION IF EXISTS audit_test_fail()').catch(() => {});
		await q('DROP FUNCTION IF EXISTS audit_test_block()').catch(() => {});
		await db.end();
	}
}

console.log(`\naudit-api: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
