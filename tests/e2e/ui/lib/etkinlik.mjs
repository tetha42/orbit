// Events a suite creates for itself. Times are always relative to now, so a run on any
// day sees the same "upcoming" or "under way" event; nothing is pinned to a date.
import { runTag } from './uyelik.mjs';
import { openWide } from './arayuz.mjs';

const MIN = 60_000;

/**
 * Creates an event starting `startMin` minutes from now and lasting `lengthMin`, and
 * removes it when the suite ends (check-ins first: an event with attendance cannot be deleted).
 */
export async function makeEvent(t, admin, { label, startMin = 3 * 24 * 60, lengthMin = 120, kapasite = 30, durum = 'yayinda', tur = 'atolye' } = {}) {
	const now = Date.now();
	const res = await admin.post('/api/etkinlikler', {
		action: 'createEvent',
		baslik: `E2E ${label} ${runTag()}`,
		aciklama: 'E2E sınaması için kurulan geçici etkinlik.',
		tur,
		konum: 'Test Salonu',
		baslangic: now + startMin * MIN,
		bitis: now + (startMin + lengthMin) * MIN,
		kapasite,
		durum,
	});
	if (!res.json?.id) throw new Error(`createEvent ${label}: ${res.status} ${JSON.stringify(res.json)}`);
	const id = res.json.id;
	t.cleanup(() => removeEvent(admin, id));
	return { id, baslik: (await eventOf(admin, id)).baslik };
}

/** Deletes an event after taking back its check-ins. */
export async function removeEvent(admin, id) {
	const list = (await admin.get(`/api/etkinlikler/${encodeURIComponent(id)}/katilim`)).json?.liste ?? [];
	for (const r of list) if (r.katilimZamani) await admin.post('/api/etkinlikler', { action: 'yoklamaSil', etkinlikId: id, kullaniciId: r.kullaniciId });
	await admin.post('/api/etkinlikler', { action: 'deleteEvent', etkinlikId: id });
}

/** Events named "E2E …" left by a killed run. */
export async function sweepEvents(admin) {
	for (const e of (await admin.get('/api/etkinlikler')).json?.etkinlikler ?? []) if (/^E2E /.test(e.baslik)) await removeEvent(admin, e.id);
}

/** The event as `who` sees it in `/api/etkinlikler` (undefined when hidden). */
export async function eventOf(who, id) {
	return (await who.get('/api/etkinlikler')).json?.etkinlikler?.find((e) => e.id === id);
}

/** The organiser's list of registrations and check-ins. */
export async function attendance(admin, id) {
	return (await admin.get(`/api/etkinlikler/${encodeURIComponent(id)}/katilim`)).json?.liste ?? [];
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
