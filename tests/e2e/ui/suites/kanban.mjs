// Kanban (Teams → Task Board): creating tasks, drag and drop, assignment, checklist,
// comments, activity history, filters, and deletion. Captain and member permissions: kanban-permissions.mjs.
import { answerDialog, dateInput, drag, openTeam, refreshBoard, stepper, toast } from '../lib/ui-shared.mjs';
import { makeTeam, addTask, readTeam, readTask, sweepStale, xpOf } from '../lib/team.mjs';
import { newMember } from '../lib/membership.mjs';
import { tr, trf } from '../lib/locale.mjs';

export const meta = { title: 'Kanban: task creation, drag and drop, assignment, checklist, comments' };

const COLUMN = { todo: tr('kbColTodo'), in_progress: tr('kbColDoing'), review: tr('kbColReview'), done: tr('kbColDone') };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');

	await sweepStale(admin);

	// Own team: one captain and one member who owns tasks.
	const captain = await newMember(t, admin, { label: 'captain', roleId: fx.roles.member });
	const worker = await newMember(t, admin, { label: 'member', roleId: fx.roles.member });
	const team = await makeTeam(t, admin, { label: 'Kanban', leadId: captain.id });
	await (await worker.api()).post('/api/teams', { action: 'join', teamId: team.id });

	const { page, context: adminCtx } = await t.open('admin');
	const win = await openTeam(page, team.id);
	const step = stepper(t, page);
	const card = (title) => win.locator('[data-task-id]').filter({ hasText: title });
	const column = (id) => win.locator(`section[aria-label="${COLUMN[id]}"]`);
	const tasksOf = async () => (await readTeam(admin, team.id)).tasks;
	const byTitle = async (title) => (await tasksOf()).find((g) => g.title === title);
	const description = 'Acceptance criteria go here.';
	const labelInput = 'Front End';
	const taskLabel = 'front-end';
	const checklistItems = ['Sketch the draft', 'Code it', 'Review it'];
	const firstComment = 'First comment';
	const secondComment = 'Second comment';
	const editedDescription = 'New description text.';
	const historyPattern = (key) =>
		new RegExp(
			tr(key)
				.split(/\{[^}]+\}/)
				.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('.+')
		);

	await step('empty board: four columns, counters at zero', async () => {
		t.sameSet(await win.locator('section[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))), Object.values(COLUMN), 'four columns exist');
		t.eq(await win.locator('[data-task-id]').count(), 0, 'board is empty');
		t.check(await win.getByText(tr('kbEmptyColumn')).count() === 4, 'every column shows the empty-board message');
		await t.shot(page, 'empty-board');
	});

	const title = `Kanban task ${Date.now().toString(36)}`;
	await step('create a task from the new-task form (description, priority, assignee, due date, label)', async () => {
		await win.getByRole('button', { name: tr('teamsAddTask') }).click();
		const dlg = page.getByRole('dialog', { name: tr('teamsAddTask') });
		await dlg.getByLabel(tr('evFieldTitle')).fill(title);
		await dlg.getByLabel(tr('description')).fill(description);
		await dlg.getByLabel(tr('kbAssignee')).selectOption(worker.id);
		await dlg.getByLabel(tr('kbDue')).fill(dateInput(5));
		await dlg.getByRole('radio', { name: tr('teamsPriorityHigh') }).click();
		const labels = dlg.getByPlaceholder(tr('kbLabelsPh'));
		await labels.fill(labelInput);
		await labels.press('Enter');
		await dlg.getByRole('button', { name: tr('kbCreate') }).click();
		await dlg.waitFor({ state: 'detached' });
		await card(title).waitFor();
		const stored = await byTitle(title);
		t.check(Boolean(stored), 'task is stored in the API');
		t.eq(stored?.status, 'todo', 'initial column is to do');
		t.eq(stored?.priority, 'high', 'priority is high');
		t.eq(stored?.assigneeMemberId, worker.id, 'assigned member');
		t.eq(stored?.tags, [taskLabel], 'tag was lowercased and hyphenated');
		t.check(stored?.dueDate > Date.now(), 'due date is in the future');
		t.check(Boolean(stored?.creatorId), 'creator is recorded');
		t.check(await card(title).getByText(`#${taskLabel}`).count() === 1, 'tag appears on the card');
		t.check(await card(title).getByText(tr('teamsPriorityHigh')).count() === 1, 'priority badge on the card');
		t.check(await column('todo').locator('[data-task-id]').filter({ hasText: title }).count() === 1, 'card is in the to-do column');
		await t.shot(page, 'task-created');
	});

	await step('a task cannot be created with an empty title', async () => {
		await win.getByRole('button', { name: tr('teamsAddTask') }).click();
		const dlg = page.getByRole('dialog', { name: tr('teamsAddTask') });
		t.check(await dlg.getByRole('button', { name: tr('kbCreate') }).isDisabled(), 'create button is disabled without a title');
		await dlg.getByRole('button', { name: tr('acEmailChangeCancel') }).click();
		await dlg.waitFor({ state: 'detached' });
	});

	const doingTitle = `From in-progress column ${Date.now().toString(36)}`;
	await step('the column "+" button opens the task in that column; an unassigned task goes to the pool', async () => {
		await column('in_progress').getByRole('button', { name: tr('kbAddHere') }).click();
		const dlg = page.getByRole('dialog', { name: tr('teamsAddTask') });
		t.eq(await dlg.getByLabel(tr('kbColumn')).inputValue(), 'in_progress', 'column selection is in progress');
		t.check(await dlg.getByText(tr('kbPoolHint')).count() === 1, 'pool hint is visible');
		await dlg.getByLabel(tr('evFieldTitle')).fill(doingTitle);
		await dlg.getByRole('button', { name: tr('kbCreate') }).click();
		await dlg.waitFor({ state: 'detached' });
		await card(doingTitle).waitFor();
		const stored = await byTitle(doingTitle);
		t.eq(stored?.status, 'in_progress', 'task was stored in the in-progress column');
		t.eq(stored?.assigneeMemberId, null, 'no assignee (pool)');
	});

	await step('drag and drop: the card moves to another column and persists', async () => {
		await drag(page, card(title), column('review'));
		await column('review').locator('[data-task-id]').filter({ hasText: title }).waitFor();
		const ok = await t.waitFor(async () => (await byTitle(title))?.status === 'review');
		t.check(ok >= 0, 'status became review on the server');
		await refreshBoard(page);
		t.check(await column('review').locator('[data-task-id]').filter({ hasText: title }).count() === 1, 'card is still in review after reloading from the server');
		await t.shot(page, 'drag-and-drop');
	});

	await step('drag and drop: ordering changes within the same column', async () => {
		const a = await addTask(admin, team.id, { title: `Order A ${Date.now().toString(36)}`, status: 'done' });
		const b = await addTask(admin, team.id, { title: `Order B ${Date.now().toString(36)}`, status: 'done' });
		await refreshBoard(page);
		const col = column('done');
		await col.locator(`[data-task-id="${a.id}"]`).waitFor();
		const order = async () => col.locator('[data-task-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-task-id')));
		const before = await order();
		const [first, second] = before.filter((id) => id === a.id || id === b.id);
		// Drop the second one onto the first.
		const target = col.locator(`[data-task-id="${first}"]`);
		const box = await target.boundingBox();
		await drag(page, col.locator(`[data-task-id="${second}"]`), target, { x: box.width / 2, y: 4 });
		const moved = await t.waitFor(async () => (await order()).filter((id) => id === a.id || id === b.id)[0] === second);
		t.check(moved >= 0, 'order changed on screen');
		// The board updates optimistically (screen first, request last): wait for the record to land for the server state.
		let stored = await tasksOf();
		const orderOf = (id) => stored.find((g) => g.id === id)?.order;
		await t.waitFor(async () => {
			stored = await tasksOf();
			return orderOf(second) < orderOf(first);
		}, { timeout: 5000, every: 150 });
		t.check(orderOf(second) < orderOf(first), 'the order also changed on the server', `${orderOf(second)} < ${orderOf(first)}`);
		await admin.post('/api/teams', { action: 'deleteTask', taskId: a.id });
		await admin.post('/api/teams', { action: 'deleteTask', taskId: b.id });
	});

	await step('arrow buttons and Alt+arrow: move one column left/right', async () => {
		const target = card(title);
		await target.hover();
		await target.getByRole('button', { name: tr('kbMoveLeft') }).click();
		await column('in_progress').locator('[data-task-id]').filter({ hasText: title }).waitFor();
		await t.waitFor(async () => (await byTitle(title))?.status === 'in_progress', { timeout: 5000, every: 150 });
		t.eq((await byTitle(title))?.status, 'in_progress', 'left button: in progress');
		await card(title).focus();
		await page.keyboard.press('Alt+ArrowRight');
		await column('review').locator('[data-task-id]').filter({ hasText: title }).waitFor();
		await t.waitFor(async () => (await byTitle(title))?.status === 'review', { timeout: 5000, every: 150 });
		t.eq((await byTitle(title))?.status, 'review', 'Alt+→: review');
	});

	await step('task page: details, changing the assignee, and activity history', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		t.check(await sheet.getByText(description).count() === 1, 'description is visible');
		const assignee = sheet.locator('aside select').nth(1);
		await assignee.selectOption('');
		await t.waitFor(async () => (await byTitle(title))?.assigneeMemberId === null);
		t.eq((await byTitle(title))?.assigneeMemberId, null, 'assignee was cleared');
		await assignee.selectOption(captain.id);
		await t.waitFor(async () => (await byTitle(title))?.assigneeMemberId === captain.id);
		t.eq((await byTitle(title))?.assigneeMemberId, captain.id, 'task assigned to the captain');
		const log = await sheet.locator('ul li').allInnerTexts();
		t.check(log.some((l) => historyPattern('kbActMoved').test(l)), 'history contains a move', log.join(' | '));
		t.check(log.some((l) => historyPattern('kbActAssigned').test(l) || historyPattern('kbActUnassigned').test(l)), 'history contains an assignment', log.join(' | '));
		await t.shot(page, 'task-sheet');
		await sheet.getByRole('button', { name: tr('kbClose') }).click();
	});

	await step('task page: editing title, description, priority, label, and due date', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		await sheet.getByRole('radio', { name: tr('kbPrioCritical') }).click();
		await t.waitFor(async () => (await byTitle(title))?.priority === 'critical');
		t.eq((await byTitle(title))?.priority, 'critical', 'priority became critical');
		const label = sheet.getByPlaceholder(tr('kbLabelsPh'));
		await label.fill('urgent');
		await label.press('Enter');
		await t.waitFor(async () => (await byTitle(title))?.tags.includes('urgent'));
		t.includes((await byTitle(title)).tags, 'urgent', 'label added');
		await sheet.getByRole('button', { name: trf('tmRemoveLabelAria', { label: taskLabel }) }).click();
		await t.waitFor(async () => !(await byTitle(title))?.tags.includes(taskLabel));
		t.eq((await byTitle(title)).tags, ['urgent'], 'label removed');
		await sheet.getByRole('button', { name: tr('kbEdit') }).click();
		await sheet.locator('textarea').first().fill(editedDescription);
		await sheet.getByRole('button', { name: tr('kbSave') }).click();
		await t.waitFor(async () => (await byTitle(title))?.description === editedDescription);
		t.eq((await byTitle(title)).description, editedDescription, 'description was saved');
		const due = sheet.locator('input[type=date]');
		await due.fill(dateInput(9));
		await t.waitFor(async () => (await byTitle(title))?.dueDate > Date.now() + 8 * 86_400_000);
		t.check((await byTitle(title)).dueDate > Date.now() + 8 * 86_400_000, 'due date updated');
		await sheet.getByRole('button', { name: tr('kbClose') }).click();
	});

	await step('checklist: adding, checking, card counter, deleting', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		const input = sheet.getByPlaceholder(tr('kbChecklistPh'));
		for (const text of checklistItems) {
			await input.fill(text);
			await sheet.getByRole('button', { name: tr('kbAdd'), exact: true }).click();
			await sheet.getByText(text, { exact: true }).waitFor();
		}
		t.eq(await sheet.locator('input[type=checkbox]').count(), 3, 'three items');
		await sheet.locator('input[type=checkbox]').nth(0).check();
		await sheet.locator('input[type=checkbox]').nth(1).check();
		const detail = async () => (await readTask(admin, (await byTitle(title)).id)).json;
		await t.waitFor(async () => (await detail()).items.filter((m) => Number(m.isDone) === 1).length === 2);
		const d = await detail();
		t.eq(d.items.filter((m) => Number(m.isDone) === 1).length, 2, 'two items completed on the server');
		await t.waitFor(async () => (await sheet.getByText('2/3').count()) >= 1, { timeout: 3000, every: 50 });
		t.check(await sheet.getByText('2/3').count() >= 1, 'page shows 2/3');
		await sheet.locator('label').filter({ hasText: checklistItems[2] }).getByRole('button', { name: tr('delete'), exact: true }).click();
		await t.waitFor(async () => (await detail()).items.length === 2);
		t.eq((await detail()).items.length, 2, 'item deleted');
		await sheet.getByRole('button', { name: tr('kbClose') }).click();
		t.check(await card(title).getByText(/\d\/2/).count() === 1, 'checklist counter on the card face (x/2)');
		const inbox = (await detail()).activity.map((a) => a.type);
		t.includes(inbox, 'item_added', 'history contains item_added');
		t.includes(inbox, 'item_completed', 'history contains item_completed');
	});

	await step('comments: writing, counter, deleting one\'s own comment', async () => {
		await card(title).click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		t.check(await sheet.getByText(tr('kbNoComments')).count() === 1, 'no comments initially');
		const box = sheet.getByPlaceholder(tr('kbCommentPh'));
		await box.fill(firstComment);
		await sheet.getByRole('button', { name: tr('kbSend') }).click();
		await sheet.locator('[data-comment-id]').filter({ hasText: firstComment }).waitFor();
		await box.fill(secondComment);
		// Typed while the first comment is still being saved: the text must survive that save
		// (it used to be wiped). A send while busy is ignored, so wait for the button.
		t.check((await t.waitFor(() => sheet.getByRole('button', { name: tr('kbSend') }).isEnabled())) >= 0, 'the text typed while the first comment was being saved was not wiped');
		await box.press('Control+Enter');
		await sheet.locator('[data-comment-id]').filter({ hasText: secondComment }).waitFor();
		const detail = async () => (await readTask(admin, (await byTitle(title)).id)).json;
		t.eq((await detail()).comments.length, 2, 'two comments stored');
		await sheet.locator('[data-comment-id]').filter({ hasText: firstComment }).getByRole('button', { name: tr('delete'), exact: true }).click();
		await answerDialog(page);
		await t.waitFor(async () => (await detail()).comments.length === 1);
		t.eq((await detail()).comments.length, 1, 'comment deleted');
		await sheet.getByRole('button', { name: tr('kbClose') }).click();
		t.check(await card(title).locator(`[title="${tr('kbComments')}"]`).count() === 1, 'comment counter on the card');
	});

	await step('completing a task grants +100 XP (once)', async () => {
		const mine = await addTask(admin, team.id, { title: `XP task ${Date.now().toString(36)}`, assigneeMemberId: worker.id });
		const api = await worker.api();
		const before = await xpOf(api);
		await refreshBoard(page);
		await card(mine.title).waitFor();
		await drag(page, card(mine.title), column('done'));
		await toast(page, '+100 XP');
		t.eq(await xpOf(api), before + 100, 'task owner earned 100 XP');
		// Undoing and completing again does not grant XP a second time.
		await admin.post('/api/teams', { action: 'updateTask', taskId: mine.id, status: 'in_progress' });
		const again = await admin.post('/api/teams', { action: 'updateTask', taskId: mine.id, status: 'done' });
		t.eq(again.json?.xpGiven, false, 'no XP was granted on the second completion');
		t.eq(await xpOf(api), before + 100, 'XP did not change');
	});

	await step('filters: search, mine, unassigned, priority, label, sorting', async () => {
		await win.getByPlaceholder(tr('kbSearch')).fill(doingTitle);
		t.eq(await win.locator('[data-task-id]').count(), 1, 'search finds one card');
		await win.getByPlaceholder(tr('kbSearch')).fill('no-task-matches-this');
		t.check(await win.getByText(tr('kbNoMatch')).count() === 1, 'warning shown when nothing matches');
		await win.getByRole('button', { name: tr('kbClearFilters') }).click();
		t.check(await win.locator('[data-task-id]').count() >= 3, 'cards returned after clearing the filter');
		await win.getByRole('button', { name: tr('kbFilterPool'), exact: true }).click();
		t.check(await win.locator('[data-task-id]').filter({ hasText: doingTitle }).count() === 1, 'unassigned: the pooled task is present');
		t.eq(await win.locator('[data-task-id]').filter({ hasText: title }).count(), 0, 'unassigned: the task assigned to the captain is hidden');
		await win.getByRole('button', { name: tr('all'), exact: true }).click();
		await win.getByLabel(tr('teamsTaskPriority')).selectOption('critical');
		t.check(await win.locator('[data-task-id]').filter({ hasText: title }).count() === 1, 'critical filter: matching task visible');
		t.eq(await win.locator('[data-task-id]').filter({ hasText: doingTitle }).count(), 0, 'critical filter: others hidden');
		await win.getByLabel(tr('teamsTaskPriority')).selectOption('');
		await win.getByLabel(tr('kbLabels')).selectOption('urgent');
		t.eq(await win.locator('[data-task-id]').count(), 1, 'label filter: one card');
		await win.getByLabel(tr('kbLabels')).selectOption('');
		await win.getByLabel('Sort').selectOption('priority');
		const order = await column('review').locator('[data-task-id]').allInnerTexts();
		t.check(order.length >= 1, 'cards remain under priority sorting');
		await win.getByLabel('Sort').selectOption('manual');
	});

	await step('task deletion: confirmation is required and the card and record disappear', async () => {
		const victim = await addTask(admin, team.id, { title: `Deletable task ${Date.now().toString(36)}` });
		await refreshBoard(page);
		await card(victim.title).click();
		const sheet = page.getByRole('dialog', { name: victim.title });
		await sheet.getByRole('button', { name: tr('kbDelete') }).click();
		await answerDialog(page, false);
		t.check(await byTitle(victim.title) !== undefined, 'task remains after cancelling');
		await sheet.getByRole('button', { name: tr('kbDelete') }).click();
		await answerDialog(page);
		await sheet.waitFor({ state: 'detached' });
		t.eq(await card(victim.title).count(), 0, 'card removed from the board');
		t.eq(await byTitle(victim.title), undefined, 'record deleted');
	});
	await t.close(adminCtx);

	await t.step('unauthorized role: a news-only user cannot see teams or tasks', async () => {
		const reader = await t.api('reader');
		const list = await reader.get('/api/teams');
		t.eq(list.status, 403, 'GET /api/teams 403');
		const task = (await tasksOf())[0];
		const detail = await readTask(reader, task.id);
		t.eq(detail.status, 403, 'task detail 403');
		const add = await reader.post('/api/teams', { action: 'addTask', teamId: team.id, title: 'intrusion' });
		t.eq(add.status, 403, 'adding a task 403');
		const { page: readerPage } = await t.open('reader');
		t.eq(await readerPage.locator('[data-dock-app=teams]').count(), 0, 'no Teams app in the dock');
	});
}
