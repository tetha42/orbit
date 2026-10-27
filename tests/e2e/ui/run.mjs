// Browser (Playwright) end-to-end suites.   pnpm e2e [suite …] [--base URL --fixtures FILE]
//
// Every file in tests/e2e/ui/suites/ is one suite; add a file and it is picked up.
// See tests/e2e/ui/README.md for the two ways to run and a template.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, SUITES, TMP, flag, positional, setting } from './lib/env.mjs';
import { assertTestDatabase, resetDatabase, siblingDatabase } from './lib/db.mjs';
import { startServer } from './lib/server.mjs';
import { readFixtures } from './lib/fixtures.mjs';
import { markTotpUsed } from './lib/totp.mjs';
import { launchBrowser } from './lib/browser.mjs';
import { createContext } from './lib/context.mjs';

const BASE = setting('base', 'E2E_BASE', '');
const FIXTURES = setting('fixtures', 'E2E_FIXTURES', '');
const PORT = Number(setting('port', 'E2E_PORT', '3100'));
const DATABASE_URL = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';

async function loadSuites() {
	const files = fs.readdirSync(SUITES).filter((f) => f.endsWith('.mjs')).sort();
	const suites = [];
	for (const file of files) {
		const mod = await import(path.join(SUITES, file));
		if (typeof mod.default !== 'function') throw new Error(`${file}: export default async function suite(t) { … }`);
		suites.push({ name: file.replace(/\.mjs$/, ''), title: mod.meta?.title ?? '', isolated: Boolean(mod.meta?.isolated), optIn: Boolean(mod.meta?.optIn), run: mod.default });
	}
	return suites;
}

const all = await loadSuites();
if (flag('list')) {
	for (const s of all) console.log(`${s.name.padEnd(18)} ${s.isolated ? '[kendi sunucusu] ' : ''}${s.optIn ? '[yalnız adıyla] ' : ''}${s.title}`);
	process.exit(0);
}

const wanted = positional();
const unknown = wanted.filter((n) => !all.some((s) => s.name === n));
if (unknown.length) {
	console.error(`Unknown suite: ${unknown.join(', ')}. Available: ${all.map((s) => s.name).join(', ')}`);
	process.exit(2);
}
// `optIn` suites (slow measurements) run only when named: `pnpm e2e performans`.
const selected = all.filter((s) => (wanted.length === 0 ? !s.optIn : wanted.includes(s.name)));

const external = Boolean(BASE);
const skipped = [];
const runnable = selected.filter((s) => {
	if (s.isolated && external) {
		skipped.push(s);
		return false;
	}
	return true;
});

let failures = 0;
const summary = [];

async function runSuite(suite, ctxInput) {
	let pass = 0;
	let fail = 0;
	const report = (ok, name, extra = '') => {
		if (ok) pass++;
		else fail++;
		console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && extra ? ` — ${extra}` : ''}`);
	};
	console.log(`\n== ${suite.name}${suite.title ? ` — ${suite.title}` : ''} ==`);
	const { t, finish } = createContext({ suite: suite.name, report, ...ctxInput });
	const started = Date.now();
	try {
		await suite.run(t);
	} catch (e) {
		report(false, `${suite.name}: paket çöktü`, String(e.stack ?? e).split('\n').slice(0, 3).join(' | '));
	} finally {
		await finish();
	}
	failures += fail;
	summary.push({ name: suite.name, pass, fail, seconds: Math.round((Date.now() - started) / 1000) });
}

const browser = await launchBrowser({ headed: flag('headed') });
const owned = []; // servers this run started
const stopAll = async () => {
	for (const stop of owned.splice(0)) await stop();
};
process.on('SIGINT', async () => {
	await stopAll();
	process.exit(130);
});

try {
	if (external) {
		const needsFx = runnable.some((s) => !s.isolated);
		const fx = needsFx ? readFixtures(FIXTURES) : null;
		for (const s of runnable) await runSuite(s, { base: BASE, fx, browser });
	} else {
		if (!DATABASE_URL) {
			throw new Error('Set E2E_BASE (a server you started) or E2E_DATABASE_URL (a throw-away database in the test container, e.g. postgresql://test:test@127.0.0.1:55432/beu_e2e) so the run can reset it and start its own server.');
		}
		assertTestDatabase(DATABASE_URL);
		const bootstrap = {
			eposta: process.env.E2E_ADMIN_EMAIL || 'admin@e2e.test',
			sifre: process.env.E2E_ADMIN_PASSWORD || `E2e-${crypto.randomBytes(9).toString('hex')}`,
		};
		const serverEnv = (databaseUrl) => ({
			DATABASE_URL: databaseUrl,
			BOOTSTRAP_ADMIN_EMAIL: bootstrap.eposta,
			BOOTSTRAP_ADMIN_PASSWORD: bootstrap.sifre,
			NEXT_TELEMETRY_DISABLED: '1',
		});

		// Suites that need an empty database each get their own, one server at a time (a checkout allows one `next dev`).
		for (const s of runnable.filter((x) => x.isolated)) {
			const url = siblingDatabase(DATABASE_URL, s.name.replace(/[^a-z0-9]/gi, ''));
			console.log(`\n-- ${s.name}: boş veritabanı ${new URL(url).pathname.slice(1)} ve kendi sunucusu`);
			await resetDatabase(url);
			const server = await startServer({ port: PORT, env: serverEnv(url), name: `server-${s.name}` });
			owned.push(server.stop);
			try {
				await runSuite(s, { base: server.base, fx: null, bootstrap, browser });
			} finally {
				await stopAll();
			}
		}

		const shared = runnable.filter((x) => !x.isolated);
		if (shared.length) {
			console.log(`\n-- ortak sunucu: ${new URL(DATABASE_URL).pathname.slice(1)} sıfırlanıyor, .env admini, dev-fixtures`);
			await resetDatabase(DATABASE_URL);
			const server = await startServer({ port: PORT, env: serverEnv(DATABASE_URL), name: 'server' });
			owned.push(server.stop);
			try {
				fs.mkdirSync(TMP, { recursive: true });
				const file = path.join(TMP, 'fixtures.json');
				fs.rmSync(file, { force: true });
				const made = spawnSync('node', ['scripts/dev-fixtures.mjs', '--base', server.base, '--out', file], {
					cwd: ROOT,
					env: { ...process.env, BOOTSTRAP_ADMIN_EMAIL: bootstrap.eposta, BOOTSTRAP_ADMIN_PASSWORD: bootstrap.sifre },
					stdio: 'inherit',
				});
				if (made.status !== 0) throw new Error('scripts/dev-fixtures.mjs failed');
				const fx = readFixtures(file);
				// dev-fixtures just enrolled these secrets with a code from the current window.
				for (const secret of [fx.adminTotp, ...Object.values(fx.users).map((u) => u.totp)]) if (secret) markTotpUsed(secret);
				for (const s of shared) await runSuite(s, { base: server.base, fx, browser });
			} finally {
				await stopAll();
			}
		}
	}
} finally {
	await stopAll();
	await browser.close().catch(() => {});
}

console.log('\n==== Özet ====');
for (const r of summary) console.log(`${r.fail ? 'FAIL' : 'ok  '} ${r.name.padEnd(18)} ${r.pass} geçti, ${r.fail} kaldı  (${r.seconds} sn)`);
for (const s of skipped) console.log(`atlandı ${s.name} — kendi sunucusu ve boş veritabanı ister; E2E_BASE olmadan çalıştırın`);
const total = summary.reduce((n, r) => n + r.pass, 0);
console.log(`${total} geçti, ${failures} kaldı`);
process.exit(failures ? 1 : 0);
