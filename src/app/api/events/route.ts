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
	CAPACITY_MAX,
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
 * from `/api/events/[id]/katilim`.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'events', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const manage = can(auth.user, 'events', 'manage');
		// Close check-in on events that have ended, before anyone reads their state.
		await closeFinishedAttendances();
		const rows = await getEventViews(auth.user.id, manage);
		const now = Date.now();
		const events = await Promise.all(
			rows.map(async (e) => ({
				...e,
				// A ticket for events the member is signed up for and that are not over.
				ticketCode: e.myMyRecord && Number(e.endTime) >= now ? await createTicketCode(e.id, auth.user.id) : null,
			}))
		);
		return NextResponse.json({ events: events, permissions: { manage }, serverTime: now });
	} catch (error) {
		console.error('API /api/events GET error:', error);
		return bad('Etkinlikler okunamadı.', 500);
	}
}

/** Validates the editable fields; `partial` leaves absent ones out. */
async function parseEventFields(body: Record<string, unknown>, partial: boolean): Promise<{ ok: true; value: EventPatch; error?: undefined } | { ok: false; value?: undefined; error: string }> {
	const v: EventPatch = {};
	const has = (k: string) => body[k] !== undefined;

	if (!partial || has('title')) {
		const rawTitle = body.title;
		const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
		if (title.length < 3) return { ok: false, error: 'Event title must be at least 3 characters.' };
		if (title.length > EVENT_TITLE_MAX) return { ok: false, error: `Title cannot exceed ${EVENT_TITLE_MAX} characters.` };
		v.title = title;
	}
	if (!partial || has('type')) {
		const rawType = (body.type ?? body.typeValue ?? 'workshop') as string;
		const typeValue = normalizeEventType(rawType);
		if (!typeValue) return { ok: false, error: 'Invalid event type.' };
		v.typeValue = typeValue;
	}
	if (!partial || has('description')) {
		const rawDesc = body.description;
		const description = typeof rawDesc === 'string' ? rawDesc.trim() : '';
		if (description.length > EVENT_DESCRIPTION_MAX) return { ok: false, error: 'Description is too long.' };
		v.description = description;
	}
	if (!partial || has('location')) {
		const rawLoc = body.location;
		const location = typeof rawLoc === 'string' ? rawLoc.trim() : '';
		if (!location) return { ok: false, error: 'Location is required.' };
		v.location = location.slice(0, 120);
	}
	if (!partial || has('start')) {
		const rawStart = body.start;
		const startNum = Number(rawStart);
		if (!Number.isFinite(startNum) || startNum <= 0) {
			return { ok: false, error: 'Start and end times must be valid.' };
		}
		v.start = Math.round(startNum);
	}
	if (!partial || has('endTime') || has('end')) {
		const rawEnd = body.endTime ?? body.end;
		const endNum = Number(rawEnd);
		if (!Number.isFinite(endNum) || endNum <= 0) {
			return { ok: false, error: 'Start and end times must be valid.' };
		}
		v.endTime = Math.round(endNum);
	}
	if (v.start && v.endTime && v.endTime <= v.start) {
		return { ok: false, error: 'End time must be after start time.' };
	}
	if (!partial || has('capacity')) {
		const rawKap = body.capacity ?? 50;
		const n = Number(rawKap);
		if (!Number.isInteger(n) || n < 0 || n > CAPACITY_MAX) return { ok: false, error: `Capacity must be between 0 and ${CAPACITY_MAX} (0 = unlimited).` };
		v.capacity = n;
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
			if (!owner || owner.status !== 'active') return { ok: false, error: 'Sahip üye bulunamadı.' };
		}
		v.ownerUserId = ownerUserId;
	}
	return { ok: true, value: v };
}

