// Posta (portal içi üyeden üyeye mesajlaşma): iki geçici üye arasında tarayıcıdan uçtan uca
// yazışma (yazma + alıcı otomatik tamamlama, bildirim ve Dock rozeti, okundu, yanıt, arşiv,
// çöp, kalıcı silme), başkasının konusu için 404, mail:yok rolünde uygulamanın hiçbir
// yerde görünmemesi + API 403, "Sadece Haberler" rolüne bildirim gitmemesi ve alıcının
// rolü Posta'yı açmıyorsa gönderene bilgi dönmesi. Paket kendi üyelerini kurar, bitince siler.
import { answerDialog, toast } from '../lib/arayuz.mjs';
import { dockApps, openApp, showLauncherApps } from '../lib/browser.mjs';
import { newMember, runTag } from '../lib/uyelik.mjs';

export const meta = { title: 'Posta: yazışma, yanıt, okundu, arşiv/çöp, 404, yetki, bildirim' };

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const tag = runTag();

	const ayse = await newMember(t, admin, { label: 'posta-a', rolId: fx.roles.uye });
	const berk = await newMember(t, admin, { label: 'posta-b', rolId: fx.roles.uye });
	const yabanci = await newMember(t, admin, { label: 'posta-y', rolId: fx.roles.uye });
	const haber = await newMember(t, admin, { label: 'posta-h', rolId: fx.roles.haber });
	const [aApi, bApi, yApi, hApi] = await Promise.all([ayse.api(), berk.api(), yabanci.api(), haber.api()]);

	const konu = `E2E Posta ${tag}`;
	const govde = `Merhaba, bu uçtan uca bir test mesajıdır (${tag}).`;
	let konuId = null;

	const inbox = async (api, klasor = 'gelen') => must(await api.get(`/api/posta?klasor=${klasor}`), `liste ${klasor}`);
	const thread = async (api, id = konuId) => api.get(`/api/posta/${encodeURIComponent(id)}`);

	await t.step('API: mail:yok rolü Posta uçlarının hiçbirine giremez (403)', async () => {
		for (const path of ['/api/posta', '/api/posta/okunmamis', '/api/posta/alicilar', '/api/posta/ayarlar', '/api/posta/yok-boyle-bir-konu']) {
			t.eq((await hApi.get(path)).status, 403, `GET ${path} → 403`);
		}
		t.eq((await hApi.post('/api/posta', { konu: 'x', govde: 'y', alicilar: [berk.id] })).status, 403, 'POST /api/posta → 403');
		t.eq((await hApi.patch('/api/posta/yok', { action: 'okundu' })).status, 403, 'PATCH → 403');
	});

	await t.step('API: gönderim doğrulamaları (alıcı, uzunluk, aktif üye, kendine)', async () => {
		const post = (body) => aApi.post('/api/posta', body);
		t.eq((await post({ konu, govde, alicilar: [] })).status, 400, 'alıcısız 400');
		t.eq((await post({ konu, govde, alicilar: [ayse.id] })).status, 400, 'yalnız kendine 400');
		t.eq((await post({ konu, govde, alicilar: ['olmayan-uye-kimligi'] })).status, 400, 'olmayan alıcı 400');
		t.eq((await post({ konu: '', govde, alicilar: [berk.id] })).status, 400, 'boş konu 400');
		t.eq((await post({ konu: 'k'.repeat(121), govde, alicilar: [berk.id] })).status, 400, 'konu sınırı (120) 400');
		t.eq((await post({ konu, govde: ' ', alicilar: [berk.id] })).status, 400, 'boş gövde 400');
		t.eq((await post({ konu, govde: 'g'.repeat(10_001), alicilar: [berk.id] })).status, 400, 'gövde sınırı (10000) 400');
		t.eq((await post({ konu, govde, alicilar: Array.from({ length: 21 }, (_, i) => `x${i}`) })).status, 400, 'en fazla 20 alıcı');
		// Aktif olmayan üye (mezun): alıcı olamaz.
		const mezun = await newMember(t, admin, { label: 'posta-m', rolId: fx.roles.uye });
		t.eq((await admin.patch('/api/uyeler', { id: mezun.id, durum: 'mezun' })).status, 200, 'üye mezun yapıldı');
		t.eq((await post({ konu, govde, alicilar: [berk.id, mezun.id] })).status, 400, 'aktif olmayan alıcı 400');
		t.eq((await inbox(bApi)).toplam, 0, 'hiçbir reddedilen istek mesaj bırakmadı');
	});

	await t.step('API: alıcının rolü Posta’yı açmıyorsa mesaj gitmez, gönderene bilgi döner', async () => {
		const only = await aApi.post('/api/posta', { konu: `${konu} yalnız`, govde, alicilar: [haber.id] });
		t.eq(only.status, 422, 'tek alıcı Posta’sız: 422, konu oluşmadı');
		t.eq(only.json?.atlananlar?.[0]?.neden, 'rol', 'neden: rol');
		t.check(/rolü Posta'yı açmıyor/.test(only.json?.error ?? ''), 'hata metni "rolü Posta\'yı açmıyor" diyor', only.json?.error);
		t.check((only.json?.error ?? '').includes('posta-h'), 'hata metni alıcının adını söylüyor', only.json?.error);
		t.eq((await inbox(aApi, 'gonderilen')).toplam, 0, 'gönderilenlerde konu yok');
	});

	await t.step('arayüz (ayşe): Posta açılır, alıcı otomatik tamamlamayla yeni mesaj yazar', async () => {
		const { page } = await ayse.open();
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-folder=gelen]').waitFor();
		await win.locator('[data-mail-empty]').waitFor();
		t.eq(await win.locator('[data-mail-empty]').count(), 1, 'gelen kutusu boş');
		await win.locator('[data-mail-compose]').click();
		const sheet = page.getByRole('dialog', { name: 'Yeni Mesaj' });
		await sheet.waitFor();
		const input = sheet.locator('[data-mail-recipient-input]');
		await input.fill(berk.soyad);
		const option = sheet.locator(`[data-mail-option="${berk.id}"]`);
		await option.waitFor();
		t.eq(await sheet.locator(`[data-mail-option="${ayse.id}"]`).count(), 0, 'kendisi öneride yok');
		// Posta’yı açmayan üye önerilir ama seçilemez.
		await input.fill(haber.soyad);
		const closed = sheet.locator(`[data-mail-option="${haber.id}"]`);
		await closed.waitFor();
		t.check(await closed.isDisabled(), 'Posta’sız rol seçilemez (kapalı)');
		t.check(/Posta’yı açmıyor/.test(await closed.innerText()), 'nedeni yazıyor');
		await input.fill(berk.soyad);
		await option.click();
		t.eq(await sheet.locator(`[data-mail-chip="${berk.id}"]`).count(), 1, 'alıcı çip olarak eklendi');
		await sheet.locator('[data-mail-subject]').fill(konu);
		await sheet.locator('[data-mail-body]').fill(govde);
		await t.shot(page, 'yazma-penceresi');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, 'Mesaj gönderildi.');
		await sheet.waitFor({ state: 'detached' });
		const sent = await inbox(aApi, 'gonderilen');
		konuId = sent.konular[0]?.id;
		t.eq(sent.konular[0]?.konu, konu, 'gönderilenlerde konu var');
		// Gönderilenler klasörü açılır ve konu seçili gelir.
		await win.locator(`[data-mail-thread="${konuId}"]`).waitFor();
		const msg = win.locator('[data-mail-message]');
		await msg.first().waitFor();
		t.eq(await msg.count(), 1, 'konuda tek mesaj');
		t.check((await msg.first().innerText()).includes(govde), 'mesaj metni görünüyor');
		t.eq(await win.locator('[data-mail-subject-line]').innerText(), konu, 'konu başlığı');
		await t.shot(page, 'ayse-gonderildi');
	});

	await t.step('alıcıda: bildirim paneli "message" türüyle, Dock rozeti, okunmamış sayısı', async () => {
		const feed = must(await bApi.get('/api/bildirimler'), 'bildirimler');
		const item = feed.items.find((i) => i.id === `message:${konuId}`);
		t.eq(item?.kind, 'message', 'bildirim türü "message"');
		t.eq(item?.priority, 'info', 'bilgi bildirimi');
		t.eq(item?.target, { appId: 'mail', kind: 'thread', itemId: konuId }, 'hedef: Posta/konu');
		t.eq(item?.data?.title, konu, 'başlık konu');
		t.eq(feed.counts.unreadMessages, 1, 'counts.unreadMessages 1');
		t.eq(must(await bApi.get('/api/posta/okunmamis'), 'okunmamis').sayi, 1, '/api/posta/okunmamis 1');

		const { page } = await berk.open();
		const badge = page.locator('[data-dock-app=mail] [data-dock-badge]');
		await badge.waitFor();
		t.eq(await badge.getAttribute('data-dock-badge'), '1', 'Dock rozeti 1');
		await page.locator('[data-notification-toggle]').click();
		const row = page.locator(`[data-notification-panel] [data-notification-item="message:${konuId}"]`);
		await row.waitFor();
		t.check((await row.innerText()).includes(konu), 'panel satırında konu var');
		t.check((await row.innerText()).includes('posta-a'), 'panel satırında gönderen var');
		await t.shot(page, 'berk-bildirim');

		// Satıra tıklamak Posta’yı açıp konuyu seçer; açılınca konu okunur ve rozet söner.
		await row.locator('button.nc-row-main').click();
		const win = page.locator('[data-window-frame=mail]');
		await win.waitFor();
		await win.locator('[data-mail-message]').first().waitFor();
		t.check((await win.locator('[data-mail-message]').first().innerText()).includes(govde), 'konu açıldı, mesaj görünüyor');
		await badge.waitFor({ state: 'detached' });
		t.eq(must(await bApi.get('/api/posta/okunmamis'), 'okunmamis').sayi, 0, 'konu açılınca okundu: sayı 0');
		t.eq((await thread(bApi)).json.mesajlar.every((m) => m.okundu), true, 'API: tüm mesajlar okundu');
		await t.shot(page, 'berk-okundu');
	});

	await t.step('okundu / okunmadı: konuyu açmak okur, "Okunmadı Yap" geri alır', async () => {
		const row = (await inbox(bApi)).konular.find((k) => k.id === konuId);
		t.eq(row?.okunmamis, 0, 'liste: okunmamış 0');
		t.eq((await bApi.patch(`/api/posta/${konuId}`, { action: 'okunmadi' })).status, 200, 'okunmadı işareti 200');
		t.eq(must(await bApi.get('/api/posta/okunmamis'), 'okunmamis').sayi, 1, 'okunmamış sayısı 1');
		t.eq((await bApi.patch(`/api/posta/${konuId}`, { action: 'okundu' })).status, 200, 'okundu işareti 200');
		t.eq(must(await bApi.get('/api/posta/okunmamis'), 'okunmamis').sayi, 0, 'okunmamış sayısı 0');
		t.eq((await bApi.patch(`/api/posta/${konuId}`, { action: 'uc' })).status, 400, 'geçersiz işlem 400');
	});

	await t.step('arayüz (berk): yanıt; ayşe yanıtı okunmamış görür', async () => {
		const page = (await berk.open()).page;
		const win = await openApp(page, 'mail');
		await win.locator(`[data-mail-thread="${konuId}"]`).click();
		await win.locator('[data-mail-reply]').fill('Yanıt: mesajınız ulaştı, teşekkürler.');
		await win.locator('[data-mail-reply-send]').click();
		await toast(page, 'Yanıt gönderildi.');
		await win.locator('[data-mail-message]').nth(1).waitFor();
		t.eq(await win.locator('[data-mail-message]').count(), 2, 'konuda iki mesaj');
		t.eq((await thread(aApi)).json.mesajlar.length, 2, 'ayşe için de iki mesaj');
		t.eq(await win.locator('[data-mail-reply]').inputValue(), '', 'yanıt kutusu boşaldı');

		const a = (await ayse.open()).page;
		const aWin = await openApp(a, 'mail');
		await aWin.locator('[data-mail-folder=gelen] [data-mail-unread="1"]').waitFor();
		t.check(true, 'ayşe: gelen kutusu sayacı 1');
		await aWin.locator(`[data-mail-thread="${konuId}"][data-unread]`).waitFor();
		await t.shot(a, 'ayse-yanit-geldi');
		await aWin.locator(`[data-mail-thread="${konuId}"]`).click();
		await aWin.locator('[data-mail-message]').nth(1).waitFor();
		t.check((await aWin.locator('[data-mail-message]').nth(1).innerText()).includes('mesajınız ulaştı'), 'ayşe yanıtı okuyor');
		await aWin.locator('[data-mail-folder=gelen] [data-mail-unread]').waitFor({ state: 'detached' });
		t.eq(must(await aApi.get('/api/posta/okunmamis'), 'okunmamis').sayi, 0, 'okununca ayşenin sayısı 0');
	});

	await t.step('başkasının konusu: açma, yanıtlama, işlem, arama → 404 (varlık sızmaz)', async () => {
		const g = await thread(yApi);
		t.eq(g.status, 404, 'yabancı: GET 404');
		const gone = await thread(yApi, 'hic-olmayan-bir-konu');
		t.eq(gone.status, 404, 'olmayan konu: GET 404');
		t.eq(JSON.stringify(g.json), JSON.stringify(gone.json), 'iki yanıt aynı: konunun varlığı belli olmuyor');
		t.eq((await yApi.post(`/api/posta/${konuId}`, { govde: 'sızma' })).status, 404, 'yabancı: yanıt 404');
		t.eq((await yApi.patch(`/api/posta/${konuId}`, { action: 'cope' })).status, 404, 'yabancı: çöpe atma 404');
		t.eq((await yApi.patch(`/api/posta/${konuId}`, { action: 'sil' })).status, 404, 'yabancı: silme 404');
		t.eq((await thread(aApi)).json.mesajlar.length, 2, 'konu bozulmadı');
		const q = (api) => api.get(`/api/search?q=${encodeURIComponent(tag)}`).then((r) => (r.json?.hits ?? []).filter((h) => h.kind === 'message').map((h) => h.id));
		t.includes(await q(bApi), `message:${konuId}`, 'aramada katılımcı konuyu buluyor');
		t.eq(await q(yApi), [], 'aramada yabancı bulamıyor');
		t.eq(await q(hApi), [], 'mail:yok rolü aramada mesaj görmüyor');
	});

	await t.step('arayüz (berk): arşivle → gelene taşı → çöp → kalıcı sil (yalnız kendi kutusundan)', async () => {
		const page = (await berk.open()).page;
		const win = await openApp(page, 'mail');
		const row = win.locator(`[data-mail-thread="${konuId}"]`);
		await row.click();
		await win.locator('[data-mail-action=arsivle]').click();
		await toast(page, 'Konu arşivlendi.');
		await row.waitFor({ state: 'detached' });
		t.eq((await inbox(bApi, 'arsiv')).konular.map((k) => k.id), [konuId], 'API: arşivde');
		t.eq((await inbox(bApi)).toplam, 0, 'API: gelen kutusunda yok');

		await win.locator('[data-mail-folder=arsiv]').click();
		await row.click();
		await win.locator('[data-mail-action=gelene]').click();
		await toast(page, 'Konu gelen kutusuna taşındı.');
		t.eq((await inbox(bApi)).konular.map((k) => k.id), [konuId], 'API: yeniden gelen kutusunda');

		await win.locator('[data-mail-folder=gelen]').click();
		await row.click();
		await win.locator('[data-mail-action=cope]').click();
		await toast(page, 'Konu çöpe atıldı.');
		t.eq((await inbox(bApi, 'cop')).konular.map((k) => k.id), [konuId], 'API: çöpte');
		await win.locator('[data-mail-folder=cop]').click();
		await row.click();
		await win.locator('[data-mail-action=sil]').waitFor();
		t.eq(await win.locator('[data-mail-action=cope]').count(), 0, 'çöpteki konuda "Çöpe At" yok');
		await t.shot(page, 'berk-cop');
		await win.locator('[data-mail-action=sil]').click();
		await answerDialog(page, true);
		await toast(page, 'Konu silindi.');
		t.eq((await thread(bApi)).status, 404, 'silinen konu berk için 404');
		t.eq((await thread(aApi)).status, 200, 'ayşe konuyu hâlâ görüyor');
		t.eq((await bApi.patch(`/api/posta/${konuId}`, { action: 'cope' })).status, 404, 'silinmiş konuda işlem 404');
	});

	await t.step('API: kalıcı silme yalnız çöpteki konuda; yeni mesaj arşivdeki konuyu gelene döndürür', async () => {
		const made = must(await aApi.post('/api/posta', { konu: `${konu} ikinci`, govde, alicilar: [berk.id, yabanci.id] }), 'ikinci konu');
		const id = made.konuId;
		t.eq(made.atlananlar, [], 'herkese ulaştı');
		t.eq((await bApi.patch(`/api/posta/${id}`, { action: 'sil' })).status, 400, 'gelen kutusundaki konu doğrudan silinemez (400)');
		t.eq((await bApi.patch(`/api/posta/${id}`, { action: 'arsivle' })).status, 200, 'berk arşivler');
		t.eq((await inbox(bApi)).konular.length, 0, 'berkin gelen kutusu boş');
		must(await aApi.post(`/api/posta/${id}`, { govde: 'ikinci mesaj' }), 'yanıt');
		t.eq((await inbox(bApi)).konular.map((k) => k.id), [id], 'yeni mesaj konuyu gelen kutusuna döndürdü');
		t.eq((await inbox(bApi)).konular[0]?.okunmamis, 2, 'iki okunmamış mesaj');
		t.eq(must(await bApi.get('/api/posta/okunmamis'), 'okunmamis').sayi, 1, 'okunmamış sayısı konu sayısıdır (1)');
		t.eq((await inbox(yApi)).konular.length, 1, 'üçüncü alıcı da aldı');
		// Berk'in rolü Posta'yı kapatır; yabancı hâlâ var: yanıt yalnız ona gider ve berk atlananlarda görünür.
		const roleId = await newRole(t, admin, tag);
		t.eq((await admin.patch('/api/uyeler', { id: berk.id, rolId: roleId })).status, 200, 'berkin rolü Posta’sız yapıldı');
		await t.sleep(5500); // izin önbelleği
		t.eq((await bApi.get('/api/posta')).status, 403, 'berk: API 403');
		const reply = await aApi.post(`/api/posta/${id}`, { govde: 'berk artık okuyamaz' });
		t.eq(reply.status, 201, 'yanıt yine de gider (yabancıya)');
		t.eq(reply.json?.atlananlar?.map((a) => [a.id, a.neden]), [[berk.id, 'rol']], 'berk atlananlarda: rol');
		t.eq((await admin.patch('/api/uyeler', { id: berk.id, rolId: fx.roles.uye })).status, 200, 'berkin rolü geri verildi');
		await t.sleep(5500);
	});

	await t.step('"Sadece Haberler" rolü: Dock, mobil başlatıcı, Spotlight ve bildirimde Posta yok', async () => {
		const feed = must(await hApi.get('/api/bildirimler'), 'bildirimler');
		t.excludes(feed.items.map((i) => i.kind), 'message', 'bildirimde message türü yok');
		t.eq(feed.counts.unreadMessages, 0, 'unreadMessages 0');
		const { page } = await haber.open();
		await page.locator('[data-dock-app=news]').waitFor();
		t.excludes(await dockApps(page), 'mail', 'Dock’ta Posta yok');
		await page.keyboard.press('Control+Space');
		const box = page.getByRole('combobox');
		await box.fill('Posta');
		await page.getByRole('listbox').or(page.locator('[aria-label="Arama sonuçları"]')).first().waitFor();
		await page.waitForTimeout(400);
		t.check(!/Posta/.test(await page.locator('[aria-label="Arama sonuçları"]').innerText()), 'Spotlight Posta’yı önermiyor');
		await page.keyboard.press('Escape');
		const mobile = (await haber.open({ mobile: true })).page;
		await showLauncherApps(mobile);
		await mobile.locator('[data-launcher-app=news]').waitFor();
		t.excludes(await mobile.locator('[data-launcher-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-launcher-app'))), 'mail', 'mobil başlatıcıda Posta yok');
		await t.shot(page, 'haber-masaustu');
		// Karşılaştırma: Posta’lı rolde Spotlight uygulamayı önerir.
		const u = (await ayse.open()).page;
		await u.locator('[data-dock-app=mail]').waitFor();
		await u.keyboard.press('Control+Space');
		await u.getByRole('combobox').fill('Posta');
		await u.locator('[aria-label="Arama sonuçları"]').getByText('Posta').first().waitFor();
		t.check(true, 'Posta’lı rolde Spotlight Posta’yı öneriyor');
	});

	await t.step('"e-postayla da haber ver" ayarı kaydedilir ve gönderimi bozmaz', async () => {
		t.eq(must(await bApi.get('/api/posta/ayarlar'), 'ayar').epostaIleHaber, false, 'varsayılan kapalı');
		t.eq((await bApi.patch('/api/posta/ayarlar', { epostaIleHaber: 'evet' })).status, 400, 'geçersiz değer 400');
		const page = (await berk.open()).page;
		const win = await openApp(page, 'mail');
		const toggle = win.locator('[data-mail-email-toggle]');
		await toggle.waitFor();
		await win.locator('[data-mail-email-toggle]:not([disabled])').waitFor();
		await toggle.check();
		await t.waitFor(async () => (await bApi.get('/api/posta/ayarlar')).json.epostaIleHaber === true);
		t.eq(must(await bApi.get('/api/posta/ayarlar'), 'ayar').epostaIleHaber, true, 'ayar kalıcı');
		const sent = await aApi.post('/api/posta', { konu: `${konu} e-posta`, govde, alicilar: [berk.id] });
		t.eq(sent.status, 201, 'e-posta bildirimi açık alıcıya gönderim 201');
		await toggle.uncheck();
		await t.waitFor(async () => (await bApi.get('/api/posta/ayarlar')).json.epostaIleHaber === false);
		t.eq(must(await bApi.get('/api/posta/ayarlar'), 'ayar').epostaIleHaber, false, 'ayar geri kapandı');
	});

	await t.step('hız sınırı: dakikada 20 mesajdan sonra 429', async () => {
		const spam = await newMember(t, admin, { label: 'posta-s', rolId: fx.roles.uye });
		const sApi = await spam.api();
		let limited = null;
		for (let i = 0; i < 25 && !limited; i++) {
			const r = await sApi.post('/api/posta', { konu: `hiz ${i}`, govde: 'x', alicilar: [yabanci.id] });
			if (r.status === 429) limited = r;
		}
		t.check(limited, '25 denemede 429 geldi');
		t.check(/hızlı/.test(limited?.json?.error ?? ''), 'hata metni yavaşlamayı söylüyor', limited?.json?.error);
	});
}

/** A role that opens News only (no Mail). Removed when the suite ends. */
async function newRole(t, admin, tag) {
	const res = await admin.post('/api/roller', { ad: `E2E Postasiz ${tag}`, renk: '#8e8e93', aciklama: 'Posta yok', ikiAdimZorunlu: false, izinler: { news: 'kullan', settings: 'kullan' } });
	const id = must(res, 'rol').id;
	t.cleanup(() => admin.del('/api/roller', { id, tasi: t.fx.roles.uye }));
	return id;
}
