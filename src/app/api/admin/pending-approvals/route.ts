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
			ad: u.ad,
			soyad: u.soyad,
			email: u.email,
			ogrenciNo: u.ogrenciNo,
			bolum: u.bolum,
			sinif: u.sinif,
			olusturma: u.olusturma,
		}));

		return NextResponse.json({ count: users.length, users });
	} catch (error) {
		console.error('API /api/admin/onay-bekleyenler GET error:', error);
		return NextResponse.json({ error: 'Başvurular okunamadı.' }, { status: 500 });
	}
}
