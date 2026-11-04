import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { getCommunityProfile, setSystemSettings } from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { authenticateEnrolled, can } from '@/lib/auth/access';
import { getCached, setCached, invalidateCache } from '@/server/cache';

export const dynamic = 'force-dynamic';

const MAX = 80;

/** The names certificates print. Every member sees them on their own certificate. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const cached = getCached<unknown>('club_info');
	if (cached) {
		return NextResponse.json(cached);
	}

	const data = await getCommunityProfile();
	setCached('club_info', data, 60_000);
	return NextResponse.json(data);
}

/** The board sets the university line, the club name and the two signatories. */
async function handlePATCH(request: Request) {
	const auth = await authenticateEnrolled(request);
	if (!auth.authorized) return auth.response;
	if (!can(auth.user, 'settings', 'manage') && !can(auth.user, 'certificates', 'manage')) {
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
		if (body.university !== undefined) next.university = text(body.university, 'Studio', true);
		if (body.clubName !== undefined) next.club_name = text(body.clubName, 'Community name', true);
		if (body.signatures !== undefined) {
			if (!Array.isArray(body.signatures) || body.signatures.length !== 2) throw new Error('İki imza satırı gönderin.');
			body.signatures.forEach((signature: unknown, i: number) => {
				const row = (signature ?? {}) as Record<string, unknown>;
				next[`imza${i + 1}_ad`] = text(row.name, 'İmzacı adı', false);
				next[`imza${i + 1}_unvan`] = text(row.rank, 'Unvan', true);
			});
		}
		await setSystemSettings(next);
		invalidateCache('club_info');
		const fresh = await getCommunityProfile();
		setCached('club_info', fresh, 60_000);
		return NextResponse.json({ success: true, ...fresh });
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message && !message.includes('\n')) return NextResponse.json({ error: message }, { status: 400 });
		console.error('API /api/community PATCH error:', error);
		return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500 });
	}
}

export const PATCH = withAudit(handlePATCH, { action: 'community.update', target: 'community' });
