// Mail: finding people and starting a conversation. Two temporary members find each other by
// first name, last name, e-mail, department and student number and exchange messages; search
// only returns names (no e-mail, department, student number or password leaks); a role without
// Mail gets 403 on the search endpoints and cannot be selected in the recipient list; recent
// contacts become suggestions; "Send message" from the Member Directory and from Spotlight
// opens Mail with the recipient selected; a role without Mail (even if it can open the Member
// Directory) and "News Only" cannot see these. The suite sets up its own members and role,
// and deletes them when done.
//
// Stored fixture data is English. The Turkish-letter probes are written as \uXXXX escapes so
// this file stays ASCII while the search still has to fold them onto those English names.
import { dockApps, openApp, showLauncherApps } from '../lib/browser.mjs';
import { toast } from '../lib/ui-shared.mjs';
import { newMember, runTag } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Mail contacts: search (name/e-mail/department/no), suggestions, multiple recipients, message from Member Directory and Spotlight, leakage' };

// English fixture names; the dotted/dotless i, c-cedilla, g-breve, o-umlaut, s-cedilla and
// u-umlaut probes below must all fold onto them.
const ALINA = 'Alina';
const JONAS = 'Jonas';
const BROOKS = 'Brooks';

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const tag = runTag();
	const digits = String(Date.now()).slice(-7);

	const alina = await newMember(t, admin, { label: 'person-a', name: ALINA, surname: 'Turner', roleId: fx.roles.member, department: `Software Engineering & Architecture ${tag}`, studentNo: `71${digits}` });
	const jonas = await newMember(t, admin, { label: 'person-b', name: JONAS, surname: BROOKS, roleId: fx.roles.member, department: `Industrial Engineering ${tag}`, studentNo: `72${digits}` });
	const talia = await newMember(t, admin, { label: 'person-c', name: 'Talia', surname: 'Morgan', roleId: fx.roles.member, department: `Applied Mathematics ${tag}`, studentNo: `73${digits}` });
	const casey = await newMember(t, admin, { label: 'person-h', name: 'Casey', surname: 'Sullivan', roleId: fx.roles.news, department: `Media Studies ${tag}`, studentNo: `74${digits}` });
	const [aApi, jApi, tApi, cApi] = await Promise.all([alina.api(), jonas.api(), talia.api(), casey.api()]);

	const roleId = must(
		await admin.post('/api/roles', { name: `E2E Directory ${tag}`, color: '#8e8e93', description: 'Has the Member Directory but not Mail', twoStepRequired: false, permissions: { members: 'use', news: 'use', settings: 'use' } }),
		'role'
	).id;
	t.cleanup(() => admin.del('/api/roles', { id: roleId, move: fx.roles.member }));
	const guide = await newMember(t, admin, { label: 'person-r', name: 'Robin', surname: 'Ellis', roleId: roleId });
	const rApi = await guide.api();

	const lookup = async (api, q) => (await api.get(`/api/messages/recipients?q=${encodeURIComponent(q)}`)).json;
	const ids = (body) => (body?.recipients ?? []).map((a) => a.id);

	await t.step('API: found by first name, last name (Turkish letters folded), e-mail, department and student number', async () => {
		t.includes(ids(await lookup(jApi, 'alina')), alina.id, 'first name: a lowercase search finds the member');
		t.includes(ids(await lookup(jApi, 'Al\u0131na')), alina.id, 'first name: a dotless i search finds the member');
		t.includes(ids(await lookup(jApi, 'AL\u0130NA')), alina.id, 'first name: a dotted capital I search finds the member');
		t.includes(ids(await lookup(jApi, 'T\u00fcrner')), alina.id, 'last name: a u-umlaut search finds the member');
		t.includes(ids(await lookup(aApi, 'jonas')), jonas.id, 'first name: a lowercase search finds the member');
		t.includes(ids(await lookup(aApi, 'J\u00f6nas')), jonas.id, 'first name: an o-umlaut search finds the member');
		t.includes(ids(await lookup(aApi, 'brooks')), jonas.id, 'last name: a lowercase search finds the member');
		t.includes(ids(await lookup(aApi, 'talia')), talia.id, 'first name: a lowercase search finds the member');
		t.includes(ids(await lookup(aApi, 'TAL\u0130A')), talia.id, 'first name: a dotted capital I search finds the member');
		t.includes(ids(await lookup(aApi, 'Mor\u011fan')), talia.id, 'last name: a g-breve search finds the member');
		t.includes(ids(await lookup(aApi, 'casey')), casey.id, 'first name: a lowercase search finds the member');
		t.includes(ids(await lookup(aApi, 'Ca\u015fey')), casey.id, 'first name: an s-cedilla search finds the member');
		t.includes(ids(await lookup(aApi, '\u00c7asey')), casey.id, 'first name: a c-cedilla search finds the member');
		t.includes(ids(await lookup(aApi, 'sullivan')), casey.id, 'last name: a lowercase search finds the member');
		t.eq(ids(await lookup(aApi, jonas.email.split('@')[0])), [jonas.id], 'e-mail (prefix): only that person');
		t.eq(ids(await lookup(aApi, jonas.email.toUpperCase())), [jonas.id], 'full e-mail, uppercase');
		t.eq(ids(await lookup(aApi, `Industrial Engineering ${tag}`)), [jonas.id], 'department');
		t.eq(ids(await lookup(aApi, `72${digits}`)), [jonas.id], 'student number');
		t.eq(ids(await lookup(aApi, `industrial engineering ${tag} brooks`)), [jonas.id], 'department + last name (every word must match)');
		t.eq(ids(await lookup(aApi, `industrial engineering ${tag} turner`)), [], "another person's department: no match");
		// The user cannot search for themselves; a role without Mail appears in the list but is marked unreachable.
		t.excludes(ids(await lookup(aApi, 'alina')), alina.id, 'self not in results');
		const h = (await lookup(aApi, `Media Studies ${tag}`)).recipients;
		t.eq(h.map((a) => [a.id, a.reachable]), [[casey.id, false]], 'role without Mail: found, reachable=false');
		t.eq((await lookup(aApi, `Software Engineering & Architecture ${tag}`)).recipients.length, 0, 'searching own department does not return self');
	});

	await t.step('API: search leaks no personal data; wildcard characters are literal', async () => {
		const sample = [await lookup(aApi, jonas.email), await lookup(aApi, `72${digits}`), await lookup(aApi, `Industrial Engineering ${tag}`), await lookup(aApi, 'jonas')];
		for (const body of sample) {
			for (const a of body.recipients) t.eq(Object.keys(a).sort(), ['id', 'name', 'reachable', 'surname'], 'each row has only id, name, surname, reachable');
		}
		// The answer repeats the search text (`q`), which may be the e-mail address itself; the rows are what must not carry it.
		const raw = JSON.stringify(sample.map((body) => body.recipients));
		for (const [secret, what] of [[jonas.email, 'e-mail'], [`72${digits}`, 'student number'], [`Industrial Engineering ${tag}`, 'department'], ['password', 'password field'], ['hash', 'hash field'], ['roleId', 'role id'], ['totp', 'TOTP']]) {
			t.check(!raw.toLowerCase().includes(secret.toLowerCase()), `no ${what} in the response`);
		}
		t.eq(ids(await lookup(aApi, '%')), [], '"%" is not a wildcard');
		t.eq(ids(await lookup(aApi, '_')), [], '"_" is not a wildcard');
		t.eq(ids(await lookup(aApi, '\\')), [], 'backslash is not a wildcard');
		t.eq(ids(await lookup(aApi, "' OR '1'='1")), [], 'SQL fragment is literal text');
		// E-mail/student number cannot be scanned with a short fragment or the domain.
		t.eq(ids(await lookup(aApi, 'e2e.test')), [], 'e-mail domain fragment does not match (prefix match only)');
		t.eq(ids(await lookup(aApi, `72${digits}`.slice(0, 2))), [], 'two characters of the student number do not match');
		const long = await lookup(aApi, 'a'.repeat(300));
		t.eq(long.q.length, 64, 'search text limited to 64 characters');
		// At most 20 people.
		const wide = (await lookup(aApi, 'e')).recipients.length;
		t.check(wide <= 20, `at most 20 results (${wide})`);
		t.eq((await aApi.get(`/api/messages/recipients?id=${encodeURIComponent(jonas.id)}`)).json.recipients.map((a) => a.id), [jonas.id], 'single person by id');
		t.eq((await aApi.get(`/api/messages/recipients?id=${encodeURIComponent(alina.id)}`)).json.recipients, [], 'own id: empty');
		t.eq((await aApi.get('/api/messages/recipients?id=nonexistent')).json.recipients, [], 'nonexistent id: empty');
		const reach = (await aApi.get('/api/messages/recipients?reachable=1')).json;
		t.eq(Object.keys(reach), ['ids'], 'reachable=1 returns only an id list');
		t.includes(reach.ids, jonas.id, 'present in the reachable list');
		t.excludes(reach.ids, casey.id, 'role without Mail absent from the list');
		t.excludes(reach.ids, alina.id, 'self absent');
		// An inactive member is not found.
		const alumni = await newMember(t, admin, { label: 'person-m', name: 'Drew', surname: 'Diaz', roleId: fx.roles.member });
		t.includes(ids(await lookup(aApi, alumni.surname)), alumni.id, 'active member found');
		t.eq((await admin.patch('/api/members', { id: alumni.id, status: 'alumni' })).status, 200, 'member made alumni');
		t.eq(ids(await lookup(aApi, alumni.surname)), [], 'alumni (inactive) not found');
	});

	await t.step('API: role without Mail cannot access any search endpoint (403); no person suggestion appears in search', async () => {
		for (const path of ['/api/messages/recipients', '/api/messages/recipients?q=jonas', `/api/messages/recipients?id=${jonas.id}`, '/api/messages/recipients?reachable=1']) {
			t.eq((await cApi.get(path)).status, 403, `GET ${path} without Mail → 403`);
			t.eq((await rApi.get(path)).status, 403, `Member Directory but no Mail: GET ${path} → 403`);
		}
		const hits = async (api, q) => (await api.get(`/api/search?q=${encodeURIComponent(q)}`)).json?.hits ?? [];
		const compose = (list) => list.filter((h) => h.id.startsWith('compose:'));
		const mine = compose(await hits(aApi, 'brooks'));
		t.eq(mine.map((h) => [h.id, h.kind, h.appId, h.target.section, h.target.itemId]), [[`compose:${jonas.id}`, 'message', 'mail', 'compose', jonas.id]], 'role with Mail: a surname search returns the send-message result');
		t.eq(Object.keys(mine[0] ?? {}).sort(), ['appId', 'id', 'kind', 'score', 'target', 'title'], 'the result carries only the name (no subtitle)');
		t.eq(compose(await hits(aApi, `Media Studies ${tag}`)), [], 'no result for a person whose role does not open Mail');
		t.check(!JSON.stringify(await hits(aApi, jonas.email)).includes(jonas.email), 'searching by e-mail returns no e-mail in the response');
		for (const [who, api] of [['role without Mail', cApi], ['Member Directory but no Mail', rApi]]) {
			t.eq(compose(await hits(api, 'brooks')), [], `${who}: no person message in search`);
		}
		// A role that can open the Member Directory but not Mail sees the first member in directory results, not as a message result.
		t.eq((await hits(rApi, 'brooks')).filter((h) => h.kind === 'message'), [], 'directory user: no message result at all');
	});

	await t.step('API: suggestions are recent contacts; with no correspondence the top of the directory is listed', async () => {
		const empty = await lookup(tApi, '');
		t.eq(empty.suggestion, false, 'with no correspondence, top of directory instead of suggestions');
		t.check(empty.recipients.length > 0 && empty.recipients.length <= 20, 'the list is still non-empty');
		t.eq((await lookup(aApi, '')).suggestion, false, 'alina: no correspondence yet');
		must(await aApi.post('/api/messages', { subject: `Intro ${tag}`, body: 'first', recipients: [jonas.id] }), 'first message');
		await t.sleep(20);
		const first = await lookup(aApi, '');
		t.eq([first.suggestion, ids(first)], [true, [jonas.id]], 'after the first message, the correspondent is suggested');
		await t.sleep(20);
		must(await aApi.post('/api/messages', { subject: `Intro 2 ${tag}`, body: 'second', recipients: [talia.id, jonas.id] }), 'second message');
		const second = await lookup(aApi, '');
		t.eq(second.suggestion, true, 'marked as suggestions');
		t.sameSet(ids(second), [talia.id, jonas.id], 'two people in suggestions');
		t.includes(ids(await lookup(jApi, '')), alina.id, 'the recipient is also offered the person who wrote to them');
	});

	await t.step('UI (alina): search with compose, select with the keyboard, remove with Backspace, multiple recipients, empty results', async () => {
		const { page } = await alina.open();
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-compose]').click();
		const sheet = page.getByRole('dialog', { name: tr('mailComposeTitle') });
		await sheet.waitFor();
		const input = sheet.locator('[data-mail-recipient-input]');
		t.check(await input.evaluate((el) => el === document.activeElement), 'recipient box focused');
		// With an empty box, recent contacts are suggested.
		await sheet.locator('[data-mail-recent]').waitFor();
		t.eq((await sheet.locator('[data-mail-recent]').textContent()).trim(), tr('mailRecent'), 'suggestions heading');
		const recentIds = await sheet.locator('[data-mail-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mail-option')));
		t.sameSet(recentIds, [talia.id, jonas.id], 'suggestions: the two contacts');
		await t.shot(page, 'find-person-suggestions');

		// Search by e-mail, select with arrow key + Enter.
		await input.fill(jonas.email.split('@')[0]);
		const opt = sheet.locator(`[data-mail-option="${jonas.id}"]`);
		await opt.waitFor();
		// The list shows the earlier suggestions until the debounced answer for the typed text arrives.
		await t.waitFor(async () => (await sheet.locator('[data-mail-option]').count()) === 1);
		t.eq(await sheet.locator('[data-mail-option]').count(), 1, 'e-mail: single result');
		t.check(!(await sheet.locator('[data-mail-suggestions]').innerText()).includes(jonas.email), 'the list does not show the e-mail');
		t.eq(await opt.getAttribute('aria-selected'), 'true', 'first reachable result selected');
		await input.press('Enter');
		await sheet.locator(`[data-mail-chip="${jonas.id}"]`).waitFor();
		t.eq(await input.inputValue(), '', 'box cleared after selection');
		// Search by department; an already selected result does not appear again.
		await input.fill(`Applied Mathematics ${tag}`);
		await sheet.locator(`[data-mail-option="${talia.id}"]`).waitFor();
		await input.press('ArrowDown');
		await input.press('Enter');
		await sheet.locator(`[data-mail-chip="${talia.id}"]`).waitFor();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 2, 'two recipients added as chips');
		// Backspace removes the last chip in an empty box; the chip button removes the selected one.
		await input.press('Backspace');
		await sheet.locator(`[data-mail-chip="${talia.id}"]`).waitFor({ state: 'detached' });
		t.eq(await sheet.locator('[data-mail-chip]').count(), 1, 'Backspace removed the last chip');
		await sheet.locator(`[data-mail-chip="${jonas.id}"] button`).click();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 0, 'the chip remove button worked');
		// Search by student number.
		await input.fill(`73${digits}`);
		await sheet.locator(`[data-mail-option="${talia.id}"]`).waitFor();
		await t.waitFor(async () => (await sheet.locator('[data-mail-option]').count()) === 1);
		t.eq(await sheet.locator('[data-mail-option]').count(), 1, 'student number: single result');
		// Role without Mail: visible, faded/disabled, not selectable with Enter, arrow keys do not land on it.
		await input.fill(`Media Studies ${tag}`);
		const closed = sheet.locator(`[data-mail-option="${casey.id}"]`);
		await closed.waitFor();
		t.check(await closed.isDisabled(), 'role without Mail cannot be selected');
		t.eq(await closed.getAttribute('aria-disabled'), 'true', 'aria-disabled');
		t.check((await closed.innerText()).includes(tr('mailUnreachable')), 'reason shown');
		await input.press('Enter');
		t.eq(await sheet.locator('[data-mail-chip]').count(), 0, 'Enter did not select the person without Mail');
		await t.shot(page, 'find-person-disabled');
		// No match.
		await input.fill(`no-such-person-${tag}`);
		await sheet.locator('[data-mail-no-matches]').waitFor();
		t.eq(await sheet.locator('[data-mail-no-matches]').innerText(), tr('mailNoMatches'), 'empty-result message');
		await t.shot(page, 'find-person-empty');
		// Finish: send to both people at once.
		await input.fill('');
		await sheet.locator(`[data-mail-option="${jonas.id}"]`).click();
		await input.fill('talia');
		await sheet.locator(`[data-mail-option="${talia.id}"]`).click();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 2, 'multiple recipients: two chips');
		await sheet.locator('[data-mail-subject]').fill(`Group ${tag}`);
		await sheet.locator('[data-mail-body]').fill('To both of you at once.');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, tr('mailSent'));
		await sheet.waitFor({ state: 'detached' });
		const toJonas = must(await jApi.get('/api/messages?folder=inbox'), 'list').topics.find((k) => k.topic === `Group ${tag}`);
		const toTalia = must(await tApi.get('/api/messages?folder=inbox'), 'list').topics.find((k) => k.topic === `Group ${tag}`);
		t.check(toJonas && toTalia, "landed in both recipients' inboxes");
	});

	await t.step('UI: two members find each other and exchange messages (the first searches for the second, writes; the second replies)', async () => {
		const { page, context: jonasCtx } = await jonas.open();
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-compose]').click();
		const sheet = page.getByRole('dialog', { name: tr('mailComposeTitle') });
		const input = sheet.locator('[data-mail-recipient-input]');
		await input.fill(`Software Engineering & Architecture ${tag}`);
		await sheet.locator(`[data-mail-option="${alina.id}"]`).click();
		await sheet.locator('[data-mail-subject]').fill(`Hello ${tag}`);
		await sheet.locator('[data-mail-body]').fill('I found you through your department.');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, tr('mailSent'));
		const got = must(await aApi.get('/api/messages?folder=inbox'), 'alina inbox').topics.find((k) => k.topic === `Hello ${tag}`);
		t.check(got, 'alina received the message');
		await t.close(jonasCtx);
		const ap = (await alina.open()).page;
		const aWin = await openApp(ap, 'mail');
		await aWin.locator(`[data-mail-thread="${got.id}"]`).click();
		await aWin.locator('[data-mail-reply]').fill('You found me, hello!');
		await aWin.locator('[data-mail-reply-send]').click();
		await toast(ap, tr('mailReplySent'));
		t.eq(must(await jApi.get(`/api/messages/${got.id}`), 'thread').messages.length, 2, 'the first member sees the reply: two messages');
		await t.shot(ap, 'two-way-chat');
	});

	await t.step('UI (alina): send-message action in the Member Directory only on reachable people; clicking opens Mail with the recipient selected', async () => {
		t.eq((await aApi.get('/api/members')).status, 200, 'precondition: alina can open the Member Directory');
		const { page } = await alina.open();
		const dir = await openApp(page, 'members');
		await dir.locator(`[data-focus-id="member:${jonas.id}"]`).waitFor();
		const btn = dir.locator(`[data-member-message="${jonas.id}"]`);
		await btn.waitFor();
		t.eq(await dir.locator(`[data-member-message="${casey.id}"]`).count(), 0, 'no button on a person whose role does not open Mail');
		t.eq(await dir.locator(`[data-member-message="${alina.id}"]`).count(), 0, 'no button on their own row');
		t.eq(await dir.locator(`[data-focus-id="member:${casey.id}"]`).count(), 1, 'that person is still listed (only the button is missing)');
		t.check((await btn.getAttribute('aria-label')).includes(JONAS), 'the button names the person', await btn.getAttribute('aria-label'));
		await t.shot(page, 'directory-send-message');
		await btn.click();
		const mail = page.locator('[data-window-frame=mail]');
		await mail.waitFor();
		const sheet = page.getByRole('dialog', { name: tr('mailComposeTitle') });
		await sheet.locator(`[data-mail-chip="${jonas.id}"]`).waitFor();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 1, 'Mail compose window opened with that recipient selected');
		t.check(await sheet.locator('[data-mail-subject]').evaluate((el) => el === document.activeElement), 'cursor in the subject field');
		await t.shot(page, 'compose-from-directory');
		await sheet.locator('[data-mail-subject]').fill(`FromDirectory ${tag}`);
		await sheet.locator('[data-mail-body]').fill('Sent from the Member Directory.');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, tr('mailSent'));
		t.check(must(await jApi.get('/api/messages?folder=inbox'), 'list').topics.some((k) => k.topic === `FromDirectory ${tag}`), 'the first member received the message');
	});

	await t.step('UI (Spotlight): searching for a person, the send-message result opens Mail with the recipient selected', async () => {
		const { page } = await alina.open();
		await page.locator('[data-dock-app=mail]').waitFor();
		await page.keyboard.press('Control+Space');
		const resultsLabel = tr('spotResultsLabel');
		await page.locator('input[role=combobox][maxlength="120"]').fill(BROOKS.toLowerCase());
		const row = page.locator(`[aria-label="${resultsLabel}"] [role=option]`).filter({ hasText: tr('spotMessageTo', { name: JONAS }) });
		await row.first().waitFor();
		t.eq(await row.count(), 1, 'a single send-message result');
		await t.shot(page, 'spotlight-send-message');
		await row.first().click();
		const sheet = page.getByRole('dialog', { name: tr('mailComposeTitle') });
		await sheet.locator(`[data-mail-chip="${jonas.id}"]`).waitFor();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 1, 'Spotlight: Mail opened with the recipient selected');
	});

	await t.step('Member Directory but no Mail: no button in the directory, no Mail in Dock, Spotlight does not suggest person messages', async () => {
		const { page } = await guide.open();
		const dir = await openApp(page, 'members');
		await dir.locator(`[data-focus-id="member:${jonas.id}"]`).waitFor();
		await page.waitForTimeout(600);
		t.eq(await dir.locator('[data-member-message]').count(), 0, 'no send-message action on any row');
		t.excludes(await dockApps(page), 'mail', 'no Mail in the Dock');
		await page.keyboard.press('Control+Space');
		const resultsLabel = tr('spotResultsLabel');
		await page.locator('input[role=combobox][maxlength="120"]').fill(BROOKS.toLowerCase());
		await page.locator(`[aria-label="${resultsLabel}"] [role=option]`).filter({ hasText: BROOKS }).first().waitFor();
		t.eq(await page.locator(`[aria-label="${resultsLabel}"] [role=option]`).filter({ hasText: tr('membersSendMessage') }).count(), 0, 'Spotlight does not suggest send message');
		await t.shot(page, 'directory-no-mail');
	});

	await t.step('"News Only": neither Member Directory nor Mail (Dock, API, Spotlight)', async () => {
		const { page } = await casey.open();
		await page.locator('[data-dock-app=news]').waitFor();
		const apps = await dockApps(page);
		t.excludes(apps, 'mail', 'no Mail in the Dock');
		t.excludes(apps, 'members', 'no Member Directory in the Dock');
		t.eq((await cApi.get('/api/members')).status, 403, 'GET /api/members → 403');
		t.eq((await cApi.get('/api/messages/recipients?q=brooks')).status, 403, 'GET /api/messages/recipients → 403');
		await page.keyboard.press('Control+Space');
		await page.locator('input[role=combobox][maxlength="120"]').fill(BROOKS.toLowerCase());
		await page.waitForTimeout(700);
		const text = await page.locator(`[aria-label="${tr('spotResultsLabel')}"]`).innerText();
		t.check(!text.includes(BROOKS) && !text.includes(tr('membersSendMessage')), 'Spotlight shows neither the person nor the message');
		await t.shot(page, 'news-no-person');
	});

	await t.step('mobile: person search and selection work', async () => {
		const { page } = await alina.open({ mobile: true });
		await showLauncherApps(page);
		await page.locator('[data-launcher-app=mail]').click();
		await page.getByRole('button', { name: tr('mailBack') }).waitFor();
		await t.shot(page, 'mobile-mail');
		const win = page.locator('[data-mail-app]');
		await win.locator('[data-mail-compose]').waitFor();
		await win.locator('[data-mail-compose]').click();
		const sheet = page.getByRole('dialog', { name: tr('mailComposeTitle') });
		await sheet.locator('[data-mail-recipient-input]').fill('brooks');
		await sheet.locator(`[data-mail-option="${jonas.id}"]`).click();
		await sheet.locator(`[data-mail-chip="${jonas.id}"]`).waitFor();
		await t.shot(page, 'mobile-find-person');
	});
}
