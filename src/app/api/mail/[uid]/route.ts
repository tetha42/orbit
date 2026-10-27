import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/access';
import { getMessageDetail } from '@/lib/mail/imap';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ uid: string }> }
) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	try {
		const { uid: rawUid } = await params;
		const uid = parseInt(rawUid, 10);
		if (isNaN(uid) || uid <= 0) {
			return NextResponse.json({ error: 'Geçersiz ileti numarası (UID).' }, { status: 400 });
		}

		const url = new URL(request.url);
		const folder = url.searchParams.get('folder') || 'INBOX';

		const detail = await getMessageDetail(folder, uid);
		return NextResponse.json(detail, { headers: NO_STORE });
	} catch (error) {
		console.error('[API /api/mail/[uid] GET Error]:', error);
		return NextResponse.json(
			{ error: errorMessage(error) || 'İleti ayrıntıları alınırken bir hata oluştu.' },
			{ status: 500, headers: NO_STORE }
		);
	}
}
