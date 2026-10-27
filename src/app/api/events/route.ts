import { NextResponse } from 'next/server';
import {
	createEvent,
	deleteEvent,
	etkinligeKaydol,
	getOpenAttendanceEvents,
	closeFinishedAttendances,
	cancelEventRegistration,
	deleteEventRegistration,
	getEventById,
	getEventViews,
	getUserById,
	getUserByHandle,
	updateEvent,
	saveAttendance,
	deleteAttendance,
	getPgPool,
	type EventPatch,
} from '@/db';
import { notificationEvents, publishEventQuiet } from '@/db/olaylar';
import type { User } from '@/db/schema';
import { can, requireApp } from '@/lib/auth/access';
import {
	ETKINLIK_ACIKLAMA_MAX,
	ETKINLIK_BASLIK_MAX,
	ETKINLIK_DURUMLARI,
	ETKINLIK_TURLERI,
	KAPASITE_MAX,
	KATILIM_XP,
	parseBiletKodu,
	yoklamaZamaniMi,
	type EventStatus,
	type EventType,
} from '@/lib/events';
import { biletKoduDogrula, biletKoduUret, kisaKoduDogrula } from '@/lib/server/attendanceToken';

export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Every event the member may see, with counts and their own registration and
 * check-in. Who else signed up is not part of this — organisers read the list
 * from `/api/etkinlikler/[id]/katilim`.
 */
export async function GET(request: Request) {
	const auth = await requireApp(request, 'events', 'kullan');
	if (!auth.authorized) return auth.response;
	try {
		const manage = can(auth.user, 'events', 'yonet');
		// Close check-in on events that have ended, before anyone reads their state.
		await closeFinishedAttendances();
		const rows = await getEventViews(auth.user.id, manage);
		const now = Date.now();
		const etkinlikler = await Promise.all(
			rows.map(async (e) => ({
				...e,
				// A ticket for events the member is signed up for and that are not over.
				biletKodu: e.benimKaydim && Number(e.endTime) >= now ? await biletKoduUret(e.id, auth.user.id) : null,
			}))
		);
		return NextResponse.json({ etkinlikler, izinler: { manage }, sunucuZamani: now });
	} catch (error) {
		console.error('API /api/etkinlikler GET error:', error);
		return bad('Etkinlikler okunamadı.', 500);
	}
}

/** Validates the editable fields; `partial` leaves absent ones out. */
function parseEventFields(body: Record<string, unknown>, partial: boolean): { ok: true; value: EventPatch; error?: undefined } | { ok: false; value?: undefined; error: string } {
	const v: EventPatch = {};
	const has = (k: string) => body[k] !== undefined;
	if (!partial || has('baslik')) {
		const baslik = typeof body.baslik === 'string' ? body.baslik.trim() : '';
		if (baslik.length < 3) return { ok: false, error: 'CommunityEvent başlığı en az 3 karakter olmalıdır.' };
		if (baslik.length > ETKINLIK_BASLIK_MAX) return { ok: false, error: `Başlık en fazla ${ETKINLIK_BASLIK_MAX} karakter olabilir.` };
		v.baslik = baslik;
	}
	if (!partial || has('tur')) {
		const tur = body.tur ?? 'atolye';
		if (!(ETKINLIK_TURLERI as readonly unknown[]).includes(tur)) return { ok: false, error: 'Geçersiz etkinlik türü.' };
		v.tur = tur as EventType;
	}
	if (!partial || has('aciklama')) {
		const aciklama = typeof body.aciklama === 'string' ? body.aciklama.trim() : '';
		if (aciklama.length > ETKINLIK_ACIKLAMA_MAX) return { ok: false, error: 'Açıklama çok uzun.' };
		v.aciklama = aciklama;
	}
	if (!partial || has('konum')) {
		const konum = typeof body.konum === 'string' ? body.konum.trim() : '';
		if (!konum) return { ok: false, error: 'Konum zorunludur.' };
		v.konum = konum.slice(0, 120);
	}
	for (const k of ['baslangic', 'endTime'] as const) {
		if (!partial || has(k)) {
			const n = Number(body[k]);
			if (!Number.isFinite(n) || n <= 0) return { ok: false, error: 'Başlangıç ve bitiş zamanı geçerli olmalıdır.' };
			v[k] = Math.round(n);
		}
	}
	if (!partial || has('kapasite')) {
		const n = Number(body.kapasite ?? 50);
		if (!Number.isInteger(n) || n < 0 || n > KAPASITE_MAX) return { ok: false, error: `Kapasite 0 ile ${KAPASITE_MAX} arasında olmalıdır (0 = sınırsız).` };
		v.kapasite = n;
	}
	if (has('status')) {
		if (!(ETKINLIK_DURUMLARI as readonly unknown[]).includes(body.status)) return { ok: false, error: 'Geçersiz status.' };
		v.status = body.status as EventStatus;
	}
	return { ok: true, value: v };
}

async function memberOf(body: Record<string, unknown>): Promise<User | null> {
	if (typeof body.userId === 'string' && body.userId) return getUserById(body.userId);
	if (typeof body.ogrenciNo === 'string' && body.ogrenciNo.trim()) return getUserByHandle(body.ogrenciNo.trim());
	return null;
}

