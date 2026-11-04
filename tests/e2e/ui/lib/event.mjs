// Events a suite creates for itself. Times are always relative to now, so a run on any
// day sees the same "upcoming" or "under way" event; nothing is pinned to a date.
import { runTag } from './membership.mjs';
import { openWide } from './arayuz.mjs';

const MIN = 60_000;

/**
 * Creates an event starting `startMin` minutes from now and lasting `lengthMin`, and
 * removes it when the suite ends (check-ins first: an event with attendance cannot be deleted).
 */
export async function makeEvent(t, admin, { label, startMin = 3 * 24 * 60, lengthMin = 120, capacity = 30, status = 'published', typeValue = 'workshop' } = {}) {
	const now = Date.now();
	const res = await admin.post('/api/etkinlikler', {
		action: 'createEvent',
		title: `E2E ${label} ${runTag()}`,
		description: 'E2E sınaması için kurulan geçici etkinlik.',
		typeValue,
		location: 'Test Salonu',
		start: now + startMin * MIN,
		end: now + (startMin + lengthMin) * MIN,
		capacity,
		status,
	});
	if (!res.json?.id) throw new Error(`createEvent ${label}: ${res.status} ${JSON.stringify(res.json)}`);
	const id = res.json.id;
	t.cleanup(() => removeEvent(admin, id));
	return { id, title: (await eventOf(admin, id)).title };
}

/** Deletes an event after taking back its check-ins. */
export async function removeEvent(admin, id) {
	const list = (await admin.get(`/api/etkinlikler/${encodeURIComponent(id)}/katilim`)).json?.list ?? [];
	for (const r of list) if (r.participationTime) await admin.post('/api/etkinlikler', { action: 'removeAttendance', eventId: id, userId: r.userId });
	await admin.post('/api/etkinlikler', { action: 'deleteEvent', eventId: id });
}

/** Events named "E2E …" left by a killed run. */
export async function sweepEvents(admin) {
	for (const e of (await admin.get('/api/etkinlikler')).json?.events ?? []) if (/^E2E /.test(e.title)) await removeEvent(admin, e.id);
}

/** The event as `who` sees it in `/api/etkinlikler` (undefined when hidden). */
export async function eventOf(who, id) {
	return (await who.get('/api/etkinlikler')).json?.events?.find((e) => e.id === id);
}

/** The organiser's list of registrations and check-ins. */
export async function attendance(admin, id) {
	return (await admin.get(`/api/etkinlikler/${encodeURIComponent(id)}/katilim`)).json?.list ?? [];
}

/** Events app, maximised, with one event selected; returns { win, detail }. */
export async function openEvent(page, id, tab) {
	const win = await openWide(page, 'events');
	if (tab) await win.getByRole('tab', { name: new RegExp(tab) }).click();
	await win.locator(`[data-focus-id="event:${id}"]`).click();
	const detail = win.locator(`[data-event-id="${id}"]`);
	await detail.waitFor();
	return { win, detail };
}
