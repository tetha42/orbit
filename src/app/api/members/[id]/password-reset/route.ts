import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueMail, getPgPool, getUserById, withTransaction } from '@/db';
import { auditContext, logAuditEvent } from '@/db/audit';
import { requireApp } from '@/lib/auth/access';
import { hashOtpCode } from '@/lib/auth/otp';
import { clientAddress } from '@/lib/http';
import { consumeRateLimit } from '@/lib/rateLimit';
import { notifyPasswordResetCode } from '@/lib/mail/notifications';
import { wasDelivered } from '@/lib/mail/mailer';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { ADMIN_ROLE_ID } from '@/core/permissions';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/**
 * An administrator/member manager asks the system to e-mail a fresh reset code.
 * The code is never returned to the caller; it only reaches the member's inbox.
 */
export async function POST(request: Request, { params }: Params) {
	const auth = await requireApp(request, 'members', 'yonet');
	if (!auth.authorized) return auth.response;
	if (auth.user.status === 'mezun') {
		return NextResponse.json({ error: 'Mezunlar sadece okuma erişimine sahiptir.' }, { status: 403 });
	}

	const { id } = await params;
	const target = await getUserById(id);
	if (!target) return NextResponse.json({ error: 'Üye bulunamadı.' }, { status: 404 });
	if (target.roleId === ADMIN_ROLE_ID && !auth.user.permission.admin) {
		return NextResponse.json({ error: 'Admin hesabı için yalnızca bir admin işlem yapabilir.' }, { status: 403 });
	}
	if (target.roleId === ADMIN_ROLE_ID) {
		return NextResponse.json(
			{ error: 'Admin hesabı için e-posta ile şifre sıfırlama kapalıdır; güvenli yönetim akışını kullanın.' },
			{ status: 409 }
		);
	}

	const limit = consumeRateLimit(`pwd_admin:${auth.user.id}:${target.id}`, 3, 15 * 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Bu üye için çok sık sıfırlama e-postası gönderildi.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	const code = String(crypto.randomInt(100000, 1000000));
	const expiresAt = Date.now() + 15 * 60_000;
	const ip = clientAddress(request);

	await withTransaction(async (client) => {
		await client.query('DELETE FROM email_verifications WHERE expires_at < $1', [Date.now()]);
		await client.query(
			`INSERT INTO email_verifications (email, code, type, expires_at, created_at)
			 VALUES ($1, $2, 'sifre_sifirlama', $3, $4)
			 ON CONFLICT (email) DO UPDATE
			 SET code = EXCLUDED.code, type = 'sifre_sifirlama',
			     expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at`,
			[target.email, hashOtpCode(code), expiresAt, Date.now()]
		);
		await logAuditEvent(client, auditContext(request, auth.user), {
			islem: 'uye.sifre_sifirlama',
			hedefTur: 'uye',
			hedefId: target.id,
			hedefAd: `${target.ad} ${target.soyad}`.trim(),
			onceki: null,
			sonraki: { email: target.email, expiresAt },
		});
	});

	const delivery = await notifyPasswordResetCode(
		{ ad: target.ad, soyad: target.soyad, email: target.email },
		code
	);
	let mailQueued = false;
	if (!wasDelivered(delivery)) {
		await getPgPool().query(
			"UPDATE email_verifications SET expires_at = $1 WHERE email = $2 AND type = 'sifre_sifirlama'",
			[Date.now() + 24 * 60 * 60_000, target.email]
		);
		await enqueueMail({
			kind: 'password_reset',
			recipient: target.email,
			subject: `Şifre Sıfırlama Kodu — ${target.ad} ${target.soyad}`.trim(),
			payload: { code },
			targetUserId: target.id,
			requestedBy: auth.user.id,
		});
		mailQueued = true;
	}
	await logSystemEvent({
		servis: 'auth',
		seviye: 'INFO',
		mesaj: `Yönetici şifre sıfırlama e-postası gönderdi: ${target.email}`,
		detay: { yapanId: auth.user.id, hedefId: target.id },
		userId: auth.user.id,
		ip,
	});

	return NextResponse.json({
		success: true,
		mailQueued,
		message: mailQueued
			? 'E-posta servisi kullanılamıyor; sıfırlama kodu yönetici onay kuyruğuna alındı.'
			: 'Şifre sıfırlama kodu üyenin e-posta adresine gönderildi.',
	});
}
