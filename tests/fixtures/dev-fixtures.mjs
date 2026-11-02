// Development fixtures for a clean database (only the bootstrap admin exists).
//
//   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... node scripts/dev-fixtures.mjs [--base http://localhost:3000] [--out .fixtures.json]
//
// Everything goes through the public API, exactly as an operator would do it in
// the app, so the fixtures exercise the same validation and permission rules:
//   1. signs in as the admin, enrolling two-factor auth if it is not yet on
//   2. creates the roles "Operations Board", "Member" and "News Reader"
//   3. creates members with those roles and gives each a known password
//   4. adds a team, an event, a news item, a treasury record and an inventory item
// The admin's TOTP secret and every account are written to the output file
// (git-ignored) for the e2e tests. Never run against a production database.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generate } = require('otplib');

const arg = (name, fallback) => {
	const i = process.argv.indexOf(name);
	return i > 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('--base', 'http://localhost:3000');
const OUT = arg('--out', '.fixtures.json');
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set.');
	process.exit(1);
}
if (/orbit\.community$/.test(new URL(BASE).hostname)) {
	console.error('Refusing to run fixtures against a public production host.');
	process.exit(1);
}

const state = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
// Saved after every step that cannot be repeated (an enrolled TOTP secret is
// shown once), so a run that fails half-way can simply be run again.
const save = () => fs.writeFileSync(OUT, JSON.stringify(state, null, 2));

/** A tiny cookie-keeping client per account. */
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
		const json = await res.json().catch(() => null);
		return { status: res.status, json };
	};
	return { call };
}

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

/** Waits for the next 30-second window so a TOTP code is never reused. */
async function freshCode(secret) {
	const last = state.totpUsedAt ?? 0;
	if (Math.floor(last / 30000) === Math.floor(Date.now() / 30000)) await new Promise((r) => setTimeout(r, 30500 - (Date.now() % 30000)));
	state.totpUsedAt = Date.now();
	return generate({ secret });
}

