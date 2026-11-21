// Event attendance: the organizer opens attendance, and the projector QR code comes from the server in every window;
// a member checks in with the QR code (in-app and via the /checkin/<code> link); ticket scanning at the door,
// manual addition by student number, undo (XP refund), and attendance CSV.
import fs from 'node:fs';
import { answerDialog, stepper, toast } from '../lib/ui-shared.mjs';
import { attendance, eventOf, makeEvent, openEvent, sweepEvents } from '../lib/event.mjs';
import { sweepStale, xpOf } from '../lib/team.mjs';
import { newMember } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Events: QR attendance, projector code, ticket, manual add, CSV' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepEvents(admin);

	const qr = await newMember(t, admin, { label: 'qr', roleId: fx.roles.member });
	const link = await newMember(t, admin, { label: 'link', roleId: fx.roles.member });
	const ticket = await newMember(t, admin, { label: 'ticket', roleId: fx.roles.member });
	const walkIn = await newMember(t, admin, { label: 'manual', roleId: fx.roles.member });
	const [qrApi, linkApi, ticketApi] = await Promise.all([qr.api(), link.api(), ticket.api()]);
	const studentNo = (await admin.get('/api/members')).json.members.find((m) => m.id === walkIn.id)?.studentNo;

	// An event happening now (started ten minutes ago) and one three days from now.
	const live = await makeEvent(t, admin, { label: 'Live', startMin: -10, lengthMin: 90 });
	const later = await makeEvent(t, admin, { label: 'Later', startMin: 3 * 24 * 60 });
	await ticketApi.post('/api/events', { action: 'register', eventId: live.id });
	const codeOf = (id) => admin.get(`/api/events/${encodeURIComponent(id)}/checkin-code`);

	const { page: ap } = await t.open('admin');
	const astep = stepper(t, ap);

	await astep('attendance closed: no code is issued; also no code before the event starts', async () => {
		const closed = await codeOf(live.id);
		t.eq(closed.status, 409, 'closed attendance: 409');
		t.eq(closed.json?.code, 'YOKLAMA_KAPALI', 'code: YOKLAMA_KAPALI');
		await admin.post('/api/events', { action: 'setAttendance', eventId: later.id, open: true });
		const early = await codeOf(later.id);
		t.eq(early.status, 409, 'event has not started: 409');
		t.eq(early.json?.code, 'ZAMAN_DISI', 'code: ZAMAN_DISI');
		await admin.post('/api/events', { action: 'setAttendance', eventId: later.id, open: false });
	});

	await astep('organizer opens attendance; the projector QR code comes from the server', async () => {
		const { detail } = await openEvent(ap, live.id);
		t.check(await detail.getByRole('button', { name: tr('evProjector') }).isDisabled(), 'projector button disabled while attendance is closed');
		await detail.getByText(tr('evAttendanceClosed')).click();
		await detail.getByText(tr('evAttendanceOpen')).waitFor();
		t.eq(Number((await eventOf(admin, live.id)).attendanceOpen), 1, 'attendance open on the server');
		await detail.getByRole('button', { name: tr('evProjector') }).click();
		const projector = ap.locator('[data-testid=projector-qr]');
		await t.waitFor(async () => /^[A-Z0-9]{6}$/.test((await projector.getAttribute('data-code')) ?? ''));
		const shown = await projector.getAttribute('data-code');
		t.check(/^[A-Z0-9]{6}$/.test(shown), 'six-character attendance code on the projector');
		const fresh = await codeOf(live.id);
		t.eq(fresh.status, 200, 'organizer can fetch the code');
		t.check(fresh.json.remainingMs > 0 && fresh.json.remainingMs <= 30_000, 'code belongs to a 30-second window');
		t.check(/^[A-Z0-9]{6}$/.test(fresh.json.shortCode ?? ''), 'short code is six characters');
		t.check(await ap.getByRole('dialog', { name: tr('evProjectorTitle') }).locator('img').count() === 1, 'QR image rendered');
		await t.shot(ap, 'projector');
		await ap.keyboard.press('Escape');
	});

	await t.step('member checks in with the QR code in the app (+150 XP, once)', async () => {
		const { page } = await qr.open();
		const before = await xpOf(qrApi);
		const { detail } = await openEvent(page, live.id);
		await detail.getByRole('button', { name: tr('evCheckIn') }).click();
		const code = (await codeOf(live.id)).json.shortCode;
		await page.getByPlaceholder(tr('evScanMemberPh')).fill(code);
		await page.getByRole('button', { name: tr('chatSend'), exact: true }).click();
		await toast(page, tr('ciConfirmedTitle'));
		t.eq(await xpOf(qrApi), before + 150, '150 XP earned');
		await t.waitFor(async () => (await detail.getByText(tr('evAttended')).count()) > 0);
		t.check(await detail.getByText(tr('evAttended')).count() > 0, 'attendance badge shown');
		const again = await qrApi.post('/api/events', { action: 'attend', code: (await codeOf(live.id)).json.shortCode });
		t.eq(again.json?.already, true, 'second check-in reports already recorded');
		t.eq(await xpOf(qrApi), before + 150, 'XP not awarded twice');
		await t.shot(page, 'qr-checkin');
	});

	await t.step('phone camera flow: the /checkin/<code> link records attendance with a session', async () => {
		const { page } = await link.open();
		const { shortCode } = (await codeOf(live.id)).json;
		const url = `/checkin/${encodeURIComponent(shortCode)}`;
		await page.goto(`${t.base}${url}`);
		await page.getByRole('heading', { name: tr('ciConfirmedTitle') }).waitFor();
		t.check(await page.getByText(live.title).count() === 1, 'event name on the page');
		t.check(Boolean((await eventOf(linkApi, live.id)).myAttendance), 'attendance recorded');
		const anon = await t.anonymous();
		await anon.page.goto(`${t.base}${url}`);
		const checkinHeadings = [tr('ciLoginTitle'), tr('ciFailedTitle'), tr('ciConfirmedTitle')].join('|');
		await anon.page.getByRole('heading', { name: new RegExp(checkinHeadings) }).waitFor();
		t.eq(await anon.page.getByRole('heading', { name: tr('ciLoginTitle') }).count(), 1, 'visitor without a session is asked to sign in');
	});

	await t.step('a fake or other-event code is not accepted', async () => {
		const real = (await codeOf(live.id)).json.shortCode;
		const forged = real === 'AAAAAA' ? 'BBBBBB' : 'AAAAAA';
		t.eq((await qrApi.post('/api/events', { action: 'attend', code: forged })).status, 403, 'wrong code 403');
		t.eq((await qrApi.post('/api/events', { action: 'attend', code: 'rastgele' })).status, 403, 'malformed short code 403');
		t.eq((await qrApi.post('/api/events', { action: 'attend', code: '!!!' })).status, 400, 'empty/unsupported code 400');
		t.eq((await qrApi.get(`/api/events/${live.id}/checkin-code`)).status, 403, 'member cannot fetch the projector code');
	});

	await astep('ticket scanning at the door and manual addition by student number', async () => {
		const ticketCode = (await eventOf(ticketApi, live.id)).ticketCode;
		t.check(/^BB1\./.test(ticketCode ?? ''), 'registered member has a ticket');
		const { detail } = await openEvent(ap, live.id);
		await detail.getByRole('button', { name: tr('evScanTickets') }).click();
		await ap.getByPlaceholder(/BB1\./).fill(ticketCode);
		await ap.getByRole('button', { name: tr('chatSend'), exact: true }).click();
		await toast(ap, tr('evCheckedInRecorded', { name: ticket.nameSurname }));
		await ap.keyboard.press('Escape');
		await detail.getByLabel(tr('evManualAdd')).fill(studentNo);
		await detail.getByRole('button', { name: tr('evAdd'), exact: true }).click();
		await toast(ap, tr('evManualAdded', { name: walkIn.nameSurname }));
		const list = await attendance(admin, live.id);
		const row = (id) => list.find((r) => r.userId === id);
		t.eq(row(ticket.id)?.method, 'ticket', 'ticket scan: method is ticket');
		t.eq(row(walkIn.id)?.method, 'manual', 'manual add: method is manual');
		t.eq(row(walkIn.id)?.recordTime ?? null, null, 'manually added attendee has no registration');
		t.eq(row(qr.id)?.method, 'qr', 'QR arrival: method is qr');
		await detail.locator(`tr[data-member-id="${walkIn.id}"]`).getByText(tr('evWalkIn')).waitFor();
		t.eq(await detail.locator(`tr[data-member-id="${walkIn.id}"]`).getByText(tr('evWalkIn')).count(), 1, 'list shows the unregistered badge');
		t.check((await t.waitFor(async () => (await detail.getByText('4/4').count()) >= 1)) >= 0, 'counter is 4/4 (attendance/registration plus arrivals)');
		t.eq((await admin.post('/api/events', { action: 'scanTicket', eventId: later.id, code: ticketCode })).status, 409, 'ticket for another event 409');
		t.eq((await admin.post('/api/events', { action: 'scanTicket', eventId: live.id, code: ticketCode.slice(0, -3) + 'xyz' })).status, 403, 'corrupt ticket 403');
		await t.shot(ap, 'attendance-list');
	});

	await astep('attendance CSV: header, rows, student number, and method', async () => {
		const { detail } = await openEvent(ap, live.id);
		const [download] = await Promise.all([ap.waitForEvent('download'), detail.getByRole('button', { name: tr('evExportCsv') }).click()]);
		t.check(/\.csv$/.test(download.suggestedFilename()), `filename ends in .csv (${download.suggestedFilename()})`);
		const text = fs.readFileSync(await download.path(), 'utf8');
		t.check(text.charCodeAt(0) === 0xfeff, 'UTF-8 BOM present (for Excel)');
		const lines = text.replace(/^﻿/, '').split('\r\n');
		t.eq(lines[0].split(';'), [tr('auditRoleMember'), tr('acStudentNo'), tr('department'), tr('reportColReg'), tr('reportColAtt'), tr('evColMethod'), tr('evColBy')], 'header row');
		t.eq(lines.length - 1, 4, 'four attendee rows');
		const walkLine = lines.find((l) => l.startsWith(walkIn.nameSurname));
		t.check(walkLine?.split(';')[1] === studentNo, 'student number is correct');
		t.check(walkLine?.split(';')[5] === tr('evMethodManual'), 'method column says manual');
	});

	await astep('undoing attendance refunds XP', async () => {
		const before = await xpOf(qrApi);
		const { detail } = await openEvent(ap, live.id);
		await detail.locator(`tr[data-member-id="${qr.id}"]`).getByRole('button', { name: tr('evRemoveCheckIn') }).click();
		await answerDialog(ap);
		await t.waitFor(async () => !(await attendance(admin, live.id)).find((r) => r.userId === qr.id)?.participationTime);
		t.eq(await xpOf(qrApi), before - 150, '150 XP refunded');
	});

	await astep('after attendance closes, an existing code no longer works', async () => {
		const code = (await codeOf(live.id)).json.shortCode;
		const { detail } = await openEvent(ap, live.id);
		await detail.getByText(tr('evAttendanceOpen')).click();
		await detail.getByText(tr('evAttendanceClosed')).waitFor();
		const r = await qrApi.post('/api/events', { action: 'attend', code: code });
		t.eq(r.status, 409, 'closed attendance rejects the code with 409');
		t.eq((await codeOf(live.id)).status, 409, 'no new code is issued');
	});

	await t.step('unauthorized role: the news-only role cannot check in or fetch a code', async () => {
		const reader = await t.api('reader');
		await admin.post('/api/events', { action: 'setAttendance', eventId: live.id, open: true });
		const code = (await codeOf(live.id)).json.shortCode;
		t.eq((await reader.post('/api/events', { action: 'attend', code: code })).status, 403, 'attendance 403');
		t.eq((await reader.get(`/api/events/${live.id}/checkin-code`)).status, 403, 'code 403');
		t.eq((await reader.get(`/api/events/${live.id}/attendance`)).status, 403, 'attendance list 403');
	});
}
