import { NextResponse } from 'next/server';
import { getEventById, getEventAttendeeList } from '@/db';
import { requireApp } from '@/lib/auth/access';
import { windowRemainingMs, isAttendanceTime } from '@/lib/events';
import { createAttendanceCode } from '@/lib/server/attendanceToken';

export const dynamic = 'force-dynamic';

/**
 * The code for the projector, for the current 30-second window. Organisers only,
 * and only while check-in is open and the event is on — so a code cannot be
 * minted in advance and passed around.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'events', 'yonet');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const ev = await getEventById(id);
	if (!ev) return NextResponse.json({ error: 'CommunityEvent bulunamadı.' }, { status: 404 });
	if (ev.status !== 'yayinda' || !Number(ev.yoklamaAcik)) {
		return NextResponse.json({ error: 'Önce yoklamayı açın.', code: 'YOKLAMA_KAPALI' }, { status: 409 });
	}
	const now = Date.now();
	if (!isAttendanceTime(Number(ev.baslangic), Number(ev.endTime), now)) {
		return NextResponse.json({ error: 'Attendance yalnızca etkinlik sırasında alınabilir.', code: 'ZAMAN_DISI' }, { status: 409 });
	}
	const code = await createAttendanceCode(id, now);
	const participant = (await getEventAttendeeList(id)).filter((r) => r.katilimZamani).length;
	return NextResponse.json(
		{
			// The projector shows and encodes only this short code.
			kisaKod: code.kisaKod,
			kalanMs: windowRemainingMs(now),
			katilimciSayisi: participant,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
