// Project Showcase: member proposal → admin approval/publication, stars, featuring, archive,
// unpublishing, deletion; the proposal is visible only to its owner and admins; unauthorized roles.
import { answerDialog, openWide, stepper, toast } from '../lib/ui-shared.mjs';
import { makeTeam, sweepStale } from '../lib/team.mjs';
import { newMember, runTag } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Projects: proposal → approval/publication, stars, archive, featuring' };

/** Projects named "E2E …" left by a killed run. */
async function sweepProjects(admin) {
	for (const p of (await admin.get('/api/projects')).json?.projects ?? []) {
		if (/^E2E /.test(p.title)) await admin.del(`/api/projects/${encodeURIComponent(p.id)}`);
	}
}

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepProjects(admin);

	const author = await newMember(t, admin, { label: 'author', roleId: fx.roles.member });
	const fan = await newMember(t, admin, { label: 'fan', roleId: fx.roles.member });
	const [authorApi, fanApi] = await Promise.all([author.api(), fan.api()]);
	const team = await makeTeam(t, admin, { label: 'Project', leadId: author.id });
	const other = await makeTeam(t, admin, { label: 'Other', leadId: fan.id });

	const title = `E2E Project ${runTag()}`;
	let id = null;
	t.cleanup(async () => {
		if (id) await admin.del(`/api/projects/${encodeURIComponent(id)}`);
	});
	const read = async (who = admin) => (await who.get(`/api/projects/${encodeURIComponent(id)}`)).json;

	const { page, context: authorCtx } = await author.open();
	const win = await openWide(page, 'projects');
	const step = stepper(t, page);
	const card = () => win.locator(`[data-project-id="${id}"]`);

	await step('member: a proposal without a link is rejected and cannot be tied to another team', async () => {
		t.eq((await authorApi.post('/api/projects', { title: 'E2E no-link', summary: 'Proposal text without a link', technologies: 'Go' })).status, 400, '400 when no link is provided');
		t.eq((await authorApi.post('/api/projects', { title: 'E2E bad', summary: 'Proposal with a malicious link', repoUrl: 'javascript:alert(1)', technologies: 'Go' })).status, 400, '400 for a javascript: link');
		const r = await authorApi.post('/api/projects', { title: 'E2E foreign team', summary: 'Proposal linked to another team', repoUrl: 'https://example.com/x', technologies: 'Go', teamId: other.id });
		t.eq(r.status, 400, 'cannot link to a team the member does not belong to');
	});

	await step('member: the "Propose Project" form creates a proposal (it does not go live)', async () => {
		await win.getByRole('button', { name: tr('pjPropose') }).click();
		const dlg = page.getByRole('dialog', { name: tr('pjFormTitleNew') });
		await dlg.getByLabel(tr('pjFieldTitle')).fill(title);
		await dlg.getByLabel(tr('pjFieldSummary')).fill('An end-to-end tested sample project for the club.');
		await dlg.getByLabel(tr('pjFieldRepo')).fill('https://github.com/example/e2e-proje');
		await dlg.getByLabel(tr('pjFieldTech')).fill('Next.js, PostgreSQL, next.js');
		await dlg.getByLabel(tr('pjFieldTeam')).selectOption(team.id);
		t.check(await dlg.getByText(tr('pjMemberHint')).count() === 1, 'member hint is visible');
		await dlg.getByRole('button', { name: tr('pjSubmitProposal') }).click();
		await toast(page, tr('pjProposalSent'));
		const mine = (await authorApi.get('/api/projects')).json.projects.find((p) => p.title === title);
		id = mine?.id;
		t.eq(mine?.status, 'proposed', 'status: proposed');
		t.eq(mine?.technologies, ['Next.js', 'PostgreSQL'], 'technologies deduplicated');
		t.eq(mine?.teamId, team.id, 'linked to own team');
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.waitFor();
		t.check(await sheet.getByText(tr('pjStatusProposal')).count() >= 1, 'the "Pending approval" label is shown on the page');
		t.eq(await sheet.getByRole('button', { name: tr('evPublish') }).count(), 0, 'members do not see "Publish"');
		t.check(await sheet.getByRole('button', { name: /^\d+$/ }).isDisabled(), 'a proposal cannot be starred (button disabled)');
		await t.shot(page, 'oneri-gonderildi');
	});

	await step('the proposal is visible only to its owner and admins', async () => {
		t.eq((await fanApi.get(`/api/projects/${id}`)).status, 404, '404 for another member');
		t.check(!(await fanApi.get('/api/projects')).json.projects.some((p) => p.id === id), 'not in another member\'s list');
		t.eq((await fanApi.post(`/api/projects/${id}`, { action: 'star' })).status, 404, 'another member cannot star it (404)');
		t.eq((await authorApi.post(`/api/projects/${id}`, { action: 'star' })).status, 400, 'a proposal cannot be starred (400)');
		t.eq((await authorApi.patch(`/api/projects/${id}`, { status: 'published' })).status, 403, 'the owner cannot publish their own proposal');
	});

	await step('member: edits their own proposal', async () => {
		await card().click();
		const sheet = page.getByRole('dialog', { name: title });
		await sheet.getByRole('button', { name: tr('edit') }).click();
		const dlg = page.getByRole('dialog', { name: tr('pjFormTitleEdit') });
		await dlg.getByLabel(tr('pjFieldDemo')).fill('https://example.com/demo');
		await dlg.getByRole('button', { name: tr('pjSave') }).click();
		await toast(page, tr('evSaved'));
		t.eq((await read(authorApi)).liveUrl, 'https://example.com/demo', 'demo link saved');
	});
	await t.close(authorCtx);

	await t.step('admin: approves and publishes from the Proposals tab', async () => {
		const { page: ap, context: apCtx } = await t.open('admin');
		const aw = await openWide(ap, 'projects');
		await aw.getByRole('tab', { name: tr('pjTabProposals') }).click();
		await aw.locator(`[data-project-id="${id}"]`).click();
		const sheet = ap.getByRole('dialog', { name: title });
		await sheet.waitFor();
		await sheet.getByRole('button', { name: tr('evPublish') }).click();
		await toast(ap, tr('pjPublished'));
		t.eq((await read()).status, 'published', 'status: published');
		t.check((await fanApi.get('/api/projects')).json.projects.some((p) => p.id === id), 'other members can see it now');
		await t.shot(ap, 'yayinlandi');
		await t.close(apCtx);
	});

	await t.step('stars: a member stars and unstars; the count is correct', async () => {
		const { page: fp } = await fan.open();
		const fw = await openWide(fp, 'projects');
		const star = fw.locator(`[data-project-id="${id}"]`).locator('button[aria-pressed]');
		t.eq(await star.getAttribute('aria-pressed'), 'false', 'not starred initially');
		await star.click();
		await t.waitFor(async () => (await read(fanApi)).likeCount === 1);
		t.eq((await read(fanApi)).likeCount, 1, '1 star on the server');
		t.eq(await star.getAttribute('aria-pressed'), 'true', 'button pressed');
		t.eq((await authorApi.post(`/api/projects/${id}`, { action: 'star' })).json?.likeCount, 2, '2 after a second member stars');
		await star.click();
		await t.waitFor(async () => (await read(fanApi)).likeCount === 1);
		t.eq((await read(fanApi)).likeCount, 1, '1 after unstarring');
		t.eq((await read(fanApi)).likedByMe, false, 'the member\'s star is removed');
	});

	await t.step('featuring: admin only; "Featured" badge on the card', async () => {
		t.eq((await authorApi.patch(`/api/projects/${id}`, { isFeatured: true })).status, 403, 'the owner cannot feature it');
		const { page: ap, context: apCtx } = await t.open('admin');
		const aw = await openWide(ap, 'projects');
		await aw.locator(`[data-project-id="${id}"]`).click();
		const sheet = ap.getByRole('dialog', { name: title });
		await sheet.waitFor();
		await sheet.getByRole('button', { name: tr('pjActPin') }).click();
		await toast(ap, tr('evSaved'));
		t.eq(Number((await read()).isFeatured), 1, 'featured on the server');
		await ap.keyboard.press('Escape');
		await aw.locator(`[data-project-id="${id}"]`).getByText(tr('pjFeatured')).waitFor();
		t.check(await aw.locator(`[data-project-id="${id}"]`).getByText(tr('pjFeatured')).count() === 1, 'the card shows "Featured"');
		const first = await aw.locator('[data-project-id]').first().getAttribute('data-project-id');
		t.eq(first, id, '"Featured" ordering puts it first');
		await t.close(apCtx);
	});

	await t.step('archive: an archived project leaves the showcase, loses featured status, cannot be starred, and its owner cannot edit it', async () => {
		const { page: ap, context: apCtx } = await t.open('admin');
		const aw = await openWide(ap, 'projects');
		await aw.locator(`[data-project-id="${id}"]`).click();
		const sheet = ap.getByRole('dialog', { name: title });
		await sheet.waitFor();
		await sheet.getByRole('button', { name: tr('mailArchive') }).click();
		await toast(ap, tr('evSaved'));
		const p = await read();
		t.eq(p.status, 'archived', 'status: archived');
		t.eq(Number(p.isFeatured), 0, 'featured status removed');
		t.eq((await fanApi.get(`/api/projects/${id}`)).status, 404, 'an archived project is not visible to another member');
		t.eq((await authorApi.post(`/api/projects/${id}`, { action: 'star' })).status, 400, 'an archived project cannot be starred (even by its owner)');
		t.eq((await authorApi.patch(`/api/projects/${id}`, { summary: 'Trying to edit it while it is archived' })).status, 403, 'the owner cannot edit an archived project');
		await ap.keyboard.press('Escape');
		await aw.getByRole('tab', { name: tr('pjTabArchive') }).click();
		t.eq(await aw.locator(`[data-project-id="${id}"]`).count(), 1, 'in the Archive tab');
		await aw.locator(`[data-project-id="${id}"]`).click();
		// The archive toast says the same thing; wait for it to disappear so the next one belongs to this save.
		await ap.locator('[role=status] > div').filter({ hasText: tr('evSaved') }).waitFor({ state: 'detached', timeout: 15_000 });
		await sheet.waitFor();
		await sheet.getByRole('button', { name: tr('pjActRestore') }).click();
		await toast(ap, tr('evSaved'));
		t.eq((await read()).status, 'published', 'published after restoring from the archive');
		t.eq((await read()).likeCount, 1, 'stars preserved');
		await t.close(apCtx);
	});

	await t.step('unpublishing and deletion permissions', async () => {
		t.eq((await authorApi.del(`/api/projects/${id}`)).status, 403, 'the owner cannot delete a published project');
		t.eq((await admin.patch(`/api/projects/${id}`, { status: 'proposed' })).status, 200, 'admin returned it to a proposal');
		t.eq((await fanApi.get(`/api/projects/${id}`)).status, 404, 'hidden from other members once it is a proposal again');
		const { page: authorPage } = await author.open();
		const w = await openWide(authorPage, 'projects');
		await w.getByRole('tab', { name: tr('pjTabProposals') }).click();
		await w.locator(`[data-project-id="${id}"]`).click();
		await authorPage.getByRole('dialog', { name: title }).getByRole('button', { name: tr('pjActDelete'), exact: true }).click();
		await answerDialog(authorPage);
		await t.waitFor(async () => (await authorApi.get(`/api/projects/${id}`)).status === 404);
		t.eq((await admin.get(`/api/projects/${id}`)).status, 404, 'the owner deleted their own proposal');
		id = null;
	});

	await t.step('unauthorized role: the news-only member cannot see or propose projects', async () => {
		const reader = await t.api('reader');
		t.eq((await reader.get('/api/projects')).status, 403, 'GET /api/projects 403');
		t.eq((await reader.post('/api/projects', { title: 'E2E infiltration', summary: 'Unauthorized user proposal', repoUrl: 'https://example.com', technologies: 'Go' })).status, 403, 'proposal 403');
		const { page: op } = await t.open('reader');
		t.eq(await op.locator('[data-dock-app=projects]').count(), 0, 'Projects is not in the Dock');
	});
}
