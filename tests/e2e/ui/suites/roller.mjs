// Ayarlar → Roller ve Yetkiler (admin): liste, Yeni Rol, renk seçici, 2FA ipucu (#2),
// rol oluşturma, Üye Rehberi rozet/select, üyeli rolü silip üyeleri taşıma.
import { openApp, openSettingsTab } from '../lib/browser.mjs';

export const meta = { title: 'Roller sekmesi, rol oluşturma/silme, Üye Rehberi (admin)' };

const HINT = 'yönetim yetkisi olduğu için önerilir';
const GREEN = '#30d158';

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const rolesApi = async (c = admin) => (await c.get('/api/roller')).json;
	const rolad = `E2E Etkinlik Ekibi ${Date.now().toString(36)}`;
	const roladKilitli = `E2E Notlar Yönetimi ${Date.now().toString(36)}`;
	let createdId = null;
	let lockedId = null;

	// Whatever this suite leaves behind goes: members back to their fixture roles, test roles deleted.
	t.cleanup(async () => {
		for (const [key, rolKey] of [['ege', 'uye'], ['can', 'uye']]) {
			await admin.patch('/api/uyeler', { id: t.fx.users[key].id, rolId: t.fx.roles[rolKey] });
		}
		for (const id of [createdId, lockedId]) {
			if (id) await admin.del('/api/roller', { id, tasi: fx.roles.uye });
		}
	});

	const { page } = await t.open('admin');
	const settings = await openSettingsTab(page, 'roles');
	await settings.locator('[data-role-id]').first().waitFor();

	await t.step('4 yerleşik/fikstür rol listeleniyor', async () => {
		const api = (await rolesApi()).roller;
		const names = await settings.locator('[data-role-id]').evaluateAll((els) => els.map((e) => e.querySelector('div > div')?.firstChild?.textContent?.trim()));
		for (const ad of ['Admin', 'Yönetim Kurulu', 'Üye', 'Sadece Haberler']) {
			t.includes(names, ad, `Roller sekmesinde "${ad}" var`);
			t.check(api.some((r) => r.ad === ad), `API'de "${ad}" var`);
		}
		t.eq(names.length, api.length, 'listedeki rol sayısı API ile aynı');
		await t.shot(page, 'roller-listesi');
	});

	await t.step('#2: 2FA ipucu yalnız yönetim yetkisi varken görünüyor', async () => {
		await settings.getByRole('button', { name: 'Yeni Rol' }).click();
		const sheet = page.getByRole('dialog', { name: 'Yeni rol' });
		await sheet.waitFor();
		const box = sheet.getByRole('checkbox');
		// Kabul 1: yalnız Haberler: Kullan → ipucu yok, kutu işaretsiz
		t.eq(await sheet.getByText(HINT).count(), 0, '#2 yeni rol: yönetim yetkisi yokken ipucu görünmüyor');
		t.check(!(await box.isChecked()), '#2 yeni rol: 2FA kutusu işaretsiz');
		// Kabul 2: bir uygulama Yönet olunca kutu kendiliğinden işaretlenir ve ipucu çıkar
		await sheet.locator('[data-app=events]').getByRole('radio', { name: 'Yönet' }).click();
		t.check(await box.isChecked(), '#2 Etkinlikler=Yönet: kutu kendiliğinden işaretlendi');
		t.eq(await sheet.getByText(HINT).count(), 1, '#2 Etkinlikler=Yönet: ipucu görünüyor');
		await t.shot(page, 'ikiadim-ipucu-gorunur');
		// Kabul 3: kullanıcı kutuyu elle değiştirince ipucu bir daha görünmez (işaretli kalsa da kalmasa da)
		await box.click();
		t.check(!(await box.isChecked()), '#2 elle kapatınca kutu kapalı kalıyor');
		t.eq(await sheet.getByText(HINT).count(), 0, '#2 elle değiştirdikten sonra ipucu görünmüyor');
		await sheet.locator('[data-app=teams]').getByRole('radio', { name: 'Yönet' }).click();
		t.check(!(await box.isChecked()), '#2 başka bir uygulama Yönet olunca elle verilen karar bozulmuyor');
		t.eq(await sheet.getByText(HINT).count(), 0, '#2 elle değiştirdikten sonra ipucu geri gelmiyor');
		await sheet.getByRole('button', { name: 'Vazgeç' }).click();
		await sheet.waitFor({ state: 'detached' });
	});

	await t.step('arayüzden rol oluşturma: ad, renk, matris, 2FA', async () => {
		await settings.getByRole('button', { name: 'Yeni Rol' }).click();
		const sheet = page.getByRole('dialog', { name: 'Yeni rol' });
		await sheet.waitFor();
		await sheet.getByPlaceholder('Örn. Yönetim Kurulu').fill(rolad);

		// Renk düğmesi gerçekten tıklanabilir mi: modal pencerenin ve ekranın içinde, üstünde başka öğe yok, fare tıklaması işliyor.
		const swatch = sheet.getByRole('radio', { name: GREEN });
		const vp = page.viewportSize();
		const sheetBox = await sheet.boundingBox();
		const sw = await swatch.boundingBox();
		t.check(sw.x >= sheetBox.x && sw.y >= sheetBox.y && sw.x + sw.width <= sheetBox.x + sheetBox.width && sw.y + sw.height <= sheetBox.y + sheetBox.height, 'renk düğmesi rol modalının içinde', JSON.stringify({ sw, sheetBox }));
		t.check(sheetBox.y >= 28 && sheetBox.y + sheetBox.height <= vp.height, 'rol modalı masaüstü görünüm alanının üstünden/altından taşmıyor', JSON.stringify({ sheetBox, vp }));
		const cx = sw.x + sw.width / 2;
		const cy = sw.y + sw.height / 2;
		t.check(await page.evaluate(([x, y, c]) => document.elementFromPoint(x, y)?.getAttribute('aria-label') === c, [cx, cy, GREEN]), 'renk düğmesinin üstünde başka öğe yok (elementFromPoint)');
		await page.mouse.click(cx, cy);
		t.eq(await swatch.getAttribute('aria-checked'), 'true', 'gerçek fare tıklaması rengi seçti');

		await sheet.locator('[data-app=events]').getByRole('radio', { name: 'Yönet' }).click();
		await sheet.locator('[data-app=news]').getByRole('radio', { name: 'Kullan' }).click();
		await t.shot(page, 'yeni-rol-dolu');
		await sheet.getByRole('button', { name: 'Kaydet' }).click();
		await sheet.waitFor({ state: 'detached' });
		await settings.locator('[data-role-id]', { hasText: rolad }).waitFor();

		const r = (await rolesApi()).roller.find((x) => x.ad === rolad);
		createdId = r?.id ?? null;
		t.check(r, 'GET /api/roller yeni rolü döndürüyor');
		t.eq(r?.renk, GREEN, 'renk #30d158 kaydedildi');
		t.eq(r?.izinler?.events, 'yonet', 'Etkinlikler = yonet kaydedildi');
		t.eq(r?.izinler?.news, 'kullan', 'Haberler = kullan kaydedildi');
		t.eq(r?.ikiAdimZorunlu, true, 'ikiAdimZorunlu: true (yönetim yetkisi olan rolde otomatik)');
		const row = settings.locator(`[data-role-id="${createdId}"]`);
		t.check((await row.innerText()).includes('2FA zorunlu'), 'rol satırında "2FA zorunlu" rozeti var');
		await t.shot(page, 'rol-listede');
	});

	// Yöneticinin (zeynep) kendinde olmayan yetkiyi içeren rol: o atayamaz, admin atayabilir.
	await t.step('kilitli rol (zeynep atayamaz) hazırlanıyor', async () => {
		const res = await admin.post('/api/roller', { ad: roladKilitli, renk: '#ff375f', aciklama: '', ikiAdimZorunlu: true, izinler: { notes: 'yonet', news: 'kullan', settings: 'kullan' } });
		lockedId = res.json?.id ?? null;
		t.check(res.status === 200 || res.status === 201, 'notlar=yönet rolü API ile oluşturuldu', JSON.stringify(res));
	});

	await t.step('Üye Rehberi: rozetler, rol listesi, rol atama', async () => {
		const win = await openApp(page, 'members');
		await win.locator('[data-role-badge]').first().waitFor();
		const api = (await rolesApi()).roller;
		const assignable = api.filter((r) => r.atanabilir).map((r) => r.ad);

		// Yeni rolü arayüzden iki üyeye ver.
		for (const key of ['ege', 'can']) {
			const sel = win.locator(`[data-role-select="${fx.users[key].id}"]`);
			await sel.waitFor();
			const options = await sel.locator('option').allInnerTexts();
			if (key === 'ege') {
				t.sameSet(options.filter((o) => !o.startsWith('—')), assignable, 'admin için rol listesi = atanabilir roller (API)');
				t.includes(options, rolad, 'rol listesi yeni rolü içeriyor');
			}
			await sel.selectOption({ label: rolad });
		}
		await t.waitFor(async () => (await rolesApi()).roller.find((r) => r.id === createdId)?.kullaniciSayisi === 2);
		t.eq((await rolesApi()).roller.find((r) => r.id === createdId)?.kullaniciSayisi, 2, 'iki üye yeni role geçti (kullaniciSayisi=2)');

		// Rozet: ad ve renk (#30d158 = rgb(48, 209, 88)).
		const badges = win.locator(`[data-role-badge="${rolad}"]`);
		await badges.first().waitFor();
		await t.waitFor(async () => (await badges.count()) === 2);
		t.eq(await badges.count(), 2, 'Üye Rehberi\'nde yeni rolün iki rozeti var');
		t.eq(await badges.first().evaluate((e) => getComputedStyle(e).color), 'rgb(48, 209, 88)', 'rozet rengi rolün rengi');
		const allBadges = await win.locator('[data-role-badge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-role-badge')));
		t.includes(allBadges, 'Yönetim Kurulu', 'başka roller de rozetle görünüyor (Yönetim Kurulu)');
		t.includes(allBadges, 'Sadece Haberler', 'başka roller de rozetle görünüyor (Sadece Haberler)');
		await t.shot(page, 'uye-rehberi-rozetler');
	});

	await t.step('Üye Rehberi: yetkisi yetmeyen yönetici yalnız atanabilir rolleri görüyor (zeynep)', async () => {
		const zeynep = await t.open('zeynep');
		const win = await openApp(zeynep.page, 'members');
		await win.locator('[data-role-badge]').first().waitFor();
		const api = (await rolesApi(await t.api('zeynep'))).roller;
		const assignable = api.filter((r) => r.atanabilir).map((r) => r.ad);
		t.includes(assignable, rolad, 'zeynep için etkinlik rolü atanabilir (API)');
		t.excludes(assignable, roladKilitli, 'zeynep için notlar=yönet rolü atanabilir değil (API)');
		const sel = win.locator(`[data-role-select="${fx.users.ege.id}"]`);
		await sel.waitFor();
		const options = (await sel.locator('option').allInnerTexts()).filter((o) => !o.startsWith('—'));
		t.sameSet(options, assignable, 'zeynep\'in rol listesi = atanabilir roller');
		t.excludes(options, roladKilitli, 'kendinde olmayan yetkiyi içeren rol listede yok');
		t.excludes(options, 'Admin', 'zeynep Admin rolünü atayamıyor');
		await t.shot(zeynep.page, 'uye-rehberi-zeynep');
	});

	await t.step('üyeli rolü sil: üyeleri taşı penceresi', async () => {
		// Ayarlar paneli üyeler atanmadan önce yüklendi: ekrandaki sayı bayat. Silme yine de gerçek sayıyı sormalı.
		await openSettingsTab(page, 'roles');
		const row = settings.locator(`[data-role-id="${createdId}"]`);
		await row.getByRole('button', { name: `${rolad} rolünü sil` }).click();
		const sheet = page.getByRole('dialog', { name: 'Rolü sil' });
		await sheet.waitFor();
		t.check((await sheet.innerText()).includes('2 kişi'), 'pencere "2 kişi" diyor');
		await sheet.getByRole('combobox', { name: 'Üyelerin taşınacağı rol' }).selectOption(fx.roles.uye);
		await t.shot(page, 'rol-sil-uyeleri-tasi');
		await sheet.getByRole('button', { name: 'Taşı ve sil' }).click();
		await sheet.waitFor({ state: 'detached' });
		await settings.locator(`[data-role-id="${createdId}"]`).waitFor({ state: 'detached' });

		const after = (await rolesApi()).roller;
		t.check(!after.some((r) => r.id === createdId), 'rol API listesinden silindi');
		const uyeSayisi = after.find((r) => r.id === fx.roles.uye)?.kullaniciSayisi;
		const members = (await admin.get('/api/uyeler')).json.members;
		for (const key of ['ege', 'can']) {
			t.eq(members.find((m) => m.id === fx.users[key].id)?.rolId, fx.roles.uye, `${key} "Üye" rolüne taşındı`);
		}
		t.check(uyeSayisi >= 2, 'Üye rolünün üye sayısı arttı', String(uyeSayisi));
		createdId = null;
		await t.shot(page, 'rol-silindi');
	});
}
