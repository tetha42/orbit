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
	yonetim: { ad: 'Operations Board', renk: '#ff9f0a', aciklama: 'Daily community operations and governance', ikiAdimZorunlu: true, izinler: { news: 'yonet', events: 'yonet', teams: 'yonet', projects: 'yonet', certificates: 'yonet', inventory: 'yonet', members: 'yonet', budget: 'yonet', notes: 'kullan', chat: 'yonet', mail: 'yonet', settings: 'kullan' } },
	uye: { ad: 'Member', renk: '#0a84ff', aciklama: 'Active community member', ikiAdimZorunlu: false, izinler: { news: 'kullan', events: 'kullan', teams: 'kullan', projects: 'kullan', certificates: 'kullan', inventory: 'kullan', members: 'kullan', notes: 'kullan', chat: 'kullan', mail: 'kullan', settings: 'kullan' } },
	haber: { ad: 'News Reader', renk: '#8e8e93', aciklama: 'Read-only announcement access', ikiAdimZorunlu: false, izinler: { news: 'kullan', chat: 'kullan', settings: 'kullan' } },
};

const MEMBERS = [
	{ key: 'alex', ad: 'Alex', soyad: 'Morgan', email: 'alex@orbit.test', role: 'yonetim', bolum: 'Software Engineering', sinif: 3 },
	{ key: 'jordan', ad: 'Jordan', soyad: 'Lee', email: 'jordan@orbit.test', role: 'uye', bolum: 'AI & Data Science', sinif: 2 },
	{ key: 'taylor', ad: 'Taylor', soyad: 'Smith', email: 'taylor@orbit.test', role: 'uye', bolum: 'Cloud Infrastructure', sinif: 1 },
	{ key: 'sam', ad: 'Sam', soyad: 'Reader', email: 'sam@orbit.test', role: 'haber', bolum: 'Product Design', sinif: 2 },
];
const PASSWORD = 'Orbit-Test-2026!';

const admin = await loginAdmin();
state.admin = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };

// Roles (idempotent by name)
const existing = must(await admin.call('GET', '/api/roller'), 'list roles').roller;
state.roles = {};
for (const [key, role] of Object.entries(ROLES)) {
	const found = existing.find((r) => r.ad === role.ad);
	state.roles[key] = found ? found.id : must(await admin.call('POST', '/api/roller', role), `create role ${role.ad}`).id;
}
must(await admin.call('POST', '/api/roller', { action: 'varsayilan', roleId: state.roles.uye }), 'default role');

// Members with known passwords
state.users = state.users ?? {};
const roster = must(await admin.call('GET', '/api/uyeler'), 'roster').members;
for (const m of MEMBERS) {
	if (state.users[m.key] && roster.some((r) => r.email === m.email)) continue;
	const created = must(await admin.call('POST', '/api/uyeler', { ad: m.ad, soyad: m.soyad, email: m.email, bolum: m.bolum, sinif: m.sinif, roleId: state.roles[m.role] }), `create ${m.email}`);
	const u = client();
	must(await u.call('POST', '/api/auth/login', { email: m.email, password: created.geciciSifre }), `first login ${m.email}`);
	must(await u.call('POST', '/api/profil/password', { mevcut: created.geciciSifre, yeni: PASSWORD }), `password ${m.email}`);
	state.users[m.key] = { id: created.member.id, email: m.email, password: PASSWORD, role: m.role };
	// Roles that require a second factor: enrol it now, as the first sign-in would demand.
	if (ROLES[m.role].ikiAdimZorunlu) {
		const setup = must(await u.call('POST', '/api/auth/2fa/setup', {}), `2FA setup ${m.email}`);
		must(await u.call('POST', '/api/auth/2fa/enable', { code: await freshCode(setup.secret) }), `2FA enable ${m.email}`);
		state.users[m.key].totp = setup.secret;
	}
	save();
}

// A little content to work with
const once = async (key, fn) => {
	state.content = state.content ?? {};
	if (!state.content[key]) state.content[key] = await fn();
	save();
};
await once('team', async () => must(await admin.call('POST', '/api/takimlar', { action: 'createTeam', ad: 'Core Architecture & Web Platform', kategori: 'Web & Mobile', aciklama: 'Core platform development and client suites', kontenjan: 6, liderId: state.users.jordan.id }), 'team'));
await once('news', async () => must(await admin.call('POST', '/api/haberler', { baslik: 'Orbit Community OS Launch Meeting', icerik: 'Welcome all core contributors and maintainers to Orbit Community OS.', kategori: 'genel', publishStatus: 'yayinda' }), 'news'));
await once('event', async () => must(await admin.call('POST', '/api/etkinlikler', { action: 'createEvent', baslik: 'Modern Web Architecture & Git Workshop', aciklama: 'Decentralized collaboration and release workflows', tur: 'workshop', konum: 'Virtual Lab Stage A', baslangic: Date.now() + 3 * 86400000, endTime: Date.now() + 3 * 86400000 + 2 * 3600000, kapasite: 30, status: 'yayinda' }), 'event'));
await once('income', async () => must(await admin.call('POST', '/api/butce', { tur: 'gelir', kategori: 'Sponsorship', tutarKurus: 2500000, aciklama: 'Open source ecosystem grant' }), 'income'));
await once('item', async () => must(await admin.call('POST', '/api/envanter', { action: 'create', kod: 'LAB-RPI-001', ad: 'Raspberry Pi 5 (8GB)', kategori: 'Development Board', konum: 'Hardware Lab Rack B-1' }), 'item'));

save();
console.log(`fixtures ready → ${OUT}: ${Object.keys(state.users).length} members, ${Object.keys(state.roles).length} roles`);
