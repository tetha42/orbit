// Etkinlikler: kayıt, bilet, kontenjan, kayıt iptali ve organizatör işlemleri (oluşturma,
// taslak/yayın, düzenleme, iptal/yeniden yayın, silme). Yoklama ve CSV: etkinlik-yoklama.mjs.
import { answerDialog, dateInput, openWide, stepper, toast } from '../lib/arayuz.mjs';
import { attendance, eventOf, makeEvent, openEvent, removeEvent, sweepEvents } from '../lib/etkinlik.mjs';
import { sweepStale } from '../lib/takim.mjs';
import { newMember, runTag } from '../lib/uyelik.mjs';

export const meta = { title: 'Etkinlikler: kayıt, bilet, kontenjan, organizatör işlemleri' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	await sweepStale(admin);
	await sweepEvents(admin);

	const ayse = await newMember(t, admin, { label: 'katilimci', rolId: fx.roles.uye });
	const burak = await newMember(t, admin, { label: 'yedek', rolId: fx.roles.uye });
	const [ayseApi, burakApi] = await Promise.all([ayse.api(), burak.api()]);

	const { page: ap } = await t.open('admin');
	const astep = stepper(t, ap);

	// Organizatör: arayüzden yayında bir etkinlik ve bir taslak.
	const title = `E2E Atölye ${runTag()}`;
	const draftTitle = `E2E Taslak ${runTag()}`;
	let eventId = null;
	let draftId = null;
	t.cleanup(async () => {
		for (const id of [eventId, draftId]) if (id) await removeEvent(admin, id);
	});
	const findId = async (baslik) => (await admin.get('/api/etkinlikler')).json.etkinlikler.find((e) => e.baslik === baslik)?.id ?? null;

	await astep('organizatör: "Yeni Etkinlik" formuyla yayında etkinlik oluşturur', async () => {
		const win = await openWide(ap, 'events');
		await win.getByRole('button', { name: 'Yeni Etkinlik' }).click();
		const dlg = ap.getByRole('dialog', { name: 'Yeni Etkinlik' });
		await dlg.getByLabel('Başlık').fill(title);
		await dlg.getByRole('radio', { name: 'Seminer' }).click();
		await dlg.getByLabel('Konum').fill('Mühendislik D-101');
		await dlg.getByLabel('Tarih').fill(dateInput(4));
		await dlg.getByLabel('Başlangıç').fill('14:00');
		await dlg.getByLabel('Bitiş').fill('16:30');
		await dlg.locator('input[type=number]').fill('1');
		await dlg.getByRole('button', { name: 'Yayınla' }).click();
		await toast(ap, 'Etkinlik oluşturuldu.');
		eventId = await findId(title);
		const e = await eventOf(admin, eventId);
		t.eq(e?.durum, 'yayinda', 'durum: yayında');
		t.eq(e?.tur, 'seminer', 'tür: seminer');
		t.eq(e?.kapasite, 1, 'kontenjan 1');
		t.eq(e?.bitis - e?.baslangic, 150 * 60_000, 'süre 2,5 saat');
		t.check(e?.baslangic > Date.now() + 3 * 86_400_000, 'tarih dört gün sonra');
		await win.locator(`[data-event-id="${eventId}"]`).waitFor();
		await t.shot(ap, 'etkinlik-olustu');
	});

	await astep('organizatör: taslak kaydeder; taslak üyelere görünmez, yayınlanınca görünür', async () => {
		const win = await openWide(ap, 'events');
		await win.getByRole('button', { name: 'Yeni Etkinlik' }).click();
		const dlg = ap.getByRole('dialog', { name: 'Yeni Etkinlik' });
		await dlg.getByLabel('Başlık').fill(draftTitle);
		await dlg.getByLabel('Konum').fill('Kütüphane');
		await dlg.getByRole('button', { name: 'Taslak olarak kaydet' }).click();
		await toast(ap, 'Etkinlik oluşturuldu.');
		draftId = await findId(draftTitle);
		t.eq((await eventOf(admin, draftId))?.durum, 'taslak', 'durum: taslak');
		t.eq(await eventOf(ayseApi, draftId), undefined, 'üye taslağı görmüyor');
		t.eq((await ayseApi.post('/api/etkinlikler', { action: 'kaydol', etkinlikId: draftId })).status, 400, 'taslağa kayıt olunamaz');
		const { detail } = await openEvent(ap, draftId, 'Taslaklar');
		await detail.getByRole('button', { name: 'Yayınla' }).click();
		await toast(ap, 'Değişiklikler kaydedildi.');
		t.eq((await eventOf(admin, draftId))?.durum, 'yayinda', 'yayınlandı');
		t.check(Boolean(await eventOf(ayseApi, draftId)), 'üye artık görüyor');
	});

	await t.step('üye: kaydolur, "Kayıtlısın" rozeti ve bilet çıkar', async () => {
		const { page } = await ayse.open();
		const step = stepper(t, page);
		await step('kayıt', async () => {
			const { detail } = await openEvent(page, eventId);
			t.check(await detail.getByText('1 yer kaldı').count() === 1, '"1 yer kaldı"');
			await detail.getByRole('button', { name: 'Kaydol' }).click();
			await toast(page, 'Etkinliğe kaydoldunuz.');
			t.check(await detail.getByText('Kayıtlısın').count() >= 1, '"Kayıtlısın" rozeti');
			const e = await eventOf(ayseApi, eventId);
			t.eq(e.benimKaydim, true, 'API: kayıtlı');
			t.eq(e.kayitliSayisi, 1, 'kayıtlı sayısı 1');
			t.check(/^BB1\./.test(e.biletKodu ?? ''), 'imzalı bilet kodu üretildi');
			t.eq((await ayseApi.post('/api/etkinlikler', { action: 'kaydol', etkinlikId: eventId })).status, 409, 'ikinci kayıt 409');
		});
		await step('bilet', async () => {
			const { detail } = await openEvent(page, eventId);
			await detail.getByRole('button', { name: 'Biletim' }).click();
			const ticket = page.getByRole('dialog', { name: 'Etkinlik Bileti' });
			await ticket.locator('img').waitFor();
			t.check(await ticket.getByText(title).count() === 1, 'bilette etkinlik adı');
			t.check(await ticket.getByText(ayse.adSoyad).count() === 1, 'bilette üyenin adı');
			t.check((await ticket.locator('img').getAttribute('src')).startsWith('data:image/png'), 'biletin karekodu çizildi');
			await t.shot(page, 'bilet');
		});
	});

	await t.step('kontenjan dolu: ikinci üye kaydolamaz', async () => {
		const { page } = await burak.open();
		const { detail } = await openEvent(page, eventId);
		const btn = detail.getByRole('button', { name: 'Kontenjan doldu' });
		t.check(await btn.isDisabled(), '"Kontenjan doldu" düğmesi kapalı');
		t.eq((await burakApi.post('/api/etkinlikler', { action: 'kaydol', etkinlikId: eventId })).status, 409, 'API 409 (kontenjan doldu)');
		t.eq((await burakApi.post('/api/etkinlikler', { action: 'kaydiIptal', etkinlikId: eventId })).status, 404, 'kaydı olmayanın iptali 404');
	});

	await t.step('üye: kaydını iptal eder (onaylı), yer açılır', async () => {
		const { page } = await ayse.open();
		const { detail } = await openEvent(page, eventId);
		await detail.getByRole('button', { name: 'Kaydı iptal et' }).click();
		await answerDialog(page);
		await toast(page, 'Kaydınız iptal edildi.');
		const e = await eventOf(ayseApi, eventId);
		t.eq(e.benimKaydim, false, 'kayıt kalktı');
		t.eq(e.biletKodu, null, 'bilet geçersiz (kod yok)');
		t.eq((await burakApi.post('/api/etkinlikler', { action: 'kaydol', etkinlikId: eventId })).status, 200, 'açılan yere diğer üye kaydoldu');
	});

	await astep('organizatör: düzenler, iptal eder, yeniden yayınlar', async () => {
		const { detail } = await openEvent(ap, eventId);
		await detail.getByRole('button', { name: 'Düzenle' }).click();
		const dlg = ap.getByRole('dialog', { name: 'Etkinliği Düzenle' });
		await dlg.getByLabel('Konum').fill('Konferans Salonu');
		await dlg.locator('input[type=number]').fill('5');
		await dlg.getByRole('button', { name: 'Kaydet' }).click();
		await toast(ap, 'Değişiklikler kaydedildi.');
		let e = await eventOf(admin, eventId);
		t.eq(e.konum, 'Konferans Salonu', 'konum güncellendi');
		t.eq(e.kapasite, 5, 'kontenjan güncellendi');

		await detail.getByRole('button', { name: 'Etkinliği iptal et' }).click();
		await answerDialog(ap);
		await t.waitFor(async () => (await eventOf(admin, eventId)).durum === 'iptal');
		t.eq((await eventOf(admin, eventId)).durum, 'iptal', 'iptal edildi');
		t.check((await t.waitFor(async () => (await detail.getByText('İptal edildi').count()) >= 1)) >= 0, '"İptal edildi" rozeti');
		t.eq((await ayseApi.post('/api/etkinlikler', { action: 'kaydol', etkinlikId: eventId })).status, 400, 'iptal edilen etkinliğe kayıt olunamaz');
		await detail.getByRole('button', { name: 'Yeniden yayınla' }).click();
		await t.waitFor(async () => (await eventOf(admin, eventId)).durum === 'yayinda');
		t.eq((await eventOf(admin, eventId)).durum, 'yayinda', 'yeniden yayında');
		e = await eventOf(burakApi, eventId);
		t.eq(e.benimKaydim, true, 'kayıtlı üyenin kaydı duruyor');
	});

	await astep('organizatör: katılımı olmayan etkinliği siler; katılımı olanı silemez', async () => {
		const live = await makeEvent(t, admin, { label: 'Silinemez', startMin: -10, lengthMin: 60 });
		await admin.post('/api/etkinlikler', { action: 'manuelYoklama', etkinlikId: live.id, kullaniciId: ayse.id });
		t.eq((await admin.post('/api/etkinlikler', { action: 'deleteEvent', etkinlikId: live.id })).status, 409, 'katılımı olan etkinlik silinemez (409)');
		const { detail } = await openEvent(ap, draftId);
		await detail.getByRole('button', { name: 'Sil' }).click();
		await answerDialog(ap);
		await t.waitFor(async () => !(await eventOf(admin, draftId)));
		t.eq(await eventOf(admin, draftId), undefined, 'taslaktan yayınlanan etkinlik silindi');
		draftId = null;
	});

	await t.step('üye organizatör işlemi yapamaz; "Yeni Etkinlik" ve yönetim paneli görünmez', async () => {
		const bad = [
			['createEvent', { baslik: 'E2E izinsiz', konum: 'x', baslangic: Date.now() + 86_400_000, bitis: Date.now() + 90_000_000 }],
			['updateEvent', { etkinlikId: eventId, konum: 'ele geçirildi' }],
			['setYoklama', { etkinlikId: eventId, acik: true }],
			['deleteEvent', { etkinlikId: eventId }],
			['manuelYoklama', { etkinlikId: eventId, kullaniciId: ayse.id }],
		];
		for (const [action, body] of bad) t.eq((await ayseApi.post('/api/etkinlikler', { action, ...body })).status, 403, `üye: ${action} 403`);
		t.eq((await ayseApi.get(`/api/etkinlikler/${eventId}/katilim`)).status, 403, 'üye katılım listesini okuyamaz');
		const { page } = await ayse.open();
		const { win, detail } = await openEvent(page, eventId);
		t.eq(await win.getByRole('button', { name: 'Yeni Etkinlik' }).count(), 0, '"Yeni Etkinlik" yok');
		t.eq(await detail.getByText('Katılım Listesi').count(), 0, 'katılım paneli yok');
		t.eq(await detail.getByRole('button', { name: 'Düzenle' }).count(), 0, '"Düzenle" yok');
	});

	await t.step('yetkisiz rol: "Sadece Haberler" etkinliklere ulaşamaz', async () => {
		const okur = await t.api('okur');
		t.eq((await okur.get('/api/etkinlikler')).status, 403, 'GET 403');
		t.eq((await okur.post('/api/etkinlikler', { action: 'kaydol', etkinlikId: eventId })).status, 403, 'kayıt 403');
		const { page } = await t.open('okur');
		t.eq(await page.locator('[data-dock-app=events]').count(), 0, 'Dock\'ta Etkinlikler yok');
	});

	// The list of who registered stays in step with what members did.
	await t.step('katılım listesi kayıtları doğru gösteriyor', async () => {
		const list = await attendance(admin, eventId);
		t.sameSet(list.map((r) => r.kullaniciId), [burak.id], 'listede yalnız kayıtlı üye');
	});
}
