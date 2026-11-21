// Mail (in-portal member-to-member messaging): end-to-end correspondence between two
// temporary members through the browser (compose + recipient autocomplete, notification and
// Dock badge, read state, reply, archive, trash, permanent delete), 404 for someone else's
// thread, the app never appearing anywhere for a role without Mail + API 403, no notification
// for the "News Only" role, and feedback to the sender when the recipient's role does not
// open Mail. The suite sets up its own members and deletes them when done.
import { answerDialog, toast } from '../lib/ui-shared.mjs';
import { dockApps, openApp, showLauncherApps } from '../lib/browser.mjs';
import { newMember, runTag } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Mail: correspondence, reply, read state, archive/trash, 404, permissions, notifications' };

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const tag = runTag();

	const ayse = await newMember(t, admin, { label: 'mail-a', roleId: fx.roles.member });
	const berk = await newMember(t, admin, { label: 'mail-b', roleId: fx.roles.member });
	const foreign = await newMember(t, admin, { label: 'mail-y', roleId: fx.roles.member });
	const news = await newMember(t, admin, { label: 'mail-h', roleId: fx.roles.news });
	const [aApi, bApi, yApi, hApi] = await Promise.all([ayse.api(), berk.api(), foreign.api(), news.api()]);

	const topic = `E2E Mail ${tag}`;
	const body = `Hello, this is an end-to-end test message (${tag}).`;
	const replyText = 'Reply: your message arrived, thanks.';
	let topicId = null;

	const inbox = async (api, folder = 'inbox') => must(await api.get(`/api/messages?folder=${folder}`), `list ${folder}`);
	const thread = async (api, id = topicId) => api.get(`/api/messages/${encodeURIComponent(id)}`);

	await t.step('API: a role without Mail cannot access any Mail endpoint (403)', async () => {
		for (const path of ['/api/messages', '/api/messages/unread', '/api/messages/recipients', '/api/messages/settings', '/api/messages/yok-boyle-bir-konu']) {
			t.eq((await hApi.get(path)).status, 403, `GET ${path} → 403`);
		}
		t.eq((await hApi.post('/api/messages', { subject: 'x', body: 'y', recipients: [berk.id] })).status, 403, 'POST /api/messages → 403');
		t.eq((await hApi.patch('/api/messages/yok', { action: 'read' })).status, 403, 'PATCH → 403');
	});

	await t.step('API: send validations (recipient, length, active member, self)', async () => {
		const post = (body) => aApi.post('/api/messages', body);
		t.eq((await post({ subject: topic, body, recipients: [] })).status, 400, 'no recipient 400');
		t.eq((await post({ subject: topic, body, recipients: [ayse.id] })).status, 400, 'self only 400');
		t.eq((await post({ subject: topic, body, recipients: ['olmayan-uye-kimligi'] })).status, 400, 'nonexistent recipient 400');
		t.eq((await post({ subject: '', body, recipients: [berk.id] })).status, 400, 'empty subject 400');
		t.eq((await post({ subject: 'k'.repeat(121), body, recipients: [berk.id] })).status, 400, 'subject limit (120) 400');
		t.eq((await post({ subject: topic, body: ' ', recipients: [berk.id] })).status, 400, 'empty body 400');
		t.eq((await post({ subject: topic, body: 'g'.repeat(10_001), recipients: [berk.id] })).status, 400, 'body limit (10000) 400');
		t.eq((await post({ subject: topic, body, recipients: Array.from({ length: 21 }, (_, i) => `x${i}`) })).status, 400, 'at most 20 recipients');
		// An inactive member (alumni) cannot be a recipient.
		const alumni = await newMember(t, admin, { label: 'mail-m', roleId: fx.roles.member });
		t.eq((await admin.patch('/api/members', { id: alumni.id, status: 'alumni' })).status, 200, 'member made alumni');
		t.eq((await post({ subject: topic, body, recipients: [berk.id, alumni.id] })).status, 400, 'inactive recipient 400');
		t.eq((await inbox(bApi)).total, 0, 'no rejected request left a message');
	});

	await t.step("API: if the recipient's role does not open Mail, no message is sent and the sender gets feedback", async () => {
		const only = await aApi.post('/api/messages', { subject: `${topic} only`, body, recipients: [news.id] });
		t.eq(only.status, 422, 'single recipient without Mail: 422, no thread created');
		t.eq(only.json?.skipped?.[0]?.reason, 'role', 'reason: role');
		t.check(/role does not open Mail/.test(only.json?.error ?? ''), 'error text says the role does not grant Mail access', only.json?.error);
		t.check((only.json?.error ?? '').includes(news.surname), 'error text names the recipient', only.json?.error);
		t.eq((await inbox(aApi, 'sent')).total, 0, 'no thread in sent');
	});

	await t.step('UI (sender): Mail opens, a new message is written with recipient autocomplete', async () => {
		const { page } = await ayse.open();
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-folder=inbox]').waitFor();
		await win.locator('[data-mail-empty]').waitFor();
		t.eq(await win.locator('[data-mail-empty]').count(), 1, 'inbox empty');
		await win.locator('[data-mail-compose]').click();
		const sheet = page.getByRole('dialog', { name: tr('mailComposeTitle') });
		await sheet.waitFor();
		const input = sheet.locator('[data-mail-recipient-input]');
		await input.fill(berk.surname);
		const option = sheet.locator(`[data-mail-option="${berk.id}"]`);
		await option.waitFor();
		t.eq(await sheet.locator(`[data-mail-option="${ayse.id}"]`).count(), 0, 'self not in suggestions');
		// A member whose role does not open Mail is suggested but cannot be selected.
		await input.fill(news.surname);
		const closed = sheet.locator(`[data-mail-option="${news.id}"]`);
		await closed.waitFor();
		t.check(await closed.isDisabled(), 'role without Mail cannot be selected (disabled)');
		t.check((await closed.innerText()).includes(tr('mailUnreachable')), 'reason shown');
		await input.fill(berk.surname);
		await option.click();
		t.eq(await sheet.locator(`[data-mail-chip="${berk.id}"]`).count(), 1, 'recipient added as a chip');
		await sheet.locator('[data-mail-subject]').fill(topic);
		await sheet.locator('[data-mail-body]').fill(body);
		await t.shot(page, 'compose-window');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, tr('mailSent'));
		await sheet.waitFor({ state: 'detached' });
		const sent = await inbox(aApi, 'sent');
		topicId = sent.topics[0]?.id;
		t.eq(sent.topics[0]?.topic, topic, 'thread present in sent');
		// The Sent folder opens with the thread selected.
		await win.locator(`[data-mail-thread="${topicId}"]`).waitFor();
		const msg = win.locator('[data-mail-message]');
		await msg.first().waitFor();
		t.eq(await msg.count(), 1, 'single message in the thread');
		t.check((await msg.first().innerText()).includes(body), 'message text visible');
		t.eq(await win.locator('[data-mail-subject-line]').innerText(), topic, 'thread subject');
		await t.shot(page, 'ayse-sent');
	});

	await t.step('recipient side: notification panel with type "message", Dock badge, unread count', async () => {
		const feed = must(await bApi.get('/api/notifications'), 'notifications');
		const item = feed.items.find((i) => i.id === `message:${topicId}`);
		t.eq(item?.kind, 'message', 'notification type "message"');
		t.eq(item?.priority, 'info', 'info notification');
		t.eq(item?.target, { appId: 'mail', kind: 'thread', itemId: topicId }, 'target: Mail/thread');
		t.eq(item?.data?.title, topic, 'title is the subject');
		t.eq(feed.counts.unreadMessages, 1, 'counts.unreadMessages 1');
		t.eq(must(await bApi.get('/api/messages/unread'), 'unread').count, 1, '/api/messages/unread 1');

		const { page } = await berk.open();
		const badge = page.locator('[data-dock-app=mail] [data-dock-badge]');
		await badge.waitFor();
		t.eq(await badge.getAttribute('data-dock-badge'), '1', 'Dock badge 1');
		await page.locator('[data-notification-toggle]').click();
		const row = page.locator(`[data-notification-panel] [data-notification-item="message:${topicId}"]`);
		await row.waitFor();
		t.check((await row.innerText()).includes(topic), 'subject present in the panel row');
		t.check((await row.innerText()).includes(ayse.surname), 'sender present in the panel row');
		await t.shot(page, 'berk-notification');

		// Clicking the row opens Mail and selects the thread; on open the thread is marked read and the badge clears.
		await row.locator('button.nc-row-main').click();
		const win = page.locator('[data-window-frame=mail]');
		await win.waitFor();
		await win.locator('[data-mail-message]').first().waitFor();
		t.check((await win.locator('[data-mail-message]').first().innerText()).includes(body), 'thread opened, message visible');
		await badge.waitFor({ state: 'detached' });
		t.eq(must(await bApi.get('/api/messages/unread'), 'unread').count, 0, 'opening the thread marked it read: count 0');
		t.eq((await thread(bApi)).json.messages.every((m) => m.read), true, 'API: all messages read');
		await t.shot(page, 'berk-read');
	});

	await t.step('read / unread: opening a thread marks it read, the mark-unread action reverts it', async () => {
		const row = (await inbox(bApi)).topics.find((k) => k.id === topicId);
		t.eq(row?.unread, 0, 'list: unread 0');
		t.eq((await bApi.patch(`/api/messages/${topicId}`, { action: 'unread' })).status, 200, 'mark unread 200');
		t.eq(must(await bApi.get('/api/messages/unread'), 'unread').count, 1, 'unread count 1');
		t.eq((await bApi.patch(`/api/messages/${topicId}`, { action: 'read' })).status, 200, 'mark read 200');
		t.eq(must(await bApi.get('/api/messages/unread'), 'unread').count, 0, 'unread count 0');
		t.eq((await bApi.patch(`/api/messages/${topicId}`, { action: 'uc' })).status, 400, 'invalid action 400');
	});

	await t.step('UI (recipient): reply; the sender sees the reply as unread', async () => {
		const { page, context: berkCtx } = await berk.open();
		const win = await openApp(page, 'mail');
		await win.locator(`[data-mail-thread="${topicId}"]`).click();
		await win.locator('[data-mail-reply]').fill(replyText);
		await win.locator('[data-mail-reply-send]').click();
		await toast(page, tr('mailReplySent'));
		await win.locator('[data-mail-message]').nth(1).waitFor();
		t.eq(await win.locator('[data-mail-message]').count(), 2, 'two messages in the thread');
		t.eq((await thread(aApi)).json.messages.length, 2, 'two messages for the sender too');
		t.eq(await win.locator('[data-mail-reply]').inputValue(), '', 'reply box cleared');
		await t.close(berkCtx);

		const a = (await ayse.open()).page;
		const aWin = await openApp(a, 'mail');
		await aWin.locator('[data-mail-folder=inbox] [data-mail-unread="1"]').waitFor();
		t.check(true, 'sender: inbox counter 1');
		await aWin.locator(`[data-mail-thread="${topicId}"][data-unread]`).waitFor();
		await t.shot(a, 'ayse-reply-arrived');
		await aWin.locator(`[data-mail-thread="${topicId}"]`).click();
		await aWin.locator('[data-mail-message]').nth(1).waitFor();
		t.check((await aWin.locator('[data-mail-message]').nth(1).innerText()).includes(replyText), 'the sender reads the reply');
		await aWin.locator('[data-mail-folder=inbox] [data-mail-unread]').waitFor({ state: 'detached' });
		t.eq(must(await aApi.get('/api/messages/unread'), 'unread').count, 0, 'the sender count is 0 once read');
	});

	await t.step("someone else's thread: open, reply, action, search → 404 (existence not leaked)", async () => {
		const g = await thread(yApi);
		t.eq(g.status, 404, 'foreign: GET 404');
		const gone = await thread(yApi, 'hic-olmayan-bir-konu');
		t.eq(gone.status, 404, 'nonexistent thread: GET 404');
		t.eq(JSON.stringify(g.json), JSON.stringify(gone.json), 'both responses identical: thread existence not revealed');
		t.eq((await yApi.post(`/api/messages/${topicId}`, { body: 'leak attempt' })).status, 404, 'foreign: reply 404');
		t.eq((await yApi.patch(`/api/messages/${topicId}`, { action: 'trash' })).status, 404, 'foreign: trash 404');
		t.eq((await yApi.patch(`/api/messages/${topicId}`, { action: 'delete' })).status, 404, 'foreign: delete 404');
		t.eq((await thread(aApi)).json.messages.length, 2, 'thread unchanged');
		const q = (api) => api.get(`/api/search?q=${encodeURIComponent(tag)}`).then((r) => (r.json?.hits ?? []).filter((h) => h.kind === 'message').map((h) => h.id));
		t.includes(await q(bApi), `message:${topicId}`, 'participant finds the thread in search');
		t.eq(await q(yApi), [], 'foreign participant cannot find it in search');
		t.eq(await q(hApi), [], 'role without Mail sees no messages in search');
	});

	await t.step('UI (berk): archive → restore to inbox → trash → permanent delete (own mailbox only)', async () => {
		const page = (await berk.open()).page;
		const win = await openApp(page, 'mail');
		const row = win.locator(`[data-mail-thread="${topicId}"]`);
		await row.click();
		await win.locator('[data-mail-action=archive]').click();
		await toast(page, tr('mailArchived'));
		await row.waitFor({ state: 'detached' });
		t.eq((await inbox(bApi, 'archived')).topics.map((k) => k.id), [topicId], 'API: archived');
		t.eq((await inbox(bApi)).total, 0, 'API: not in the inbox');

		await win.locator('[data-mail-folder=archived]').click();
		await row.click();
		await win.locator('[data-mail-action=restore]').click();
		await toast(page, tr('mailRestored'));
		t.eq((await inbox(bApi)).topics.map((k) => k.id), [topicId], 'API: back in the inbox');

		await win.locator('[data-mail-folder=inbox]').click();
		await row.click();
		await win.locator('[data-mail-action=trash]').click();
		await toast(page, tr('mailTrashed'));
		t.eq((await inbox(bApi, 'trash')).topics.map((k) => k.id), [topicId], 'API: in trash');
		await win.locator('[data-mail-folder=trash]').click();
		await row.click();
		await win.locator('[data-mail-action=delete]').waitFor();
		t.eq(await win.locator('[data-mail-action=trash]').count(), 0, 'no trash action on a thread already in trash');
		await t.shot(page, 'berk-trash');
		await win.locator('[data-mail-action=delete]').click();
		await answerDialog(page, true);
		await toast(page, tr('mailDeleted'));
		t.eq((await thread(bApi)).status, 404, 'deleted thread returns 404 for berk');
		t.eq((await thread(aApi)).status, 200, 'the sender still sees the thread');
		t.eq((await bApi.patch(`/api/messages/${topicId}`, { action: 'trash' })).status, 404, 'action on a deleted thread 404');
	});

	await t.step('API: permanent delete only on a trashed thread; a new message returns an archived thread to the inbox', async () => {
		const made = must(await aApi.post('/api/messages', { subject: `${topic} second`, body, recipients: [berk.id, foreign.id] }), 'second thread');
		const id = made.threadId;
		t.eq(made.skipped, [], 'delivered to everyone');
		t.eq((await bApi.patch(`/api/messages/${id}`, { action: 'delete' })).status, 400, 'an inbox thread cannot be deleted directly (400)');
		t.eq((await bApi.patch(`/api/messages/${id}`, { action: 'archive' })).status, 200, 'berk archives');
		t.eq((await inbox(bApi)).topics.length, 0, 'berk inbox is empty');
		must(await aApi.post(`/api/messages/${id}`, { body: 'second message' }), 'reply');
		t.eq((await inbox(bApi)).topics.map((k) => k.id), [id], 'the new message returned the thread to the inbox');
		t.eq((await inbox(bApi)).topics[0]?.unread, 2, 'two unread messages');
		t.eq(must(await bApi.get('/api/messages/unread'), 'unread').count, 1, 'unread count is the thread count (1)');
		t.eq((await inbox(yApi)).topics.length, 1, 'the third recipient also received it');
		// Berk's role disables Mail; the foreign recipient is still there: the reply goes only to them and berk appears in skipped.
		const roleId = await newRole(t, admin, tag);
		t.eq((await admin.patch('/api/members', { id: berk.id, roleId: roleId })).status, 200, "berk's role changed to one without Mail");
		await t.waitFor(async () => (await bApi.get('/api/messages')).status === 403, { timeout: 6000, every: 150 });
		t.eq((await bApi.get('/api/messages')).status, 403, 'berk: API 403');
		const reply = await aApi.post(`/api/messages/${id}`, { body: 'berk can no longer read it' });
		t.eq(reply.status, 201, 'the reply still goes through (to the foreign recipient)');
		t.eq(reply.json?.skipped?.map((a) => [a.id, a.reason]), [[berk.id, 'role']], 'berk in skipped: role');
		t.eq((await admin.patch('/api/members', { id: berk.id, roleId: fx.roles.member })).status, 200, "berk's role restored");
		await t.waitFor(async () => (await bApi.get('/api/messages')).status === 200, { timeout: 6000, every: 150 });
	});

	await t.step('"News Only" role: no Mail in Dock, mobile launcher, Spotlight or notifications', async () => {
		const feed = must(await hApi.get('/api/notifications'), 'notifications');
		t.excludes(feed.items.map((i) => i.kind), 'message', 'no message item in notifications');
		t.eq(feed.counts.unreadMessages, 0, 'unreadMessages 0');
		const { page, context: newsCtx } = await news.open();
		await page.locator('[data-dock-app=news]').waitFor();
		t.excludes(await dockApps(page), 'mail', 'no Mail in the Dock');
		await page.keyboard.press('Control+Space');
		const box = page.getByRole('combobox');
		const mailName = tr('mailTitle');
		const resultsLabel = tr('spotResultsLabel');
		const results = page.locator(`[aria-label="${resultsLabel}"]`);
		await box.fill(mailName);
		await page.getByRole('listbox').or(results).first().waitFor();
		await page.waitForTimeout(400);
		t.check(!(await results.innerText()).includes(mailName), 'Spotlight does not suggest Mail');
		await page.keyboard.press('Escape');
		await t.shot(page, 'news-desktop');
		await t.close(newsCtx);
		const { page: mobile, context: mobileCtx } = await news.open({ mobile: true });
		await showLauncherApps(mobile);
		await mobile.locator('[data-launcher-app=news]').waitFor();
		t.excludes(await mobile.locator('[data-launcher-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-launcher-app'))), 'mail', 'no Mail in the mobile launcher');
		await t.close(mobileCtx);
		// Comparison: with a Mail-enabled role Spotlight suggests the app.
		const u = (await ayse.open()).page;
		await u.locator('[data-dock-app=mail]').waitFor();
		await u.keyboard.press('Control+Space');
		await u.getByRole('combobox').fill(mailName);
		await u.locator(`[aria-label="${resultsLabel}"]`).getByText(mailName).first().waitFor();
		t.check(true, 'with a Mail-enabled role Spotlight suggests Mail');
	});

	await t.step('the "also notify by e-mail" setting saves and does not break sending', async () => {
		t.eq(must(await bApi.get('/api/messages/settings'), 'setting').emailWithNews, false, 'off by default');
		t.eq((await bApi.patch('/api/messages/settings', { emailWithNews: 'yes' })).status, 400, 'invalid value 400');
		const page = (await berk.open()).page;
		const win = await openApp(page, 'mail');
		const toggle = win.locator('[data-mail-email-toggle]');
		await toggle.waitFor();
		await win.locator('[data-mail-email-toggle]:not([disabled])').waitFor();
		await toggle.check();
		await t.waitFor(async () => (await bApi.get('/api/messages/settings')).json.emailWithNews === true);
		t.eq(must(await bApi.get('/api/messages/settings'), 'setting').emailWithNews, true, 'setting persisted');
		const sent = await aApi.post('/api/messages', { subject: `${topic} e-mail`, body, recipients: [berk.id] });
		t.eq(sent.status, 201, 'send to a recipient with e-mail notification on 201');
		await toggle.uncheck();
		await t.waitFor(async () => (await bApi.get('/api/messages/settings')).json.emailWithNews === false);
		t.eq(must(await bApi.get('/api/messages/settings'), 'setting').emailWithNews, false, 'setting turned back off');
	});

	await t.step('rate limit: 429 after 20 messages per minute', async () => {
		const spam = await newMember(t, admin, { label: 'mail-s', roleId: fx.roles.member });
		const sApi = await spam.api();
		let limited = null;
		for (let i = 0; i < 25 && !limited; i++) {
			const r = await sApi.post('/api/messages', { subject: `speed ${i}`, body: 'x', recipients: [foreign.id] });
			if (r.status === 429) limited = r;
		}
		t.check(limited, '429 received within 25 attempts');
		t.eq(limited?.json?.code, 'MAIL_RATE_LIMITED', 'error code MAIL_RATE_LIMITED (throttling)');
	});
}

/** A role that opens News only (no Mail). Removed when the suite ends. */
async function newRole(t, admin, tag) {
	const res = await admin.post('/api/roles', { name: `E2E NoMail ${tag}`, color: '#8e8e93', description: 'No Mail', twoStepRequired: false, permissions: { news: 'use', settings: 'use' } });
	const id = must(res, 'role').id;
	t.cleanup(() => admin.del('/api/roles', { id, move: t.fx.roles.member }));
	return id;
}
