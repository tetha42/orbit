import { NextResponse } from 'next/server';
import { getCertificates, createCertificate, deleteCertificate, createEventCertificates, getEventById, getUserById } from '@/db';
import { can, requireApp } from '@/lib/auth/access';

export async function GET(request: Request) {
	// Previously unauthenticated: with no `userId` this returned every
	// member's certificates to anyone who asked.
	const auth = await requireApp(request, 'certificates', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		const requested = searchParams.get('userId');

		// Members may only list their own; those who manage certificates may list anyone's.
		const userId = can(auth.user, 'certificates', 'yonet') ? requested || undefined : auth.user.id;

		const certs = await getCertificates(userId);
		return NextResponse.json(certs);
	} catch (error) {
		console.error('API /api/sertifikalar GET error:', error);
		return NextResponse.json({ error: 'Sertifikalar okunamadı.' }, { status: 500 });
	}
}

export async function POST(request: Request) {
	// Issuing a certificate mints a publicly verifiable credential, so it is a
	// management action.
	const auth = await requireApp(request, 'certificates', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const body = await request.json();
		const { userId, etkinlikId, pdfUrl, kategori, dil, aciklama } = body;
		const baslik = typeof body.baslik === 'string' ? body.baslik.trim() : '';
		if (!baslik || baslik.length > 160) {
			return NextResponse.json({ error: 'Başlık zorunludur (en fazla 160 karakter).' }, { status: 400 });
		}

		// Everyone who attended an event, in one go; those who already hold one are skipped.
		if (body.action === 'bulk') {
			const ev = typeof etkinlikId === 'string' ? await getEventById(etkinlikId) : null;
			if (!ev) return NextResponse.json({ error: 'CommunityEvent bulunamadı.' }, { status: 404 });
			const r = await createEventCertificates(ev.id, baslik, {
				kategori: typeof kategori === 'string' ? kategori : undefined,
				dil: typeof dil === 'string' ? dil : undefined,
				aciklama: typeof aciklama === 'string' ? aciklama.trim() : undefined,
			});
			return NextResponse.json({
				success: true,
				...r,
				message: r.verilen
					? `${r.verilen} katılımcıya sertifika verildi${r.zatenVar ? `, ${r.zatenVar} kişide zaten vardı` : ''}.`
					: 'Yeni sertifika verilecek katılımcı yok.',
			});
		}

		if (!userId) {
			return NextResponse.json({ error: 'Kullanıcı ve Başlık zorunludur.' }, { status: 400 });
		}
		if (!(await getUserById(userId))) return NextResponse.json({ error: 'Üye bulunamadı.' }, { status: 404 });

		const result = await createCertificate({
			userId,
			baslik,
			etkinlikId: etkinlikId || undefined,
			pdfUrl: pdfUrl || undefined,
			kategori: typeof kategori === 'string' ? kategori : undefined,
			dil: typeof dil === 'string' ? dil : undefined,
			aciklama: typeof aciklama === 'string' ? aciklama.trim() : undefined,
		});

		return NextResponse.json({ success: true, id: result.id, verificationCode: result.verificationCode });
	} catch (error) {
		console.error('API /api/sertifikalar POST error:', error);
		return NextResponse.json({ error: 'Certificate oluşturulamadı.' }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'certificates', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'Certificate ID zorunludur.' }, { status: 400 });
		}

		const deleted = await deleteCertificate(id);
		if (!deleted) {
			return NextResponse.json({ error: 'Certificate bulunamadı veya silinemedi.' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Certificate iptal edildi.' });
	} catch (error) {
		console.error('API /api/sertifikalar DELETE error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
