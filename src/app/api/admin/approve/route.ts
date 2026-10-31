import { NextResponse } from 'next/server';
import { getUserById, recordApplicationDecision } from '@/db';
import { auditContext } from '@/db/audit';
import { setMemberStatus } from '@/db/roles';
import { requireApp } from '@/lib/auth/access';
import {
	notifyMembershipApproved,
	notifyMembershipRejected,
} from '@/lib/mail/notifications';

export async function POST(request: Request) {
	// Deciding applications is managing members (the guard also enforces the role's 2FA rule).
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { userId, aksiyon } = body;
		const rejectionReason =
			typeof body.rejectionReason === 'string' ? body.rejectionReason.trim().slice(0, 500) : null;

		if (!userId || (aksiyon !== 'onayla' && aksiyon !== 'reddet')) {
			return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 });
		}

		const targetUser = await getUserById(userId);
		if (!targetUser) {
			return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
		}

		// This endpoint decides membership applications, nothing else. Without the
		// check it could be pointed at any account — including an admin's.
		if (targetUser.status !== 'beklemede') {
			return NextResponse.json(
				{ error: 'Bu kayıt için onay işlemi yapılamaz: başvuru beklemede değil.' },
				{ status: 409 }
			);
		}

		const newStatus = aksiyon === 'onayla' ? 'aktif' : 'reddedildi';
		// An approved member starts with the club's default role (none if unset:
		// they then see only their own settings until someone assigns one).
		if ((await setMemberStatus(userId, newStatus, auditContext(request, auth.user))) === 'yok') {
			return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
		}
		await recordApplicationDecision(
			userId,
			newStatus === 'aktif' ? 'approved' : 'rejected',
			auth.user.id,
			rejectionReason
		);

		// Fire-and-forget: the decision is already persisted, so a mail failure must
		// not roll it back or fail the request.
		const recipient = {
			ad: targetUser.ad,
			soyad: targetUser.soyad,
			email: targetUser.email,
		};
		if (newStatus === 'aktif') {
			notifyMembershipApproved(recipient);
		} else {
			notifyMembershipRejected(recipient);
		}

		return NextResponse.json({
			success: true,
			message: aksiyon === 'onayla'
				? `${targetUser.ad} ${targetUser.soyad} adlı üyenin başvurusu onaylandı ve hesabı aktifleşti.`
				: `${targetUser.ad} ${targetUser.soyad} adlı kişinin başvurusu reddedildi.`,
			userId,
			status: newStatus,
		});
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
