import { NextResponse } from 'next/server';
import { createMailThread, getMailThreads, getUnreadMailCount } from '@/db/posta';
import { requireApp } from '@/lib/auth/access';
import { consumeRateLimit } from '@/lib/rateLimit';
import { aliciKarari, epostaIleHaberVer } from '@/lib/server/posta';
import {
	atlananAciklamasi,
	POSTA_ALICI_MAX,
	POSTA_DAKIKA_LIMITI,
	POSTA_GOVDE_MAX,
	POSTA_KLASORLERI,
	POSTA_KONU_MAX,
	POSTA_SAYFA_BOYUTU,
	type PostaGonderimSonucu,
	type MailFolder,
	type PostaKonuListesi,
} from '@/lib/posta';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** One folder of the caller's own conversations, a page at a time. */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const params = new URL(request.url).searchParams;
		const klasor = (params.get('klasor') ?? 'gelen') as MailFolder;
		if (!POSTA_KLASORLERI.includes(klasor)) return NextResponse.json({ error: 'Geçersiz klasör.' }, { status: 400, headers: NO_STORE });
		const sayfa = Math.max(1, Math.floor(Number(params.get('sayfa'))) || 1);
		const [liste, okunmamis] = await Promise.all([
			getMailThreads(auth.user.id, klasor, sayfa),
			getUnreadMailCount(auth.user.id),
		]);
		const body: PostaKonuListesi = { klasor, ...liste, sayfa, sayfaBoyutu: POSTA_SAYFA_BOYUTU, simdi: Date.now(), okunmamis };
		return NextResponse.json(body, { headers: NO_STORE });
	} catch (error) {
		console.error('API /api/posta GET error:', error);
		return NextResponse.json({ error: 'Posta okunamadı.' }, { status: 500, headers: NO_STORE });
	}
}

/**
 * Starts a conversation with one or more members. Recipients must be active members
 * whose role opens Mail; the others are reported back (`atlananlar`) and the
 * message goes to the rest — or, when nobody can be reached, nowhere (422).
 */
export async function POST(request: Request) {
	const auth = await requireApp(request, 'mail', 'kullan');
	if (!auth.authorized) return auth.response;
	const user = auth.user;
	try {
		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		const konu = typeof body?.konu === 'string' ? body.konu.trim() : '';
		const govde = typeof body?.govde === 'string' ? body.govde.trim() : '';
		const alicilar = Array.isArray(body?.alicilar) ? body.alicilar.filter((x): x is string => typeof x === 'string') : [];
		if (!konu || konu.length > POSTA_KONU_MAX) {
			return NextResponse.json({ error: `Konu 1 ile ${POSTA_KONU_MAX} karakter arasında olmalıdır.` }, { status: 400 });
		}
		if (!govde || govde.length > POSTA_GOVDE_MAX) {
			return NextResponse.json({ error: `Mesaj 1 ile ${POSTA_GOVDE_MAX} karakter arasında olmalıdır.` }, { status: 400 });
		}
		const ids = [...new Set(alicilar)].filter((id) => id !== user.id);
		if (ids.length === 0) return NextResponse.json({ error: 'En az bir alıcı seçin (kendinize mesaj gönderemezsiniz).' }, { status: 400 });
		if (ids.length > POSTA_ALICI_MAX) return NextResponse.json({ error: `En fazla ${POSTA_ALICI_MAX} alıcı seçilebilir.` }, { status: 400 });

		const limit = consumeRateLimit(`posta:${user.id}`, POSTA_DAKIKA_LIMITI, 60_000);
		if (!limit.allowed) {
			return NextResponse.json({ error: 'Çok hızlı mesaj gönderiyorsunuz. Biraz bekleyin.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } });
		}

		const karar = await aliciKarari(user.id, ids, true);
		if (karar.hata) return NextResponse.json({ error: karar.hata }, { status: 400 });
		const { gidecek, atlananlar } = karar;
		if (gidecek.length === 0) {
			return NextResponse.json({ error: atlananlar.map(atlananAciklamasi).join(' '), atlananlar }, { status: 422 });
		}

		const { konuId, mesajId } = await createMailThread(user.id, konu, govde, gidecek.map((u) => u.id));
		epostaIleHaberVer(gidecek, user, konu);
		const sonuc: PostaGonderimSonucu = { konuId, mesajId, atlananlar };
		return NextResponse.json(sonuc, { status: 201 });
	} catch (error) {
		console.error('API /api/posta POST error:', error);
		return NextResponse.json({ error: 'Mesaj gönderilemedi.' }, { status: 500 });
	}
}
