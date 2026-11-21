// Kanban permissions: the captain manages the board; a member only moves/checks their own task,
// claims tasks from the pool, and comments on anyone's task; an outsider cannot see the board; a
// captain of another team cannot touch this team's task; alumni are read-only.
import { drag, openTeam, refreshBoard, stepper } from '../lib/ui-shared.mjs';
import { addTask, makeTeam, readTask, readTeam, sweepStale } from '../lib/team.mjs';
import { newMember } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Kanban: captain and member permissions' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);

	const member = fx.roles.member;
	const captain = await newMember(t, admin, { label: 'captain', roleId: member });
	const ali = await newMember(t, admin, { label: 'alice', roleId: member });
	const bek = await newMember(t, admin, { label: 'bob', roleId: member });
	const outsider = await newMember(t, admin, { label: 'outsider', roleId: member });
	const captain2 = await newMember(t, admin, { label: 'captain2', roleId: member });
	const team = await makeTeam(t, admin, { label: 'Permission', leadId: captain.id });
	const team2 = await makeTeam(t, admin, { label: 'Permission2', leadId: captain2.id });
	const [aliApi, bekApi, outApi, cap2Api, capApi] = await Promise.all([ali.api(), bek.api(), outsider.api(), captain2.api(), captain.api()]);
	await aliApi.post('/api/teams', { action: 'join', teamId: team.id });
	await bekApi.post('/api/teams', { action: 'join', teamId: team.id });

	const aliTask = await addTask(capApi, team.id, { title: `Alice task ${Date.now().toString(36)}`, assigneeMemberId: ali.id });
	const bekTask = await addTask(capApi, team.id, { title: `Bob task ${Date.now().toString(36)}`, assigneeMemberId: bek.id });
	const poolTask = await addTask(capApi, team.id, { title: `Pool task ${Date.now().toString(36)}` });
	const myItem = 'My item';
	const question = 'Question from Alice';
	const aliceDescription = 'Alice updated the description.';
	const statusOf = async (id) => (await readTeam(admin, team.id)).tasks.find((g) => g.id === id)?.status;

	await t.step('captain (API): adds, assigns, moves, and deletes another member\'s task', async () => {
		const extra = await addTask(capApi, team.id, { title: 'Captain temporary task', assigneeMemberId: bek.id });
		t.eq(extra.assigneeMemberId, bek.id, 'captain assigned the task to a team member');
		t.eq((await capApi.post('/api/teams', { action: 'updateTask', taskId: extra.id, status: 'in_progress' })).status, 200, 'captain moved another member\'s task');
		t.eq((await capApi.patch(`/api/teams/tasks/${extra.id}`, { title: 'New name', priority: 'critical' })).status, 200, 'captain changed the title/priority');
		const outsiderAssign = await capApi.post('/api/teams', { action: 'addTask', teamId: team.id, title: 'outsider task', assigneeMemberId: outsider.id });
		t.eq(outsiderAssign.status, 400, 'a task cannot be assigned to a non-member (400)');
		t.eq((await capApi.post('/api/teams', { action: 'deleteTask', taskId: extra.id })).status, 200, 'captain deleted the task');
	});

	await t.step('captain (UI): new-task button, column "+", and settings tab exist; captain drags a card', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, team.id);
		t.eq(await win.getByRole('button', { name: tr('teamsAddTask') }).count(), 1, 'create-task button is present');
		t.eq(await win.getByRole('button', { name: tr('kbAddHere') }).count(), 4, 'every column has a "+"');
		t.check(await win.locator('nav').getByText(tr('tmTabSettings')).count() === 1, 'settings tab is present');
		t.eq(await win.locator(`[data-task-id="${bekTask.id}"]`).getAttribute('draggable'), 'true', 'another member\'s card is draggable for the captain');
		await drag(page, win.locator(`[data-task-id="${bekTask.id}"]`), win.locator(`section[aria-label="${tr('kbColDoing')}"]`));
		await t.waitFor(async () => (await statusOf(bekTask.id)) === 'in_progress');
		t.eq(await statusOf(bekTask.id), 'in_progress', 'captain dragged Bob\'s task');
		await t.shot(page, 'kaptan-pano');
	});

	await t.step('member (UI): no add buttons; only their own card is draggable', async () => {
		const { page } = await ali.open();
		const win = await openTeam(page, team.id);
		t.eq(await win.getByRole('button', { name: tr('teamsAddTask') }).count(), 0, 'no create-task button');
		t.eq(await win.getByRole('button', { name: tr('kbAddHere') }).count(), 0, 'no column "+" buttons');
		t.check(await win.getByText(tr('kbOnlyManagers')).count() === 1, 'captain/management-only hint shown');
		t.eq(await win.locator('nav').getByText(tr('tmTabSettings')).count(), 0, 'no settings tab');
		t.eq(await win.locator('nav').getByText(tr('teamsTreasuryTab')).count(), 0, 'no project vault tab');
		t.eq(await win.locator(`[data-task-id="${aliTask.id}"]`).getAttribute('draggable'), 'true', 'own card is draggable');
		t.eq(await win.locator(`[data-task-id="${bekTask.id}"]`).getAttribute('draggable'), 'false', 'another member\'s card is not draggable');
		t.eq(await win.locator(`[data-task-id="${bekTask.id}"]`).getByRole('button', { name: new RegExp(`${tr('kbMoveLeft')}|${tr('kbMoveRight')}`) }).count(), 0, 'no move arrows on another member\'s card');
		// Trying to drag someone else's card changes nothing.
		await drag(page, win.locator(`[data-task-id="${bekTask.id}"]`), win.locator(`section[aria-label="${tr('kbColReview')}"]`));
		await page.waitForTimeout(500);
		t.eq(await statusOf(bekTask.id), 'in_progress', 'another member\'s task stayed in place');
		await drag(page, win.locator(`[data-task-id="${aliTask.id}"]`), win.locator(`section[aria-label="${tr('kbColReview')}"]`));
		await t.waitFor(async () => (await statusOf(aliTask.id)) === 'review');
		t.eq(await statusOf(aliTask.id), 'review', 'member dragged their own task');
		await t.shot(page, 'uye-pano');
	});

	await t.step('member (UI): checklist and description are editable on their own task; title/priority/due/assignee are locked and there is no delete', async () => {
		const { page } = await ali.open();
		const win = await openTeam(page, team.id);
		const step = stepper(t, page);
		await step('own task', async () => {
			await win.locator(`[data-task-id="${aliTask.id}"]`).click();
			const sheet = page.getByRole('dialog', { name: aliTask.title });
			await sheet.waitFor();
			t.check(await sheet.getByLabel(tr('evFieldTitle')).isDisabled(), 'title field is disabled');
			t.check(await sheet.getByRole('radio', { name: tr('kbPrioCritical') }).isDisabled(), 'priority selection is disabled');
			t.check(await sheet.locator('input[type=date]').isDisabled(), 'due date is disabled');
			t.eq(await sheet.locator('aside select').count(), 1, 'no assignee select (status select only)');
			t.eq(await sheet.getByRole('button', { name: tr('kbDelete') }).count(), 0, 'no delete-task action');
			const input = sheet.getByPlaceholder(tr('kbChecklistPh'));
			await input.fill(myItem);
			await sheet.getByRole('button', { name: tr('kbAdd'), exact: true }).click();
			await sheet.getByText(myItem, { exact: true }).waitFor();
			await sheet.locator('input[type=checkbox]').first().check();
			await t.waitFor(async () => (await readTask(aliApi, aliTask.id)).json.items.some((m) => Number(m.isDone) === 1));
			t.check((await readTask(aliApi, aliTask.id)).json.items.some((m) => Number(m.isDone) === 1), 'member checked their own checklist item');
			await sheet.getByRole('button', { name: tr('edit') }).click();
			await sheet.locator('textarea').first().fill(aliceDescription);
			await sheet.getByRole('button', { name: tr('kbSave') }).click();
			await t.waitFor(async () => (await readTask(aliApi, aliTask.id)).json.task.description === aliceDescription);
			t.eq((await readTask(aliApi, aliTask.id)).json.task.description, aliceDescription, 'member updated the description of their own task');
		});
		await step('someone else\'s task: read-only, but comments can be written', async () => {
			await win.locator(`[data-task-id="${bekTask.id}"]`).click();
			const sheet = page.getByRole('dialog', { name: bekTask.title });
			await sheet.waitFor();
			t.check(await sheet.getByText(tr('kbReadOnly')).count() === 1, 'view-only warning shown');
			t.eq(await sheet.getByPlaceholder(tr('kbChecklistPh')).count(), 0, 'no checklist input');
			t.check(await sheet.locator('aside select').first().isDisabled(), 'status select is disabled');
			await sheet.getByPlaceholder(tr('kbCommentPh')).fill(question);
			await sheet.getByRole('button', { name: tr('kbSend') }).click();
			await sheet.locator('[data-comment-id]').filter({ hasText: question }).waitFor();
			t.check((await readTask(bekApi, bekTask.id)).json.comments.some((y) => y.content === question), 'member commented on someone else\'s task');
		});
		await step('claiming a pooled task', async () => {
			await win.locator(`[data-task-id="${poolTask.id}"]`).click();
			const sheet = page.getByRole('dialog', { name: poolTask.title });
			await sheet.getByRole('button', { name: tr('kbClaim') }).click();
			await t.waitFor(async () => (await readTask(aliApi, poolTask.id)).json.task.assigneeMemberId === ali.id);
			t.eq((await readTask(aliApi, poolTask.id)).json.task.assigneeMemberId, ali.id, 'pooled task was assigned to the member');
			await t.waitFor(async () => (await sheet.getByRole('button', { name: tr('kbClaim') }).count()) === 0);
			t.eq(await sheet.getByRole('button', { name: tr('kbClaim') }).count(), 0, 'claim-task button disappeared');
		});
	});

	await t.step('member (API): unauthorized writes return 403', async () => {
		t.eq((await aliApi.post('/api/teams', { action: 'addTask', teamId: team.id, title: 'unauthorized' })).status, 403, 'cannot add tasks');
		t.eq((await aliApi.post('/api/teams', { action: 'updateTask', taskId: bekTask.id, status: 'done' })).status, 403, 'cannot move another member\'s task');
		t.eq((await aliApi.post('/api/teams', { action: 'deleteTask', taskId: aliTask.id })).status, 403, 'cannot even delete their own task');
		t.eq((await aliApi.patch(`/api/teams/tasks/${aliTask.id}`, { title: 'changed' })).status, 403, 'cannot change the title of their own task');
		t.eq((await aliApi.patch(`/api/teams/tasks/${aliTask.id}`, { assigneeMemberId: bek.id })).status, 403, 'cannot transfer their own task to someone else');
		t.eq((await aliApi.patch(`/api/teams/tasks/${bekTask.id}`, { assigneeMemberId: ali.id })).status, 403, 'cannot claim a task assigned to someone else');
		t.eq((await aliApi.post(`/api/teams/tasks/${bekTask.id}`, { action: 'addItem', text: 'x' })).status, 403, 'cannot add items to someone else\'s checklist');
		const bekComment = (await bekApi.post(`/api/teams/tasks/${bekTask.id}`, { action: 'addComment', content: 'Bob wrote this' })).json.comment;
		t.eq((await aliApi.post(`/api/teams/tasks/${bekTask.id}`, { action: 'deleteComment', commentId: bekComment.id })).status, 403, 'cannot delete someone else\'s comment');
		t.eq((await capApi.post(`/api/teams/tasks/${bekTask.id}`, { action: 'deleteComment', commentId: bekComment.id })).status, 200, 'captain can delete the comment (moderation)');
		t.eq((await aliApi.post('/api/teams', { action: 'updateTeam', teamId: team.id, description: 'A member cannot change team settings.' })).status, 403, 'cannot change team settings');
	});

	await t.step('non-member: board locked, tasks hidden (404)', async () => {
		const list = await readTeam(outApi, team.id);
		t.eq(list.tasks, [], 'no tasks in the team list');
		t.eq((await readTask(outApi, aliTask.id)).status, 404, 'task detail 404');
		t.eq((await outApi.post(`/api/teams/tasks/${aliTask.id}`, { action: 'addComment', content: 'intrusion' })).status, 404, 'cannot comment (404)');
		t.eq((await outApi.post('/api/teams', { action: 'updateTask', taskId: aliTask.id, status: 'done' })).status, 403, 'cannot move tasks');
		const { page } = await outsider.open();
		const win = await openTeam(page, team.id);
		await win.getByText(tr('tmLocked')).waitFor();
		t.eq(await win.locator('[data-task-id]').count(), 0, 'no cards on the locked screen');
		await t.shot(page, 'takim-disi-kilit');
	});

	await t.step('a captain of another team cannot delete or move this team\'s task', async () => {
		t.eq((await cap2Api.post('/api/teams', { action: 'deleteTask', taskId: aliTask.id, teamId: team2.id })).status, 403, 'deleteTask (own team in body) 403');
		t.eq((await cap2Api.post('/api/teams', { action: 'updateTask', taskId: aliTask.id, status: 'done' })).status, 403, 'updateTask 403');
		t.eq((await cap2Api.patch(`/api/teams/tasks/${aliTask.id}`, { title: 'hijacked' })).status, 404, 'PATCH 404 (task not visible)');
		t.check((await readTask(admin, aliTask.id)).status === 200, 'task unchanged');
	});

	await t.step('alumni member: can read the board, cannot write', async () => {
		t.eq((await admin.patch('/api/members', { id: ali.id, status: 'alumni' })).status, 200, 'member set to alumni');
		try {
			t.eq((await readTask(aliApi, aliTask.id)).status, 200, 'alumni can read the task');
			t.eq((await aliApi.post(`/api/teams/tasks/${aliTask.id}`, { action: 'addComment', content: 'alumni' })).status, 403, 'alumni cannot comment');
			t.eq((await aliApi.post('/api/teams', { action: 'updateTask', taskId: aliTask.id, status: 'done' })).status, 403, 'alumni cannot move tasks');
		} finally {
			await admin.patch('/api/members', { id: ali.id, status: 'active' });
		}
	});

	await t.step('unauthorized role: a news-only user cannot reach the board', async () => {
		const reader = await t.api('reader');
		t.eq((await readTask(reader, aliTask.id)).status, 403, 'task detail 403');
		t.eq((await reader.post('/api/teams', { action: 'join', teamId: team.id })).status, 403, 'cannot join the team');
	});

	await t.step('menu: a member using the add-task menu item gets an explanatory error', async () => {
		const { page } = await bek.open();
		await openTeam(page, team.id);
		await refreshBoard(page);
		await page.locator('[data-menubar-category=file]').click();
		await page.locator('[data-menu-item=new-task]').click();
		await page.locator('[role=status] > div').filter({ hasText: tr('tmAddTaskCaptainOnly') }).waitFor();
		t.eq(await page.getByRole('dialog', { name: tr('teamsAddTask') }).count(), 0, 'task form did not open');
	});
}
