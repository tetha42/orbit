// Notification center: bell counter, panel, grouping (pinned / action / fresh / earlier),
// unread counter reset when the panel opens, a row opening the app, rejecting an application
// from the panel, and filtering by role. The suite sets up its own news, event, task and
// application; it deletes them when done.
import crypto from 'node:crypto';
import { openWindows } from '../lib/browser.mjs';

export const meta = { title: 'Notifications: panel, grouping, unread counter, filtering by role' };

const DAY = 86_400_000;
/** History considered "new" when a member has never looked in this browser (the app's first-look rule). */
const FIRST_LOOK_MS = 3 * DAY;

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

/** The number on the bell (0 when there is no badge). */
const badge = async (page) => {
	const el = page.locator('[data-notification-badge]');
	return (await el.count()) ? Number(await el.getAttribute('data-notification-badge')) : 0;
};

const panel = (page) => page.locator('[data-notification-panel]');

async function openPanel(page) {
	await page.locator('[data-notification-toggle]').click();
	await panel(page).waitFor();
	// A "Loading" state is visible until the list loads; wait for a row or the empty state.
	await page.locator('[data-notification-panel] [data-notification-item], [data-notification-empty]').first().waitFor();
}

async function closePanel(page) {
	await page.locator('[data-notification-toggle]').click();
	await panel(page).waitFor({ state: 'detached' });
}

/** Panel rows: { id, group, unread }. */
const rows = (page) =>
	page.locator('[data-notification-panel] [data-notification-item]').evaluateAll((els) =>
		els.map((e) => ({ id: e.getAttribute('data-notification-item'), group: e.closest('[data-notification-group]')?.getAttribute('data-notification-group') ?? '', unread: e.hasAttribute('data-unread') }))
	);

