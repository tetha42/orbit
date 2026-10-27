// Measuring the desktop: frames per second from requestAnimationFrame, React commits through
// the DevTools hook, and long tasks. Used by the opt-in `performans` suite; the numbers are
// written as a table and as JSON (tests/e2e/.tmp/perf-<date>.json) for before/after comparisons.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { TMP } from './env.mjs';
import { launchBrowser } from './browser.mjs';

/** A Chrome of its own with WebGL on (the shared one runs with 3D off; see lib/browser.mjs). */
export async function launchWebglBrowser() {
	const before = process.env.E2E_WEBGL;
	process.env.E2E_WEBGL = '1';
	try {
		return await launchBrowser();
	} finally {
		if (before === undefined) delete process.env.E2E_WEBGL;
		else process.env.E2E_WEBGL = before;
	}
}

/**
 * Runs before any page script: a minimal React DevTools hook that only counts commits
 * (React reports every commit to `onCommitFiberRoot`), and a long-task observer.
 */
export function installProbe(context) {
	return context.addInitScript(() => {
		const probe = { commits: 0, longTasks: [] };
		window.__perfProbe = probe;
		let nextId = 1;
		window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
			supportsFiber: true,
			isDisabled: false,
			renderers: new Map(),
			inject(renderer) {
				const id = nextId++;
				this.renderers.set(id, renderer);
				return id;
			},
			onCommitFiberRoot() {
				probe.commits++;
			},
			onCommitFiberUnmount() {},
			onPostCommitFiberRoot() {},
			onScheduleFiberRoot() {},
			checkDCE() {},
		};
		try {
			new PerformanceObserver((list) => {
				for (const e of list.getEntries()) probe.longTasks.push(e.duration);
			}).observe({ type: 'longtask', buffered: false });
		} catch {
			// no long-task API: reported as 0
		}
	});
}

/** Whether React reported to the hook at all (if not, commit counts are unknown, not zero). */
export const reactHooked = (page) => page.evaluate(() => (window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size ?? 0) > 0);

/** The WebGL renderer string ("" when WebGL is unavailable) and whether the 3D wallpaper is running. */
export const webglInfo = (page) =>
	page.evaluate(() => {
		let renderer = '';
		try {
			const gl = document.createElement('canvas').getContext('webgl');
			const ext = gl?.getExtension('WEBGL_debug_renderer_info');
			renderer = gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : '';
		} catch {
			renderer = '';
		}
		return { renderer, scene: Boolean(window.__webgl_app) };
	});

/**
 * Measures `ms` milliseconds while `during()` (optional) runs: frames counted by
 * requestAnimationFrame, React commits and long tasks in that span.
 */
export async function measure(page, ms, during) {
	await page.evaluate((duration) => {
		const probe = window.__perfProbe;
		probe.run = { frames: [], commits0: probe.commits, long0: probe.longTasks.length, start: performance.now(), duration };
		const tick = (now) => {
			probe.run.frames.push(now);
			if (now - probe.run.start < duration) requestAnimationFrame(tick);
			else probe.run.done = true;
		};
		requestAnimationFrame(tick);
	}, ms);
	if (during) await during();
	await page.waitForFunction(() => window.__perfProbe.run.done, null, { timeout: ms + 30_000, polling: 100 });
	return page.evaluate(() => {
		const probe = window.__perfProbe;
		const { frames, commits0, long0, start } = probe.run;
		const end = frames[frames.length - 1];
		const gaps = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b);
		const seconds = (end - start) / 1000;
		const long = probe.longTasks.slice(long0);
		const pick = (q) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(q * gaps.length))] : 0);
		const r1 = (n) => Math.round(n * 10) / 10;
		return {
			seconds: r1(seconds),
			frames: frames.length,
			fps: r1(frames.length / seconds),
			frameMsP50: r1(pick(0.5)),
			frameMsP95: r1(pick(0.95)),
			frameMsMax: r1(gaps[gaps.length - 1] ?? 0),
			commits: probe.commits - commits0,
			commitsPerSecond: r1((probe.commits - commits0) / seconds),
			longTasks: long.length,
			longTaskMs: Math.round(long.reduce((a, b) => a + b, 0)),
		};
	});
}

/** The machine the numbers came from (they only compare within the same machine). */
export function machine(browser) {
	return {
		cpus: os.cpus().length,
		cpuModel: os.cpus()[0]?.model ?? '',
		loadAverage: os.loadavg().map((n) => Math.round(n * 100) / 100),
		chrome: browser.version(),
		node: process.version,
	};
}

/** Writes tests/e2e/.tmp/perf-<YYYY-MM-DDTHH-MM-SS>.json and returns its path. */
export function writeReport(report) {
	fs.mkdirSync(TMP, { recursive: true });
	const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
	const file = path.join(TMP, `perf-${stamp}.json`);
	fs.writeFileSync(file, JSON.stringify(report, null, 2));
	return file;
}

/** The measurements as a plain table on the console. */
export function printTable(rows) {
	const cols = ['scenario', 'fps', 'frameMsP50', 'frameMsP95', 'frameMsMax', 'commits', 'commitsPerSecond', 'longTasks', 'longTaskMs', 'seconds'];
	const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
	const line = (vals) => vals.map((v, i) => String(v).padEnd(widths[i])).join('  ');
	console.log(line(cols));
	for (const r of rows) console.log(line(cols.map((c) => r[c])));
}
