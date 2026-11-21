import { NextResponse } from 'next/server';
import { getUserById, recordApplicationDecision } from '@/db';
import { auditContext } from '@/db/audit';
import { setMemberStatus } from '@/db/roles';
import { requireApp } from '@/lib/auth/access';
import {
	notifyMembershipApproved,
	notifyMembershipRejected,
} from '@/lib/mail/notifications/membershipStatusEmails';

export async function POST(request: Request) {
	// Deciding applications is managing members (the guard also enforces the role's 2FA rule).
	const auth = await requireApp(request, 'members', 'manage');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const userId = body.userId;
		const action = body.action;
		const rejectionReason =
			typeof body.rejectionReason === 'string' ? body.rejectionReason.trim().slice(0, 500) : null;

		const isApproval = action === 'approve';
		const isRejection = action === 'reject';
		if (!userId || (!isApproval && !isRejection)) {
			return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 });
		}

		const targetUser = await getUserById(userId);
		if (!targetUser) {
			return NextResponse.json({ error: 'User not found.' }, { status: 404 });
		}

		// This endpoint decides membership applications, nothing else. Without the
		// check it could be pointed at any account — including an admin's.
		if (targetUser.status !== 'pending') {
			return NextResponse.json(
				{ error: 'This account cannot be decided: application is not pending.' },
				{ status: 409 }
			);
		}

		const newStatus = isApproval ? 'active' : 'rejected';
		// An approved member starts with the club's default role (none if unset:
		// they then see only their own settings until someone assigns one).
		if ((await setMemberStatus(userId, newStatus, auditContext(request, auth.user))) === 'none') {
			return NextResponse.json({ error: 'User not found.' }, { status: 404 });
		}
		await recordApplicationDecision(
			userId,
			newStatus === 'active' ? 'approved' : 'rejected',
			auth.user.id,
			rejectionReason
		);

		// Fire-and-forget: the decision is already persisted, so a mail failure must
		// not roll it back or fail the request.
		const recipient = {
			name: targetUser.firstName || targetUser.name || '',
			surname: targetUser.lastName || targetUser.surname || '',
			email: targetUser.email,
			preferredLanguage: targetUser.preferredLanguage,
		};
		if (newStatus === 'active') {
			notifyMembershipApproved(recipient);
		} else {
			notifyMembershipRejected(recipient);
		}

		return NextResponse.json({
			success: true,
			message: isApproval
				? `Application approved and account activated for ${targetUser.name} ${targetUser.surname}.`
				: `Application rejected for ${targetUser.name} ${targetUser.surname}.`,
			userId,
			status: newStatus,
		});
	} catch (error) {
		console.error('API error:', error);
		return NextResponse.json({ error: 'Request could not be completed.' }, { status: 500 });
	}
}
