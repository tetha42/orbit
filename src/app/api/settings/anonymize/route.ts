import { NextResponse } from 'next/server';
import { anonymizeMember } from '@/db';
import { auditContext } from '@/db/audit';
import { requireAdmin } from '@/lib/auth/access';

export const dynamic = 'force-dynamic';

/** Irreversibly replaces a member's direct identifiers; IDs and evidence stay. */
export async function POST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const userId = typeof body?.userId === 'string' ? body.userId : '';
	if (!userId) return NextResponse.json({ error: 'Üye seçilmedi.' }, { status: 400 });
	if (userId === auth.user.id) {
		return NextResponse.json({ error: 'Kendi hesabınızı anonimleştiremezsiniz.' }, { status: 409 });
	}
	if (body?.confirm !== 'ANONYMIZE') {
		return NextResponse.json({ error: 'Onay metni eşleşmiyor.' }, { status: 400 });
	}

	const result = await anonymizeMember(userId, auditContext(request, auth.user));
	if (result === 'yok') return NextResponse.json({ error: 'Üye bulunamadı.' }, { status: 404 });
	if (result === 'admin') {
		return NextResponse.json({ error: 'Admin hesabı anonimleştirilemez.' }, { status: 409 });
	}
	return NextResponse.json({ ok: true });
}
