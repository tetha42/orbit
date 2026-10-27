import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/authGuard';
import { deleteWebauthnCredential, getWebauthnCredentials } from '@/db';

/** Lists the caller's own passkeys for the settings panel. */
export async function GET(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	try {
		const credentials = await getWebauthnCredentials(auth.user.id);

		return NextResponse.json({
			success: true,
			// Only non-sensitive metadata: the public key and counter stay server-side.
			passkeys: credentials.map((c) => ({
				id: c.id,
				nickname: c.nickname,
				deviceType: c.deviceType,
				backedUp: Number(c.backedUp) === 1,
				olusturma: c.olusturma,
				sonKullanma: c.sonKullanma,
			})),
		});
	} catch (error) {
		console.error('API /api/auth/passkey GET error:', error);
		return NextResponse.json({ error: 'Passkey listesi okunamadı.' }, { status: 500 });
	}
}

/** Removes one of the caller's passkeys. */
export async function DELETE(request: Request) {
	const auth = await verifyAuth(request);
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json().catch(() => ({}));
		const id = String(body.id ?? '').trim();
		if (!id) {
			return NextResponse.json({ error: 'Passkey kimliği zorunludur.' }, { status: 400 });
		}

		// Scoped by user id inside the query, so one member cannot remove another's.
		const removed = await deleteWebauthnCredential(id, auth.user.id);
		if (!removed) {
			return NextResponse.json({ error: 'Passkey bulunamadı.' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Passkey kaldırıldı.' });
	} catch (error) {
		console.error('API /api/auth/passkey DELETE error:', error);
		return NextResponse.json({ error: 'Passkey kaldırılamadı.' }, { status: 500 });
	}
}
