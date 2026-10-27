import { NextResponse } from 'next/server';
import { getUserSummary, updateUserProfile } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { sessionUserOf } from '@/lib/auth/session';
import { DEPARTMENTS } from '@/data/departments';
import { BIO_MAX, SINIF_MAX, SINIF_MIN, seviye } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/** The member's own profile, level and what they have done in the club. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	const ozet = await getUserSummary(auth.user.id);
	return NextResponse.json(
		{
			user: { ...(await sessionUserOf(auth.user)), olusturma: auth.user.olusturma },
			seviye: seviye(Number(auth.user.xp) || 0),
			ozet,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

/**
 * Edits what a member may change about themselves: bio, programme and year.
 * Name, e-mail and student number identify the member and stay with management.
 */
export async function PATCH(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const patch: { bio?: string | null; bolum?: string; sinif?: number } = {};
		if (body.bio !== undefined) {
			if (body.bio !== null && typeof body.bio !== 'string') return NextResponse.json({ error: 'Geçersiz biyografi.' }, { status: 400 });
			const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
			if (bio.length > BIO_MAX) return NextResponse.json({ error: `Biyografi en fazla ${BIO_MAX} karakter olabilir.` }, { status: 400 });
			patch.bio = bio || null;
		}
		if (body.bolum !== undefined) {
			const bolum = typeof body.bolum === 'string' ? body.bolum.trim() : '';
			// A programme from the list — or the one already on record, which may predate it.
			if (bolum !== auth.user.bolum && !DEPARTMENTS.some((d) => d.name === bolum)) {
				return NextResponse.json({ error: 'Listeden bir bölüm seçin.' }, { status: 400 });
			}
			patch.bolum = bolum;
		}
		if (body.sinif !== undefined) {
			const sinif = Number(body.sinif);
			if (!Number.isInteger(sinif) || sinif < SINIF_MIN || sinif > SINIF_MAX) {
				return NextResponse.json({ error: `Sınıf ${SINIF_MIN} ile ${SINIF_MAX} arasında olmalıdır.` }, { status: 400 });
			}
			patch.sinif = sinif;
		}
		await updateUserProfile(auth.user.id, patch);
		return NextResponse.json({ success: true, message: 'Profiliniz güncellendi.' });
	} catch (error) {
		console.error('API /api/profil PATCH error:', error);
		return NextResponse.json({ error: 'Profil güncellenemedi.' }, { status: 500 });
	}
}
