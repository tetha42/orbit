import { NextResponse } from 'next/server';
import { getEventById, getEventAttendeeList } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { windowRemainingMs, isAttendanceTime } from '@/lib/events';
import { createAttendanceCode } from '@/server/attendanceToken';

export const dynamic = 'force-dynamic';

/**
 * The code for the projector, for the current 30-second window. Organisers only,
 * and only while check-in is open and the event is on — so a code cannot be
 * minted in advance and passed around.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'events', 'manage');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const ev = await getEventById(id);
	if (!ev) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
	if (ev.status !== 'published' || !Number(ev.attendanceOpen)) {
		return NextResponse.json({ error: 'Open attendance first.', code: 'YOKLAMA_KAPALI' }, { status: 409 });
	}
	const now = Date.now();
	if (!isAttendanceTime(Number(ev.start), Number(ev.endTime), now)) {
		return NextResponse.json({ error: 'Attendance can only be taken during the event.', code: 'ZAMAN_DISI' }, { status: 409 });
	}
	const code = await createAttendanceCode(id, now);
	const participant = (await getEventAttendeeList(id)).filter((r) => r.participationTime).length;
	return NextResponse.json(
		{
			// The projector shows and encodes only this short code.
			shortCode: code.shortCode,
			remainingMs: windowRemainingMs(now),
			participantCount: participant,
			attendeeCount: participant,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
