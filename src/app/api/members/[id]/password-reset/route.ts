import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueMail, getPgPool, getUserById, withTransaction } from '@/db';
import { auditContext, logAuditEvent } from '@/db/audit';
import { requireApp } from '@/lib/auth/access';
import { hashOtpCode } from '@/lib/auth/otp';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { notifyPasswordResetCode } from '@/lib/mail/notifications/securityAndPortalEmails';
import { wasDelivered } from '@/lib/mail/mailer';
import { logSystemEvent } from '@/db/repositories/logs.repo';
import { ADMIN_ROLE_ID } from '@/core/permissions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * An administrator/member manager asks the system to e-mail a fresh reset code.
 * The code is never returned to the caller; it only reaches the member's inbox.
 */
export async function POST(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'members', 'manage');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'alumni') {
		return NextResponse.json({ error: 'Alumni accounts have read-only access.' }, { status: 403 });
	}

	const { id } = await params;
	const target = await getUserById(id);
	if (!target) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
	if (target.roleId === ADMIN_ROLE_ID && !auth.user.permission.admin) {
		return NextResponse.json({ error: 'Only an administrator can perform actions on an Admin account.' }, { status: 403 });
	}
	if (target.roleId === ADMIN_ROLE_ID) {
		return NextResponse.json(
			{ error: 'Email password reset is disabled for Admin accounts; use the secure administration workflow.' },
			{ status: 409 }
		);
	}

	const limit = consumeRateLimit(`pwd_admin:${auth.user.id}:${target.id}`, 3, 15 * 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Too many password reset emails sent for this member.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	const code = String(crypto.randomInt(100000, 1000000));
	const expiresAt = Date.now() + 15 * 60_000;
	const ip = clientAddress(request);

	await withTransaction(async (client) => {
		await client.query('DELETE FROM verification_tokens WHERE expires_at < $1', [Date.now()]);
		await client.query(
			`DELETE FROM verification_tokens WHERE token_type = 'password_reset' AND lower(target) = lower($1)`,
			[target.email]
		);
		await client.query(
			`INSERT INTO verification_tokens (id, user_id, token_type, target, token_hash, expires_at, created_at)
			 VALUES ($1, $2, 'password_reset', $3, $4, $5, $6)`,
			[`otp_${crypto.randomUUID()}`, target.id, target.email, hashOtpCode(code), expiresAt, Date.now()]
		);
		await logAuditEvent(client, auditContext(request, auth.user), {
			action: 'member.password_reset',
			targetType: 'member',
			targetId: target.id,
			targetName: `${target.name} ${target.surname}`.trim(),
			before: null,
			after: { email: target.email, expiresAt },
		});
	});

	const delivery = await notifyPasswordResetCode(
		{ name: target.name, surname: target.surname, email: target.email },
		code
	);
	let mailQueued = false;
	if (!wasDelivered(delivery)) {
		await getPgPool().query(
			"UPDATE verification_tokens SET expires_at = $1 WHERE lower(target) = lower($2) AND token_type = 'password_reset'",
			[Date.now() + 24 * 60 * 60_000, target.email]
		);
		await enqueueMail({
			kind: 'password_reset',
			recipient: target.email,
			subject: `Password Reset Code — ${target.name} ${target.surname}`.trim(),
			payload: { code },
			targetUserId: target.id,
			requestedBy: auth.user.id,
		});
		mailQueued = true;
	}
	await logSystemEvent({
		service: 'auth',
		level: 'INFO',
		message: `Administrator triggered password reset email: ${target.email}`,
		detail: { actorId: auth.user.id, targetId: target.id },
		userId: auth.user.id,
		ip,
	});

	return NextResponse.json({
		success: true,
		mailQueued,
		message: mailQueued
			? 'Email service is unavailable; the reset code has been queued for administrator approval.'
			: 'Password reset code sent to the member email address.',
	});
}
