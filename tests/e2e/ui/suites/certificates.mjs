// Certificates: badges are earned from real records; admins issue a certificate to one member or to
// the attendees of an event; certificate page and vector PDF; public verification;
// revocation; member and news-only role permissions.
import fs from 'node:fs';
import { answerDialog, openWide, stepper } from '../lib/ui-shared.mjs';
import { makeEvent, sweepEvents } from '../lib/event.mjs';
import { addTask, makeTeam, sweepStale } from '../lib/team.mjs';
import { newMember, runTag } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Certificates: badges, issue-certificate modal, PDF, verification' };

const BADGES = ['first-step', 'regular', 'team-player', 'captain', 'task-hunter', 'certified', 'maker', 'star'];

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepEvents(admin);

	const star = await newMember(t, admin, { label: 'badge', roleId: fx.roles.member });
	const peer = await newMember(t, admin, { label: 'peer', roleId: fx.roles.member });
	const [starApi, peerApi] = await Promise.all([star.api(), peer.api()]);
	const certsOf = async (id) => (await admin.get(`/api/certificates?userId=${encodeURIComponent(id)}`)).json ?? [];
	t.cleanup(async () => {
		for (const id of [star.id, peer.id]) for (const c of await certsOf(id)) await admin.del(`/api/certificates?id=${encodeURIComponent(c.id)}`);
	});

	const badges = async (page) => {
		const win = await openWide(page, 'certificates');
		await win.locator('[data-badge]').first().waitFor();
		return Object.fromEntries(await win.locator('[data-badge]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-badge'), e.getAttribute('data-earned') === 'yes'])));
	};

	await t.step('new member: eight badges exist, none earned', async () => {
		const { page } = await star.open();
		const got = await badges(page);
		t.sameSet(Object.keys(got), BADGES, 'eight badges');
		t.eq(Object.values(got).filter(Boolean).length, 0, 'none earned');
		await t.shot(page, 'badges-empty');
	});

	const live = [];
	await t.step('badges from real records: event, team, captaincy, task, project, XP', async () => {
		// Attendance at five events (First Step + Regular).
		for (let i = 0; i < 5; i++) live.push(await makeEvent(t, admin, { label: `Badge${i}`, startMin: -5, lengthMin: 60 }));
		for (const e of live) await admin.post('/api/events', { action: 'manualAttendance', eventId: e.id, userId: star.id });
		// The team they lead (Team Player + Captain) and ten completed tasks (Task Hunter).
		const team = await makeTeam(t, admin, { label: 'Badge', leadId: star.id });
		for (let i = 0; i < 10; i++) {
			const g = await addTask(starApi, team.id, { title: `Badge task ${i}`, assigneeMemberId: star.id });
			await starApi.post('/api/teams', { action: 'updateTask', taskId: g.id, status: 'done' });
		}
		// Once the member's proposal is published, "Maker".
		const own = await starApi.post('/api/projects', { title: `E2E My Badge ${runTag()}`, summary: 'A project by a member on their own showcase page', repoUrl: 'https://example.com/benim', technologies: 'Go' });
		t.cleanup(() => admin.del(`/api/projects/${own.json.project.id}`));
		const { page: before } = await star.open();
		t.eq((await badges(before)).maker, false, 'no "Maker" badge while the proposal is pending');
		await admin.patch(`/api/projects/${own.json.project.id}`, { status: 'published' });

		const { page } = await star.open();
		const got = await badges(page);
		for (const id of ['first-step', 'regular', 'team-player', 'captain', 'task-hunter', 'maker']) t.eq(got[id], true, `earned "${id}"`);
		t.eq(got.certified, false, 'no certificate: no "Certified" badge');
		// 5×150 + 10×100 = 1750 XP: Club Star is awarded too.
		t.eq(got.star, true, '"Club Star" (1000 XP) earned');
		await t.shot(page, 'badges-earned');
	});

	const { page: ap, context: apCtx } = await t.open('admin');
	const astep = stepper(t, ap);
	const title = `E2E Certificate of Achievement ${runTag()}`;

	await astep('admin: issues a certificate to one member via the modal', async () => {
		const win = await openWide(ap, 'certificates');
		await win.getByRole('button', { name: tr('certsIssueBtn') }).click();
		const form = ap.locator('[data-cert-issue]');
		await form.locator('select').first().selectOption(star.id);
		await form.locator('input[type=text]').fill(title);
		await form.locator('select').nth(1).selectOption(live[0].id);
		await form.getByRole('button', { name: tr('certsIssueSubmitBtn') }).click();
		await form.waitFor({ state: 'detached' });
		const mine = await certsOf(star.id);
		const cert = mine.find((c) => c.title === title);
		t.check(Boolean(cert), 'certificate saved');
		t.eq(cert?.eventId, live[0].id, 'linked to the event');
		t.check(/\S{6,}/.test(cert?.verificationCode ?? ''), 'verification code generated');
		await win.getByRole('button', { name: tr('certAllCertificates') }).click();
		t.eq(await win.locator(`[data-cert-code="${cert.verificationCode}"]`).count(), 1, 'shown under "All Community Certificates"');
	});

	await astep('admin: bulk-issues certificates to event attendees; a second issue is skipped', async () => {
		await admin.post('/api/events', { action: 'manualAttendance', eventId: live[1].id, userId: peer.id });
		const win = await openWide(ap, 'certificates');
		await win.getByRole('button', { name: tr('certsIssueBtn') }).click();
		const form = ap.locator('[data-cert-issue]');
		await form.getByRole('button', { name: tr('crtModeBulk') }).click();
		t.eq(await form.getByText(tr('certsIssueMemberLabel')).count(), 0, 'no member selection in bulk mode');
		await form.locator('input[type=text]').fill(`E2E Attendance ${runTag()}`);
		await form.locator('select').first().selectOption(live[1].id);
		await form.getByRole('button', { name: tr('certsIssueSubmitBtn') }).click();
		await win.getByText(tr('certsBulkIssued', { n: 2 })).waitFor();
		t.eq((await certsOf(peer.id)).length, 1, 'the other attendee received one too');
		const again = await admin.post('/api/certificates', { action: 'bulk', eventId: live[1].id, title: 'Again' });
		t.eq(again.json?.given, 0, 'second bulk issue gave no new certificate');
		t.eq(again.json?.alreadyExists, 2, 'two people already had one');
	});

	await t.step('member: my certificates, "Certified" badge, certificate page, and vector PDF', async () => {
		const { page } = await star.open();
		const got = await badges(page);
		t.eq(got.certified, true, '"Certified" badge earned');
		const win = page.locator('[data-window-frame=certificates]');
		const cert = (await starApi.get('/api/certificates')).json.find((c) => c.title === title);
		const cardEl = win.locator(`[data-cert-code="${cert.verificationCode}"]`);
		await cardEl.getByRole('button', { name: tr('certsViewBtn') }).click();
		const view = page.locator('[data-cert-view]');
		await view.waitFor();
		t.check(await view.getByText(star.nameSurname).count() === 1, "member's name on the certificate");
		t.check(await view.getByText(title).count() >= 1, 'title on the certificate');
		const club = (await starApi.get('/api/community')).json;
		t.check(await view.getByText(club.university.toLocaleUpperCase('tr-TR')).count() === 1, 'university from Document Settings on the certificate (same as PDF)');
		await view.locator('img').first().waitFor();
		const [download] = await Promise.all([page.waitForEvent('download'), view.getByRole('button', { name: tr('certsVectorPdfBtn') }).click()]);
		t.eq(download.suggestedFilename(), `Certificate_${cert.verificationCode}.pdf`, 'PDF filename contains the verification code');
		const pdf = fs.readFileSync(await download.path());
		t.eq(pdf.subarray(0, 5).toString(), '%PDF-', 'a real PDF');
		t.check(pdf.length > 5000, `PDF is not empty (${pdf.length} bytes)`);
		await t.shot(page, 'certificate-page');
	});

	await t.step('public verification: a valid code verifies, a made-up code is rejected', async () => {
		const cert = (await certsOf(star.id)).find((c) => c.title === title);
		const anon = await t.anonymous();
		const api = await anon.page.request.get(`${t.base}/api/certificates/${cert.verificationCode}`);
		t.eq(api.status(), 200, 'verification without a session returns 200');
		t.eq((await api.json()).isValid, true, 'valid: true');
		t.eq((await anon.page.request.get(`${t.base}/api/certificates/UYDURMA-${runTag()}`)).status(), 400, 'malformed code returns 400');
		t.eq((await anon.page.request.get(`${t.base}/api/certificates/ORB-2026-FFFF-9999`)).status(), 404, 'nonexistent but well-formed code returns 404');
		await anon.page.goto(`${t.base}/verify/${cert.verificationCode}`);
		await anon.page.getByText(tr('verifyTitle')).waitFor();
		t.check(await anon.page.getByText(star.nameSurname).count() === 1, "member's name on the verification page");
		t.eq((await anon.page.request.get(`${t.base}/api/certificates`)).status(), 401, 'listing without a session returns 401');
	});

	await t.step("member permissions: cannot issue certificates or list another member's; button absent", async () => {
		t.eq((await peerApi.post('/api/certificates', { userId: peer.id, title: 'For myself' })).status, 403, 'member cannot issue a certificate');
		const listed = (await peerApi.get(`/api/certificates?userId=${star.id}`)).json;
		t.check(listed.every((c) => c.userId === peer.id), 'only their own certificates are returned even when another user ID is requested');
		const someone = (await certsOf(star.id))[0];
		t.eq((await peerApi.del(`/api/certificates?id=${someone.id}`)).status, 403, 'member cannot revoke');
		const { page } = await peer.open();
		const win = await openWide(page, 'certificates');
		await win.locator('[data-badge]').first().waitFor();
		t.eq(await win.getByRole('button', { name: tr('certsIssueBtn') }).count(), 0, 'no "New Certificate" button');
		t.eq(await win.getByRole('button', { name: tr('certAllCertificates') }).count(), 0, 'no community-wide tab');
		t.eq(await win.locator(`button[title="${tr('certsRevokeTooltip')}"]`).count(), 0, 'no revoke button');
	});

	await astep('admin: revokes the certificate; verification now rejects it', async () => {
		const cert = (await certsOf(star.id)).find((c) => c.title === title);
		await ap.reload({ waitUntil: 'domcontentloaded' });
		const win = await openWide(ap, 'certificates');
		await win.getByRole('button', { name: tr('certAllCertificates') }).click();
		await win.locator(`[data-cert-code="${cert.verificationCode}"]`).locator(`button[title="${tr('certsRevokeTooltip')}"]`).click();
		await answerDialog(ap);
		await win.getByText(tr('certsRevokedToast')).waitFor();
		t.eq((await admin.get(`/api/certificates/${cert.verificationCode}`)).status, 404, 'revoked code returns 404');
	});
	await t.close(apCtx);

	await t.step('unauthorized role: the news-only role cannot reach certificates', async () => {
		const reader = await t.api('reader');
		t.eq((await reader.get('/api/certificates')).status, 403, 'GET 403');
		const { page } = await t.open('reader');
		t.eq(await page.locator('[data-dock-app=certificates]').count(), 0, 'no Certificates in the dock');
	});
}