const groupOf = (list, id) => list.find((r) => r.id === id)?.group ?? '(none)';

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const stamp = Date.now().toString(36);

	// --- data: news (important + normal), upcoming event, task for ege, pending application ---
	const news = must(await admin.post('/api/news', { title: `Notification test news ${stamp}`, content: 'For the notification package.', category: 'general', publishStatus: 'published' }), 'news');
	t.cleanup(() => admin.del(`/api/news?id=${news.id}`));
	const pinned = must(await admin.post('/api/news', { title: `Important announcement ${stamp}`, content: 'Pinned announcement.', category: 'general', publishStatus: 'published', isImportant: true }), 'important news');
	t.cleanup(() => admin.del(`/api/news?id=${pinned.id}`));

	const start = Date.now() + 2 * 3600_000;
	const event = must(await admin.post('/api/events', { action: 'createEvent', title: `Notification event ${stamp}`, description: 'Notification package', typeValue: 'workshop', location: 'D-101', start: start, end: start + 3600_000, capacity: 10, status: 'published' }), 'event');
	t.cleanup(() => admin.post('/api/events', { action: 'deleteEvent', eventId: event.id }));

	const team = fx.content.team.team ?? fx.content.team;
	const task = must(await admin.post('/api/teams', { action: 'addTask', teamId: team.id, title: `Notification task ${stamp}`, assigneeMemberId: fx.users.ege.id, dueDate: Date.now() + DAY }), 'task').task;
	t.cleanup(() => admin.post('/api/teams', { action: 'deleteTask', taskId: task.id }));

	// Application: through the registration form API. The password is random and never written anywhere.
	const reg = await fetch(`${t.base}/api/auth/register`, {
		method: 'POST',
		// The registration endpoint accepts 5 requests per minute per IP; avoid clashing with other suites' attempts.
		headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.77.${crypto.randomInt(255)}.${crypto.randomInt(255)}` },
		body: JSON.stringify({ name: 'Applicant', surname: `Test ${stamp}`, email: `application-${stamp}@club.test`, password: crypto.randomBytes(12).toString('hex'), department: 'Physics', grade: 1, kvkkAccept: true }),
	}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
	const applicant = must(reg, 'application').user;
	t.cleanup(() => admin.del(`/api/members?id=${applicant.id}`));

	const ids = { news: `news:${news.id}`, pinned: `news:${pinned.id}`, event: `event:${event.id}`, task: `task:${task.id}`, approval: `approval:${applicant.id}` };

	await t.step('API: each role only receives notifications for its own apps', async () => {
		const feed = async (key) => must(await (await t.api(key)).get('/api/notifications'), `notifications ${key}`).items.map((i) => i.id);
		const reader = await feed('reader');
		t.includes(reader, ids.news, 'reader: news notification present');
		for (const k of ['event', 'task', 'approval']) t.excludes(reader, ids[k], `reader: no ${k} notification`);
		const can = await feed('can');
		t.includes(can, ids.event, 'can: event notification present');
		t.excludes(can, ids.approval, 'can (Member): no application approval notification');
		t.excludes(can, ids.task, "can: no ege task");
		const zeynep = await feed('zeynep');
		t.includes(zeynep, ids.approval, 'zeynep (Board): application approval present');
	});

	await t.step('ege: bell counter, panel groups, read state', async () => {
		const ege = await t.api('ege');
		const api = must(await ege.get('/api/notifications'), 'notifications for ege');
		const { page } = await t.open('ege');
		// First look in this browser: action items + info notifications from the last 3 days.
		const expected = api.counts.actionRequired + api.items.filter((i) => i.priority === 'info' && i.at > api.generatedAt - FIRST_LOOK_MS).length;
		t.check((await t.waitFor(async () => (await badge(page)) === expected)) >= 0, `bell counter on first open is ${expected}`, `got ${await badge(page)}`);

		await openPanel(page);
		const first = await rows(page);
		t.sameSet(first.map((r) => r.id), api.items.map((i) => i.id), 'panel rows match the API');
		t.eq(groupOf(first, ids.pinned), 'pinned', 'important news pinned at the top');
		t.eq(groupOf(first, ids.task), 'action', 'upcoming task in the "action" group');
		t.eq(groupOf(first, ids.news), 'fresh', 'new news in the "fresh" group');
		t.eq(groupOf(first, ids.event), 'fresh', 'new event in the "fresh" group');
		t.check(first.find((r) => r.id === ids.news)?.unread, 'new news marked unread');
		t.excludes(first.map((r) => r.id), ids.approval, 'Member role does not see the application approval');
		await t.shot(page, 'ege-panel-first');
		t.eq(await badge(page), api.counts.actionRequired, 'after opening the panel only action items remain in the counter');

		await closePanel(page);
		await openPanel(page);
		const second = await rows(page);
		t.eq(groupOf(second, ids.news), 'earlier', 'on second open the news is in the "earlier" group');
		t.check(!second.find((r) => r.id === ids.news)?.unread, 'no unread mark on second open');
		t.eq(groupOf(second, ids.task), 'action', 'task stays in "action" even when read');
		await closePanel(page);

		// A new news item: after a reload the counter goes up by one (last look is stored in the browser).
		const late = must(await admin.post('/api/news', { title: `Late arrival ${stamp}`, content: 'New.', category: 'general', publishStatus: 'published' }), 'second news item');
		t.cleanup(() => admin.del(`/api/news?id=${late.id}`));
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('[data-notification-toggle]').waitFor();
		t.check((await t.waitFor(async () => (await badge(page)) === api.counts.actionRequired + 1)) >= 0, 'on reload the counter increased only by the new news item', `got ${await badge(page)}`);
		await openPanel(page);
		const third = await rows(page);
		t.eq(groupOf(third, `news:${late.id}`), 'fresh', 'late-arriving news in "fresh"');
		t.eq(groupOf(third, ids.news), 'earlier', 'previously seen news stayed in "earlier"');

		// Clicking a row opens the app and closes the panel.
		await page.locator(`[data-notification-item="news:${late.id}"] button`).first().click();
		await panel(page).waitFor({ state: 'detached' });
		await page.locator('[data-window-frame=news]').waitFor();
		t.includes(await openWindows(page), 'news', 'news row opened the News window');
	});

	await t.step('zeynep: application in the panel, removed from the list when rejected', async () => {
		const { page } = await t.open('zeynep');
		await openPanel(page);
		const list = await rows(page);
		t.eq(groupOf(list, ids.approval), 'action', 'application in the "action" group');
		const row = page.locator(`[data-notification-item="${ids.approval}"]`);
		t.eq(await row.locator('[data-notification-action]').count(), 2, 'approve and reject buttons present');
		await t.shot(page, 'zeynep-application');
		await row.locator('[data-notification-action="reject"]').click();
		const dialog = page.locator('[role=alertdialog]');
		await dialog.waitFor();
		await dialog.getByRole('button').last().click();
		await row.waitFor({ state: 'detached' });
		t.eq(await row.count(), 0, 'rejected application removed from the panel');
		const after = must(await (await t.api('zeynep')).get('/api/notifications'), 'notifications for zeynep').items.map((i) => i.id);
		t.excludes(after, ids.approval, 'the API no longer shows the application either');
	});

	await t.step('reader (News Only): only news notifications; no event/task/application', async () => {
		const { page } = await t.open('reader');
		await openPanel(page);
		const list = await rows(page);
		t.check(list.length > 0, 'rows present in the reader panel');
		t.sameSet([...new Set(list.map((r) => r.id.split(':')[0]))], ['news'], 'reader sees only news notifications');
		for (const k of ['event', 'task', 'approval']) t.excludes(list.map((r) => r.id), ids[k], `reader: no ${k} row`);
		await t.shot(page, 'reader-panel');
		// A row opens the app; a window the role cannot open was not opened.
		t.sameSet((await openWindows(page)).filter((a) => a !== 'news' && a !== 'settings'), [], 'no unauthorized window for the reader');
	});
}
