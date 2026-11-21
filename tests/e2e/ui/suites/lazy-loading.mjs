// Lazy loading: app components are not downloaded together with the desktop; when an app is
// opened for the first time its own chunk arrives, and it does not arrive again on reopen; the
// code of an app the role cannot open is never downloaded; every app opens without errors.
//
// Measurement has two layers: (1) bundler-independent: the number of new JS requests; (2) module
// definitions in the chunks of the dev server (Turbopack) ("[project]/…/NewsApp.tsx … (ecmascript)",
// not a loader registration). If (2) is not visible for the first opened app (another bundler, production
// build), those checks are reported as "not measurable" and only (1) is verified.
import { newContext, openApp, openWindows, waitDesktop } from '../lib/browser.mjs';
import { SESSION_COOKIE } from '../lib/api.mjs';
import { watchPage } from '../lib/desktop.mjs';

export const meta = { title: 'Lazy loading: app code arrives when opened, forbidden apps never arrive, no errors' };

const FILES = {
	teams: 'TeamsApp',
	events: 'EventsApp',
	budget: 'BudgetApp',
	decisions: 'DecisionsApp',
	certificates: 'CertificatesApp',
	inventory: 'InventoryApp',
	members: 'MemberDirectoryApp',
	notes: 'NotesApp',
	news: 'NewsApp',
	settings: 'SettingsApp',
	terminal: 'TerminalApp',
	projects: 'ProjectsApp',
	mail: 'MailApp',
};

/** Noise that does not count as an error: WebGL is disabled in tests and the 3D background falls back to a static image. */
const NOISE = ['WebGL', 'webgl', '3D background'];

/** Tracks the JS files downloaded by the page and the app modules defined inside them. */
function trackScripts(page) {
	const urls = new Set();
	const defined = new Set();
	const pending = [];
	page.on('response', (res) => {
		const url = res.url().split('?')[0];
		if (!/\.js$/.test(url) || res.status() >= 400) return;
		urls.add(url);
		pending.push(
			res
				.text()
				.then((body) => {
					for (const [id, file] of Object.entries(FILES)) {
						if (body.includes(`WorkspaceApps/${file}.tsx [app-client] (ecmascript)", ((`)) defined.add(id);
					}
				})
				.catch(() => {})
		);
	});
	return {
		urls,
		defined,
		/** Waits until network activity settles (no new JS for half a second). */
		async settle(page) {
			let last = -1;
			for (let i = 0; i < 40 && last !== urls.size; i++) {
				last = urls.size;
				await page.waitForTimeout(500);
			}
			await Promise.all(pending);
		},
	};
}

/** A page signed in with `key`; JS tracking starts before the page loads. */
async function openTracked(t, key) {
	const c = await t.api(key);
	const context = t.track(await newContext(t.browser));
	await context.addCookies([{ name: SESSION_COOKIE, value: c.token, url: t.base }]);
	const page = await context.newPage();
	const js = trackScripts(page);
	await page.goto(t.base, { waitUntil: 'domcontentloaded', timeout: 90_000 });
	await waitDesktop(page);
	return { page, js };
}

/** Did the window content leave the loading placeholder (did every app render its own UI). */
const rendered = (page, appId) =>
	page.locator(`[data-window-frame=${appId}]`).evaluate((el) => !el.querySelector('[data-app-loading]') && (el.querySelector('[data-app-id]')?.childElementCount ?? 0) > 0);

export default async function suite(t) {
	await t.step('reader: app code arrives when opened, does not arrive again on reopen, forbidden code never arrives', async () => {
		const { page, js } = await openTracked(t, 'reader');
		await js.settle(page);
		t.eq(await openWindows(page), [], 'reader desktop opened empty (setup)');
		const atStart = new Set(js.urls);

		await openApp(page, 'news');
		t.check((await t.waitFor(() => rendered(page, 'news'), { timeout: 30_000 })) >= 0, 'news window rendered its content');
		await js.settle(page);
		const afterNews = [...js.urls].filter((u) => !atStart.has(u));
		t.check(afterNews.length > 0, `news downloaded new JS on first open (${afterNews.length} files)`);

		// Does the bundler expose the module definition (dev server: yes)?
		const measurable = js.defined.size > 0;
		if (measurable) t.check(js.defined.has('news'), 'news module was defined when opened');
		else console.log('  note: module definitions are not visible with this bundler; only the request count was checked');

		// Close → open: no new downloads.
		await page.locator('[data-window-frame=news] [data-window-control=close]').click();
		await page.locator('[data-window-frame=news]').waitFor({ state: 'detached' }).catch(() => {});
		const beforeReopen = js.urls.size;
		await openApp(page, 'news');
		await js.settle(page);
		t.eq(js.urls.size, beforeReopen, 'no new JS was downloaded when news was reopened');

		await openApp(page, 'settings');
		t.check((await t.waitFor(() => rendered(page, 'settings'), { timeout: 30_000 })) >= 0, 'settings window rendered its content');
		await js.settle(page);
		t.check(js.urls.size > beforeReopen, 'settings downloaded its own JS file on first open');

		if (measurable) {
			t.check(js.defined.has('settings'), 'settings module was defined when opened');
			const others = Object.keys(FILES).filter((id) => id !== 'news' && id !== 'settings');
			t.sameSet([...js.defined].filter((id) => others.includes(id)), [], 'no other app code reached the news-only user\'s browser');
		}
		await t.shot(page, 'reader-news-settings');
	});

	await t.step('admin: only the open window\'s code is loaded at desktop start; every app opens without errors', async () => {
		const { page, js } = await openTracked(t, 'admin');
		const watch = watchPage(page, { ignore: NOISE });
		await js.settle(page);
		const open = await openWindows(page);
		if (js.defined.size > 0 || open.length > 0) {
			const extra = [...js.defined].filter((id) => !open.includes(id));
			t.sameSet(extra, [], `only the open windows' code was defined at startup (${open.join(', ') || 'none'})`);
		}
		const apps = await page.locator('[data-dock-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-app')));
		t.check(apps.length >= 10, `admin has ${apps.length} apps in the dock`);
		for (const id of apps) {
			await openApp(page, id);
			const ok = (await t.waitFor(() => rendered(page, id), { timeout: 30_000 })) >= 0;
			t.check(ok, `${id}: opened and rendered its content`);
			// The opened window is closed so it does not cover the others; the code stays cached.
			await page.locator(`[data-window-frame=${id}] [data-window-control=close]`).click();
		}
		await js.settle(page);
		if (js.defined.size > 0) t.sameSet([...js.defined].filter((id) => apps.includes(id)), apps, 'the module of every opened app was defined');
		t.eq(watch.problems, [], 'no console errors, uncaught exceptions, or failed JS requests while opening apps');
		watch.stop();
		await t.shot(page, 'admin-all-opened');
	});
}
