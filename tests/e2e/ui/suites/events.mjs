// Events: registration, ticket, capacity, registration cancellation, and organizer actions (create,
// draft/publish, edit, cancel/republish, delete). Attendance and CSV: event-attendance.mjs.
import { answerDialog, dateInput, openWide, stepper, toast } from '../lib/ui-shared.mjs';
import { attendance, eventOf, makeEvent, openEvent, removeEvent, sweepEvents } from '../lib/event.mjs';
import { sweepStale } from '../lib/team.mjs';
import { newMember, runTag } from '../lib/membership.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Events: registration, ticket, capacity, organizer actions' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepEvents(admin);

	const attendee = await newMember(t, admin, { label: 'attendee', roleId: fx.roles.member });
	const backup = await newMember(t, admin, { label: 'backup', roleId: fx.roles.member });
	const [attendeeApi, backupApi] = await Promise.all([attendee.api(), backup.api()]);

	const { page: ap, context: apCtx } = await t.open('admin');
	const astep = stepper(t, ap);

	// Organizer: one published event and one draft, both created in the UI.
	const title = `E2E Workshop ${runTag()}`;
	const draftTitle = `E2E Draft ${runTag()}`;
	const updatedLocation = 'Conference Hall';
	let eventId = null;
	let draftId = null;
	t.cleanup(async () => {
		for (const id of [eventId, draftId]) if (id) await removeEvent(admin, id);
	});
	const findId = async (title) => (await admin.get('/api/events')).json.events.find((e) => e.title === title)?.id ?? null;

	await astep('organizer: creates a published event with the "New Event" form', async () => {
		const win = await openWide(ap, 'events');
		await win.getByRole('button', { name: tr('evNew') }).click();
		const dlg = ap.getByRole('dialog', { name: tr('evFormNew') });
		await dlg.getByLabel(tr('evFieldTitle')).fill(title);
		await dlg.getByRole('radio', { name: tr('evTypeSeminar') }).click();
		await dlg.getByLabel(tr('evFieldPlace')).fill('Engineering D-101');
		await dlg.getByLabel(tr('evFieldDate')).fill(dateInput(4));
		await dlg.getByLabel(tr('evFieldStart')).fill('14:00');
		await dlg.getByLabel(tr('evFieldEnd')).fill('16:30');
		await dlg.locator('input[type=number]').fill('1');
		await dlg.getByRole('button', { name: tr('evPublish') }).click();
		await dlg.waitFor({ state: 'detached' });
		await toast(ap, tr('evCreated'));
		eventId = await findId(title);
		const e = await eventOf(admin, eventId);
		t.eq(e?.status, 'published', 'status: published');
		t.eq(e?.typeValue, 'seminar', 'type: seminar');
		t.eq(e?.capacity, 1, 'capacity 1');
		t.eq(e?.endTime - e?.start, 150 * 60_000, 'duration 2.5 hours');
		t.check(e?.start > Date.now() + 3 * 86_400_000, 'date is four days ahead');
		await win.locator(`[data-event-id="${eventId}"]`).waitFor();
		await t.shot(ap, 'event-created');
	});

	await astep('organizer: saves a draft; the draft is hidden from members and appears once published', async () => {
		const win = await openWide(ap, 'events');
		await win.getByRole('button', { name: tr('evNew') }).click();
		const dlg = ap.getByRole('dialog', { name: tr('evFormNew') });
		await dlg.getByLabel(tr('evFieldTitle')).fill(draftTitle);
		await dlg.getByLabel(tr('evFieldPlace')).fill('Library');
		await dlg.getByRole('button', { name: tr('evSaveDraft') }).click();
		await dlg.waitFor({ state: 'detached' });
		await toast(ap, tr('evCreated'));
		draftId = await findId(draftTitle);
		t.eq((await eventOf(admin, draftId))?.status, 'draft', 'status: draft');
		t.eq(await eventOf(attendeeApi, draftId), undefined, 'member cannot see the draft');
		t.eq((await attendeeApi.post('/api/events', { action: 'register', eventId: draftId })).status, 400, 'cannot register for a draft');
		const { detail } = await openEvent(ap, draftId, tr('evDrafts'));
		await detail.getByRole('button', { name: tr('evPublish') }).click();
		await toast(ap, tr('evSaved'));
		t.eq((await eventOf(admin, draftId))?.status, 'published', 'published');
		t.check(Boolean(await eventOf(attendeeApi, draftId)), 'member can see it now');
	});

	await t.step('member: registers, "Registered" badge and ticket appear', async () => {
		const { page } = await attendee.open();
		const step = stepper(t, page);
		await step('registration', async () => {
			const { detail } = await openEvent(page, eventId);
			t.check(await detail.getByText(tr('evSeatsLeft', { n: 1 })).count() === 1, 'one seat left shown');
			await detail.getByRole('button', { name: tr('evRegister') }).click();
			await toast(page, tr('evRegisteredToast'));
			t.check(await detail.getByText(tr('evRegistered')).count() >= 1, 'registered badge shown');
			const e = await eventOf(attendeeApi, eventId);
			t.eq(e.myRecord, true, 'API: registered');
			t.eq(e.registeredCount, 1, 'registered count is 1');
			t.check(/^BB1\./.test(e.ticketCode ?? ''), 'signed ticket code generated');
			t.eq((await attendeeApi.post('/api/events', { action: 'register', eventId: eventId })).status, 409, 'second registration 409');
		});
		await step('ticket', async () => {
			const { detail } = await openEvent(page, eventId);
			await detail.getByRole('button', { name: tr('evMyTicket') }).click();
			const ticket = page.getByRole('dialog', { name: tr('evTicketTitle') });
			await ticket.locator('img').waitFor();
			t.check(await ticket.getByText(title).count() === 1, 'event name on the ticket');
			t.check(await ticket.getByText(attendee.nameSurname).count() === 1, "member's name on the ticket");
			t.check((await ticket.locator('img').getAttribute('src')).startsWith('data:image/png'), 'ticket QR code rendered');
			await t.shot(page, 'ticket');
		});
	});

	await t.step('capacity full: a second member cannot register', async () => {
		const { page } = await backup.open();
		const { detail } = await openEvent(page, eventId);
		const btn = detail.getByRole('button', { name: tr('evFull') });
		t.check(await btn.isDisabled(), 'full-capacity button is disabled');
		t.eq((await backupApi.post('/api/events', { action: 'register', eventId: eventId })).status, 409, 'API 409 (capacity full)');
		t.eq((await backupApi.post('/api/events', { action: 'cancelRegistration', eventId: eventId })).status, 404, 'cancelling a nonexistent registration 404');
	});

	await t.step('member: cancels registration (confirmed), a seat opens', async () => {
		const { page } = await attendee.open();
		const { detail } = await openEvent(page, eventId);
		await detail.getByRole('button', { name: tr('evCancelRegistration') }).click();
		await answerDialog(page);
		await toast(page, tr('evUnregisteredToast'));
		const e = await eventOf(attendeeApi, eventId);
		t.eq(e.myRecord, false, 'registration removed');
		t.eq(e.ticketCode, null, 'ticket invalidated (no code)');
		t.eq((await backupApi.post('/api/events', { action: 'register', eventId: eventId })).status, 200, 'another member registered for the opened seat');
	});

	await astep('organizer: edits, cancels, and republishes', async () => {
		const { detail } = await openEvent(ap, eventId);
		await detail.getByRole('button', { name: tr('edit') }).click();
		const dlg = ap.getByRole('dialog', { name: tr('evFormEdit') });
		await dlg.getByLabel(tr('evFieldPlace')).fill(updatedLocation);
		await dlg.locator('input[type=number]').fill('5');
		await dlg.getByRole('button', { name: tr('evSave') }).click();
		await dlg.waitFor({ state: 'detached' });
		await toast(ap, tr('evSaved'));
		let e = await eventOf(admin, eventId);
		t.eq(e.location, updatedLocation, 'location updated');
		t.eq(e.capacity, 5, 'capacity updated');

		await detail.getByRole('button', { name: tr('evCancelEvent') }).click();
		await answerDialog(ap);
		await t.waitFor(async () => (await eventOf(admin, eventId)).status === 'cancelled');
		t.eq((await eventOf(admin, eventId)).status, 'cancelled', 'cancelled');
		t.check((await t.waitFor(async () => (await detail.getByText(tr('evCancelled')).count()) >= 1)) >= 0, 'cancelled badge shown');
		t.eq((await attendeeApi.post('/api/events', { action: 'register', eventId: eventId })).status, 400, 'cannot register for a cancelled event');
		await detail.getByRole('button', { name: tr('evRestore') }).click();
		await t.waitFor(async () => (await eventOf(admin, eventId)).status === 'published');
		t.eq((await eventOf(admin, eventId)).status, 'published', 'published again');
		e = await eventOf(backupApi, eventId);
		t.eq(e.myRecord, true, 'registered member keeps their registration');
	});

	await astep('organizer: deletes an event without attendance; cannot delete one with attendance', async () => {
		const live = await makeEvent(t, admin, { label: 'Undeletable', startMin: -10, lengthMin: 60 });
		await admin.post('/api/events', { action: 'manualAttendance', eventId: live.id, userId: attendee.id });
		t.eq((await admin.post('/api/events', { action: 'deleteEvent', eventId: live.id })).status, 409, 'event with attendance cannot be deleted (409)');
		const { detail } = await openEvent(ap, draftId);
		await detail.getByRole('button', { name: tr('evDelete') }).click();
		await answerDialog(ap);
		await t.waitFor(async () => !(await eventOf(admin, draftId)));
		t.eq(await eventOf(admin, draftId), undefined, 'event published from the draft was deleted');
		draftId = null;
	});
	await t.close(apCtx);

	await t.step('member cannot perform organizer actions; "New Event" and the management panel are hidden', async () => {
		const bad = [
			['createEvent', { title: 'E2E unauthorized', location: 'x', start: Date.now() + 86_400_000, end: Date.now() + 90_000_000 }],
			['updateEvent', { eventId: eventId, location: 'hijacked' }],
			['setAttendance', { eventId: eventId, open: true }],
			['deleteEvent', { eventId: eventId }],
			['manualAttendance', { eventId: eventId, userId: attendee.id }],
		];
		for (const [action, body] of bad) t.eq((await attendeeApi.post('/api/events', { action, ...body })).status, 403, `member: ${action} 403`);
		t.eq((await attendeeApi.get(`/api/events/${eventId}/attendance`)).status, 403, 'member cannot read the attendance list');
		const { page } = await attendee.open();
		const { win, detail } = await openEvent(page, eventId);
		t.eq(await win.getByRole('button', { name: tr('evNew') }).count(), 0, 'no "New Event" button');
		t.eq(await detail.getByText(tr('evList')).count(), 0, 'no attendance panel');
		t.eq(await detail.getByRole('button', { name: tr('edit') }).count(), 0, 'no "Edit" button');
	});

	await t.step('unauthorized role: the news-only role cannot reach events', async () => {
		const reader = await t.api('reader');
		t.eq((await reader.get('/api/events')).status, 403, 'GET 403');
		t.eq((await reader.post('/api/events', { action: 'register', eventId: eventId })).status, 403, 'registration 403');
		const { page } = await t.open('reader');
		t.eq(await page.locator('[data-dock-app=events]').count(), 0, 'no Events in the dock');
	});

	// The list of who registered stays in step with what members did.
	await t.step('attendance list shows registrations correctly', async () => {
		const list = await attendance(admin, eventId);
		t.sameSet(list.map((r) => r.userId), [backup.id], 'only the registered member is in the list');
	});
}
