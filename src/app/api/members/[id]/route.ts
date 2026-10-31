import { NextResponse } from 'next/server';
import { getUserById } from '@/db';
import { auditContext } from '@/db/audit';
import { requireApp } from '@/lib/auth/access';
import { ADMIN_ROLE_ID } from '@/core/permissions';
import { getMemberAdminDetail, updateMemberForAdmin } from '@/server/members/service';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Full admin view of one member, including registration-only custom values. */
export async function GET(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;
	const { id } = await params;
	const detail = await getMemberAdminDetail(id);
	if (!detail) return bad('Üye bulunamadı.', 404);
	return NextResponse.json({ success: true, ...detail });
}

/**
 * Admin profile edit. Role and status are deliberately not accepted here; the
 * existing member actions own those transitions. This route only changes the
 * person's profile and custom values, in one transaction with audit.
 */
export async function PATCH(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') return bad('Mezunlar sadece okuma erişimine sahiptir.', 403);

	const { id } = await params;
	const target = await getUserById(id);
	if (!target) return bad('Üye bulunamadı.', 404);
	// Profile editing does not grant or change permissions. The only account a
	// member manager may not touch is the built-in Admin account; handing out or
	// changing roles stays behind the stricter role limit in the member actions.
	if (target.roleId === ADMIN_ROLE_ID && !auth.user.permission.admin) {
		return bad('Admin hesabının profilini yalnızca bir admin düzenleyebilir.', 403);
	}

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return bad('Geçersiz istek gövdesi.');
	}

	try {
		const result = await updateMemberForAdmin(id, body, auditContext(request, auth.user));
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
		return NextResponse.json({ success: true, ...result.detail });
	} catch (error) {
		const code = error instanceof Error ? error.message : '';
		if (code === 'MEMBER_NOT_FOUND') return bad('Üye bulunamadı.', 404);
		if (code === 'EMAIL_TAKEN') return bad('Bu e-posta adresi başka bir üyede kullanılıyor.', 409);
		if (code === 'HANDLE_TAKEN') return bad('Bu üye kimliği başka bir üyede kullanılıyor.', 409);
		console.error('API /api/members/[id] PATCH error:', error);
		return bad('Üye güncellenemedi.', 500);
	}
}
