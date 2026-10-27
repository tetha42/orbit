import { NextResponse } from 'next/server';
import { addMailReply, getMailParticipantIds, getMailThread, setMailThreadStatus } from '@/db/posta';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';
import { aliciKarari, epostaIleHaberVer } from '@/lib/server/posta';
import { atlananAciklamasi, POSTA_DAKIKA_LIMITI, POSTA_GOVDE_MAX, POSTA_ISLEMLERI, type PostaGonderimSonucu, type PostaIslemi } from '@/lib/posta';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
/** Somebody else's conversation and one that does not exist look the same, so its existence is not given away. */
const notFound = () => NextResponse.json({ error: 'Konu bulunamadı.' }, { status: 404, headers: NO_STORE });

/** The conversation, if the caller is part of it. Reading does not mark it read; PATCH `okundu` does. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const { id } = await params;
		const konu = await getMailThread(auth.user.id, id);
		if (!konu) return notFound();
		return NextResponse.json(konu, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/posta/[id] GET error:', error);
		return NextResponse.json({ error: 'Konu okunamadı.' }, { status: 500, headers: NO_STORE });
	}
}

/** Replies to everyone in the conversation. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	try {
		const { id } = await params;
		const konu = await getMailThread(user.id, id);
		if (!konu) return notFound();

		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		const govde = typeof body?.govde === 'string' ? body.govde.trim() : '';
		if (!govde || govde.length > POSTA_GOVDE_MAX) {
			return NextResponse.json({ error: `Mesaj 1 ile ${POSTA_GOVDE_MAX} karakter arasında olmalıdır.` }, { status: 400 });
		}
		const limit = consumeRateLimit(`posta:${user.id}`, POSTA_DAKIKA_LIMITI, 60_000);
		if (!limit.allowed) {
			return NextResponse.json({ error: 'Çok hızlı mesaj gönderiyorsunuz. Biraz bekleyin.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
		}

		const karar = await aliciKarari(user.id, await getMailParticipantIds(id), false);
		if (karar.hata) return NextResponse.json({ error: karar.hata }, { status: 400 });
		const { gidecek, atlananlar } = karar;
		// Everyone else has left or lost Mail: the reply would reach nobody.
		if (gidecek.length === 0) {
			return NextResponse.json({ error: atlananlar.map(atlananAciklamasi).join(' ') || 'Yanıtın gideceği kimse kalmadı.', atlananlar }, { status: 422 });
		}

		const mesajId = await addMailReply(id, user.id, govde, gidecek.map((u) => u.id));
		epostaIleHaberVer(gidecek, user, konu.konu);
		const sonuc: PostaGonderimSonucu = { konuId: id, mesajId, atlananlar };
		return NextResponse.json(sonuc, { status: 201 });
	} catch (error) {
		console.error('API /api/posta/[id] POST error:', error);
		return NextResponse.json({ error: 'Yanıt gönderilemedi.' }, { status: 500 });
	}
}

/** `{ action }`: okundu, okunmadi, arsivle, gelene (back to the inbox), cope, sil (from the trash, for good — for the caller only). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const { id } = await params;
		const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
		const action = body?.action as PostaIslemi;
		if (!POSTA_ISLEMLERI.includes(action)) return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 });
		const konu = await getMailThread(auth.user.id, id);
		if (!konu) return notFound();
		if (action === 'sil' && konu.klasor !== 'cop') {
			return NextResponse.json({ error: 'Kalıcı silmek için konu önce çöp kutusunda olmalıdır.' }, { status: 400 });
		}
		await setMailThreadStatus(auth.user.id, id, action);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/posta/[id] PATCH error:', error);
		return NextResponse.json({ error: 'İşlem tamamlanamadı.' }, { status: 500 });
	}
}
