import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import {
	getOpenEmailChangeRequest,
	getUserByEmail,
	replaceEmailChangeRequest,
} from '@/db';
import { verifyAuth } from '@/lib/auth/authGuard';
import { hashOtpCode } from '@/lib/auth/otp';
import { clientAddress } from '@/lib/http';
import { isValidEmail } from '@/lib/mail/address';
import { notifyEmailChangeCode } from '@/lib/mail/notifications';
import { consumeRateLimit } from '@/lib/rateLimit';
import { logSystemEvent } from '@/server/db/domains/logs.repo';

export const dynamic = 'force-dynamic';

const CODE_TTL_MS = 15 * 60_000;

/** Current pending request, without the code. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	const pending = await getOpenEmailChangeRequest(auth.user.id);
	return NextResponse.json(
		{
			success: true,
			pending: pending && pending.expiresAt > Date.now()
				? { newEmail: pending.newEmail, expiresAt: pending.expiresAt }
				: null,
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}

/**
 * Step 1: ask for a verification code at the new address. The e-mail is not
 * changed until the code is confirmed.
 */
export async function POST(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;
	if (auth.user.status !== 'aktif') {
		return NextResponse.json({ error: 'Yalnızca aktif hesaplar e-posta değiştirebilir.' }, { status: 403 });
	}

	const limit = consumeRateLimit(`email-change:${auth.user.id}`, 5, 60 * 60_000);
	if (!limit.allowed) {
		return NextResponse.json(
			{ error: 'Çok sık e-posta değişikliği talebinde bulundunuz. Lütfen daha sonra tekrar deneyin.' },
			{ status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
		);
	}

	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const newEmail = String(body?.newEmail ?? body?.email ?? '').trim().toLowerCase();
	if (!isValidEmail(newEmail)) {
		return NextResponse.json({ error: 'Geçerli bir e-posta adresi girin.' }, { status: 400 });
	}
	if (newEmail === auth.user.email.trim().toLowerCase()) {
		return NextResponse.json({ error: 'Yeni e-posta adresi mevcut adresinizle aynı olamaz.' }, { status: 400 });
	}
	const existing = await getUserByEmail(newEmail);
	if (existing && existing.id !== auth.user.id) {
		return NextResponse.json({ error: 'Bu e-posta adresi başka bir üyede kullanılıyor.' }, { status: 409 });
	}

	const code = String(randomInt(100000, 1000000));
	await replaceEmailChangeRequest({
		userId: auth.user.id,
		newEmail,
		codeHash: hashOtpCode(code),
		expiresAt: Date.now() + CODE_TTL_MS,
		ip: clientAddress(request),
		userAgent: request.headers.get('user-agent'),
	});

	void notifyEmailChangeCode(
		{ ad: auth.user.ad, soyad: auth.user.soyad, email: newEmail },
		code
	);
	await logSystemEvent({
		servis: 'auth',
		seviye: 'INFO',
		mesaj: `E-posta değişikliği doğrulama kodu istendi: ${auth.user.email} → ${newEmail}`,
		userId: auth.user.id,
		ip: clientAddress(request),
	});

	return NextResponse.json({
		success: true,
		requireCode: true,
		newEmail,
		message: 'Yeni adrese 6 haneli bir doğrulama kodu gönderildi.',
	});
}
