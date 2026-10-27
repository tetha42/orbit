import { NextResponse } from 'next/server';
import { createDecision, deleteDecision, getPgPool, getDecisionById, getDecisions, setDecisionLock, updateDecision } from '@/db';
import { can, requireApp } from '@/lib/auth/access';
import { belgeOzeti } from '@/lib/server/documentDigest';
import { notificationEvents, publishEventQuiet } from '@/db/olaylar';

const BELGE_TURLERI = ['karar', 'salon_tahsisi', 'etkinlik_izni', 'malzeme_talep', 'ust_yazi'];
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
	// Kararlar, uygulamayı kullanan üyelere salt okunur açıktır (şeffaf kulüp ilkesi) — yalnızca
	// `kamuyaAcikMi = 0` ile işaretlenenler hariç: onları yalnız kararları yönetenler görür.
	const auth = await requireApp(request, 'decisions', 'kullan');
	if (!auth.authorized) return auth.response;

	try {
		const kararlar = await getDecisions();
		const yonetim = can(auth.user, 'decisions', 'yonet');
		const visible = yonetim ? kararlar : kararlar.filter((k) => Number(k.kamuyaAcikMi) === 1);
		// The digest is printed on the document and shown on the verification page.
		return NextResponse.json(visible.map((k) => ({ ...k, ozet: belgeOzeti(k) })));
	} catch (error) {
		console.error('API /api/kararlar GET error:', error);
		return bad('Kararlar okunamadı.', 500);
	}
}

/** Validates the editable fields; `partial` leaves absent ones out. */
function parse(body: Record<string, unknown>, partial: boolean) {
	const v: { baslik?: string; gundem?: string; icerik?: string; belgeTuru?: string; kamuyaAcikMi?: boolean } = {};
	if (!partial || body.baslik !== undefined) {
		const baslik = typeof body.baslik === 'string' ? body.baslik.trim() : '';
		if (baslik.length < 3 || baslik.length > 200) return { error: 'Başlık 3-200 karakter olmalıdır.' };
		v.baslik = baslik;
	}
	if (!partial || body.icerik !== undefined) {
		const icerik = typeof body.icerik === 'string' ? body.icerik.trim() : '';
		if (icerik.length < 10 || icerik.length > 20000) return { error: 'İçerik 10-20000 karakter olmalıdır.' };
		v.icerik = icerik;
	}
	if (!partial || body.gundem !== undefined) {
		const gundem = typeof body.gundem === 'string' ? body.gundem.trim() : '';
		if (gundem.length > 2000) return { error: 'Gündem en fazla 2000 karakter olabilir.' };
		v.gundem = gundem;
	}
	if (body.belgeTuru !== undefined || !partial) {
		const tur = body.belgeTuru ?? 'karar';
		if (typeof tur !== 'string' || !BELGE_TURLERI.includes(tur)) return { error: 'Geçersiz belge türü.' };
		v.belgeTuru = tur;
	}
	if (body.kamuyaAcikMi !== undefined) v.kamuyaAcikMi = Boolean(body.kamuyaAcikMi);
	return { value: v };
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'decisions', 'yonet');
	if (!auth.authorized) return auth.response;

	try {
		const body = (await request.json()) as Record<string, unknown>;

		// Locking freezes a document once it is signed: no edits, no deletion.
		// Unlocking is an admin's call alone.
		if (body.action === 'lock' || body.action === 'unlock') {
			const id = typeof body.id === 'string' ? body.id : '';
			if (!(await getDecisionById(id))) return bad('Belge bulunamadı.', 404);
			if (body.action === 'unlock' && !auth.user.permission.admin) return bad('Kilidi yalnızca bir admin açabilir.', 403);
			await setDecisionLock(id, body.action === 'lock');
			await publishEventQuiet(getPgPool(), [{ k: 'karar_guncellendi' }]);
			return NextResponse.json({ success: true, kilitliMi: body.action === 'lock' ? 1 : 0 });
		}

		const parsed = parse(body, false);
		if ('error' in parsed) return bad(parsed.error as string);
		const v = parsed.value;
		const result = await createDecision({
			baslik: v.baslik!,
			gundem: v.gundem ?? '',
			icerik: v.icerik!,
			belgeTuru: v.belgeTuru,
			kamuyaAcikMi: v.kamuyaAcikMi ?? true,
			olusturanId: auth.user.id,
		});
		await publishEventQuiet(getPgPool(), [{ k: 'karar_guncellendi' }, ...notificationEvents()]);
		return NextResponse.json({ ...result, ozet: belgeOzeti(result) }, { status: 201 });
	} catch (error) {
		console.error('API /api/kararlar POST error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}

/** Edits an unlocked document. */
export async function PATCH(request: Request) {
	const auth = await requireApp(request, 'decisions', 'yonet');
	if (!auth.authorized) return auth.response;
	try {
		const body = (await request.json()) as Record<string, unknown>;
		const id = typeof body.id === 'string' ? body.id : '';
		const parsed = parse(body, true);
		if ('error' in parsed) return bad(parsed.error as string);
		const r = await updateDecision(id, parsed.value);
		if (r === 'yok') return bad('Belge bulunamadı.', 404);
		if (r === 'kilitli') return bad('Kilitli belge düzenlenemez.', 409);
		await publishEventQuiet(getPgPool(), [{ k: 'karar_guncellendi' }]);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('API /api/kararlar PATCH error:', error);
		return bad('Belge güncellenemedi.', 500);
	}
}

/** Deletes an unlocked document. */
export async function DELETE(request: Request) {
	const auth = await requireApp(request, 'decisions', 'yonet');
	if (!auth.authorized) return auth.response;
	const id = new URL(request.url).searchParams.get('id') ?? '';
	const r = await deleteDecision(id);
	if (r === 'yok') return bad('Belge bulunamadı.', 404);
	if (r === 'kilitli') return bad('Kilitli belge silinemez; önce başkanın kilidi açması gerekir.', 409);
	await publishEventQuiet(getPgPool(), [{ k: 'karar_guncellendi' }]);
	return NextResponse.json({ success: true });
}
