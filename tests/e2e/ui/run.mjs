// Browser (Playwright) end-to-end suites.   pnpm e2e [suite …] [--base URL --fixtures FILE]
//
// Every file in tests/e2e/ui/suites/ is one suite; add a file and it is picked up.
// Uses the prebuilt production standalone server and enforces strict resource budgets
// (<= 1024 MB RSS across runner/servers/Chromium and <= 180 s total runtime).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, SUITES, TMP, flag, positional, setting } from './lib/env.mjs';
import {
	assertTestDatabase,
	clearWorkspaceStates,
	cloneDatabase,
	dropDatabase,
	readActiveSessionTokens,
	resetDatabase,
	siblingDatabase,
} from './lib/db.mjs';
import { startServer } from './lib/server.mjs';
import { readFixtures } from './lib/fixtures.mjs';
import { markTotpUsed } from './lib/totp.mjs';
import { launchBrowser } from './lib/browser.mjs';
import { createContext, seedSessionTokens } from './lib/context.mjs';
import { createBudgetMonitor } from './lib/budget.mjs';

// A run signs in many temporary accounts from one address; the spawned server trusts its
// authentication buckets only (message/SMTP limits still apply). See src/lib/rateLimit.ts.
process.env.E2E_TRUSTED_AUTH = 'true';
// The suite UI is Turkish; the bootstrap admin starts in the same language.
process.env.BOOTSTRAP_ADMIN_LANGUAGE = process.env.BOOTSTRAP_ADMIN_LANGUAGE || 'tr';
process.env.NEXT_TELEMETRY_DISABLED = '1';

const BASE = setting('base', 'E2E_BASE', '');
const FIXTURES = setting('fixtures', 'E2E_FIXTURES', '');
const PORT = Number(setting('port', 'E2E_PORT', '3100'));
const DATABASE_URL = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';

// Heavy/longest suites go first for LPT work-stealing; `passkey` stays near the end
// so the initial fixture TOTP window rotates naturally without waiting.
const LATE_SUITES = new Set(['passkey']);
const BLUR_SUITES = new Set(['theme', 'window-manager']);
const HEAVY_WAVE_SUITES = [
	'window-manager',
	'mail-contacts',
	'mail',
	'theme',
	'kanban-permissions',
	'lazy-loading',
	'teams',
	'projects',
	'inventory',
	'kanban',
	'event-attendance',
	'certificates',
	'events',
	'calendar',
	'vault',
	'decisions',
	'my-account',
	'context-menus',
	'roles',
	'onboarding-cockpit',
	'deep-links',
	'menu-bar',
	'context-menu',
	'email-account',
	'live-permissions',
	'mobile-layout',
	'notifications',
	'roleless',
];

async function loadSuites() {
	const files = fs.readdirSync(SUITES).filter((f) => f.endsWith('.mjs')).sort();
	const suites = [];
	for (const file of files) {
		const mod = await import(path.join(SUITES, file));
		if (typeof mod.default !== 'function') {
			throw new Error(`${file}: export default async function suite(t) { … }`);
		}
		suites.push({
			name: file.replace(/\.mjs$/, ''),
			title: mod.meta?.title ?? '',
			isolated: Boolean(mod.meta?.isolated),
			multiServer: file === 'sse.mjs',
			optIn: Boolean(mod.meta?.optIn),
			run: mod.default,
		});
	}
	return suites;
}

function splitSharedQueues(list) {
	const heavy = list
		.filter((s) => HEAVY_WAVE_SUITES.includes(s.name))
		.sort((a, b) => HEAVY_WAVE_SUITES.indexOf(a.name) - HEAVY_WAVE_SUITES.indexOf(b.name));
	const late = list
		.filter((s) => !HEAVY_WAVE_SUITES.includes(s.name) && LATE_SUITES.has(s.name))
		.sort((a, b) => a.name.localeCompare(b.name));
	const light = list
		.filter((s) => !HEAVY_WAVE_SUITES.includes(s.name) && !LATE_SUITES.has(s.name))
		.sort((a, b) => a.name.localeCompare(b.name));
	return { heavyQueue: heavy, lightQueue: [...light, ...late] };
}

