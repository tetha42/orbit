import { NextResponse } from 'next/server';
import { getKulupBilgileri, setSystemSettings } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { authenticateEnrolled, can } from '@/lib/auth/access';
import { getCached, setCached, invalidateCache } from '@/lib/server/cache';

export const dynamic = 'force-dynamic';

const MAX = 80;

/** The names certificates print. Every member sees them on their own certificate. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const cached = getCached<unknown>('kulup_bilgileri');
	if (cached) {
		return NextResponse.json(cached);
	}

	const data = await getKulupBilgileri();
	setCached('kulup_bilgileri', data, 60_000);
	return NextResponse.json(data);
}

/** The board sets the university line, the club name and the two signatories. */
export async function PATCH(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;
	if (!can(auth.user, 'settings', 'yonet') && !can(auth.user, 'certificates', 'yonet')) {
		return NextResponse.json({ error: 'Bu işlem için yetkiniz bulunmuyor.' }, { status: 403 });
	}
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const next: Record<string, string> = {};
		const text = (v: unknown, field: string, required: boolean) => {
			const s = typeof v === 'string' ? v.trim() : '';
			if (required && !s) throw new Error(`${field} boş olamaz.`);
			if (s.length > MAX) throw new Error(`${field} en fazla ${MAX} karakter olabilir.`);
			return s;
		};
		if (body.universite !== undefined) next.universite = text(body.universite, 'Üniversite', true);
		if (body.kulupAdi !== undefined) next.kulup_adi = text(body.kulupAdi, 'Kulüp adı', true);
		if (body.imzalar !== undefined) {
			if (!Array.isArray(body.imzalar) || body.imzalar.length !== 2) throw new Error('İki imza satırı gönderin.');
			body.imzalar.forEach((imza: unknown, i: number) => {
				const row = (imza ?? {}) as Record<string, unknown>;
				next[`imza${i + 1}_ad`] = text(row.ad, 'İmzacı adı', false);
				next[`imza${i + 1}_unvan`] = text(row.unvan, 'Unvan', true);
			});
		}
		await setSystemSettings(next);
		invalidateCache('kulup_bilgileri');
		const fresh = await getKulupBilgileri();
		setCached('kulup_bilgileri', fresh, 60_000);
		return NextResponse.json({ success: true, ...fresh });
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message && !message.includes('\n')) return NextResponse.json({ error: message }, { status: 400 });
		console.error('API /api/kulup PATCH error:', error);
		return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500 });
	}
}
