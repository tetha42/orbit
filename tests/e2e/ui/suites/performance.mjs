// Performance measurement (optional: runs only with `pnpm e2e performance`).
//
// With the 3D wallpaper on (its own Chrome, WebGL enabled) three states are measured: empty desktop,
// 3 windows + 3D, dragging a window while 3 windows are open. For each, FPS and frame
// times via rAF, React commit count via the React DevTools hook, and long tasks. The result is printed
// as a table and written to tests/e2e/.tmp/perf-<date>.json (for before/after comparison around #11).
//
// The thresholds are intentionally loose; the reasons are next to `FLOOR` below.
import { SESSION_COOKIE } from '../lib/api.mjs';
import { newContext, openApp, openWindows, waitDesktop } from '../lib/browser.mjs';
import { frameBox, rightClickDesktop, titlePoint } from '../lib/desktop.mjs';
import { installProbe, launchWebglBrowser, machine, measure, printTable, reactHooked, webglInfo, writeReport } from '../lib/perf.mjs';

export const meta = { title: 'Performance: FPS and React commit counting (3D on) — runs only by name', optIn: true };

const MEASURE_MS = 5000;
// Transparency is off by default (#8). `PERF_TRANSPARENCY=on pnpm e2e performance` enables the frosted glass and measures it.
const TRANSPARENCY = process.env.PERF_TRANSPARENCY === 'on';

const FLOOR = {
	// A hitch/freeze catch, not a smoothness target. Measured (16 cores, load ~4.5, SwiftShader):
	// while windows are open the 3D scene freezes and the page renders at 59-60 FPS; half of that was chosen as the floor.
	fps: 30,
	// On an empty desktop the 3D scene runs; on a software GPU (SwiftShader/llvmpipe) the scene renders one frame
	// in ~300 ms (~3 FPS) and that is the limit of this environment, not of the app: there it is only reported,
	// on a hardware GPU the same `fps` floor applies.
	softwareGpu: /swiftshader|llvmpipe|software/i,
	// Dragging moves the window by writing styles, it does not repaint the desktop: in a 5 s drag with ~140 moves
	// 10 commits were measured (press, focus, release, clock). Independent of frame rate, it depends on the number
	// of events; returning to a commit per move (the old behavior) makes it hundreds.
	dragCommits: 20,
};

async function openMeasured(t, browser, key) {
	const c = await t.api(key);
	const context = t.track(await newContext(browser, { prefs: TRANSPARENCY ? { transparency: true } : null, reducedMotion: 'no-preference' }));
	await installProbe(context);
	await context.addCookies([{ name: SESSION_COOKIE, value: c.token, url: t.base }]);
	const page = await context.newPage();
	await page.goto(t.base, { waitUntil: 'domcontentloaded', timeout: 90_000 });
	await waitDesktop(page);
	return page;
}

async function closeAll(page) {
	if ((await openWindows(page)).length === 0) return;
	await rightClickDesktop(page);
	await page.locator('[data-menu-item=dt-arrange-windows]').hover();
	await page.locator('[data-menu-item=dt-close-all]').click();
	await page.waitForFunction(() => document.querySelectorAll('[data-window-frame]').length === 0, null, { timeout: 5000 }).catch(() => {});
}

/** Grabs the window by its title and drags it in a circle for ~`ms` (moving every ~16 ms). */
async function circleDrag(page, appId, ms) {
	const box = await frameBox(page, appId);
	const c = titlePoint(box);
	await page.mouse.move(c.x, c.y);
	await page.mouse.down();
	const start = Date.now();
	let moves = 0;
	while (Date.now() - start < ms) {
		const a = (Date.now() - start) / 600;
		await page.mouse.move(c.x + Math.round(120 * Math.cos(a)) - 120, c.y + 150 + Math.round(90 * Math.sin(a)));
		moves++;
		await page.waitForTimeout(16);
	}
	await page.mouse.up();
	return moves;
}

