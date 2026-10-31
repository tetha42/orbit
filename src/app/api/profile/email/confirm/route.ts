import { NextResponse } from 'next/server';
import {
	getOpenEmailChangeRequest,
	getUserByEmail,
	incrementEmailChangeAttempts,
	deleteEmailChangeRequest,
	withTransaction,
} from '@/db';
import { auditContext, logAuditEvent } from '@/db/audit';
import { memberTargetName } from '@/lib/audit';
import { verifyAuth } from '@/lib/auth/authGuard';
import { verifyOtpCode } from '@/lib/auth/otp';
import { clientAddress } from '@/lib/http';
import { notifyEmailChanged } from '@/lib/mail/notifications';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;

/** Step 2: verify the code and atomically move the account to the new address. */
export async function POST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const code = String(body?.code ?? body?.verificationCode ?? '').trim();
	if (!/^\d{6}$/.test(code)) {
		return NextResponse.json({ error: '6 haneli doğrulama kodunu girin.' }, { status: 400 });
	}

	const pending = await getOpenEmailChangeRequest(auth.user.id);
	if (!pending) {
		return NextResponse.json({ error: 'Bekleyen bir e-posta değişikliği yok.' }, { status: 400 });
	}
	if (pending.expiresAt <= Date.now()) {
		await deleteEmailChangeRequest(pending.id);
		return NextResponse.json({ error: 'Doğrulama kodunun süresi doldu. Yeni kod isteyin.' }, { status: 400 });
	}
	if (pending.attempts >= MAX_ATTEMPTS) {
		await deleteEmailChangeRequest(pending.id);
		return NextResponse.json({ error: 'Çok fazla hatalı deneme. Yeni kod isteyin.' }, { status: 429 });
	}

	if (!verifyOtpCode(pending.codeHash, code)) {
		const attempts = await incrementEmailChangeAttempts(pending.id);
		if (attempts >= MAX_ATTEMPTS) await deleteEmailChangeRequest(pending.id);
		return NextResponse.json(
			{ error: 'Doğrulama kodu geçersiz.', ...(attempts >= MAX_ATTEMPTS ? { code: 'TOO_MANY_ATTEMPTS' } : {}) },
			{ status: 400 }
		);
	}

	const taken = await getUserByEmail(pending.newEmail);
	if (taken && taken.id !== auth.user.id) {
		await deleteEmailChangeRequest(pending.id);
		return NextResponse.json({ error: 'Bu e-posta adresi artık başka bir üyede kullanılıyor.' }, { status: 409 });
	}

	try {
		const oldEmail = await withTransaction(async (client) => {
			const currentRes = await client.query(
				`SELECT first_name, last_name, email FROM users WHERE id = $1 FOR UPDATE`,
				[auth.user.id]
			);
			const current = currentRes.rows[0];
			if (!current) throw new Error('MEMBER_NOT_FOUND');
			const conflict = await client.query(
				'SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1',
				[pending.newEmail, auth.user.id]
			);
			if (conflict.rowCount) throw new Error('EMAIL_TAKEN');

			await client.query('UPDATE users SET email = $2, email_verified_at = $3 WHERE id = $1', [
				auth.user.id,
				pending.newEmail,
				Date.now(),
			]);
			await client.query('UPDATE email_change_requests SET used_at = $2 WHERE id = $1', [
				pending.id,
				Date.now(),
			]);
			await logAuditEvent(client, auditContext(request, auth.user), {
				islem: 'uye.email',
				hedefTur: 'uye',
				hedefId: auth.user.id,
				hedefAd: memberTargetName({
					ad: String(current.firstName),
					soyad: String(current.lastName),
					email: String(current.email),
				}),
				onceki: { email: String(current.email) },
				sonraki: { email: pending.newEmail },
			});
			return String(current.email);
		});

		void notifyEmailChanged(
			{ ad: auth.user.ad, soyad: auth.user.soyad, email: oldEmail },
			pending.newEmail
		);
		await logSystemEvent({
			servis: 'auth',
			seviye: 'INFO',
			mesaj: `Üye e-posta adresini değiştirdi: ${oldEmail} → ${pending.newEmail}`,
			userId: auth.user.id,
			ip: clientAddress(request),
		});
		return NextResponse.json({ success: true, email: pending.newEmail });
	} catch (error) {
		const code = error instanceof Error ? error.message : '';
		if (code === 'EMAIL_TAKEN') {
			return NextResponse.json({ error: 'Bu e-posta adresi artık başka bir üyede kullanılıyor.' }, { status: 409 });
		}
		if (code === 'MEMBER_NOT_FOUND') {
			return NextResponse.json({ error: 'Üye bulunamadı.' }, { status: 404 });
		}
		console.error('API /api/profile/email/confirm POST error:', error);
		return NextResponse.json({ error: 'E-posta değiştirilemedi.' }, { status: 500 });
	}
}
