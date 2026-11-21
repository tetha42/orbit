import { NextResponse } from 'next/server';
import {
	getMailOutbox,
	getMailOutboxPayload,
	getUserByEmail,
	getUserById,
	listMailOutbox,
	markMailOutbox,
} from '@/db';
import { requireAdmin } from '@/lib/auth/access';
import { wasDelivered } from '@/lib/mail/mailer';
import { notifyEmailVerificationCode } from '@/lib/mail/notifications/membershipEmails';
import { notifyPasswordResetCode } from '@/lib/mail/notifications/securityAndPortalEmails';
import { clientAddress } from '@/lib/http';
import { logSystemEvent } from '@/db/repositories/logs.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	return NextResponse.json(
		{ items: await listMailOutbox() },
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request);
	if (!auth.authorized) return auth.response;
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const id = typeof body.id === 'string' ? body.id : '';
	const action = String(body.action ?? '');
	if (!id || !['approve', 'reject'].includes(action)) {
		return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
	}

	const item = await getMailOutbox(id);
	if (!item || !['pending', 'failed'].includes(item.status)) {
		return NextResponse.json({ error: 'Pending outbox item not found.' }, { status: 404 });
	}

	if (action === 'reject') {
		await markMailOutbox(id, 'rejected', { approvedBy: auth.user.id });
		return NextResponse.json({ ok: true, status: 'rejected' });
	}

	const payload = await getMailOutboxPayload(id);
	const code = typeof payload?.code === 'string' ? payload.code : '';
	if (!code || !['registration_verification', 'password_reset'].includes(item.kind)) {
		await markMailOutbox(id, 'failed', {
			error: 'Could not read queued email payload.',
			approvedBy: auth.user.id,
		});
		return NextResponse.json({ error: 'Could not read queued email payload.' }, { status: 409 });
	}

	const user = item.targetUserId
		? await getUserById(item.targetUserId)
		: await getUserByEmail(item.recipient);
	const recipient = user
		? { name: user.name, surname: user.surname, email: item.recipient }
		: { name: 'Applicant', surname: '', email: item.recipient };

	const result =
		item.kind === 'registration_verification'
			? await notifyEmailVerificationCode(recipient, code)
			: await notifyPasswordResetCode(recipient, code);

	if (!wasDelivered(result)) {
		const reason = result.simulated ? 'SMTP is not configured' : result.error || 'Delivery failed';
		await markMailOutbox(id, 'failed', { error: reason, approvedBy: auth.user.id });
		await logSystemEvent({
			service: 'mail',
			level: 'WARN',
			message: `Failed to send queued email: ${item.recipient}`,
			detail: { outboxId: id, reason },
			userId: auth.user.id,
			ip: clientAddress(request),
		});
		return NextResponse.json({ error: reason }, { status: 502 });
	}

	await markMailOutbox(id, 'sent', { approvedBy: auth.user.id });
	await logSystemEvent({
		service: 'mail',
		level: 'INFO',
		message: `Queued email approved and sent: ${item.recipient}`,
		detail: { outboxId: id, kind: item.kind },
		userId: auth.user.id,
		ip: clientAddress(request),
	});
	return NextResponse.json({ ok: true, status: 'sent' });
}