function orderSharedSuites(list) {
	const { heavyQueue: heavy, lightQueue: light } = splitSharedQueues(list);

	// Interleave heavy multi-tab suites with lighter suites when running sequentially on 1 worker.
	const ordered = [];
	const baseLight = heavy.length ? Math.floor(light.length / heavy.length) : 0;
	let extraLight = heavy.length ? light.length % heavy.length : 0;
	let lIdx = 0;

	for (const h of heavy) {
		ordered.push(h);
		const take = baseLight + (extraLight-- > 0 ? 1 : 0);
		for (let i = 0; i < take && lIdx < light.length; i++) ordered.push(light[lIdx++]);
	}
	while (lIdx < light.length) ordered.push(light[lIdx++]);
	return ordered;
}

function orderLptSuites(list) {
	const { heavyQueue, lightQueue } = splitSharedQueues(list);
	return [...heavyQueue, ...lightQueue];
}

const all = await loadSuites();
if (flag('list')) {
	for (const s of all) {
		console.log(
			`${s.name.padEnd(18)} ${s.isolated ? '[isolated server] ' : ''}${s.optIn ? '[opt-in by name] ' : ''}${s.title}`
		);
	}
	process.exit(0);
}

const wanted = positional();
const unknown = wanted.filter((n) => !all.some((s) => s.name === n));
if (unknown.length) {
	console.error(`Unknown suite: ${unknown.join(', ')}. Available: ${all.map((s) => s.name).join(', ')}`);
	process.exit(2);
}

// `optIn` suites (slow measurements) run only when named: `pnpm e2e performance`.
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
let budgetError = '';
const summary = [];
let browser = await launchBrowser({ headed: flag('headed'), maxRenderers: 1 });
const browserPids = new Set();
const ownedServers = new Map(); // stopFn -> { label, pid }
let stopping = false;

function trackBrowserPids() {
	for (const entry of fs.readdirSync('/proc')) {
		if (!/^\d+$/.test(entry)) continue;
		try {
			const stat = fs.readFileSync(`/proc/${entry}/status`, 'utf8');
			const ppid = /^PPid:\s+(\d+)/m.exec(stat)?.[1];
			const name = /^Name:\s+(.+)/m.exec(stat)?.[1]?.trim() ?? '';
			if (Number(ppid) === process.pid && /chrom|brave/i.test(name)) {
				const pid = Number(entry);
				browserPids.add(pid);
				budget.track('browser', pid);
			}
		} catch {
			// Process exited while inspecting /proc.
		}
	}
}

async function closeTrackedBrowser() {
	await browser.close().catch(() => {});
	await new Promise((r) => setTimeout(r, 100));
	for (const pid of browserPids) budget.untrack(pid);
	browserPids.clear();
}

async function recycleBrowser(maxRenderers = 1) {
	if (stopping || budgetError) return;
	await closeTrackedBrowser();
	browser = await launchBrowser({ headed: flag('headed'), maxRenderers });
	trackBrowserPids();
}

function printSummaryAndExit(code) {
	budget.stop();
	const b = budget.summary();
	const ramExceeded = b.peakRssMb > b.maxRssMb;
	const timeExceeded = b.elapsedSec > b.maxDurationSec;
	if (ramExceeded && !budgetError) budgetError = `Peak RSS ${b.peakRssMb} MB exceeded ${b.maxRssMb} MB`;
	if (timeExceeded && !budgetError) budgetError = `Elapsed ${b.elapsedSec}s exceeded ${b.maxDurationSec}s`;

	console.log('\n==== Summary ====');
	for (const r of summary) {
		console.log(`${r.fail ? 'FAIL' : 'ok  '} ${r.name.padEnd(20)} ${r.pass} passed, ${r.fail} failed  (${r.seconds}s)`);
	}
	for (const s of skipped) {
		console.log(`skipped ${s.name} — requires dedicated server and empty database; run without E2E_BASE`);
	}
	const total = summary.reduce((n, r) => n + r.pass, 0);
	console.log(`${total} passed, ${failures} failed`);
	console.log(
		`Resources: peak RSS ${b.peakRssMb} MB / ${b.maxRssMb} MB limit | wall-clock ${b.elapsedSec}s / ${b.maxDurationSec}s limit | peak ${JSON.stringify(b.peakBreakdown)}`
	);
	if (budgetError) console.error(`Budget failure: ${budgetError}`);
	process.exit(code || failures || budgetError ? 1 : 0);
}

