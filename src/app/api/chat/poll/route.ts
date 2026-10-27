import { NextResponse } from 'next/server';
import { requireApp } from '@/lib/auth/access';
import { canUserAccessChatRoom, createPollInRoom, castPollVote, closePoll } from '@/server/db/domains/chat.repo';
import { logSystemEvent } from '@/server/db/domains/logs.repo';
import { clientAddress } from '@/lib/http';

export const dynamic = 'force-dynamic';

const NO_CACHE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
	const auth = await requireApp(request, 'chat', 'kullan');
	if (!auth.authorized) return auth.response;

	const isAdmin = Boolean(auth.user.permission?.admin || auth.user.roleId === 'admin');

	try {
		const body = await request.json();
		const { action } = body;

		if (action === 'create') {
			if (!isAdmin) {
				return NextResponse.json(
					{ error: 'Yalnızca yöneticiler anket oluşturabilir.' },
					{ status: 403, headers: NO_CACHE }
				);
			}

			const { odaId, soru, secenekler, cokluSecim, anonim, endsAt } = body;

			if (!odaId || !soru || typeof soru !== 'string' || !soru.trim()) {
				return NextResponse.json(
					{ error: 'Anket sorusu boş olamaz.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const canAccess = await canUserAccessChatRoom(String(odaId), auth.user.id, isAdmin);
			if (!canAccess) {
				return NextResponse.json(
					{ error: 'Bu sohbet odasına erişim yetkiniz yok.' },
					{ status: 403, headers: NO_CACHE }
				);
			}

			if (!Array.isArray(secenekler) || secenekler.length < 2 || secenekler.length > 12) {
				return NextResponse.json(
					{ error: 'Ankette en az 2, en fazla 12 seçenek belirtilmelidir.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await createPollInRoom(
				odaId,
				{
					id: auth.user.id,
					ad: auth.user.ad,
					soyad: auth.user.soyad,
					profilFoto: auth.user.profilFoto || null,
				},
				{
					soru: soru.trim().slice(0, 500),
					secenekler: secenekler.map((s: unknown) => String(s ?? '').slice(0, 200)),
					cokluSecim: Boolean(cokluSecim),
					anonim: anonim !== false,
					endsAt: typeof endsAt === 'number' ? endsAt : null,
				}
			);

			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Anket oluşturulamadı.' }, { status: 400, headers: NO_CACHE });
			}

			void logSystemEvent({
				servis: 'chat',
				seviye: 'INFO',
				mesaj: `Yeni anket oluşturuldu: "${soru.trim().slice(0, 50)}" (${odaId})`,
				detay: { odaId, pollId: res.message?.anket?.id, soru: soru.trim().slice(0, 120) },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		if (action === 'vote') {
			const { pollId, secenekId } = body;
			if (!pollId || !secenekId) {
				return NextResponse.json(
					{ error: 'Anket veya seçenek kimliği belirtilmedi.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await castPollVote(
				String(pollId),
				String(secenekId),
				{
					id: auth.user.id,
					ad: auth.user.ad,
					soyad: auth.user.soyad,
					profilFoto: auth.user.profilFoto || null,
				},
				isAdmin
			);

			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Oy kullanılamadı.' }, { status: 400, headers: NO_CACHE });
			}

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		if (action === 'close') {
			const { pollId } = body;
			if (!pollId) {
				return NextResponse.json(
					{ error: 'Anket kimliği belirtilmedi.' },
					{ status: 400, headers: NO_CACHE }
				);
			}

			const res = await closePoll(pollId, auth.user.id, isAdmin);
			if (!res.ok) {
				return NextResponse.json({ error: res.error || 'Anket kapatılamadı.' }, { status: 400, headers: NO_CACHE });
			}

			void logSystemEvent({
				servis: 'chat',
				seviye: 'INFO',
				mesaj: `Anket sonlandırıldı: ${pollId}`,
				detay: { pollId },
				userId: auth.user.id,
				ip: clientAddress(request),
			});

			return NextResponse.json(res, { headers: NO_CACHE });
		}

		return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400, headers: NO_CACHE });
	} catch (err) {
		console.error('[Chat poll POST error]:', err);
		return NextResponse.json({ error: 'İşlem sırasında bir hata oluştu.' }, { status: 500, headers: NO_CACHE });
	}
}