export async function POST(request: Request) {
	const auth = await requireApp(request, 'events', 'kullan');
	if (!auth.authorized) return auth.response;
	const user = auth.user;

	try {
		const body = (await request.json()) as Record<string, unknown>;
		const action = String(body.action ?? '');
		const etkinlikId = typeof body.etkinlikId === 'string' ? body.etkinlikId : '';

		// ---- member actions ------------------------------------------------------
		if (['kaydol', 'katil', 'rsvp', 'kaydiIptal', 'iptal', 'rsvp_iptal', 'yoklama'].includes(action)) {
			if (user.status === 'mezun') return bad('Mezunlar sadece okuma erişimine sahiptir.', 403);

			if (action === 'kaydol' || action === 'katil' || action === 'rsvp') {
				if (!etkinlikId) return bad('CommunityEvent ID zorunludur.');
				const r = await etkinligeKaydol(etkinlikId, user.id);
				const messages: Record<typeof r, [number, string]> = {
					ok: [200, 'Etkinliğe kaydoldunuz. Biletiniz hazır.'],
					zaten: [409, 'Bu etkinliğe zaten kayıtlısınız.'],
					dolu: [409, 'Kontenjan doldu.'],
					kapali: [400, 'Bu etkinlik kayda açık değil.'],
					bulunamadi: [404, 'CommunityEvent bulunamadı.'],
				};
				const [status, message] = messages[r];
				if (status === 200) await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
				return status === 200 ? NextResponse.json({ success: true, message }) : bad(message, status);
			}

			if (action === 'kaydiIptal' || action === 'iptal' || action === 'rsvp_iptal') {
				if (!etkinlikId) return bad('CommunityEvent ID zorunludur.');
				const r = await cancelEventRegistration(etkinlikId, user.id);
				if (r === 'basladi') return bad('CommunityEvent başladıktan sonra kayıt iptal edilemez.');
				if (r === 'yok') return bad('Bu etkinlik için kaydınız bulunmuyor.', 404);
				await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
				return NextResponse.json({ success: true, message: 'Kaydınız iptal edildi.' });
			}

			// action === 'yoklama': the 6-character code shown on the projector (camera or typed).
			// It names no event by itself, so match it against the events checking in right now.
			let rawKod = typeof body.kisaKod === 'string' ? body.kisaKod : typeof body.kod === 'string' ? body.kod : '';
			rawKod = rawKod.trim();
			const urlMatch = rawKod.match(/\/yoklama\/([A-Za-z0-9_-]+)/i);
			if (urlMatch) {
				rawKod = urlMatch[1];
			}
			const kisaKod = rawKod.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
			if (!kisaKod) return bad('Attendance için etkinlikte gösterilen 6 haneli kodu girin.');
			const acik = await getOpenAttendanceEvents();
			let eventId: string | null = null;
			let expired = false;
			for (const id of acik) {
				const r = await kisaKoduDogrula(id, kisaKod);
				if (r === 'gecerli') {
					eventId = id;
					break;
				}
				if (r === 'suresi-doldu') expired = true;
			}
			if (!eventId) {
				return expired
					? bad('Kodun süresi doldu; ekrandaki güncel kodu girin.', 410)
					: bad('Kod geçersiz.', 403);
			}
			const ev = await getEventById(eventId);
			if (!ev || ev.status !== 'yayinda') return bad('CommunityEvent bulunamadı.', 404);
			if (!Number(ev.yoklamaAcik)) return bad('Bu etkinlikte yoklama şu anda kapalı.', 409);
			if (!yoklamaZamaniMi(ev.baslangic, ev.endTime, Date.now())) return bad('Attendance yalnızca etkinlik sırasında alınabilir.', 409);
			const r = await saveAttendance({ etkinlikId: ev.id, userId: user.id, yontem: 'qr' });
			await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
			return NextResponse.json({
				success: true,
				zaten: r === 'zaten',
				etkinlik: { id: ev.id, baslik: ev.baslik },
				message: r === 'zaten' ? 'Yoklamanız zaten alınmış.' : `Yoklamanız alındı (+${KATILIM_XP} XP).`,
			});
		}

		// ---- organiser actions -----------------------------------------------------
		if (!can(user, 'events', 'yonet')) return bad('Bu işlem Etkinlikler uygulamasında yönetim yetkisi gerektirir.', 403);

		if (action === 'createEvent') {
			const parsed = parseEventFields(body, false);
			if (!parsed.ok) return bad(parsed.error);
			const v = parsed.value;
			if (v.endTime! <= v.baslangic!) return bad('Bitiş, başlangıçtan sonra olmalıdır.');
			const created = await createEvent({
				baslik: v.baslik!,
				tur: v.tur,
				aciklama: v.aciklama,
				konum: v.konum,
				baslangic: v.baslangic!,
				endTime: v.endTime!,
				kapasite: v.kapasite,
				olusturanId: user.id,
				status: body.status === 'taslak' ? 'taslak' : 'yayinda',
			});
			await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }, ...notificationEvents()]);
			return NextResponse.json({ success: true, ...created }, { status: 201 });
		}

		if (!etkinlikId) return bad('CommunityEvent ID zorunludur.');
		const ev = await getEventById(etkinlikId);
		if (!ev) return bad('CommunityEvent bulunamadı.', 404);

		if (action === 'updateEvent') {
			const parsed = parseEventFields(body, true);
			if (!parsed.ok) return bad(parsed.error);
			const start = parsed.value.baslangic ?? Number(ev.baslangic);
			const end = parsed.value.endTime ?? Number(ev.endTime);
			if (end <= start) return bad('Bitiş, başlangıçtan sonra olmalıdır.');
			// Cancelling or completing an event also closes check-in.
			const closes = parsed.value.status && parsed.value.status !== 'yayinda';
			await updateEvent(etkinlikId, { ...parsed.value, ...(closes ? { yoklamaAcik: false } : {}) });
			await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }, ...notificationEvents()]);
			return NextResponse.json({ success: true });
		}

		if (action === 'setYoklama') {
			const acik = body.acik === true;
			if (acik && ev.status !== 'yayinda') return bad('Yalnızca yayındaki bir etkinlikte yoklama açılabilir.');
			await updateEvent(etkinlikId, { yoklamaAcik: acik });
			await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
			return NextResponse.json({ success: true, yoklamaAcik: acik });
		}

		if (action === 'deleteEvent') {
			const r = await deleteEvent(etkinlikId);
			if (r === 'katilim-var') return bad('Katılım kaydı olan etkinlik silinemez; bunun yerine iptal edin.', 409);
			await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }, ...notificationEvents()]);
			return NextResponse.json({ success: true });
		}

		// Organiser attendance writes (ticket, manual, removal) only while the event is running.
		const yoklamaYazilabilir = (e: { status: string; yoklamaAcik: number; baslangic: number | string; endTime: number | string }) =>
			e.status === 'yayinda' && Number(e.yoklamaAcik) === 1 && yoklamaZamaniMi(Number(e.baslangic), Number(e.endTime), Date.now());
		const yoklamaKapaliMesaj = 'Attendance yalnızca açık ve etkinlik sırasında değiştirilebilir.';

		if (action === 'biletOkut') {
			if (!yoklamaYazilabilir(ev)) return bad(yoklamaKapaliMesaj, 409);
			const kod = parseBiletKodu(body.kod);
			if (!kod || !(await biletKoduDogrula(kod))) return bad('Bilet geçersiz.', 403);
			if (kod.etkinlikId !== etkinlikId) return bad('Bu bilet başka bir etkinliğe ait.', 409);
			const member = await getUserById(kod.userId);
			if (!member) return bad('Bilet sahibi bulunamadı.', 404);
			const r = await saveAttendance({ etkinlikId, userId: member.id, yontem: 'bilet', kaydedenId: user.id });
			await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
			return NextResponse.json({
				success: true,
				zaten: r === 'zaten',
				uye: { id: member.id, adSoyad: `${member.ad} ${member.soyad}`, ogrenciNo: member.ogrenciNo },
				message: r === 'zaten' ? `${member.ad} ${member.soyad} zaten giriş yaptı.` : `${member.ad} ${member.soyad} — giriş kaydedildi.`,
			});
		}

		if (action === 'manuelYoklama') {
			if (!yoklamaYazilabilir(ev)) return bad(yoklamaKapaliMesaj, 409);
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı. Öğrenci numarasını kontrol edin.', 404);
			if (member.status !== 'aktif' && member.status !== 'mezun') return bad('Bu üyenin hesabı aktif değil.', 409);
			const r = await saveAttendance({ etkinlikId, userId: member.id, yontem: 'manuel', kaydedenId: user.id });
			await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
			return NextResponse.json({
				success: true,
				zaten: r === 'zaten',
				uye: { id: member.id, adSoyad: `${member.ad} ${member.soyad}`, ogrenciNo: member.ogrenciNo },
				message: r === 'zaten' ? `${member.ad} ${member.soyad} zaten listede.` : `${member.ad} ${member.soyad} eklendi.`,
			});
		}

		if (action === 'deleteAttendance') {
			if (!yoklamaYazilabilir(ev)) return bad(yoklamaKapaliMesaj, 409);
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı.', 404);
			const removed = await deleteAttendance(etkinlikId, member.id);
			if (removed) await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
			return removed ? NextResponse.json({ success: true }) : bad('Bu üyenin yoklama kaydı yok.', 404);
		}

		if (action === 'kayitSil') {
			const member = await memberOf(body);
			if (!member) return bad('Üye bulunamadı.', 404);
			const removed = await deleteEventRegistration(etkinlikId, member.id);
			if (removed) await publishEventQuiet(getPgPool(), [{ k: 'etkinlik_guncellendi' }]);
			return removed ? NextResponse.json({ success: true, message: 'Kayıt silindi.' }) : bad('Bu üyenin kaydı bulunamadı.', 404);
		}

		return bad('Geçersiz işlem.');
	} catch (error) {
		console.error('API /api/etkinlikler POST error:', error);
		return bad('İşlem tamamlanamadı.', 500);
	}
}
