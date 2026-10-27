import { NextResponse } from 'next/server';
import { getEventById, getEventAttendeeList } from '@/db';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** Registrations and check-ins with names and student numbers — organisers only. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'events', 'yonet');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const ev = await getEventById(id);
	if (!ev) return NextResponse.json({ error: 'CommunityEvent bulunamadı.' }, { status: 404 });
	const liste = await getEventAttendeeList(id);
	return NextResponse.json({ liste }, { headers: { 'Cache-Control': 'no-store' } });
}
