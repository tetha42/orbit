// Teams: creating, joining/leaving, applications (approve/reject/withdraw), capacity, team limit,
// in-team roles, removing members, captain settings, captain transfer, suspension, deletion, and roles.
import { answerDialog, backToTeams, openTeam, openWide, stepper, teamTab, toast } from '../lib/ui-shared.mjs';
import { addTask, makeTeam, readTeam, sweepStale } from '../lib/team.mjs';
import { newMember, runTag } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Teams: creating, joining/applying, captain transfer, in-team roles, capacity' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);

	const member = fx.roles.member;
	const captain = await newMember(t, admin, { label: 'captain', roleId: member });
	const applicant = await newMember(t, admin, { label: 'applicant', roleId: member });
	const secondApplicant = await newMember(t, admin, { label: 'second-applicant', roleId: member });
	const [capApi, applicantApi, secondApplicantApi] = await Promise.all([captain.api(), applicant.api(), secondApplicant.api()]);
	const card = (win, id) => win.locator(`[data-team-id="${id}"]`);
	const statusOf = async (teamId, userId) => (await readTeam(admin, teamId)).members.find((u) => u.userId === userId);

	const { page: ap, context: apCtx } = await t.open('admin');
	const astep = stepper(t, ap);
	const name = `E2E Application ${runTag()}`;
	const reapplyNote = 'I am applying again.';
	let appTeam = null;

	await astep('admin: creates an approval-based team with "New Team"; the captain becomes a member automatically', async () => {
		const win = await openWide(ap, 'teams');
		await win.getByRole('button', { name: tr('tmNewTeam') }).click();
		const dlg = ap.getByRole('dialog', { name: tr('tmNewTeam') });
		await dlg.getByLabel(tr('tmFieldName')).fill(name);
		await dlg.getByLabel(tr('tmFieldCategory')).selectOption('Robotics & Embedded');
		await dlg.getByLabel(tr('tmFieldQuota')).fill('3');
		await dlg.locator(`label:has(> span:text-is("${tr('tmFieldCaptain')}")) select`).selectOption(captain.id);
		await dlg.getByLabel(tr('tmFieldDesc')).fill('A temporary trial team that accepts members by application.');
		await dlg.getByText(tr('tmJoinApproval')).click();
		await dlg.getByRole('button', { name: tr('tmCreate') }).click();
		await toast(ap, tr('tmCreated'));
		appTeam = (await admin.get('/api/teams')).json.find((tm) => tm.name === name);
		t.cleanup(() => admin.post('/api/teams', { action: 'deleteTeam', teamId: appTeam.id }));
		t.eq(appTeam?.participationType, 'approval', 'participation: by application');
		t.eq(appTeam?.capacity, 3, 'capacity 3');
		t.eq(appTeam?.category, 'Robotics & Embedded', 'category');
		t.eq(appTeam?.leadId, captain.id, 'captain');
		const cap = appTeam.members.find((u) => u.userId === captain.id);
		t.eq(cap?.teamRole, 'Team Captain', 'the captain is a member with the "Team Captain" title');
		await card(win, appTeam.id).getByText(tr('tmByApplication'), { exact: true }).waitFor();
		t.eq((await admin.post('/api/teams', { action: 'createTeam', name: 'E2E bad', category: 'Made-up', description: 'Invalid category attempt' })).status, 400, 'invalid category returns 400');
		t.eq((await admin.post('/api/teams', { action: 'createTeam', name: 'E2E bad', category: 'Artificial Intelligence', description: 'Capacity out of range', capacity: 99 })).status, 400, 'capacity out of range returns 400');
		await t.shot(ap, 'team-created');
	});

	await t.step('member: applies (with a note), sees "Your application is pending"; withdraws; applies again', async () => {
		const { page } = await applicant.open();
		const step = stepper(t, page);
		await step('application', async () => {
			const win = await openWide(page, 'teams');
			await card(win, appTeam.id).getByRole('button', { name: tr('tmApply') }).click();
			const dlg = page.getByRole('dialog', { name: tr('tmApplyTitle') });
			await dlg.locator('textarea').fill('I have experience with embedded systems.');
			await dlg.getByRole('button', { name: tr('tmSendApplication') }).click();
			await toast(page, tr('tmAppliedToast'));
			await card(win, appTeam.id).getByText(tr('tmApplied')).waitFor();
			t.eq((await statusOf(appTeam.id, applicant.id)) ?? null, null, 'the applicant is not on the roster');
			t.eq((await readTeam(applicantApi, appTeam.id)).myStatus, 'applied', 'status: applied');
			t.eq((await applicantApi.post('/api/teams', { action: 'join', teamId: appTeam.id })).status, 409, 'a second application returns 409');
			t.eq((await readTeam(applicantApi, appTeam.id)).applications, [], 'the member cannot see the application list');
			await card(win, appTeam.id).getByRole('button', { name: tr('tmWithdraw') }).click();
			await answerDialog(page);
			await toast(page, tr('tmWithdrawnToast'));
			t.eq((await readTeam(applicantApi, appTeam.id)).myStatus, null, 'application withdrawn');
		});
		await applicantApi.post('/api/teams', { action: 'join', teamId: appTeam.id, applicationNote: reapplyNote });
		await secondApplicantApi.post('/api/teams', { action: 'join', teamId: appTeam.id, applicationNote: 'I would like to join too.' });
	});

	await t.step('captain: accepts one application and rejects the other', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, tr('reportMembersHeading'));
		const applicantApp = win.locator(`[data-applicant-id="${applicant.id}"]`);
		await applicantApp.waitFor();
		t.check(await applicantApp.getByText(reapplyNote).count() === 1, 'the application note is visible');
		await applicantApp.getByRole('button', { name: tr('tmApprove') }).click();
		await toast(page, tr('tmApprovedToast'));
		t.eq((await statusOf(appTeam.id, applicant.id))?.status, 'active', 'the accepted member is active');
		await win.locator(`[data-applicant-id="${secondApplicant.id}"]`).getByRole('button', { name: tr('tmReject') }).click();
		await answerDialog(page);
		await toast(page, tr('tmRejectedToast'));
		t.eq((await readTeam(secondApplicantApi, appTeam.id)).myStatus, null, 'the rejected application was deleted');
		t.eq((await secondApplicantApi.post('/api/teams', { action: 'approve', teamId: appTeam.id, userId: secondApplicant.id })).status, 403, 'a member cannot approve their own application');
		await t.shot(page, 'applications');
	});

	await t.step('in-team roles: the captain assigns a title; the captain title changes only through transfer', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, tr('reportMembersHeading'));
		const role = win.locator(`[data-member-id="${applicant.id}"] input`);
		await role.fill('Hardware   Lead');
		await role.press('Enter');
		await t.waitFor(async () => (await statusOf(appTeam.id, applicant.id))?.teamRole === 'Hardware Lead');
		t.eq((await statusOf(appTeam.id, applicant.id))?.teamRole, 'Hardware Lead', 'title saved (whitespace collapsed)');
		t.check(await win.locator(`[data-member-id="${captain.id}"] input`).isDisabled(), 'the captain title field is disabled');
		t.eq((await capApi.post('/api/teams', { action: 'setMemberRole', teamId: appTeam.id, userId: captain.id, teamRole: fx.roleNames.member })).status, 409, 'the captain title cannot be changed (409)');
		t.eq((await applicantApi.post('/api/teams', { action: 'setMemberRole', teamId: appTeam.id, userId: applicant.id, teamRole: 'Leader' })).status, 403, 'a member cannot give themselves a title');
		const { page: dp } = await applicant.open();
		const dw = await openTeam(dp, appTeam.id);
		await teamTab(dw, tr('reportMembersHeading'));
		t.check(await dw.locator(`[data-member-id="${applicant.id}"] input`).isDisabled(), 'the member title field is disabled');
		t.eq(await dw.getByText(tr('tmApplications')).count(), 0, 'the member does not see the applications section');
	});

	await t.step('captain settings: description/capacity/participation type; name and captain are managed by admins', async () => {
		const { page } = await captain.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, tr('tmTabSettings'));
		t.check(await win.getByLabel(tr('tmFieldName')).isDisabled(), 'the name field is disabled for the captain');
		t.eq(await win.getByLabel(tr('tmFieldStatus')).count(), 0, 'the captain cannot see the status');
		await win.getByLabel(tr('tmFieldQuota')).fill('2');
		await win.getByText(tr('tmJoinOpen')).click();
		await win.getByRole('button', { name: tr('tmSave') }).click();
		await toast(page, tr('tmSaved'));
		const tm = await readTeam(admin, appTeam.id);
		t.eq(tm.capacity, 2, 'capacity 2');
		t.eq(tm.participationType, 'open', 'participation is open');
		t.eq((await capApi.post('/api/teams', { action: 'updateTeam', teamId: appTeam.id, capacity: 1 })).status, 400, 'cannot drop below the active member count');
		t.eq((await capApi.post('/api/teams', { action: 'updateTeam', teamId: appTeam.id, name: 'New name' })).status, 403, 'the captain cannot change the name');
		t.eq((await capApi.post('/api/teams', { action: 'updateTeam', teamId: appTeam.id, leadId: applicant.id })).status, 403, 'the captain cannot transfer the captaincy themselves');
	});

	await t.step('capacity full: joining an open team is disabled', async () => {
		const { page } = await secondApplicant.open();
		const win = await openWide(page, 'teams');
		const full = card(win, appTeam.id).getByRole('button', { name: tr('tmFull') });
		t.check(await full.isDisabled(), 'the "Capacity full" button is disabled');
		const r = await secondApplicantApi.post('/api/teams', { action: 'join', teamId: appTeam.id });
		t.eq(r.status, 409, 'API returns 409');
		t.includes(r.json?.error ?? '', 'full capacity', 'the error mentions capacity');
	});

	await t.step('captain transfer (admin): the new captain receives the title and the old captain stays on the team', async () => {
		t.eq((await capApi.post('/api/teams', { action: 'leave', teamId: appTeam.id })).status, 409, 'the captain cannot leave without transferring');
		const win = await openTeam(ap, appTeam.id);
		await teamTab(win, tr('tmTabSettings'));
		await win.locator(`label:has(> span:text-is("${tr('tmFieldCaptain')}")) select`).selectOption(applicant.id);
		await win.getByRole('button', { name: tr('tmSave') }).click();
		await toast(ap, tr('tmSaved'));
		const tm = await readTeam(admin, appTeam.id);
		t.eq(tm.leadId, applicant.id, 'new captain');
		t.eq(tm.members.find((u) => u.userId === applicant.id)?.teamRole, 'Team Captain', 'the new captain title');
		t.eq(tm.members.find((u) => u.userId === captain.id)?.status, 'active', 'the old captain stays on the team');
		t.check(tm.members.find((u) => u.userId === captain.id)?.teamRole !== 'Team Captain', 'the old captain title changed');
		t.eq((await readTeam(capApi, appTeam.id)).permissions.manage, false, 'the old captain lost management permission');
		t.eq((await readTeam(applicantApi, appTeam.id)).permissions.manage, true, 'the new captain manages the team');
		await backToTeams(win);
	});

	await t.step('member removal: open tasks return to the pool; a member can leave on their own', async () => {
		const task = await addTask(applicantApi, appTeam.id, { title: 'Open task from the old captain', assigneeMemberId: captain.id });
		const { page, context: applicantCtx } = await applicant.open();
		const win = await openTeam(page, appTeam.id);
		await teamTab(win, tr('reportMembersHeading'));
		await win.getByRole('button', { name: `${tr('tmRemove')}: ${captain.nameSurname}` }).click();
		await answerDialog(page);
		await toast(page, tr('tmMemberRemovedToast'));
		t.eq(await statusOf(appTeam.id, captain.id), undefined, 'the member left the roster');
		const after = (await readTeam(admin, appTeam.id)).tasks.find((g) => g.id === task.id);
		t.eq(after?.assigneeMemberId, null, 'the open task returned to the pool');
		await t.close(applicantCtx);
		// Join the open team, then leave it.
		await capApi.post('/api/teams', { action: 'join', teamId: appTeam.id });
		const { page: cp } = await captain.open();
		const cw = await openWide(cp, 'teams');
		await card(cw, appTeam.id).getByRole('button', { name: tr('teamsLeave') }).click();
		await answerDialog(cp);
		await toast(cp, tr('tmLeftToast'));
		t.eq(await statusOf(appTeam.id, captain.id), undefined, 'the member left');
	});

	await t.step('team limit: a member can be on at most 3 teams at once', async () => {
		const extra = [];
		for (const i of [1, 2, 3, 4]) extra.push(await makeTeam(t, admin, { label: `Limit${i}` }));
		for (const tm of extra.slice(0, 3)) t.eq((await secondApplicantApi.post('/api/teams', { action: 'join', teamId: tm.id })).status, 200, `${tm.name}: joined`);
		const fourth = await secondApplicantApi.post('/api/teams', { action: 'join', teamId: extra[3].id });
		t.eq(fourth.status, 409, 'the fourth team returns 409');
		const { page } = await secondApplicant.open();
		const win = await openWide(page, 'teams');
		t.check(await card(win, extra[3].id).getByRole('button', { name: tr('tmJoin') }).isDisabled(), 'the "Join" button is disabled in the UI');
		t.check(await win.getByText('3/3').count() >= 1, '"My Teams 3/3"');
	});

	await t.step('a suspended team accepts no members; admin deletes the team', async () => {
		const paused = await makeTeam(t, admin, { label: 'Suspended' });
		await admin.post('/api/teams', { action: 'updateTeam', teamId: paused.id, status: 'suspended' });
		t.eq((await applicantApi.post('/api/teams', { action: 'join', teamId: paused.id })).status, 409, 'joining a suspended team returns 409');
		// The list is read once when the app opens: reload to see the paused team.
		await ap.reload();
		await ap.locator('[data-window-frame=teams]').waitFor();
		const w = await openWide(ap, 'teams');
		await card(w, paused.id).getByText(tr('tmPaused')).waitFor();
		await card(w, paused.id).getByRole('button', { name: tr('tmDelete') }).click();
		await answerDialog(ap);
		await toast(ap, tr('tmDeletedToast'));
		t.eq((await admin.get(`/api/teams?teamId=${paused.id}`)).status, 404, 'the team was deleted');
	});
	await t.close(apCtx);

	await t.step('unauthorized roles: a member cannot create/delete a team; the news-only role cannot see them at all', async () => {
		t.eq((await secondApplicantApi.post('/api/teams', { action: 'createTeam', name: 'E2E unauthorized', category: 'Artificial Intelligence', description: 'Member attempts to create a team' })).status, 403, 'a member cannot create a team');
		t.eq((await secondApplicantApi.post('/api/teams', { action: 'deleteTeam', teamId: appTeam.id })).status, 403, 'a member cannot delete a team');
		t.eq((await secondApplicantApi.post('/api/teams', { action: 'addMember', teamId: appTeam.id, userId: secondApplicant.id })).status, 403, 'a member cannot add themselves directly');
		t.eq((await applicantApi.post('/api/teams', { action: 'addMember', teamId: appTeam.id, userId: secondApplicant.id })).status, 403, 'even the captain cannot add a member directly (that is an admin action)');
		const { page } = await secondApplicant.open();
		const win = await openWide(page, 'teams');
		t.eq(await win.getByRole('button', { name: tr('tmNewTeam') }).count(), 0, 'members do not see "New Team"');
		t.eq(await win.getByRole('button', { name: tr('tmDelete') }).count(), 0, 'members do not see the delete button');
		const reader = await t.api('reader');
		t.eq((await reader.post('/api/teams', { action: 'join', teamId: appTeam.id })).status, 403, 'the news-only role cannot join (403)');
	});
}
