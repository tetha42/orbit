import { NextResponse } from 'next/server';
import {
	createEvent,
	deleteEvent,
	registerForEvent,
	getAttendanceWindowEvents,
	cancelEventRegistration,
	deleteEventRegistration,
	getEventById,
	getUserById,
	updateEvent,
	saveAttendance,
	deleteAttendance,
	getPgPool,
} from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/events';
import type { requireApp } from '@/lib/auth/access';
import { can } from '@/lib/auth/access';
import { PARTICIPATION_XP, parseTicketCode, isAttendanceTime } from '@/lib/events';
import { verifyTicketCode, verifyShortCode } from '@/server/attendanceToken';
import eventsContract from '@/apps/events/events.contract.json';
import { contractErrorResponse } from '@/contracts/helpers';
import { bad, memberOf, parseEventFields } from './validators';

export type EventsAuthUser = Extract<Awaited<ReturnType<typeof requireApp>>, { authorized: true }>['user'];

export async function handleMemberEventAction(
	action: string,
	eventId: string,
	body: Record<string, unknown>,
	user: EventsAuthUser
): Promise<NextResponse> {
	if (user.status === 'alumni') return bad('Alumni accounts have read-only access.', 403);

	if (action === 'register' || action === 'join' || action === 'rsvp') {
		if (!eventId) return bad('Event ID is required.');
		const r = await registerForEvent(eventId, user.id);
		if (r === 'full') {
			return contractErrorResponse(eventsContract, 'EVENT_CAPACITY_FULL', 'Event capacity is full.', undefined, 409);
		}
		if (r === 'not_found') {
			return contractErrorResponse(eventsContract, 'EVENT_NOT_FOUND', 'Event not found.');
		}
		if (r === 'already') return bad('You are already registered for this event.', 409);
		if (r === 'closed') return bad('Registration is closed for this event.', 400);
		await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
		return NextResponse.json({ success: true, message: 'You are registered. Your ticket is ready.' });
	}

	if (action === 'cancelRegistration' || action === 'cancelled' || action === 'rsvp_cancel') {
		if (!eventId) return bad('Event ID is required.');
		const r = await cancelEventRegistration(eventId, user.id);
		if (r === 'started') return bad('Registration cannot be cancelled after the event has started.');
		if (r === 'none') return bad('No registration found for this event.', 404);
		await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
		return NextResponse.json({ success: true, message: 'Your registration has been cancelled.' });
	}

	let rawCode = typeof body.code === 'string' ? body.code : typeof body.shortCode === 'string' ? body.shortCode : '';
	rawCode = rawCode.trim();
	const urlMatch = rawCode.match(/\/(?:yoklama|checkin)\/([A-Za-z0-9_-]+)/i);
	if (urlMatch) {
		rawCode = urlMatch[1];
	}
	const shortCode = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
	if (!shortCode) return bad('Enter the 6-character attendance code displayed at the event.');
	const open = await getAttendanceWindowEvents();
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
			? bad('This code has expired; enter the current code shown on screen.', 410)
			: bad('Invalid code.', 403);
	}
	const ev = await getEventById(matchedEventId);
	if (!ev || ev.status !== 'published') return contractErrorResponse(eventsContract, 'EVENT_NOT_FOUND', 'Event not found.');
	if (!Number(ev.attendanceOpen)) return bad('Attendance is currently closed for this event.', 409);
	if (!isAttendanceTime(ev.start, ev.endTime, Date.now())) return bad('Attendance can only be recorded during the event.', 409);
	const r = await saveAttendance({ eventId: ev.id, userId: user.id, method: 'qr' });
	await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
	return NextResponse.json({
		success: true,
		already: r === 'already',
		event: { id: ev.id, title: ev.title },
		message: r === 'already' ? 'Your attendance is already recorded.' : `Attendance recorded (+${PARTICIPATION_XP} XP).`,
	});
}

