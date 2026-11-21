import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { closeFinishedAttendances, getEventViews } from '@/db';
import { can, requireApp } from '@/lib/auth/access';
import { createTicketCode } from '@/server/attendanceToken';
import { bad } from './validators';
import { handleMemberEventAction, handleOrganiserEventAction } from './handlers';

export const dynamic = 'force-dynamic';

const MEMBER_ACTIONS = new Set([
	'register',
	'join',
	'rsvp',
	'cancelRegistration',
	'cancelled',
	'rsvp_cancel',
	'attend',
	'checkin',
]);

/**
 * Every event the member may see, with counts and their own registration and
 * check-in. Organisers read full attendee lists from the attendance endpoint.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'events', 'use');
	if (!auth.authorized) return auth.response;
	try {
		const manage = can(auth.user, 'events', 'manage');
		await closeFinishedAttendances();
		const rows = await getEventViews(auth.user.id, manage);
		const now = Date.now();
		const events = await Promise.all(
			rows.map(async (e) => ({
				...e,
				ticketCode: e.myRecord && Number(e.endTime) >= now ? await createTicketCode(e.id, auth.user.id) : null,
			}))
		);
		return NextResponse.json({ events, permissions: { manage }, serverTime: now });
	} catch (error) {
		console.error('API /api/events GET error:', error);
		return bad('Failed to load events.', 500);
	}
}

async function handlePOST(request: Request) {
	const auth = await requireApp(request, 'events', 'use');
	if (!auth.authorized) return auth.response;

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const action = String(body.action ?? '');
		const eventId = typeof body.eventId === 'string' ? body.eventId : '';

		if (MEMBER_ACTIONS.has(action)) {
			return handleMemberEventAction(action, eventId, body, auth.user);
		}
		return handleOrganiserEventAction(action, eventId, body, auth.user);
	} catch (error) {
		console.error('API /api/events POST error:', error);
		return bad('Could not complete event action.', 500);
	}
}

export const POST = withAudit(handlePOST, { action: 'events.create', target: 'events' });
