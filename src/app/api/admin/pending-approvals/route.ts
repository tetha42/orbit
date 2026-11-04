import { NextResponse } from 'next/server';
import { getPendingUsers } from '@/db';
import { requireApp } from '@/lib/auth/access';
import type { PendingApplicant } from '@/types/session';

/**
 * Membership applications awaiting a decision.
 *
 * Deciding applications is part of managing members. Only the fields the
 * reviewer needs leave the server (whole rows once leaked password hashes).
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const pending = await getPendingUsers();

		const users: PendingApplicant[] = pending.map((u) => ({
			id: u.id,
			firstName: u.firstName ?? u.name,
			lastName: u.lastName ?? u.surname,
			name: u.firstName ?? u.name,
			surname: u.lastName ?? u.surname,
			email: u.email,
			handle: u.handle ?? u.studentNo,
			studentNo: u.handle ?? u.studentNo,
			department: u.department ?? u.department,
			grade: u.grade ?? u.grade,
			createdAt: u.createdAt ?? u.creation ?? 0,
			creation: u.createdAt ?? u.creation ?? 0,
		}));

		return NextResponse.json({ count: users.length, users });
	} catch (error) {
		console.error('API /api/admin/onay-bekleyenler GET error:', error);
		return NextResponse.json({ error: 'Başvurular okunamadı.' }, { status: 500 });
	}
}