export async function handleOrganiserEventAction(
	action: string,
	eventId: string,
	body: Record<string, unknown>,
	user: EventsAuthUser
): Promise<NextResponse> {
	if (!can(user, 'events', 'manage')) return bad('This action requires Events management permission.', 403);

	if (action === 'createEvent') {
		const parsed = await parseEventFields(body, false);
		if (!parsed.ok) return bad(parsed.error);
		const v = parsed.value;
		if (v.endTime! <= v.start!) return bad('End time must be after start time.');
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

	if (!eventId) return bad('Event ID is required.');
	const ev = await getEventById(eventId);
	if (!ev) return contractErrorResponse(eventsContract, 'EVENT_NOT_FOUND', 'Event not found.');

	if (action === 'updateEvent') {
		const parsed = await parseEventFields(body, true);
		if (!parsed.ok) return bad(parsed.error);
		const start = parsed.value.start ?? Number(ev.start);
		const end = parsed.value.endTime ?? Number(ev.endTime);
		if (end <= start) return bad('End time must be after start time.');
		const closes = parsed.value.status && parsed.value.status !== 'published';
		await updateEvent(eventId, { ...parsed.value, ...(closes ? { attendanceOpen: false } : {}) });
		await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }, ...notificationEvents()]);
		return NextResponse.json({ success: true });
	}

	if (action === 'setAttendance') {
		const open = body.open === true;
		if (open && ev.status !== 'published') return bad('Attendance can only be opened for a published event.');
		await updateEvent(eventId, { attendanceOpen: open });
		await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
		return NextResponse.json({ success: true, attendanceOpen: open });
	}

	if (action === 'deleteEvent') {
		const r = await deleteEvent(eventId);
		if (r === 'has_participation') return bad('Events with participation records cannot be deleted; cancel it instead.', 409);
		await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }, ...notificationEvents()]);
		return NextResponse.json({ success: true });
	}

	const attendanceWritable = (e: { status: string; attendanceOpen: number; start: number | string; endTime: number | string }) =>
		e.status === 'published' && Number(e.attendanceOpen) === 1 && isAttendanceTime(Number(e.start), Number(e.endTime), Date.now());
	const attendanceClosedMessage = 'Attendance can only be modified while open during the event.';

	if (action === 'scanTicket') {
		if (!attendanceWritable(ev)) return bad(attendanceClosedMessage, 409);
		const code = parseTicketCode(body.code);
		if (!code || !(await verifyTicketCode(code))) return bad('Invalid ticket.', 403);
		if (code.eventId !== eventId) return bad('This ticket belongs to a different event.', 409);
		const member = await getUserById(code.userId);
		if (!member) return bad('Ticket holder not found.', 404);
		const r = await saveAttendance({ eventId, userId: member.id, method: 'ticket', recorderId: user.id });
		await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
		return NextResponse.json({
			success: true,
			already: r === 'already',
			member: { id: member.id, nameSurname: `${member.name} ${member.surname}`, studentNo: member.studentNo },
			message: r === 'already' ? `${member.name} ${member.surname} already checked in.` : `${member.name} ${member.surname} — check-in recorded.`,
		});
	}

	if (action === 'manualAttendance') {
		// An organiser's manual check-in is an override: it only has to be inside the event's
		// time window, not behind the members' self check-in switch.
		if (ev.status !== 'published' || !isAttendanceTime(Number(ev.start), Number(ev.endTime), Date.now())) {
			return bad(attendanceClosedMessage, 409);
		}
		const member = await memberOf(body);
		if (!member) return bad('Member not found. Check the student number.', 404);
		if (member.status !== 'active' && member.status !== 'alumni') return bad('This member account is not active.', 409);
		const r = await saveAttendance({ eventId, userId: member.id, method: 'manual', recorderId: user.id });
		await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
		return NextResponse.json({
			success: true,
			already: r === 'already',
			member: { id: member.id, nameSurname: `${member.name} ${member.surname}`, studentNo: member.studentNo },
			message: r === 'already' ? `${member.name} ${member.surname} is already checked in.` : `${member.name} ${member.surname} added.`,
		});
	}

	if (action === 'deleteAttendance') {
		if (!attendanceWritable(ev)) return bad(attendanceClosedMessage, 409);
		const member = await memberOf(body);
		if (!member) return bad('Member not found.', 404);
		const removed = await deleteAttendance(eventId, member.id);
		if (removed) await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
		return removed ? NextResponse.json({ success: true }) : bad('No attendance record found for this member.', 404);
	}

	if (action === 'removeRegistration') {
		const member = await memberOf(body);
		if (!member) return bad('Member not found.', 404);
		const removed = await deleteEventRegistration(eventId, member.id);
		if (removed) await publishEventQuiet(getPgPool(), [{ k: 'event_updated' }]);
		return removed ? NextResponse.json({ success: true, message: 'Registration removed.' }) : bad('No registration found for this member.', 404);
	}

	return bad('Invalid action.');
}
