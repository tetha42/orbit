// Live events (SSE, /api/stream) and PostgreSQL NOTIFY: a role change reaches an open session within
// seconds (without waiting for the 15-second poll), two server processes on the same database hear each
// other and invalidate the permission cache, an unauthorized request gets 401, there is a per-user
// connection limit, a new notification increments the bell counter without a page reload, and behavior
// falls back to polling when SSE is unavailable.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';
import { client, SESSION_COOKIE } from '../lib/api.mjs';
import { dockApps, newContext, openApp, openSession, openWindows, waitDesktop } from '../lib/browser.mjs';
import { startServer } from '../lib/server.mjs';

export const meta = { title: 'Live events (SSE + NOTIFY): instant permission/notification updates, two processes, 401, connection limit, polling fallback' };

const MEMBER_DOCK = ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'chat', 'mail'];
const NEWS_DOCK = ['chat', 'news', 'settings'];
/** Update over SSE: event + /api/auth/me + render; far below the 15-second poll. */
const SSE_LIMIT_MS = 3_000;
/** Polling fallback: at most 15 seconds plus response/render allowance. */
const POLL_LIMIT_MS = 22_000;

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

/** Number in the bell (0 when there is no badge). */
const badge = async (page) => {
	const el = page.locator('[data-notification-badge]');
	return (await el.count()) ? Number(await el.getAttribute('data-notification-badge')) : 0;
};

