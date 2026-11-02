import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import {
	createEvent,
	deleteEvent,
	registerForEvent,
	getOpenAttendanceEvents,
	closeFinishedAttendances,
	cancelEventRegistration,
	deleteEventRegistration,
	getEventById,
	getEventViews,
	getUserById,
	getUserByHandle,
	updateEvent,
	saveAttendance,
	deleteAttendance,
	getPgPool,
	getTeamById,
	type EventPatch,
} from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import type { User } from '@/db/schema';
import { can, requireApp } from '@/lib/auth/access';
import {
	EVENT_DESCRIPTION_MAX,
	EVENT_TITLE_MAX,
	KAPASITE_MAX,
	PARTICIPATION_XP,
	parseTicketCode,
	isAttendanceTime,
	normalizeEventType,
	normalizeEventStatus,
} from '@/lib/events';
import { verifyTicketCode, createTicketCode, verifyShortCode } from '@/server/attendanceToken';

export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Every event the member may see, with counts and their own registration and
 * check-in. Who else signed up is not part of this — organisers read the list
 * from `/api/etkinlikler/[id]/katilim`.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'events', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const manage = can(auth.user, 'events', 'yonet');
		// Close check-in on events that have ended, before anyone reads their state.
		await closeFinishedAttendances();
		const rows = await getEventViews(auth.user.id, manage);
		const now = Date.now();
		const events = await Promise.all(
			rows.map(async (e) => ({
				...e,
				// A ticket for events the member is signed up for and that are not over.
				biletKodu: e.benimKaydim && Number(e.endTime) >= now ? await createTicketCode(e.id, auth.user.id) : null,
			}))
		);
		return NextResponse.json({ etkinlikler: events, izinler: { manage }, sunucuZamani: now });
	} catch (error) {
		console.error('API /api/etkinlikler GET error:', error);
		return bad('Etkinlikler okunamadı.', 500);
	}
}

/** Validates the editable fields; `partial` leaves absent ones out. */
async function parseEventFields(body: Record<string, unknown>, partial: boolean): Promise<{ ok: true; value: EventPatch; error?: undefined } | { ok: false; value?: undefined; error: string }> {
	const v: EventPatch = {};
	const has = (k: string) => body[k] !== undefined;

	if (!partial || has('baslik') || has('title')) {
		const rawTitle = body.title ?? body.baslik;
		const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
		if (title.length < 3) return { ok: false, error: 'Event title must be at least 3 characters.' };
		if (title.length > EVENT_TITLE_MAX) return { ok: false, error: `Title cannot exceed ${EVENT_TITLE_MAX} characters.` };
		v.baslik = title;
	}
	if (!partial || has('tur') || has('type')) {
		const rawTur = (body.type ?? body.tur ?? 'atolye') as string;
		const tur = normalizeEventType(rawTur);
		if (!tur) return { ok: false, error: 'Invalid event type.' };
		v.tur = tur;
	}
	if (!partial || has('aciklama') || has('description')) {
		const rawDesc = body.description ?? body.aciklama;
		const description = typeof rawDesc === 'string' ? rawDesc.trim() : '';
		if (description.length > EVENT_DESCRIPTION_MAX) return { ok: false, error: 'Description is too long.' };
		v.aciklama = description;
	}
	if (!partial || has('konum') || has('location')) {
		const rawLoc = body.location ?? body.konum;
		const konum = typeof rawLoc === 'string' ? rawLoc.trim() : '';
		if (!konum) return { ok: false, error: 'Location is required.' };
		v.konum = konum.slice(0, 120);
	}
	if (!partial || has('baslangic') || has('start')) {
		const rawStart = body.start ?? body.baslangic;
		const startNum = Number(rawStart);
		if (!Number.isFinite(startNum) || startNum <= 0) {
			return { ok: false, error: 'Start and end times must be valid.' };
		}
		v.baslangic = Math.round(startNum);
	}
	if (!partial || has('endTime') || has('end') || has('bitis')) {
		const rawEnd = body.endTime ?? body.end ?? body.bitis;
		const endNum = Number(rawEnd);
		if (!Number.isFinite(endNum) || endNum <= 0) {
			return { ok: false, error: 'Start and end times must be valid.' };
		}
		v.endTime = Math.round(endNum);
	}
	if (v.baslangic && v.endTime && v.endTime <= v.baslangic) {
		return { ok: false, error: 'End time must be after start time.' };
	}
	if (!partial || has('kapasite') || has('capacity')) {
		const rawKap = body.capacity ?? body.kapasite ?? 50;
		const n = Number(rawKap);
		if (!Number.isInteger(n) || n < 0 || n > KAPASITE_MAX) return { ok: false, error: `Capacity must be between 0 and ${KAPASITE_MAX} (0 = unlimited).` };
		v.kapasite = n;
	}
	if (has('status')) {
		const status = normalizeEventStatus(body.status);
		if (!status) return { ok: false, error: 'Geçersiz status.' };
		v.status = status;
	}
	if (has('ownerTeamId')) {
		const ownerTeamId = typeof body.ownerTeamId === 'string' && body.ownerTeamId ? body.ownerTeamId : null;
		if (ownerTeamId) {
			const ownerTeam = await getTeamById(ownerTeamId);
			if (!ownerTeam) return { ok: false, error: 'Sahip takım bulunamadı.' };
		}
		v.ownerTeamId = ownerTeamId;
	}
	if (has('ownerUserId')) {
		const ownerUserId = typeof body.ownerUserId === 'string' && body.ownerUserId ? body.ownerUserId : null;
		if (ownerUserId) {
			const owner = await getUserById(ownerUserId);
			if (!owner || owner.status !== 'aktif') return { ok: false, error: 'Sahip üye bulunamadı.' };
		}
		v.ownerUserId = ownerUserId;
	}
	return { ok: true, value: v };
}

