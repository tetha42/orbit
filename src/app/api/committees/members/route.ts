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
			name: member.name,
			surname: member.surname,
			email: member.email,
			department: member.department,
		}))
		.sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`));
	return NextResponse.json({ members }, { headers: { 'Cache-Control': 'no-store' } });
}
