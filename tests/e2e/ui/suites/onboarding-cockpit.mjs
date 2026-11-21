// Student-first flow: the phone cockpit (bottom navigation, quick actions) and the team
// showcase of a member without a role (application + captain reply arrive without a page reload).
import { makeTeam } from '../lib/team.mjs';
import { makeEvent, sweepEvents } from '../lib/event.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Mobile cockpit and team application from a member without a role' };

const overflowOf = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const ege = await t.api('ege');
	const can = await t.api('can');
	const reader = await t.api('reader');
	await sweepEvents(admin);

	// A team of our own, open to everyone: the showcase must still turn a join into an application.
	const team = await makeTeam(t, admin, { label: 'Cockpit', leadId: fx.users.ege.id, participationType: 'open' });
	const event = await makeEvent(t, admin, { label: 'Cockpit', startMin: -10, lengthMin: 90 });
	const taskTitle = 'Cockpit test task';

	await t.step('cockpit: bottom navigation and four tabs (can, 390×844)', async () => {
		const { page } = await t.open('can', { mobile: true });
		await page.locator('[data-mobile-nav]').waitFor();
		t.eq(await page.locator('[data-mobile-nav] [data-mobile-tab]').evaluateAll((els) => els.map((e) => e.dataset.mobileTab)), ['home', 'apps', 'teams', 'profile'], 'four tabs: Home, Apps, Teams, Profile');
		t.eq(await page.locator('[data-mobile-tab=home]').getAttribute('aria-current'), 'page', 'Home tab selected on load');
		t.check((await page.locator('[data-mobile-tab=apps]').boundingBox()).height >= 44, 'tabs are finger-sized (≥44px)');
		t.eq(await page.locator('[data-cockpit=xp]').count(), 1, 'cockpit has a level/XP card');
		t.eq(await page.locator('[data-cockpit=checkin], [data-cockpit=tasks], [data-cockpit=event]').count(), 3, 'three quick-action cards: QR check-in, my tasks, upcoming event');
		t.check((await overflowOf(page)) <= 0, 'no horizontal overflow in the cockpit');
		await t.shot(page, 'cockpit');

		await page.locator('[data-mobile-tab=apps]').click();
		await page.locator('[data-launcher-app=teams]').waitFor();
		t.eq(await page.locator('[data-mobile-tab=apps]').getAttribute('aria-current'), 'page', 'Apps tab is selected');

		await page.locator('[data-mobile-tab=teams]').click();
		await page.locator(`[data-team-id="${team.id}"]`).waitFor();
		t.check(await page.locator(`[data-team-id="${team.id}"]`).isVisible(), 'Teams tab shows the showcase');
		t.check(await page.locator('[data-mobile-action=open-teams]').isVisible(), 'a role with the Teams app sees the open-app button');
		t.check((await overflowOf(page)) <= 0, 'no horizontal overflow on the Teams tab');
		await t.shot(page, 'teams-tab');

		await page.locator('[data-mobile-tab=profile]').click();
		await page.locator('[data-mobile-profile]').waitFor();
		t.eq(await page.locator('[data-mobile-profile] [data-role-badge="Member"]').count(), 1, 'role badge on the profile');
		await page.locator('[data-badge]').first().waitFor();
		t.check((await page.locator('[data-badge]').count()) >= 1, 'badges are listed on the profile');
		t.check((await overflowOf(page)) <= 0, 'no horizontal overflow on the profile');
		await t.shot(page, 'profile');

		await page.locator('[data-mobile-action=settings]').click();
		await page.getByRole('button', { name: tr('back') }).waitFor();
		await page.getByRole('button', { name: tr('back') }).click();
		await page.locator('[data-mobile-profile]').waitFor();
		t.eq(await page.locator('[data-mobile-tab=profile]').getAttribute('aria-current'), 'page', 'returns to the same tab after leaving the app');
	});

	await t.step('cockpit: my tasks and the upcoming event come from real data', async () => {
		t.eq((await can.post('/api/teams', { action: 'join', teamId: team.id })).status, 200, 'can joined the open team');
		const task = await ege.post('/api/teams', { action: 'addTask', teamId: team.id, title: taskTitle, assigneeMemberId: fx.users.can.id });
		t.eq(task.status, 200, 'the captain assigned the task to can', JSON.stringify(task.json));

		const { page } = await t.open('can', { mobile: true });
		const card = page.locator('[data-cockpit=tasks]');
		await card.getByText(taskTitle).waitFor();
		t.check((await card.innerText()).includes(team.name), 'the task card shows the team name');
		const ev = page.locator('[data-cockpit=event]');
		await ev.getByText(event.title).waitFor();
		t.includes(await ev.innerText(), tr('mobEventLive'), 'the started event says it is currently in progress');
		await t.shot(page, 'cockpit-data');

		// Live: when the captain marks the task done, the card updates without a page reload.
		const doneTask = (await can.get(`/api/teams?teamId=${team.id}`)).json.tasks.find((g) => g.title === taskTitle);
		t.eq((await ege.post('/api/teams', { action: 'updateTask', taskId: doneTask.id, status: 'done' })).status, 200, 'task marked done');
		const ms = await t.waitFor(async () => (await card.getByText(taskTitle).count()) === 0, { timeout: 15_000 });
		t.check(ms >= 0, `completed task disappeared from the card live (${ms} ms)`);

		// QR check-in: a single tap opens the scanner/manual code screen.
		await page.locator('[data-cockpit=checkin]').click();
		await page.getByText(tr('evScanTitleMember')).waitFor();
		t.check(await page.getByText(tr('evScanTitleMember')).isVisible(), 'QR check-in screen opened');
		await t.shot(page, 'qr-checkin');
	});

	await t.step('member without a role (mobile): application from the showcase → captain approval arrives live', async () => {
		t.cleanup(() => admin.patch('/api/members', { id: fx.users.reader.id, roleId: fx.roles.news }));
		t.eq((await admin.patch('/api/members', { id: fx.users.reader.id, roleId: null })).status, 200, "reader's role removed");

		const { page } = await t.open('reader', { mobile: true });
		const notice = page.locator('[data-no-role-notice]');
		await notice.waitFor();
		const card = notice.locator(`[data-team-id="${team.id}"]`);
		await card.waitFor();
		t.check(await card.isVisible(), 'team showcase opens for the member without a role');
		t.check((await card.innerText()).includes(tr('tmCaptain')), 'the card shows the captain name');
		t.check((await overflowOf(page)) <= 0, 'no horizontal overflow');
		await t.shot(page, 'no-role-showcase');

		await card.getByRole('button', { name: tr('tmApply') }).click();
		await card.getByRole('button', { name: 'C++' }).click();
		await card.getByRole('button', { name: 'ROS2' }).click();
		t.eq(await card.getByRole('button', { name: 'C++' }).getAttribute('aria-pressed'), 'true', 'the selected expertise is marked');
		await card.locator('textarea').fill('I am interested in rocket avionics.');
		await t.shot(page, 'no-role-application-form');
		await card.getByRole('button', { name: tr('tmSendApplication') }).click();
		await card.getByText(tr('obApplied')).waitFor();
		t.check(true, 'application sent, the card says it is with the captain');

		const board = (await ege.get(`/api/teams?teamId=${team.id}`)).json;
		const app = board.applications.find((b) => b.userId === fx.users.reader.id);
		t.check(!!app, 'recorded as an application even to an open team (did not become a member)');
		t.eq(app?.applicationNote, 'Expertise: C++, ROS2\nI am interested in rocket avionics.', 'the captain sees the note and expertise tags');
		t.check(!board.members.some((u) => u.userId === fx.users.reader.id), 'the applicant is not a member yet');

		// Withdraw the application, then re-apply → the captain approves → the card updates live.
		await card.getByRole('button', { name: tr('tmWithdraw') }).click();
		await card.getByRole('button', { name: tr('tmApply'), exact: true }).waitFor();
		t.check(true, 'the apply button returned after withdrawing');
		t.eq((await reader.post('/api/teams/discover', { action: 'apply', teamId: team.id })).status, 200, 're-application');
		await card.getByText(tr('obApplied')).waitFor();
		t.eq((await ege.post('/api/teams', { action: 'approve', teamId: team.id, userId: fx.users.reader.id })).status, 200, 'the captain approved');
		const ms = await t.waitFor(async () => (await card.getByText(tr('obAccepted')).count()) === 1, { timeout: 15_000 });
		t.check(ms >= 0, `approval appeared on the card without a page reload (${ms} ms)`);
		await t.shot(page, 'no-role-accepted');
	});

	await t.step('member without a role (desktop): showcase below the notice card', async () => {
		const { page } = await t.open('reader');
		const notice = page.locator('[data-no-role-notice]');
		await notice.waitFor();
		t.eq(await notice.locator('[data-onboarding-teams]').count(), 1, 'the notice card contains the showcase');
		t.eq(await page.locator('[data-no-role-settings]').count(), 1, 'the Settings button is present');
		const box = await notice.boundingBox();
		t.check(box.y >= 0 && box.y + box.height <= 900, 'the card stays inside the screen', JSON.stringify(box));
		await t.shot(page, 'no-role-desktop-showcase');
	});
}