async function memberOf(body: Record<string, unknown>): Promise<User | null> {
	if (typeof body.userId === 'string' && body.userId) return getUserById(body.userId);
	if (typeof body.ogrenciNo === 'string' && body.ogrenciNo.trim()) return getUserByHandle(body.ogrenciNo.trim());
	return null;
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'events', 'kullan');
	if (!auth.authorized) return auth.response;
	const user = auth.user;

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const action = String(body.action ?? '');
		const eventId = typeof body.eventId === 'string' ? body.eventId : typeof body.etkinlikId === 'string' ? body.etkinlikId : '';

		// ---- member actions ------------------------------------------------------
		if (['kaydol', 'katil', 'rsvp', 'kaydiIptal', 'iptal', 'rsvp_iptal', 'yoklama', 'checkin'].includes(action)) {
			if (user.status === 'mezun') return bad('Mezunlar sadece okuma erişimine sahiptir.', 403);

			if (action === 'kaydol' || action === 'katil' || action === 'rsvp') {
				if (!eventId) return bad('CommunityEvent ID zorunludur.');
				const r = await registerForEvent(eventId, user.id);
				const messages: Record<typeof r, [number, string]> = {
					ok: [200, 'Etkinliğe kaydoldunuz. Biletiniz hazır.'],
					zaten: [409, 'Bu etkinliğe zaten kayıtlısınız.'],
					dolu: [409, 'Kontenjan doldu.'],
					kapali: [400, 'Bu etkinlik kayda açık değil.'],
					bulunamadi: [404, 'CommunityEvent bulunamadı.'],
				};
				const [status, message] = messages[r];
				if (status === 200) await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
				return status === 200 ? NextResponse.json({ success: true, message }) : bad(message, status);
			}

			if (action === 'kaydiIptal' || action === 'iptal' || action === 'rsvp_iptal') {
				if (!eventId) return bad('CommunityEvent ID zorunludur.');
				const r = await cancelEventRegistration(eventId, user.id);
				if (r === 'basladi') return bad('CommunityEvent başladıktan sonra kayıt iptal edilemez.');
				if (r === 'yok') return bad('Bu etkinlik için kaydınız bulunmuyor.', 404);
				await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
				return NextResponse.json({ success: true, message: 'Kaydınız iptal edildi.' });
			}

			// action === 'yoklama' | 'checkin': the 6-character code shown on the projector (camera or typed).
			// It names no event by itself, so match it against the events checking in right now.
			let rawKod = typeof body.code === 'string' ? body.code : typeof body.shortCode === 'string' ? body.shortCode : typeof body.kisaKod === 'string' ? body.kisaKod : typeof body.kod === 'string' ? body.kod : '';
			rawKod = rawKod.trim();
			const urlMatch = rawKod.match(/\/(?:yoklama|checkin)\/([A-Za-z0-9_-]+)/i);
			if (urlMatch) {
				rawKod = urlMatch[1];
			}
			const shortCode = rawKod.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
			if (!shortCode) return bad('Attendance için etkinlikte gösterilen 6 haneli kodu girin.');
			const acik = await getOpenAttendanceEvents();
			let matchedEventId: string | null = null;
			let expired = false;
			for (const id of acik) {
				const r = await verifyShortCode(id, shortCode);
				if (r === 'gecerli') {
					matchedEventId = id;
					break;
				}
				if (r === 'suresi-doldu') expired = true;
			}
			if (!matchedEventId) {
				return expired
					? bad('Kodun süresi doldu; ekrandaki güncel kodu girin.', 410)
					: bad('Kod geçersiz.', 403);
			}
			const ev = await getEventById(matchedEventId);
			if (!ev || ev.status !== 'yayinda') return bad('CommunityEvent bulunamadı.', 404);
			if (!Number(ev.yoklamaAcik)) return bad('Bu etkinlikte yoklama şu anda kapalı.', 409);
			if (!isAttendanceTime(ev.baslangic, ev.endTime, Date.now())) return bad('Attendance yalnızca etkinlik sırasında alınabilir.', 409);
			const r = await saveAttendance({ etkinlikId: ev.id, userId: user.id, yontem: 'qr' });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({
				success: true,
				zaten: r === 'zaten',
				already: r === 'zaten',
				event: { id: ev.id, baslik: ev.baslik, title: ev.baslik },
				etkinlik: { id: ev.id, baslik: ev.baslik, title: ev.baslik },
				message: r === 'zaten' ? 'Yoklamanız zaten alınmış.' : `Yoklamanız alındı (+${PARTICIPATION_XP} XP).`,
			});
		}

		// ---- organiser actions -----------------------------------------------------
		if (!can(user, 'events', 'yonet')) return bad('Bu işlem Etkinlikler uygulamasında yönetim yetkisi gerektirir.', 403);

		if (action === 'createEvent') {
			const parsed = await parseEventFields(body, false);
			if (!parsed.ok) return bad(parsed.error);
			const v = parsed.value;
			if (v.endTime! <= v.baslangic!) return bad('Bitiş, başlangıçtan sonra olmalıdır.');
			const created = await createEvent({
				baslik: v.baslik!,
				tur: v.tur,
				aciklama: v.aciklama,
				konum: v.konum,
				baslangic: v.baslangic!,
				endTime: v.endTime!,
				kapasite: v.kapasite,
				olusturanId: user.id,
				status: v.status === 'taslak' || body.status === 'taslak' || body.status === 'draft' ? 'taslak' : 'yayinda',
				ownerTeamId: v.ownerTeamId ?? null,
				ownerUserId: v.ownerUserId ?? user.id,
			});
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }, ...notificationEvents()]);
			return NextResponse.json({ success: true, ...created }, { status: 201 });
		}

		if (!eventId) return bad('CommunityEvent ID zorunludur.');
		const ev = await getEventById(eventId);
		if (!ev) return bad('CommunityEvent bulunamadı.', 404);

		if (action === 'updateEvent') {
			const parsed = await parseEventFields(body, true);
			if (!parsed.ok) return bad(parsed.error);
			const start = parsed.value.baslangic ?? Number(ev.baslangic);
			const end = parsed.value.endTime ?? Number(ev.endTime);
			if (end <= start) return bad('Bitiş, başlangıçtan sonra olmalıdır.');
			// Cancelling or completing an event also closes check-in.
			const closes = parsed.value.status && parsed.value.status !== 'yayinda';
			await updateEvent(eventId, { ...parsed.value, ...(closes ? { yoklamaAcik: false } : {}) });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }, ...notificationEvents()]);
			return NextResponse.json({ success: true });
		}

		if (action === 'setYoklama') {
			const acik = body.acik === true;
			if (acik && ev.status !== 'yayinda') return bad('Yalnızca yayındaki bir etkinlikte yoklama açılabilir.');
			await updateEvent(eventId, { yoklamaAcik: acik });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({ success: true, yoklamaAcik: acik });
		}

		if (action === 'deleteEvent') {
			const r = await deleteEvent(eventId);
			if (r === 'katilim-var') return bad('Katılım kaydı olan etkinlik silinemez; bunun yerine iptal edin.', 409);
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }, ...notificationEvents()]);
			return NextResponse.json({ success: true });
		}

		// Organiser attendance writes (ticket, manual, removal) only while the event is running.
		const attendanceWritable = (e: { status: string; yoklamaAcik: number; baslangic: number | string; endTime: number | string }) =>
			e.status === 'yayinda' && Number(e.yoklamaAcik) === 1 && isAttendanceTime(Number(e.baslangic), Number(e.endTime), Date.now());
		const attendanceClosedMessage = 'Attendance yalnızca açık ve etkinlik sırasında değiştirilebilir.';

		if (action === 'biletOkut') {
			if (!attendanceWritable(ev)) return bad(attendanceClosedMessage, 409);
			const code = parseTicketCode(body.kod);
			if (!code || !(await verifyTicketCode(code))) return bad('Bilet geçersiz.', 403);
			if (code.etkinlikId !== eventId) return bad('Bu bilet başka bir etkinliğe ait.', 409);
			const member = await getUserById(code.userId);
			if (!member) return bad('Bilet sahibi bulunamadı.', 404);
			const r = await saveAttendance({ etkinlikId: eventId, userId: member.id, yontem: 'bilet', kaydedenId: user.id });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({
				success: true,
				zaten: r === 'zaten',
				uye: { id: member.id, adSoyad: `${member.ad} ${member.soyad}`, ogrenciNo: member.ogrenciNo },
				message: r === 'zaten' ? `${member.ad} ${member.soyad} zaten giriş yaptı.` : `${member.ad} ${member.soyad} — giriş kaydedildi.`,
			});
		}

		if (action === 'manuelYoklama') {
			if (!attendanceWritable(ev)) return bad(attendanceClosedMessage, 409);
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı. Öğrenci numarasını kontrol edin.', 404);
			if (member.status !== 'aktif' && member.status !== 'mezun') return bad('Bu üyenin hesabı aktif değil.', 409);
			const r = await saveAttendance({ etkinlikId: eventId, userId: member.id, yontem: 'manuel', kaydedenId: user.id });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({
				success: true,
				zaten: r === 'zaten',
				uye: { id: member.id, adSoyad: `${member.ad} ${member.soyad}`, ogrenciNo: member.ogrenciNo },
				message: r === 'zaten' ? `${member.ad} ${member.soyad} zaten listede.` : `${member.ad} ${member.soyad} eklendi.`,
			});
		}

		if (action === 'deleteAttendance') {
			if (!attendanceWritable(ev)) return bad(attendanceClosedMessage, 409);
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı.', 404);
			const removed = await deleteAttendance(eventId, member.id);
			if (removed) await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return removed ? NextResponse.json({ success: true }) : bad('Bu üyenin yoklama kaydı yok.', 404);
		}

		if (action === 'kayitSil') {
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı.', 404);
			const removed = await deleteEventRegistration(eventId, member.id);
			if (removed) await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return removed ? NextResponse.json({ success: true, message: 'Kayıt silindi.' }) : bad('Bu üyenin kaydı bulunamadı.', 404);
		}

		return bad('Geçersiz işlem.');
	} catch (error) {
		console.error('API /api/etkinlikler POST error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export const POST = withAudit(handlePOST, { action: 'events.create', target: 'events' });
