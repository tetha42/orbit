import { NextResponse } from 'next/server';
import {
	getFormFields,
	getMemberFieldValues,
	getUserSummary,
} from '@/db';
import { auditContext } from '@/db/audit';
import { verifyAuth } from '@/lib/auth/authGuard';
import { sessionUserOf } from '@/lib/auth/session';
import { seviye } from '@/lib/profile';
import { updateSelfProfile } from '@/server/members/service';

export const dynamic = 'force-dynamic';

/** The member's own profile, level, custom fields and what they have done. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	const [ozet, fields, allValues] = await Promise.all([
		getUserSummary(auth.user.id),
		getFormFields({ scope: 'profile' }),
		getMemberFieldValues(auth.user.id),
	]);
	const keys = new Set(fields.map((field) => field.fieldKey));
	const customFields: Record<string, string> = {};
	for (const [key, value] of Object.entries(allValues)) {
		if (keys.has(key)) customFields[key] = value;
	}
	return NextResponse.json(
		{
			user: { ...(await sessionUserOf(auth.user)), olusturma: auth.user.olusturma },
			seviye: seviye(Number(auth.user.xp) || 0),
			ozet,
			fields,
			customFields,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

/**
 * Edits what a member may change about themselves: bio, track, level and the
 * custom fields the community marked `selfEditable`. Name, e-mail and handle
 * stay with management (e-mail has its own verified change flow).
 */
export async function PATCH(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
		}
		const result = await updateSelfProfile(auth.user.id, body, auditContext(request, auth.user));
		if (!result.ok) {
			const failure = result as Extract<typeof result, { ok: false }>;
			return NextResponse.json(
				{
					error: failure.error,
					...(failure.fieldErrors ? { fieldErrors: failure.fieldErrors } : {}),
				},
				{ status: failure.status }
			);
		}
		return NextResponse.json({ success: true, message: 'Profiliniz güncellendi.' });
	} catch (error) {
		const code = error instanceof Error ? error.message : '';
		if (code === 'MEMBER_NOT_FOUND') {
			return NextResponse.json({ error: 'Üye bulunamadı.' }, { status: 404 });
		}
		console.error('API /api/profile PATCH error:', error);
		return NextResponse.json({ error: 'Profil güncellenemedi.' }, { status: 500 });
	}
}