async function memberOf(body: Record<string, unknown>): Promise<User | null> {
	if (typeof body.userId === 'string' && body.userId) return getUserById(body.userId);
	if (typeof body.studentNo === 'string' && body.studentNo.trim()) return getUserByHandle(body.studentNo.trim());
	return null;
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'events', 'use');
	if (!auth.authorized) return auth.response;
	const user = auth.user;

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const action = String(body.action ?? '');
		const eventId = typeof body.eventId === 'string' ? body.eventId : typeof body.eventId === 'string' ? body.eventId : '';

		// ---- member actions ------------------------------------------------------
		if (['register', 'join', 'rsvp', 'cancelRegistration', 'cancelled', 'rsvp_cancel', 'attend', 'checkin'].includes(action)) {
			if (user.status === 'alumni') return bad('Mezunlar sadece okuma erişimine sahiptir.', 403);

			if (action === 'register' || action === 'join' || action === 'rsvp') {
				if (!eventId) return bad('CommunityEvent ID zorunludur.');
				const r = await registerForEvent(eventId, user.id);
				const messages: Record<typeof r, [number, string]> = {
					ok: [200, 'Etkinliğe kaydoldunuz. Biletiniz hazır.'],
					already: [409, 'Bu etkinliğe zaten kayıtlısınız.'],
					full: [409, 'Kontenjan doldu.'],
					closed: [400, 'Bu etkinlik kayda açık değil.'],
					not_found: [404, 'CommunityEvent bulunamadı.'],
				};
				const [status, message] = messages[r];
				if (status === 200) await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
				return status === 200 ? NextResponse.json({ success: true, message }) : bad(message, status);
			}

			if (action === 'cancelRegistration' || action === 'cancelled' || action === 'rsvp_cancel') {
				if (!eventId) return bad('CommunityEvent ID zorunludur.');
				const r = await cancelEventRegistration(eventId, user.id);
				if (r === 'started') return bad('CommunityEvent başladıktan sonra kayıt iptal edilemez.');
				if (r === 'none') return bad('Bu etkinlik için kaydınız bulunmuyor.', 404);
				await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
				return NextResponse.json({ success: true, message: 'Kaydınız iptal edildi.' });
			}

			// action === 'attend' | 'checkin': the 6-character code shown on the projector (camera or typed).
			// It names no event by itself, so match it against the events checking in right now.
			let rawCode = typeof body.code === 'string' ? body.code : typeof body.shortCode === 'string' ? body.shortCode : typeof body.shortCode === 'string' ? body.shortCode : typeof body.code === 'string' ? body.code : '';
			rawCode = rawCode.trim();
			const urlMatch = rawCode.match(/\/(?:yoklama|checkin)\/([A-Za-z0-9_-]+)/i);
			if (urlMatch) {
				rawCode = urlMatch[1];
			}
			const shortCode = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
			if (!shortCode) return bad('Attendance için etkinlikte gösterilen 6 haneli kodu girin.');
			const open = await getOpenAttendanceEvents();
			let matchedEventId: string | null = null;
			let expired = false;
			for (const id of open) {
				const r = await verifyShortCode(id, shortCode);
				if (r === 'valid') {
					matchedEventId = id;
					break;
				}
				if (r === 'expired') expired = true;
			}
			if (!matchedEventId) {
				return expired
					? bad('Kodun süresi doldu; ekrandaki güncel kodu girin.', 410)
					: bad('Kod geçersiz.', 403);
			}
			const ev = await getEventById(matchedEventId);
			if (!ev || ev.status !== 'published') return bad('CommunityEvent bulunamadı.', 404);
			if (!Number(ev.attendanceOpen)) return bad('Bu etkinlikte yoklama şu anda kapalı.', 409);
			if (!isAttendanceTime(ev.start, ev.endTime, Date.now())) return bad('Attendance yalnızca etkinlik sırasında alınabilir.', 409);
			const r = await saveAttendance({ eventId: ev.id, userId: user.id, method: 'qr' });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({
				success: true,
				already: r === 'already',
				event: { id: ev.id, title: ev.title },
				message: r === 'already' ? 'Yoklamanız zaten alınmış.' : `Yoklamanız alındı (+${PARTICIPATION_XP} XP).`,
			});
		}

		// ---- organiser actions -----------------------------------------------------
		if (!can(user, 'events', 'manage')) return bad('Bu işlem Etkinlikler uygulamasında yönetim yetkisi gerektirir.', 403);

		if (action === 'createEvent') {
			const parsed = await parseEventFields(body, false);
			if (!parsed.ok) return bad(parsed.error);
			const v = parsed.value;
			if (v.endTime! <= v.start!) return bad('Bitiş, başlangıçtan sonra olmalıdır.');
			const created = await createEvent({
				title: v.title!,
				typeValue: v.typeValue,
				description: v.description,
				location: v.location,
				start: v.start!,
				endTime: v.endTime!,
				capacity: v.capacity,
				creatorId: user.id,
				status: v.status === 'draft' || body.status === 'draft' ? 'draft' : 'published',
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
			const start = parsed.value.start ?? Number(ev.start);
			const end = parsed.value.endTime ?? Number(ev.endTime);
			if (end <= start) return bad('Bitiş, başlangıçtan sonra olmalıdır.');
			// Cancelling or completing an event also closes check-in.
			const closes = parsed.value.status && parsed.value.status !== 'published';
			await updateEvent(eventId, { ...parsed.value, ...(closes ? { attendanceOpen: false } : {}) });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }, ...notificationEvents()]);
			return NextResponse.json({ success: true });
		}

		if (action === 'setAttendance') {
			const open = body.open === true;
			if (open && ev.status !== 'published') return bad('Yalnızca yayındaki bir etkinlikte yoklama açılabilir.');
			await updateEvent(eventId, { attendanceOpen: open });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({ success: true, attendanceOpen: open });
		}

		if (action === 'deleteEvent') {
			const r = await deleteEvent(eventId);
			if (r === 'has_participation') return bad('Katılım kaydı olan etkinlik silinemez; bunun yerine iptal edin.', 409);
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }, ...notificationEvents()]);
			return NextResponse.json({ success: true });
		}

		// Organiser attendance writes (ticket, manual, removal) only while the event is running.
		const attendanceWritable = (e: { status: string; attendanceOpen: number; start: number | string; endTime: number | string }) =>
			e.status === 'published' && Number(e.attendanceOpen) === 1 && isAttendanceTime(Number(e.start), Number(e.endTime), Date.now());
		const attendanceClosedMessage = 'Attendance yalnızca açık ve etkinlik sırasında değiştirilebilir.';

		if (action === 'scanTicket') {
			if (!attendanceWritable(ev)) return bad(attendanceClosedMessage, 409);
			const code = parseTicketCode(body.code);
			if (!code || !(await verifyTicketCode(code))) return bad('Bilet geçersiz.', 403);
			if (code.eventId !== eventId) return bad('Bu bilet başka bir etkinliğe ait.', 409);
			const member = await getUserById(code.userId);
			if (!member) return bad('Bilet sahibi bulunamadı.', 404);
			const r = await saveAttendance({ eventId: eventId, userId: member.id, method: 'ticket', recorderId: user.id });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({
				success: true,
				already: r === 'already',
				member: { id: member.id, nameSurname: `${member.name} ${member.surname}`, studentNo: member.studentNo },
				message: r === 'already' ? `${member.name} ${member.surname} zaten giriş yaptı.` : `${member.name} ${member.surname} — giriş kaydedildi.`,
			});
		}

		if (action === 'manualAttendance') {
			if (!attendanceWritable(ev)) return bad(attendanceClosedMessage, 409);
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı. Öğrenci numarasını kontrol edin.', 404);
			if (member.status !== 'active' && member.status !== 'alumni') return bad('Bu üyenin hesabı aktif değil.', 409);
			const r = await saveAttendance({ eventId: eventId, userId: member.id, method: 'manual', recorderId: user.id });
			await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return NextResponse.json({
				success: true,
				already: r === 'already',
				member: { id: member.id, nameSurname: `${member.name} ${member.surname}`, studentNo: member.studentNo },
				message: r === 'already' ? `${member.name} ${member.surname} zaten listede.` : `${member.name} ${member.surname} eklendi.`,
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

		if (action === 'removeRegistration') {
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı.', 404);
			const removed = await deleteEventRegistration(eventId, member.id);
			if (removed) await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
			return removed ? NextResponse.json({ success: true, message: 'Kayıt silindi.' }) : bad('Bu üyenin kaydı bulunamadı.', 404);
		}

		return bad('Geçersiz işlem.');
	} catch (error) {
		console.error('API /api/events POST error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

export const POST = withAudit(handlePOST, { action: 'events.create', target: 'events' });