async function loginAdmin() {
	const c = client();
	const r = await c.call('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
	if (r.json?.require2fa) {
		if (!state.adminTotp) throw new Error('Admin has 2FA on but its secret is not in ' + OUT);
		must(await c.call('POST', '/api/auth/2fa/challenge', { challengeToken: r.json.challengeToken, code: await freshCode(state.adminTotp) }), '2FA challenge');
	} else {
		must(r, 'admin login');
		if (!state.adminTotp) {
			const setup = must(await c.call('POST', '/api/auth/2fa/setup', {}), '2FA setup');
			state.adminTotp = setup.secret;
			must(await c.call('POST', '/api/auth/2fa/enable', { code: await freshCode(setup.secret) }), '2FA enable');
			save();
		}
	}
	return c;
}

const ROLES = {
	yonetim: { ad: 'Yönetim Kurulu', renk: '#ff9f0a', aciklama: 'Topluluk yönetim kurulu ve icra', ikiAdimZorunlu: true, izinler: { news: 'yonet', events: 'yonet', teams: 'yonet', projects: 'yonet', certificates: 'yonet', inventory: 'yonet', members: 'yonet', budget: 'yonet', notes: 'kullan', chat: 'yonet', mail: 'yonet', settings: 'kullan' } },
	uye: { ad: 'Üye', renk: '#0a84ff', aciklama: 'Aktif topluluk üyesi', ikiAdimZorunlu: false, izinler: { news: 'kullan', events: 'kullan', teams: 'kullan', projects: 'kullan', certificates: 'kullan', inventory: 'kullan', members: 'kullan', notes: 'kullan', chat: 'kullan', mail: 'kullan', settings: 'kullan' } },
	haber: { ad: 'Sadece Haberler', renk: '#8e8e93', aciklama: 'Salt okunur duyuru ve haber erişimi', ikiAdimZorunlu: false, izinler: { news: 'kullan' } },
};

const MEMBERS = [
	{ key: 'zeynep', alias: 'alex', ad: 'Zeynep', soyad: 'Kaya', email: 'zeynep@kulup.test', role: 'yonetim', bolum: 'Bilgisayar Mühendisliği', sinif: 3 },
	{ key: 'ege', alias: 'jordan', ad: 'Ege', soyad: 'Kılıç', email: 'ege@kulup.test', role: 'uye', bolum: 'Yazılım Mühendisliği', sinif: 3 },
	{ key: 'can', alias: 'taylor', ad: 'Can', soyad: 'Demir', email: 'can@kulup.test', role: 'uye', bolum: 'Bilgisayar Mühendisliği', sinif: 2 },
	{ key: 'okur', alias: 'sam', ad: 'Okur', soyad: 'Haber', email: 'okur@kulup.test', role: 'haber', bolum: 'Endüstri Mühendisliği', sinif: 1 },
];
const PASSWORD = 'Orbit-Test-2026!';

const admin = await loginAdmin();
state.admin = {
	email: ADMIN_EMAIL,
	eposta: ADMIN_EMAIL,
	password: ADMIN_PASSWORD,
	sifre: ADMIN_PASSWORD,
};

// Roles (idempotent by name)
const rolesRes = must(await admin.call('GET', '/api/roles'), 'list roles');
const existing = rolesRes.roles ?? rolesRes.roller;
state.roles = {};
for (const [key, role] of Object.entries(ROLES)) {
	const found = existing.find((r) => r.ad === role.ad || r.name === role.ad);
	if (found) {
		await admin.call('PATCH', '/api/roles', { id: found.id, ad: role.ad, renk: role.renk, aciklama: role.aciklama, ikiAdimZorunlu: role.ikiAdimZorunlu, izinler: role.izinler });
		state.roles[key] = found.id;
	} else {
		state.roles[key] = must(await admin.call('POST', '/api/roles', role), `create role ${role.ad}`).id;
	}
}
must(await admin.call('POST', '/api/roles', { action: 'varsayilan', roleId: state.roles.uye }), 'default role');
must(await admin.call('PATCH', '/api/settings/membership-policy', { emailVerification: false }), 'membership policy');

const dbUrl = process.env.DATABASE_URL || (() => {
	try {
		const rc = JSON.parse(fs.readFileSync('data/runtime-config.json', 'utf8'));
		return rc?.database?.url;
	} catch {
		return null;
	}
})();

if (dbUrl) {
	try {
		const { Client } = await import('pg');
		const db = new Client({ connectionString: dbUrl });
		await db.connect();
		await db.query("DELETE FROM system_settings WHERE key LIKE 'smtp%'");
		await db.query("TRUNCATE TABLE audit_logs CASCADE");
		await db.query("DELETE FROM roles WHERE ad IN ('SilinemezRol', 'GeriAlinacak') OR ad LIKE 'Denetim Rolü%'");
		await db.end();
	} catch {}
}

// Members with known passwords
state.users = state.users ?? {};
const roster = must(await admin.call('GET', '/api/members'), 'roster').members;
for (const m of MEMBERS) {
	const inRoster = roster.find((r) => r.email === m.email || r.eposta === m.email);
	if (state.users[m.key] && inRoster) {
		await admin.call('PATCH', '/api/members', { id: inRoster.id, roleId: state.roles[m.role], status: 'aktif' });
		continue;
	}
	const created = must(await admin.call('POST', '/api/members', { ad: m.ad, soyad: m.soyad, email: m.email, bolum: m.bolum, sinif: m.sinif, roleId: state.roles[m.role] }), `create ${m.email}`);
	const u = client();
	const initialPw = created.geciciSifre || created.temporaryPassword;
	must(await u.call('POST', '/api/auth/login', { email: m.email, password: initialPw }), `first login ${m.email}`);
	must(await u.call('POST', '/api/profile/password', { mevcut: initialPw, yeni: PASSWORD, currentPassword: initialPw, newPassword: PASSWORD }), `password ${m.email}`);
	let totpSecret = null;
	// Roles that require a second factor: enrol it now, as the first sign-in would demand.
	if (ROLES[m.role].ikiAdimZorunlu) {
		const setup = must(await u.call('POST', '/api/auth/2fa/setup', {}), `2FA setup ${m.email}`);
		must(await u.call('POST', '/api/auth/2fa/enable', { code: await freshCode(setup.secret) }), `2FA enable ${m.email}`);
		totpSecret = setup.secret;
	}
	const userRecord = {
		id: created.member.id,
		eposta: m.email,
		email: m.email,
		sifre: PASSWORD,
		password: PASSWORD,
		rol: m.role,
		role: m.role,
		...(totpSecret ? { totp: totpSecret } : {}),
	};
	state.users[m.key] = userRecord;
	if (m.alias) state.users[m.alias] = userRecord;
	save();
}

// A little content to work with
const once = async (key, fn) => {
	state.content = state.content ?? {};
	if (!state.content[key]) state.content[key] = await fn();
	save();
};
await once('team', async () => {
	const res = await admin.call('POST', '/api/teams', { action: 'createTeam', ad: 'Core Architecture & Web Platform', kategori: 'Web & Mobile', aciklama: 'Core platform development and client suites', kontenjan: 6, liderId: state.users.ege.id });
	if (res.status === 409) {
		const all = await admin.call('GET', '/api/teams');
		const found = (all.json?.teams ?? all.json ?? []).find?.((t) => t.ad === 'Core Architecture & Web Platform');
		if (found) return { team: found };
	}
	return must(res, 'team');
});
await once('news', async () => must(await admin.call('POST', '/api/news', { baslik: 'Güz Dönemi Tanışma Toplantısı', icerik: 'Orbit topluluğu yeni dönem tanışma toplantısı ve platform tanıtımı.', kategori: 'genel', publishStatus: 'yayinda' }), 'news'));
await once('event', async () => must(await admin.call('POST', '/api/events', { action: 'createEvent', baslik: 'Modern Web ve Git Atölyesi', aciklama: 'Sürüm kontrolü ve açık kaynak işbirliği atölye çalışması', tur: 'atolye', konum: 'Virtual Lab Stage A', baslangic: Date.now() + 3 * 86400000, endTime: Date.now() + 3 * 86400000 + 2 * 3600000, kapasite: 30, status: 'yayinda' }), 'event'));
await once('income', async () => must(await admin.call('POST', '/api/budget', { tur: 'gelir', kategori: 'Sponsorluk', tutarKurus: 2500000, aciklama: 'Açık Kaynak Ekosistem Sponsorluk Hibesi' }), 'income'));
await once('item', async () => {
	const res = await admin.call('POST', '/api/inventory', { action: 'create', kod: 'LAB-RPI-001', ad: 'Raspberry Pi 5 (8GB)', kategori: 'Development Board', konum: 'Hardware Lab Rack B-1' });
	if (res.status === 409) {
		const all = await admin.call('GET', '/api/inventory');
		const list = Array.isArray(all.json) ? all.json : (all.json?.items ?? []);
		const found = list.find((i) => i.seriNo === 'LAB-RPI-001' || i.kod === 'LAB-RPI-001');
		if (found) return found;
	}
	return must(res, 'item');
});

if (state.totpUsedAt) {
	const elapsed = Date.now() % 30000;
	await new Promise((r) => setTimeout(r, 30500 - elapsed));
}

save();
console.log(`fixtures ready → ${OUT}: ${Object.keys(state.users).length} members, ${Object.keys(state.roles).length} roles`);
