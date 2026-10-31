import { withAudit } from '@/lib/audit/withAudit';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/access';
import { performMailAction, emptyTrashFolder } from '@/lib/mail/imap';
import { errorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const ALLOWED_ACTIONS = [
	'read',
	'unread',
	'star',
	'unstar',
	'trash',
	'restore',
	'delete',
	'emptyTrash',
] as const;
type ActionType = (typeof ALLOWED_ACTIONS)[number];

async function handlePOST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { folder = 'INBOX', uid: rawUid, uids: rawUids, action } = body;

		if (!action || !ALLOWED_ACTIONS.includes(action as ActionType)) {
			return NextResponse.json({ error: 'Geçersiz e-posta eylemi.' }, { status: 400 });
		}

		if (action === 'emptyTrash') {
			const result = await emptyTrashFolder(folder);
			if (!result.success) {
				return NextResponse.json(
					{ error: result.message || 'Çöp kutusu boşaltılamadı.' },
					{ status: 500 }
				);
			}
			return NextResponse.json({ success: true, action: 'emptyTrash', folder });
		}

		let uids: number[] = [];
		if (Array.isArray(rawUids)) {
			uids = rawUids
				.map((n) => parseInt(String(n), 10))
				.filter((n) => !isNaN(n) && n > 0);
		} else if (rawUid !== undefined) {
			const parsed = parseInt(String(rawUid), 10);
			if (!isNaN(parsed) && parsed > 0) {
				uids = [parsed];
			}
		}

		if (uids.length === 0) {
			return NextResponse.json({ error: 'Geçersiz ileti numarası (UID).' }, { status: 400 });
		}

		type MessageActionType = Exclude<ActionType, 'emptyTrash'>;
		const result = await performMailAction(folder, uids, action as MessageActionType);
		if (!result.success) {
			return NextResponse.json(
				{ error: result.message || 'İşlem gerçekleştirilemedi.' },
				{ status: 500 }
			);
		}

		return NextResponse.json({ success: true, action, uids, count: uids.length });
	} catch (error) {
		return NextResponse.json(
			{ error: errorMessage(error) || 'E-posta işlemi sırasında bir hata oluştu.' },
			{ status: 500 }
		);
	}
}

export const POST = withAudit(handlePOST, { action: 'mail.action.create', target: 'mail.action' });
