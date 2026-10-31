import { NextResponse } from 'next/server';
import { getMemberRoster } from '@/db';
import { requireApp } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** A small, directory-safe member picker for committee membership. */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'decisions', 'kullan');
	if (!auth.authorized) return auth.response;
	const rows = await getMemberRoster();
	const members = rows
		.filter((member) => member.status === 'aktif')
		.map((member) => ({
			id: member.id,
			ad: member.ad,
			soyad: member.soyad,
			email: member.email,
			bolum: member.bolum,
		}))
		.sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`));
	return NextResponse.json({ members }, { headers: { 'Cache-Control': 'no-store' } });
}