const budget = createBudgetMonitor({
	onViolation: async (reason) => {
		budgetError = budgetError || reason;
		process.env.__E2E_ABORTING = '1';
		console.error(`\nABORT: ${reason}`);
		stopping = true;
		await stopAllServers();
		await closeTrackedBrowser();
		printSummaryAndExit(1);
	},
});
budget.track('runner', process.pid);
trackBrowserPids();

async function startTrackedServer(label, opts) {
	const server = await startServer({ ...opts, name: label });
	budget.track(label, server.pid);
	const handle = { label, pid: server.pid, stop: server.stop };
	ownedServers.set(server.stop, handle);
	return {
		...server,
		async stop() {
			ownedServers.delete(server.stop);
			await server.stop();
			budget.untrack(server.pid);
		},
	};
}

async function stopAllServers() {
	for (const [stopFn, handle] of [...ownedServers.entries()]) {
		ownedServers.delete(stopFn);
		await stopFn().catch(() => {});
		budget.untrack(handle.pid);
	}
}

process.on('SIGINT', async () => {
	budget.stop();
	await stopAllServers();
	await browser.close().catch(() => {});
	process.exit(130);
});

async function runSuite(suite, ctxInput, { buffered = false, workerTag = '' } = {}) {
	if (stopping || budgetError) return;
	if (ctxInput.databaseUrl) await clearWorkspaceStates(ctxInput.databaseUrl).catch(() => {});
	let pass = 0;
	let fail = 0;
	const lines = [];
	const emit = (line) => {
		if (buffered) lines.push(line);
		else console.log(line);
	};
	const report = (ok, name, extra = '') => {
		if (ok) pass++;
		else fail++;
		emit(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && extra ? ` — ${extra}` : ''}`);
	};
	const tag = workerTag ? ` [${workerTag}]` : '';
	emit(`\n== ${suite.name}${suite.title ? ` — ${suite.title}` : ''}${tag} ==`);

	const { t, finish } = createContext({
		suite: suite.name,
		report,
		log: emit,
		trackServer: (label, pid) => budget.track(label, pid),
		untrackServer: (pid) => budget.untrack(pid),
		...ctxInput,
	});
	const started = Date.now();
	try {
		await suite.run(t);
	} catch (e) {
		report(false, `${suite.name}: suite crashed`, String(e.stack ?? e).split('\n').slice(0, 3).join(' | '));
	} finally {
		await finish();
	}
	failures += fail;
	summary.push({ name: suite.name, pass, fail, seconds: Math.round((Date.now() - started) / 1000) });
	if (buffered) console.log(lines.join('\n'));
}

function buildFixtures(base, databaseUrl, bootstrap) {
	fs.mkdirSync(TMP, { recursive: true });
	const file = path.join(TMP, 'fixtures.json');
	fs.rmSync(file, { force: true });
	const made = spawnSync(
		process.execPath,
		['tests/fixtures/dev-fixtures.mjs', '--base', base, '--out', file, '--no-totp-wait'],
		{
			cwd: ROOT,
			env: {
				...process.env,
				DATABASE_URL: databaseUrl,
				BOOTSTRAP_ADMIN_EMAIL: bootstrap.email,
				BOOTSTRAP_ADMIN_PASSWORD: bootstrap.password,
			},
			stdio: 'inherit',
		}
	);
	if (made.status !== 0) throw new Error('tests/fixtures/dev-fixtures.mjs failed');
	return readFixtures(file);
}

function markFixtureTotpUsed(fx, scope) {
	for (const secret of [fx.adminTotp, ...Object.values(fx.users).map((u) => u.totp)]) {
		if (secret) markTotpUsed(secret, scope);
	}
}

try {
	if (external) {
		const needsFx = runnable.some((s) => !s.isolated);
		const fx = needsFx ? readFixtures(FIXTURES) : null;
		for (const s of runnable) await runSuite(s, { base: BASE, fx, browser });
	} else {
		if (!DATABASE_URL) {
			throw new Error(
				'Set E2E_BASE or E2E_DATABASE_URL (e.g. postgresql://test:test@127.0.0.1:55432/orbit_e2e).'
			);
		}
		assertTestDatabase(DATABASE_URL);
		const bootstrap = {
			email: process.env.E2E_ADMIN_EMAIL || 'admin@e2e.test',
			password: process.env.E2E_ADMIN_PASSWORD || `E2e-${crypto.randomBytes(9).toString('hex')}`,
		};
		const serverEnv = (databaseUrl) => ({
			DATABASE_URL: databaseUrl,
			BOOTSTRAP_ADMIN_EMAIL: bootstrap.email,
			BOOTSTRAP_ADMIN_PASSWORD: bootstrap.password,
			NEXT_TELEMETRY_DISABLED: '1',
		});

		const isolatedSuites = runnable.filter((s) => s.isolated);
		const multiServerSuites = runnable.filter((s) => !s.isolated && s.multiServer);
		const sharedSuites = orderSharedSuites(runnable.filter((s) => !s.isolated && !s.multiServer));

		const maxWorkers = process.env.E2E_DEV_SERVER === '1' ? 1 : 2;
		const defaultWorkers = process.env.E2E_DEV_SERVER === '1' ? 1 : sharedSuites.length >= 4 ? 2 : 1;
		const workers = Math.max(1, Math.min(maxWorkers, Number(process.env.E2E_WORKERS || defaultWorkers)));

		// Phase 1: run isolated empty-DB suites completely before shared servers start so RAM stays separate.
		for (const s of isolatedSuites) {
			if (stopping || budgetError) break;
			const url = siblingDatabase(DATABASE_URL, s.name.replace(/[^a-z0-9]/gi, ''));
			console.log(`\n-- ${s.name}: empty database ${new URL(url).pathname.slice(1)} and dedicated server`);
			await resetDatabase(url);
			const server = await startTrackedServer(`server-${s.name}`, { port: PORT, env: serverEnv(url) });
			try {
				await runSuite(s, { base: server.base, fx: null, bootstrap, browser, databaseUrl: url });
			} finally {
				await server.stop();
			}
		}

		const resetSharedWorkers = workers === 2 && isolatedSuites.length > 0 && (sharedSuites.length > 0 || multiServerSuites.length > 0);
		if (isolatedSuites.length > 0 && (sharedSuites.length > 0 || multiServerSuites.length > 0) && !resetSharedWorkers) {
			await recycleBrowser(1);
		}

		if (workers === 1 && (sharedSuites.length > 0 || multiServerSuites.length > 0) && !stopping && !budgetError) {
			console.log(`\n-- shared server: resetting ${new URL(DATABASE_URL).pathname.slice(1)}, seeding fixtures`);
			await resetDatabase(DATABASE_URL);
			const server = await startTrackedServer('server-a', { port: PORT, env: serverEnv(DATABASE_URL) });
			try {
				const fx = buildFixtures(server.base, DATABASE_URL, bootstrap);
				const tokens = await readActiveSessionTokens(DATABASE_URL);
				seedSessionTokens(server.base, fx, tokens);
				markFixtureTotpUsed(fx, server.base);
				let sharedDone = 0;
				for (const s of sharedSuites) {
					if (stopping || budgetError) break;
					await runSuite(s, { base: server.base, fx, browser, databaseUrl: DATABASE_URL });
					sharedDone++;
					const snap = budget.sample();
					if ((snap.breakdown.browser ?? 0) >= 380 && sharedDone < sharedSuites.length) {
						await recycleBrowser(1);
					}
				}
				if (multiServerSuites.length > 0 && !stopping && !budgetError) {
					if (sharedSuites.length > 0) await recycleBrowser(1);
					for (const s of multiServerSuites) {
						if (stopping || budgetError) break;
						await runSuite(s, { base: server.base, fx, browser, databaseUrl: DATABASE_URL });
					}
				}
			} finally {
				await server.stop();
			}
		} else if (workers === 2 && (sharedSuites.length > 0 || multiServerSuites.length > 0) && !stopping && !budgetError) {
			// Phase 2: template snapshot on PORT -> 2 shard DBs -> batched 2-worker execution -> stop server-b -> Phase 3 SSE.
			const templateUrl = siblingDatabase(DATABASE_URL, 'tpl');
			const shard2Url = siblingDatabase(DATABASE_URL, 's2');
			try {
				console.log('\n-- template setup: creating pre-seeded snapshot for parallel shards');
				await Promise.all([
					resetDatabase(templateUrl),
					resetSharedWorkers ? recycleBrowser(1) : Promise.resolve(),
				]);
				let fx = null;
				let tokens = new Map();
				const tplServer = await startTrackedServer('server-tpl', { port: PORT, env: serverEnv(templateUrl) });
				try {
					fx = buildFixtures(tplServer.base, templateUrl, bootstrap);
					tokens = await readActiveSessionTokens(templateUrl);
				} finally {
					await tplServer.stop();
				}

				if (!stopping && !budgetError) {
					await cloneDatabase(templateUrl, DATABASE_URL);
					if (sharedSuites.length > 0) await cloneDatabase(templateUrl, shard2Url);
					await dropDatabase(templateUrl);

					const serverBPromise =
						sharedSuites.length > 0
							? startTrackedServer('server-b', { port: PORT + 1, env: serverEnv(shard2Url) })
							: Promise.resolve(null);
					const [serverA, serverB] = await Promise.all([
						startTrackedServer('server-a', { port: PORT, env: serverEnv(DATABASE_URL) }),
						serverBPromise,
					]);
					seedSessionTokens(serverA.base, fx, tokens);
					markFixtureTotpUsed(fx, serverA.base);
					if (serverB) {
						seedSessionTokens(serverB.base, fx, tokens);
						markFixtureTotpUsed(fx, serverB.base);
					}

					if (sharedSuites.length > 0 && serverB && !stopping && !budgetError) {
						try {
							const workQueue = orderLptSuites(sharedSuites);
							const runningSuites = new Set();
							let activeWorkers = 0;
							let pendingRecycle = false;
							let recycleResolve = null;
							let recyclePromise = null;
							let turnWaiters = [];

							const notifyTurn = () => {
								const waiters = turnWaiters;
								turnWaiters = [];
								for (const fn of waiters) fn();
							};
							const waitForTurn = () => new Promise((r) => turnWaiters.push(r));

							const finishPendingRecycle = async () => {
								try {
									await recycleBrowser(1);
								} finally {
									pendingRecycle = false;
									const resolve = recycleResolve;
									recycleResolve = null;
									recyclePromise = null;
									resolve?.();
									notifyTurn();
								}
							};

							const runWorker = async (server, dbUrl, tag) => {
								while (!stopping && !budgetError) {
									if (pendingRecycle && recyclePromise) {
										await recyclePromise;
										continue;
									}
									if (workQueue.length === 0) break;

									const hasBlur = [...runningSuites].some((n) => BLUR_SUITES.has(n));
									const idx = workQueue.findIndex((s) => !(hasBlur && BLUR_SUITES.has(s.name)));
									if (idx < 0) {
										await waitForTurn();
										continue;
									}

									const suite = workQueue.splice(idx, 1)[0];
									runningSuites.add(suite.name);
									activeWorkers++;
									try {
										await runSuite(suite, { base: server.base, fx, browser, databaseUrl: dbUrl }, { buffered: true, workerTag: tag });
									} finally {
										runningSuites.delete(suite.name);
										activeWorkers--;
									}

									if (pendingRecycle && activeWorkers === 0) {
										await finishPendingRecycle();
										continue;
									}

									if (!pendingRecycle && workQueue.length > 0 && !stopping && !budgetError) {
										const snap = budget.sample();
										if ((snap.breakdown.browser ?? 0) >= 340) {
											pendingRecycle = true;
											recyclePromise = new Promise((r) => {
												recycleResolve = r;
											});
											if (activeWorkers === 0) await finishPendingRecycle();
										}
									}
									notifyTurn();
								}
								if (pendingRecycle && activeWorkers === 0) await finishPendingRecycle();
								notifyTurn();
							};

							await Promise.all([
								runWorker(serverA, DATABASE_URL, 'w1'),
								runWorker(serverB, shard2Url, 'w2'),
							]);
						} finally {
							await Promise.all([
								serverB.stop().then(() => dropDatabase(shard2Url).catch(() => {})),
								multiServerSuites.length > 0 && !stopping && !budgetError ? recycleBrowser(1) : Promise.resolve(),
							]);
						}
					}

					if (multiServerSuites.length > 0 && !stopping && !budgetError) {
						for (const s of multiServerSuites) {
							if (stopping || budgetError) break;
							await runSuite(s, { base: serverA.base, fx, browser, databaseUrl: DATABASE_URL });
						}
					}
					await serverA.stop();
				}
			} finally {
				await stopAllServers();
				await dropDatabase(templateUrl).catch(() => {});
				await dropDatabase(shard2Url).catch(() => {});
			}
		}
	}
} finally {
	budget.stop();
	await stopAllServers();
	await closeTrackedBrowser();
}

printSummaryAndExit(0);