/** Opens an SSE stream; collects incoming event names and sets `ended` to true when it finishes. */
async function openStream(base, token) {
	const ac = new AbortController();
	const res = await fetch(`${base}/api/stream`, { headers: { cookie: `${SESSION_COOKIE}=${token}` }, signal: ac.signal });
	const stream = { res, events: [], ended: false, text: '', close: () => ac.abort() };
	if (res.status !== 200) return stream;
	(async () => {
		const reader = res.body.getReader();
		const dec = new TextDecoder();
		try {
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				stream.text += dec.decode(value);
				stream.events = [...stream.text.matchAll(/^event: (.+)$/gm)].map((x) => x[1]);
			}
		} catch {
			// aborted by the test
		}
		stream.ended = true;
	})();
	return stream;
}

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const canId = fx.users.can.id;
	const setRole = (roleId) => admin.patch('/api/members', { id: canId, roleId });
	t.cleanup(() => setRole(fx.roles.member));
	const stamp = Date.now().toString(36);

	// ---- (a) a role change reaches an open session within ~3 seconds ---------------------------------
	await t.step('SSE: admin changes the role → the member screen updates without waiting for the poll', async () => {
		const { page } = await t.open('can');
		const opened = [];
		page.on('request', (r) => r.url().includes('/api/stream') && opened.push(r.url()));
		await page.reload({ waitUntil: 'domcontentloaded' });
		await waitDesktop(page);
		await openApp(page, 'events');
		t.sameSet(await dockApps(page), MEMBER_DOCK, 'initial state: Dock shows the Member role applications');
		t.check(await t.waitFor(() => opened.length > 0, { timeout: 8000 }) >= 0, 'the page opened the /api/stream stream');
		// A short allowance for the stream to open (first byte); then make the change.
		await t.sleep(300);

		t.eq((await setRole(fx.roles.news)).status, 200, `PATCH /api/members {roleId: ${fx.roleNames.news}} 200`);
		const ms = await t.waitFor(async () => !(await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= SSE_LIMIT_MS, `Events disappeared from the Dock (${ms} ms ≤ ${SSE_LIMIT_MS}; polling would have taken ~15 seconds)`);
		t.sameSet(await dockApps(page), NEWS_DOCK, 'the Dock shows only News and Settings');
		t.excludes(await openWindows(page), 'events', 'the open Events window closed');
		await t.shot(page, 'sse-rol-degisti');

		await setRole(fx.roles.member);
		const back = await t.waitFor(async () => (await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(back >= 0 && back <= SSE_LIMIT_MS, `the Dock updated after the role was restored (${back} ms)`);
	});

	// ---- session-ended: remote device revocation / second session ends old device ----
	await t.step('SSE: revoking other devices ends the open session immediately', async () => {
		const { page } = await t.open('ege');
		await t.sleep(350);
		const started = Date.now();
		const otherSession = await t.api('ege', { fresh: true });
		await otherSession.post('/api/auth/devices/revoke-others', {});
		const ok = await page.locator('input[type=email]').waitFor({ timeout: 10_000 }).then(() => true, () => false);
		const ms = Date.now() - started;
		t.check(ok && ms <= SSE_LIMIT_MS + 2000, `the old session returned to the login screen (${ms} ms; polling would have taken ~15 seconds)`);
	});

	// ---- (c) unauthorized request and connection limit -----------------------------------------
	await t.step('SSE: no session / invalid session returns 401, headers are correct', async () => {
		const anon = await fetch(`${t.base}/api/stream`);
		t.eq(anon.status, 401, 'GET /api/stream without a session returns 401');
		const bad = await fetch(`${t.base}/api/stream`, { headers: { cookie: `${SESSION_COOKIE}=invalid-token` } });
		t.eq(bad.status, 401, 'invalid session cookie returns 401');
		const s = await openStream(t.base, (await t.api('can')).token);
		t.eq(s.res.status, 200, 'a valid session returns 200');
		t.check((s.res.headers.get('content-type') ?? '').startsWith('text/event-stream'), 'Content-Type is text/event-stream');
		t.eq(s.res.headers.get('cache-control'), 'no-store, no-transform', 'Cache-Control is no-store, no-transform');
		t.eq(s.res.headers.get('x-accel-buffering'), 'no', 'X-Accel-Buffering is no');
		await t.waitFor(() => s.text.includes(': ready'), { timeout: 3000, every: 30 });
		t.check(s.text.includes(': ready'), 'the first bytes arrived immediately (stream is open)');
		s.close();
	});

	await t.step('SSE: at most 8 connections per user; excess connections close the oldest', async () => {
		const token = (await t.api('can')).token;
		const streams = [];
		for (let i = 0; i < 10; i++) streams.push(await openStream(t.base, token));
		await t.waitFor(() => streams.slice(0, 2).every((s) => s.ended), { timeout: 4000, every: 50 });
		t.check(streams.slice(0, 2).every((s) => s.ended), 'the oldest 2 streams were closed by the server');
		t.check(streams.slice(2).every((s) => !s.ended && s.res.status === 200), 'the last 8 streams are open');
		// The remaining open streams still receive events (the closed old ones did not break the hub).
		await setRole(fx.roles.news);
		await t.waitFor(() => streams.slice(2).every((s) => s.events.includes('permission-changed')), { timeout: 4000, every: 50 });
		t.check(streams.slice(2).every((s) => s.events.includes('permission-changed')), 'all 8 open streams received permission-changed');
		t.check(!streams.slice(0, 2).some((s) => s.events.length), 'the closed streams received no events');
		await setRole(fx.roles.member);
		for (const s of streams) s.close();
		await t.sleep(100);
		// The limit counts closed streams: a new stream can still be opened.
		const again = await openStream(t.base, token);
		t.eq(again.res.status, 200, 'a new stream opens after the streams close');
		again.close();
	});

	await t.step('SSE: the event carries only a marker (no content/data) and another user\'s events do not arrive', async () => {
		const canTok = (await t.api('can')).token;
		const egeTok = (await t.api('ege')).token;
		const sCan = await openStream(t.base, canTok);
		const sEge = await openStream(t.base, egeTok);
		await t.waitFor(() => sCan.text.includes(': ready') && sEge.text.includes(': ready'), { timeout: 3000, every: 30 });
		await setRole(fx.roles.news);
		await t.waitFor(() => sCan.events.includes('permission-changed'), { timeout: 4000, every: 50 });
		await t.sleep(200);
		t.includes(sCan.events, 'permission-changed', 'the member whose role changed received permission-changed');
		t.eq(sEge.events, [], 'the member whose role did not change received no events');
		const payloads = [...sCan.text.matchAll(/^data: (.*)$/gm)].map((m) => m[1]);
		t.check(
			payloads.length > 0 &&
				payloads.every((p) => {
					try {
						const parsed = JSON.parse(p);
						return (
							parsed !== null &&
							typeof parsed === 'object' &&
							!Array.isArray(parsed) &&
							typeof parsed.ts === 'number' &&
							Object.keys(parsed).length === 1
						);
					} catch {
						return false;
					}
				}),
			'event data carries only the ts timestamp — no leaked fields'
		);
		await setRole(fx.roles.member);
		sCan.close();
		sEge.close();
	});

	// ---- (d) notification event: the bell counter increments without a page reload -------------
	await t.step('SSE: a new news item → the bell counter increments without a page reload', async () => {
		const { page } = await t.open('can');
		await page.locator('[data-notification-toggle]').waitFor();
		await t.sleep(450);
		const before = await badge(page);
		const news = must(await admin.post('/api/news', { title: `SSE notification post ${stamp}`, content: 'Live notification.', category: 'general', publishStatus: 'published' }), 'news');
		t.cleanup(() => admin.del(`/api/news?id=${news.id}`));
		const ms = await t.waitFor(async () => (await badge(page)) > before, { timeout: 20_000, every: 100 });
		t.check(ms >= 0 && ms <= SSE_LIMIT_MS, `the bell counter went ${before} → ${await badge(page)} (${ms} ms; polling is every 60 seconds)`);
		await t.shot(page, 'sse-zil-artti');
	});

	// ---- without SSE: fallback to polling -------------------------------------------------------
	await t.step('when SSE is blocked or EventSource unavailable, behavior falls back to 15-second polling with no loss of function', async () => {
		const token = (await t.api('can')).token;

		const blockedCtx = t.track(await newContext(t.browser));
		await blockedCtx.addCookies([{ name: SESSION_COOKIE, value: token, url: t.base }]);
		let blocked = 0;
		await blockedCtx.route('**/api/stream', (route) => {
			blocked++;
			return route.abort();
		});
		const blockedPage = await blockedCtx.newPage();

		const noSseCtx = t.track(await newContext(t.browser));
		await noSseCtx.addInitScript(() => {
			delete window.EventSource;
		});
		await noSseCtx.addCookies([{ name: SESSION_COOKIE, value: token, url: t.base }]);
		const noSsePage = await noSseCtx.newPage();

		await Promise.all([
			blockedPage.goto(t.base, { waitUntil: 'domcontentloaded' }).then(() => waitDesktop(blockedPage)),
			noSsePage.goto(t.base, { waitUntil: 'domcontentloaded' }).then(() => waitDesktop(noSsePage)),
		]);

		t.sameSet(await dockApps(blockedPage), MEMBER_DOCK, 'stream blocked: the desktop still opened');
		t.check(await t.waitFor(() => blocked > 0, { timeout: 8000 }) >= 0, 'the /api/stream attempt was blocked');
		await t.sleep(150);

		await setRole(fx.roles.news);
		const [blockedMs, noSseMs] = await Promise.all([
			t.waitFor(async () => !(await dockApps(blockedPage)).includes('events'), { timeout: 30_000, every: 250 }),
			t.waitFor(async () => !(await dockApps(noSsePage)).includes('events'), { timeout: 30_000, every: 250 }),
		]);
		t.check(blockedMs >= 0 && blockedMs <= POLL_LIMIT_MS, `the Dock updated through polling (${blockedMs} ms ≤ ${POLL_LIMIT_MS})`);
		t.check(noSseMs >= 0 && noSseMs <= POLL_LIMIT_MS, `the Dock updated through polling without EventSource (${noSseMs} ms)`);
		await setRole(fx.roles.member);
	});

	// ---- (b) two server processes, same database ------------------------------------------------
	const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';
	if (!databaseUrl) {
		console.log('skipped: the two-process test requires E2E_DATABASE_URL (or DATABASE_URL)');
		return;
	}
	await t.step('NOTIFY: a second server process (same database) hears the role change and the permission cache is invalidated', async () => {
		const portA = Number(new URL(t.base).port);
		const useDevServer = process.env.E2E_DEV_SERVER === '1';
		// Only `next dev` needs an isolated BEU_DIST_DIR (`.next-b`), which rewrites tsconfig/next-env.
		const touched = useDevServer
			? ['next-env.d.ts', 'tsconfig.json'].map((f) => [path.join(ROOT, f), fs.readFileSync(path.join(ROOT, f), 'utf8')])
			: [];
		if (useDevServer) {
			t.cleanup(() => {
				for (const [file, text] of touched) fs.writeFileSync(file, text);
				fs.rmSync(path.join(ROOT, '.next-b'), { recursive: true, force: true });
			});
		}
		const second = await startServer({
			port: portA + 1,
			name: 'server-sse-b',
			env: {
				DATABASE_URL: databaseUrl,
				BOOTSTRAP_ADMIN_EMAIL: fx.admin.email,
				BOOTSTRAP_ADMIN_PASSWORD: fx.admin.password,
				NEXT_TELEMETRY_DISABLED: '1',
				...(useDevServer ? { BEU_DIST_DIR: '.next-b' } : {}),
			},
		});
		t.trackServer?.('server-sse-b', second.pid);
		t.cleanup(async () => {
			await second.stop();
			t.untrackServer?.(second.pid);
		});
		const baseB = second.base;
		const canA = await t.api('can');
		const canB = client(baseB, canA.token); // same session token, the other process

		// (1) The screen of the session connected to B updates when the role changes on A.
		const { context, page } = await openSession(t.browser, baseB, canA.token);
		t.track(context);
		t.sameSet(await dockApps(page), MEMBER_DOCK, 'session connected to process B: initial Dock');
		await t.sleep(450); // B's stream and LISTEN connection are ready
		t.eq((await setRole(fx.roles.news)).status, 200, 'the role changed on process A');
		const ms = await t.waitFor(async () => !(await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= SSE_LIMIT_MS + 1000, `the screen on process B updated through NOTIFY (${ms} ms; polling would take ~15 seconds)`);
		await setRole(fx.roles.member);
		await t.waitFor(async () => (await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });

		// (2) B's 5-second permission cache is invalidated immediately by the role edit on A.
		const roleName = `E2E SSE ${stamp}`;
		const role = must(await admin.post('/api/roles', { name: roleName, color: '#8e8e93', description: 'SSE cache', twoStepRequired: false, permissions: { news: 'use', events: 'use', settings: 'use' } }), 'role');
		t.cleanup(() => admin.del('/api/roles', { id: role.id, move: fx.roles.member }));
		must(await setRole(role.id), 'role for member');
		t.eq((await canB.get('/api/events')).status, 200, 'B: Events is permitted (permission was cached)');
		t.eq((await canB.get('/api/events')).status, 200, 'B: the second request returns 200 from cache');
		const edit = await admin.patch('/api/roles', { id: role.id, name: roleName, color: '#8e8e93', description: 'SSE cache', twoStepRequired: false, permissions: { news: 'use', settings: 'use' } });
		t.eq(edit.status, 200, 'A: the Events permission was removed from the role');
		const cacheMs = await t.waitFor(async () => (await canB.get('/api/events')).status === 403, { timeout: 8000, every: 100 });
		t.check(cacheMs >= 0 && cacheMs < 2500, `B's cache was invalidated through NOTIFY (${cacheMs} ms; with a TTL it could keep returning 200 for ~5000 ms)`);
		await setRole(fx.roles.member);
	});
}
