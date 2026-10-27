// Etkileşim başına React commit sayısı (isteğe bağlı: yalnız `pnpm e2e performans-etkilesim` ile koşar).
//
// `performans` paketi FPS ve sürüklemeyi ölçer; bu paket pencere/Dock etkileşimlerinde kaç React
// commit'i olduğunu sayar (DevTools kancası, bkz. lib/perf.mjs): 3 pencere aç, 6 kez odak değiştir,
// 6 Dock simgesinin üstünden geç, 3 pencereyi kapatıp yeniden aç. Her senaryo 3 tur koşar; sonuç
// tests/e2e/.tmp/perf-etkilesim-<tarih>.json dosyasına yazılır (öncesi/sonrası karşılaştırması için).
// 3B duvar kağıdı kapalıdır (commit sayısı GPU'ya bağlı değildir); eşik yok, yalnız ölçer ve raporlar.
import fs from 'node:fs';
import path from 'node:path';
import { SESSION_COOKIE } from '../lib/api.mjs';
import { newContext, openWindows, waitDesktop } from '../lib/browser.mjs';
import { frameBox, titlePoint } from '../lib/desktop.mjs';
import { installProbe, machine, reactHooked } from '../lib/perf.mjs';
import { TMP } from '../lib/env.mjs';

export const meta = { title: 'Performans: pencere ve Dock etkileşimlerinde React commit sayısı — yalnız adıyla koşar', optIn: true };

const APPS = ['teams', 'news', 'notes'];
const CLOSE = '[data-window-control=close], button[title="Close Window"]';
const ROUNDS = 3;

const commits = (page) => page.evaluate(() => window.__perfProbe.commits);

async function closeAll(page) {
	for (const id of await openWindows(page)) await page.locator(`[data-window-frame=${id}]`).locator(CLOSE).first().click();
	await page.waitForFunction(() => document.querySelectorAll('[data-window-frame]').length === 0, null, { timeout: 5000 });
	await page.waitForTimeout(600);
}

async function openThree(page) {
	for (const id of APPS) {
		await page.locator(`[data-dock-app=${id}]`).click();
		await page.locator(`[data-window-frame=${id}]`).waitFor();
		await page.waitForTimeout(500);
	}
	await page.waitForTimeout(800);
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

export default async function suite(t) {
	const c = await t.api('admin');
	const context = t.track(await newContext(t.browser, {}));
	await installProbe(context);
	await context.addCookies([{ name: SESSION_COOKIE, value: c.token, url: t.base }]);
	const page = await context.newPage();
	await page.goto(t.base, { waitUntil: 'domcontentloaded', timeout: 90_000 });
	await waitDesktop(page);
	t.check(await reactHooked(page), 'React DevTools kancasına bağlandı (commit sayımı geçerli)');
	await page.waitForTimeout(2000);

	const scenarios = {
		'3 pencere aç': {
			prepare: () => closeAll(page),
			run: () => openThree(page),
		},
		'6 odak değişimi': {
			prepare: async () => {
				await closeAll(page);
				await openThree(page);
			},
			run: async () => {
				for (const id of [...APPS, ...APPS]) {
					const p = titlePoint(await frameBox(page, id));
					await page.mouse.click(p.x - 120, p.y);
					await page.waitForTimeout(350);
				}
			},
		},
		'6 Dock üstünden geçiş': {
			prepare: () => closeAll(page),
			run: async () => {
				const icons = page.locator('[data-dock-app]');
				for (let i = 0; i < 6; i++) {
					await icons.nth(i).hover();
					await page.waitForTimeout(250);
				}
				await page.mouse.move(700, 300);
				await page.waitForTimeout(300);
			},
		},
		'3 kapat + 3 aç': {
			prepare: async () => {
				await closeAll(page);
				await openThree(page);
			},
			run: async () => {
				await closeAll(page);
				await openThree(page);
			},
		},
	};

	const report = { schema: 1, date: new Date().toISOString(), base: t.base, rounds: ROUNDS, machine: machine(t.browser), scenarios: [] };
	for (const [name, s] of Object.entries(scenarios)) {
		await t.step(name, async () => {
			const runs = [];
			for (let i = 0; i < ROUNDS; i++) {
				await s.prepare();
				await page.waitForTimeout(500);
				const before = await commits(page);
				await s.run();
				await page.waitForTimeout(400);
				runs.push((await commits(page)) - before);
			}
			report.scenarios.push({ scenario: name, commits: runs, median: median(runs) });
			t.check(runs.every((n) => n > 0) || name.includes('Dock'), `${name}: commit sayıları ${runs.join(' / ')} (medyan ${median(runs)})`);
		});
	}

	fs.mkdirSync(TMP, { recursive: true });
	const file = path.join(TMP, `perf-etkilesim-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`);
	fs.writeFileSync(file, JSON.stringify(report, null, 2));
	console.log(`\n  Etkileşim başına commit (${ROUNDS} tur)`);
	for (const r of report.scenarios) console.log(`  ${r.scenario.padEnd(24)} ${r.commits.join(' / ')}  (medyan ${r.median})`);
	console.log(`  JSON: ${file}`);
}
