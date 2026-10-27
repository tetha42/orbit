// Envanter: ekleme, ödünç, iade, süre uzatma, etiket yazdırma, arızalı/kayıp ve rol sınırları.
import { client } from '../lib/api.mjs';
import { dockApps, openApp } from '../lib/browser.mjs';
import { dialogCevapla } from '../lib/diyalog.mjs';
import { uniq } from '../lib/gecici.mjs';

export const meta = { title: 'Envanter: ekleme, ödünç/iade/uzatma, etiket, arızalı/kayıp, roller' };

const DAY = 86_400_000;

export default async function suite(t) {
	const admin = await t.api('admin');
	const zeynep = await t.api('zeynep');
	const can = await t.api('can');
	const ege = await t.api('ege');
	const okur = await t.api('okur');
	const tag = uniq().toUpperCase();
	const KOD = `E2E-${tag}`;
	const KOD_2 = `E2E-${tag}-B`;
	const AD = `E2E Osiloskop ${tag}`;
	const ids = [];

	// The items go: a borrowed one is returned first (the server refuses to delete it).
	t.cleanup(async () => {
		for (const id of ids) {
			await admin.post('/api/envanter', { action: 'iadeEt', envanterId: id });
			await admin.post('/api/envanter', { action: 'delete', envanterId: id });
		}
	});
	const items = async (c = admin) => (await c.get('/api/envanter')).json;
	const item = async (kod = KOD) => (await items()).find((i) => i.kod === kod);
	const card = (win, kod = KOD) => win.locator(`[data-item-kod="${kod}"]`);
	const sheet = (page, name) => page.getByRole('dialog', { name });

	let id = null;
	const zPage = (await t.open('zeynep')).page;
	const zWin = await openApp(zPage, 'inventory');

	await t.step('Yönetim Kurulu arayüzden eşya ekliyor; kod büyük harfe çevrilir', async () => {
		await zWin.getByRole('button', { name: 'Yeni Ekipman' }).click();
		const form = sheet(zPage, 'Yeni ekipman');
		await form.waitFor();
		await form.getByPlaceholder('LAB-RPI-006').fill(KOD.toLowerCase());
		await form.getByPlaceholder('Örn: Raspberry Pi 5 8GB Starter Kit').fill(AD);
		await form.getByPlaceholder('Örn: Teknoloji Lab Dolap B, Raf 2').fill('E2E Test Rafı');
		await form.getByRole('button', { name: 'Envantere Ekle' }).click();
		await card(zWin).waitFor();
		const it = await item();
		t.check(it, 'eşya API listesinde (kod büyük harfle kaydedildi)');
		id = it?.id ?? null;
		if (id) ids.push(id);
		t.eq(it?.durum, 'saglam', 'yeni eşya müsait');
		t.eq(it?.konum, 'E2E Test Rafı', 'konum kaydedildi');
		t.includes((await card(zWin).textContent()).toLocaleLowerCase('tr'), 'müsait', 'kart "Müsait" diyor');
		await t.shot(zPage, 'eşya-eklendi');

		const dup = await zeynep.post('/api/envanter', { action: 'create', kod: KOD, ad: AD, kategori: 'Sensör', konum: 'Başka raf' });
		t.eq(dup.status, 409, 'aynı kod ikinci kez eklenemez (409)');
		const badKod = await zeynep.post('/api/envanter', { action: 'create', kod: 'küçük harf!', ad: AD, kategori: 'Sensör', konum: 'Raf' });
		t.eq(badKod.status, 400, 'geçersiz kod reddedilir (400)');
	});

	const canPage = (await t.open('can')).page;
	const cWin = await openApp(canPage, 'inventory');

	await t.step('Üye eşyayı ödünç alıyor (Ödünç Al → Sende)', async () => {
		await card(cWin).getByRole('button', { name: 'Ödünç Al' }).click();
		const m = sheet(canPage, 'Ödünç Al');
		await m.waitFor();
		await m.getByRole('button', { name: 'Ödünç Al' }).click();
		await card(cWin).getByText('Sende').waitFor();
		const it = await item();
		t.eq(it?.durum, 'oduncte', 'eşya ödünçte');
		t.eq(it?.oduncAlanId, t.fx.users.can.id, 'ödünç alan Can');
		const days = Math.round((it.iadeTarihi - Date.now()) / DAY);
		t.check(days >= 13 && days <= 15, `varsayılan süre 14 gün (${days})`);
		t.eq(await card(cWin).getByRole('button', { name: 'İade Et' }).count(), 1, 'kartta "İade Et" çıktı');
		t.includes(await cWin.getByRole('button', { name: /Bendekiler/ }).innerText(), '(1)', '"Bendekiler" sayacı 1');
		await t.shot(canPage, 'odunc-alindi');
	});

	await t.step('başkası iade edemez, uzatamaz, ödünç alamaz', async () => {
		const r = await ege.post('/api/envanter', { action: 'iadeEt', envanterId: id });
		t.eq(r.status, 403, 'başka üye iade edemez (403)');
		const u = await ege.post('/api/envanter', { action: 'uzat', envanterId: id, iadeTarihi: Date.now() + 20 * DAY });
		t.eq(u.status, 403, 'başka üye süre uzatamaz (403)');
		const o = await ege.post('/api/envanter', { action: 'oduncAl', envanterId: id });
		t.eq(o.status, 409, 'ödünçteki eşya ödünç alınamaz (409)');
		t.eq((await item())?.oduncAlanId, t.fx.users.can.id, 'eşya hâlâ Can\'da');
		const { page } = await t.open('ege');
		const win = await openApp(page, 'inventory');
		await card(win).waitFor();
		t.eq(await card(win).getByRole('button', { name: 'İade Et' }).count(), 0, 'Ege\'nin ekranında "İade Et" yok');
		t.includes(await card(win).innerText(), 'Can', 'Ege kimde olduğunu görüyor');
	});

	await t.step('süre uzatma: üye 30 günü aşamaz', async () => {
		const before = (await item()).iadeTarihi;
		await card(cWin).getByRole('button', { name: 'Ayrıntılar' }).click();
		const detail = sheet(canPage, `${KOD} ayrıntıları`);
		await detail.waitFor();
		await detail.getByRole('button', { name: 'Süreyi uzat' }).click();
		const m = sheet(canPage, 'Süreyi Uzat');
		await m.waitFor();
		await m.getByRole('button', { name: 'Süreyi Uzat' }).click();
		await m.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await item()).iadeTarihi > before);
		const after = (await item()).iadeTarihi;
		t.check(after > before, 'iade tarihi ileri alındı', `${before} → ${after}`);
		const tooLong = await can.post('/api/envanter', { action: 'uzat', envanterId: id, iadeTarihi: Date.now() + 60 * DAY });
		t.eq(tooLong.status, 400, '60 gün isteyen üye reddedildi (400)');
		const past = await can.post('/api/envanter', { action: 'uzat', envanterId: id, iadeTarihi: Date.now() - DAY });
		t.eq(past.status, 400, 'geçmiş tarih reddedildi (400)');
	});

	await t.step('etiket: karekod görünür, "Etiket yazdır" kodu basan pencere açar', async () => {
		const detail = sheet(canPage, `${KOD} ayrıntıları`);
		if (!(await detail.count())) {
			await card(cWin).getByRole('button', { name: 'Ayrıntılar' }).click();
			await detail.waitFor();
		}
		await detail.getByRole('img', { name: `${KOD} karekodu` }).waitFor();
		const printBtn = detail.getByRole('button', { name: 'Etiket yazdır' });
		await t.waitFor(async () => await printBtn.isEnabled());
		const [popup] = await Promise.all([canPage.context().waitForEvent('page'), printBtn.click()]);
		await popup.waitForLoadState('domcontentloaded');
		const label = await popup.locator('.label').innerText();
		t.includes(label, KOD, 'etiket eşyanın kodunu basıyor');
		t.includes(label, AD, 'etiket eşyanın adını basıyor');
		t.eq(await popup.locator('.label img').count(), 1, 'etikette karekod görseli var');
		await popup.close();
		const hist = (await zeynep.get(`/api/envanter?gecmis=${encodeURIComponent(id)}`)).json.hareketler.map((h) => h.tur);
		for (const tur of ['ekle', 'odunc', 'uzat']) t.includes(hist, tur, `geçmişte "${tur}" kaydı var`);
		await detail.getByRole('button', { name: 'Kapat' }).click();
	});

	await t.step('iade: arıza bildirilirse eşya servis dışına alınır', async () => {
		await card(cWin).getByRole('button', { name: 'İade Et' }).click();
		const m = sheet(canPage, 'İade Et');
		await m.waitFor();
		await m.getByRole('checkbox').check();
		await m.getByRole('textbox').fill('Kanal 2 probu sinyal vermiyor');
		await m.getByRole('button', { name: 'İade Et' }).click();
		await m.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await item())?.durum === 'arizali');
		const it = await item();
		t.eq(it?.durum, 'arizali', 'arıza bildirilen eşya "arızalı"');
		t.eq(it?.oduncAlanId, null, 'zimmet kapandı');
		t.eq(await card(cWin).getByRole('button', { name: 'Ödünç Al' }).count(), 0, 'arızalı eşya ödünç alınamıyor');
		const o = await can.post('/api/envanter', { action: 'oduncAl', envanterId: id });
		t.eq(o.status, 409, 'arızalı eşya API ile de ödünç alınamaz (409)');
		await t.shot(canPage, 'arizali');
	});

	await t.step('Yönetim Kurulu: onarıldı → üye adına ödünç → kayıp → bulundu → sil', async () => {
		await zPage.reload();
		const win = await openApp(zPage, 'inventory');
		await card(win).getByRole('button', { name: 'Ayrıntılar' }).click();
		const detail = sheet(zPage, `${KOD} ayrıntıları`);
		await detail.waitFor();

		await detail.getByRole('button', { name: 'Onarıldı / bulundu' }).click();
		const said = await dialogCevapla(zPage, true);
		t.includes(said, `${KOD} kullanıma hazır`, 'onay penceresi durumu söylüyor');
		await t.waitFor(async () => (await item())?.durum === 'saglam');
		t.eq((await item())?.durum, 'saglam', 'onarılan eşya müsait');

		await detail.getByRole('button', { name: 'Üye adına ödünç ver' }).click();
		const lend = sheet(zPage, 'Üye Adına Ödünç Ver');
		await lend.waitFor();
		await lend.getByRole('combobox').selectOption({ label: 'Ege Kılıç' });
		await lend.getByRole('button', { name: 'Üye Adına Ödünç Ver' }).click();
		await lend.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await item())?.oduncAlanId === t.fx.users.ege.id);
		t.eq((await item())?.oduncAlanId, t.fx.users.ege.id, 'eşya Ege adına ödünç verildi');

		await detail.waitFor();
		t.eq(await detail.getByRole('button', { name: 'Sil' }).isDisabled(), true, 'ödünçteki eşyanın "Sil" düğmesi kapalı');
		t.eq((await zeynep.post('/api/envanter', { action: 'delete', envanterId: id })).status, 409, 'ödünçteki eşya API ile de silinemez (409)');
		await detail.getByRole('button', { name: 'Kayıp işaretle' }).click();
		const lost = await dialogCevapla(zPage, true);
		t.includes(lost, 'Ödünç kaydı kapanır', 'kayıp onayı zimmetin kapanacağını söylüyor');
		await t.waitFor(async () => (await item())?.durum === 'kayip');
		t.eq((await item())?.durum, 'kayip', 'eşya kayıp');
		t.eq((await item())?.oduncAlanId, null, 'kayıpta zimmet kapandı');
		await t.shot(zPage, 'kayip');

		await detail.getByRole('button', { name: 'Onarıldı / bulundu' }).click();
		await dialogCevapla(zPage, true);
		await t.waitFor(async () => (await item())?.durum === 'saglam');
		t.eq((await item())?.durum, 'saglam', 'bulunan eşya müsait');
		const hist = (await zeynep.get(`/api/envanter?gecmis=${encodeURIComponent(id)}`)).json.hareketler.map((h) => h.tur);
		for (const tur of ['iade', 'durum']) t.includes(hist, tur, `geçmişte "${tur}" kaydı var`);

		const second = await zeynep.post('/api/envanter', { action: 'create', kod: KOD_2, ad: `${AD} B`, kategori: 'Sensör', konum: 'E2E Test Rafı' });
		if (second.json?.item?.id) ids.push(second.json.item.id);
		await zPage.reload();
		const win2 = await openApp(zPage, 'inventory');
		await card(win2, KOD_2).getByRole('button', { name: 'Ayrıntılar' }).click();
		const detail2 = sheet(zPage, `${KOD_2} ayrıntıları`);
		await detail2.waitFor();
		await detail2.getByRole('button', { name: 'Arızalı işaretle' }).click();
		await dialogCevapla(zPage, true);
		await t.waitFor(async () => (await item(KOD_2))?.durum === 'arizali');
		t.eq((await item(KOD_2))?.durum, 'arizali', '"Arızalı işaretle" eşyayı arızalı yaptı');
		await detail2.getByRole('button', { name: 'Sil' }).click();
		const del = await dialogCevapla(zPage, true);
		t.includes(del, 'kalıcı olarak silinsin mi', 'silme onayı soruluyor');
		await t.waitFor(async () => !(await item(KOD_2)));
		t.check(!(await item(KOD_2)), 'eşya silindi');
	});

	await t.step('Üye (Kullan): ekleyemez, düzenleyemez, durum değiştiremez', async () => {
		await canPage.reload();
		const win = await openApp(canPage, 'inventory');
		await card(win).waitFor();
		t.eq(await win.getByRole('button', { name: 'Yeni Ekipman' }).count(), 0, 'Üye: "Yeni Ekipman" yok');
		await card(win).getByRole('button', { name: 'Ayrıntılar' }).click();
		const detail = sheet(canPage, `${KOD} ayrıntıları`);
		await detail.waitFor();
		t.eq(await detail.locator('[aria-label="Yönetim"]').count(), 0, 'Üye: "Yönetim" bölümü yok');
		t.eq(await detail.getByRole('button', { name: 'Üye adına ödünç ver' }).count(), 0, 'Üye: "Üye adına ödünç ver" yok');
		const f = { kod: 'E2E-UYE', ad: 'Üye ekleyemez', kategori: 'Sensör', konum: 'Raf' };
		t.eq((await can.post('/api/envanter', { action: 'create', ...f })).status, 403, 'Üye eşya ekleyemez (403)');
		t.eq((await can.post('/api/envanter', { action: 'update', envanterId: id, ...f })).status, 403, 'Üye eşya düzenleyemez (403)');
		t.eq((await can.post('/api/envanter', { action: 'updateDurum', envanterId: id, durum: 'kayip' })).status, 403, 'Üye durum değiştiremez (403)');
		t.eq((await can.post('/api/envanter', { action: 'delete', envanterId: id })).status, 403, 'Üye eşya silemez (403)');
		// "Üye adına" alanı yönetim dışında yok sayılır: ödünç kendi adına yazılır.
		const o = await can.post('/api/envanter', { action: 'oduncAl', envanterId: id, kullaniciId: t.fx.users.ege.id });
		t.eq(o.status, 200, 'Üye ödünç alabiliyor');
		t.eq((await item())?.oduncAlanId, t.fx.users.can.id, 'başkası adına verilmek istenen ödünç kendi adına yazıldı');
		await can.post('/api/envanter', { action: 'iadeEt', envanterId: id });
	});

	await t.step('Sadece Haberler: Envanter hiç görünmez, API kapalı', async () => {
		const { page } = await t.open('okur');
		t.eq(await dockApps(page), ['news', 'settings'], 'Dock\'ta Envanter yok');
		t.eq((await okur.get('/api/envanter')).status, 403, 'liste 403');
		t.eq((await okur.post('/api/envanter', { action: 'oduncAl', envanterId: id })).status, 403, 'ödünç alma 403');
		t.eq((await client(t.base).get('/api/envanter')).status, 401, 'oturumsuz istek 401');
	});
}
