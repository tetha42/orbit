import { NextResponse } from 'next/server';
import { getUnreadMailCount } from '@/db/messages';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** How many inbox conversations have something unread. */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const count = await getUnreadMailCount(auth.user.id);
		return NextResponse.json({ count, sayi: count }, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('API /api/messages/unread error:', error);
		return NextResponse.json({ error: 'Okunmamış sayısı okunamadı.' }, { status: 500 });
	}
}