export default async function suite(t) {
	const browser = await launchWebglBrowser();
	t.cleanup(() => browser.close());
	const rows = [];
	const report = { schema: 1, date: new Date().toISOString(), transparency: TRANSPARENCY, base: t.base, viewport: t.viewport.DESKTOP, measureMs: MEASURE_MS, machine: machine(browser), webgl: null, scenarios: [] };
	const record = (scenario, m, extra = {}) => {
		const row = { scenario, ...m, ...extra };
		rows.push(row);
		report.scenarios.push(row);
		return row;
	};

	await t.step('admin: empty desktop, 3 windows + 3D, dragging', async () => {
		const page = await openMeasured(t, browser, 'admin');
		const gl = await webglInfo(page);
		report.webgl = gl.renderer || null;
		t.check(await reactHooked(page), 'connected to the React DevTools hook (commit counting is valid)');

		await closeAll(page);
		await page.waitForTimeout(2500);
		const scene = await webglInfo(page);
		if (gl.renderer) t.check(scene.scene, `3D scene runs on the empty desktop (${gl.renderer})`);
		else console.log('  note: no WebGL; the 3D scene could not be measured, measurements use the static background');
		const idle = record('bos-masaustu', await measure(page, MEASURE_MS), { scene: scene.scene });
		await t.shot(page, 'bos-masaustu');

		for (const id of ['teams', 'news', 'notes']) await openApp(page, id);
		await page.locator('[data-window-frame=notes] [data-app-id]').waitFor();
		await page.waitForTimeout(2500);
		t.eq((await openWindows(page)).length, 3, '3 windows open');
		const three = record('3-pencere-3b', await measure(page, MEASURE_MS), { scene: (await webglInfo(page)).scene });
		await t.shot(page, '3-pencere');

		let moves = 0;
		const drag = record('surukleme', await measure(page, MEASURE_MS, async () => {
			moves = await circleDrag(page, 'news', MEASURE_MS - 300);
		}));
		drag.pointerMoves = moves;
		t.check(moves > 50, `${moves} pointer moves during the drag`);

		const software = FLOOR.softwareGpu.test(gl.renderer) || !gl.renderer;
		if (software) console.log(`  note: software GPU (${gl.renderer || 'no WebGL'}): the empty-desktop FPS with the 3D scene running (${idle.fps}) is only reported`);
		else t.check(idle.fps >= FLOOR.fps, `empty desktop (3D running): ${idle.fps} FPS >= loose floor ${FLOOR.fps}`, JSON.stringify(idle));
		report.softwareGpu = software;
		for (const [name, m] of [['3 windows + 3D', three], ['dragging', drag]]) {
			t.check(m.fps >= FLOOR.fps, `${name}: ${m.fps} FPS >= loose floor ${FLOOR.fps}`, JSON.stringify(m));
		}
		t.check(drag.commits <= FLOOR.dragCommits, `drag: ${drag.commits} React commits (${moves} moves) <= ${FLOOR.dragCommits}`);
	});

	await t.step('role: empty desktop of the news-only user; cannot open 3 windows', async () => {
		const page = await openMeasured(t, browser, 'reader');
		const dock = await page.locator('[data-dock-app]').count();
		t.eq(dock, 2, 'the reader sees only 2 apps in the Dock: the 3-window scenario cannot be set up for this role');
		await page.waitForTimeout(2500);
		const gl = await webglInfo(page);
		const m = record('okur-bos-masaustu', await measure(page, MEASURE_MS), { scene: gl.scene });
		if (!FLOOR.softwareGpu.test(gl.renderer) && gl.renderer) t.check(m.fps >= FLOOR.fps, `reader empty desktop: ${m.fps} FPS >= ${FLOOR.fps}`);
		t.check(m.commitsPerSecond < 5, `reader empty desktop idle: ${m.commitsPerSecond} commits/s (< 5; no idle re-render)`);
	});

	console.log(`\n  Performance (${report.machine.cpus} cores, load ${report.machine.loadAverage.join('/')}, WebGL: ${report.webgl ?? 'none'})`);
	printTable(rows);
	const file = writeReport(report);
	console.log(`  JSON: ${file}`);
	t.check(Boolean(file), 'measurement JSON file written');
}
