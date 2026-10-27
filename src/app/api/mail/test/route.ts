import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/access';
import { getFolderMessages, getMessageDetail } from '@/lib/mail/imap';
import { errorMessage } from '@/lib/errors';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) {
		await logSystemEvent({
			servis: 'mail',
			seviye: 'WARN',
			mesaj: 'Unauthorized /api/mail/test access attempt blocked',
			ip: clientAddress(request),
		});
		return auth.response;
	}

	try {
		const list = await getFolderMessages('INBOX', 1, 5);
		if (!list.messages || list.messages.length === 0) {
			return NextResponse.json({ success: false, error: 'Gelen kutusunda ileti bulunamadı.' });
		}

		const firstUid = list.messages[0].uid;
		const detail = await getMessageDetail('INBOX', firstUid);
		return NextResponse.json({ success: true, firstUid, detail });
	} catch (err: unknown) {
		console.error('[TEST GET MESSAGE DETAIL ERROR]:', err);
		return NextResponse.json(
			{
				success: false,
				error: errorMessage(err) || 'İleti testi başarısız oldu.',
			},
			{ status: 500 }
		);
	}
}
