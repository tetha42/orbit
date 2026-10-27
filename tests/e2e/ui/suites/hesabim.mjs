// Hesabım (Ayarlar → Hesap): profil, şifre değiştirme, fotoğraf.
// Şifre ve fotoğraf yalnız bu paketin kurduğu GEÇİCİ üyede değişir; fikstür hesaplarına dokunulmaz.
import { SESSION_COOKIE, client, loginApi } from '../lib/api.mjs';
import { dockApps, openSettingsTab } from '../lib/browser.mjs';
import { geciciUye, rastgeleSifre } from '../lib/gecici.mjs';
import { png, sahtePng } from '../lib/ornek-dosya.mjs';

export const meta = { title: 'Hesabım: profil, şifre değiştirme, fotoğraf (geçici üye)' };

export default async function suite(t) {
	// "Sadece Haberler" rolünde: yetkisi en az olan üye de kendi hesabını yönetebilir.
	const me = await geciciUye(t, { rolId: t.fx.roles.haber, ad: 'Hesap' });
	const profile = async () => (await me.api.get('/api/profil')).json;
	const upload = async (file) => {
		const form = new FormData();
		form.append('file', new Blob([file.buffer], { type: file.mimeType }), file.name);
		const res = await fetch(`${t.base}/api/profil/foto`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${me.api.token}` }, body: form });
		return { status: res.status, json: await res.json().catch(() => null) };
	};

	const { page } = await me.open();
	await t.step('Hesabım açılıyor: kimlik bilgileri salt okunur', async () => {
		t.eq(await dockApps(page), ['news', 'settings'], 'Sadece Haberler üyesi yalnız Haberler ve Ayarlar görüyor');
		const win = await openSettingsTab(page, 'account');
		await win.getByRole('heading', { name: `${me.ad} ${me.soyad}` }).waitFor();
		const text = await win.innerText();
		t.includes(text, me.eposta, 'e-posta görünüyor');
		const form = win.getByRole('form', { name: 'Profil' });
		t.eq(await form.locator(`input[value="${me.eposta}"]`).isDisabled(), true, 'e-posta alanı değiştirilemez');
		t.eq(await win.locator('[data-role-badge]').first().getAttribute('data-role-badge'), 'Sadece Haberler', 'rol rozeti üyenin rolü');
		await t.shot(page, 'hesabim');
	});

	await t.step('profil: bölüm, sınıf ve hakkımda kaydediliyor', async () => {
		const win = page.locator('[data-window-frame=settings]');
		const form = win.getByRole('form', { name: 'Profil' });
		const save = form.getByRole('button', { name: 'Kaydet' });
		t.eq(await save.isDisabled(), true, 'değişiklik yokken "Kaydet" kapalı');
		const selects = form.locator('select');
		const current = (await profile()).user.bolum;
		const target = (await selects.nth(0).locator('option').allTextContents()).find((d) => d !== current);
		await selects.nth(0).selectOption({ label: target });
		await selects.nth(1).selectOption('4');
		const bio = `E2E hakkımda ${Date.now().toString(36)}`;
		await form.locator('textarea').fill(bio);
		await save.click();
		await win.getByRole('status').filter({ hasText: 'Profiliniz güncellendi.' }).waitFor();
		const u = (await profile()).user;
		t.eq(u.bolum, target, 'bölüm kaydedildi');
		t.eq(u.sinif, 4, 'sınıf kaydedildi');
		t.eq(u.bio, bio, 'hakkımda kaydedildi');
		t.eq(await save.isDisabled(), true, 'kaydedince "Kaydet" yeniden kapandı');
		await t.shot(page, 'profil-kaydedildi');
	});

	await t.step('profil API: kimlik alanları ve geçersiz değerler reddedilir', async () => {
		const before = (await profile()).user;
		const r = await me.api.patch('/api/profil', { ad: 'Başkası', eposta: 'baska@kulup.test', rolId: t.fx.roles.yonetim, sinif: 3 });
		t.eq(r.status, 200, 'bilinen alan kaydedildi');
		const after = (await profile()).user;
		t.eq([after.ad, after.eposta, after.rolBilgi?.ad], [before.ad, before.eposta, before.rolBilgi?.ad], 'ad, e-posta ve rol bu uçtan değişmiyor');
		t.eq((await me.api.patch('/api/profil', { sinif: 99 })).status, 400, 'sınıf 99 reddedildi');
		t.eq((await me.api.patch('/api/profil', { bolum: 'Olmayan Bölüm' })).status, 400, 'listede olmayan bölüm reddedildi');
		t.eq((await me.api.patch('/api/profil', { bio: 'x'.repeat(5000) })).status, 400, 'çok uzun hakkımda reddedildi');
	});

	await t.step('fotoğraf: yükleme, görünme, kaldırma', async () => {
		const win = page.locator('[data-window-frame=settings]');
		await win.locator('input[type=file]').setInputFiles(png());
		await win.getByRole('status').filter({ hasText: 'Profil fotoğrafı güncellendi.' }).waitFor();
		const foto = (await profile()).user.profilFoto;
		t.check(/^\/api\/uploads\/\d+_[a-f0-9]+\.(webp|jpg)$/.test(foto ?? ''), 'fotoğraf sunucuda saklandı', String(foto));
		const served = await me.api.get(foto);
		t.eq(served.status, 200, 'fotoğraf adresi sahibine görüntü veriyor');
		const other = await (await t.api('can')).get(foto);
		t.eq(other.status, 200, 'profil fotoğrafı diğer üyelere de açık');
		await win.locator('img[src*="/api/uploads/"], img[src*="uploads"]').first().waitFor();
		t.eq(await win.getByRole('button', { name: 'Kaldır' }).count(), 1, '"Kaldır" düğmesi çıktı');
		await t.shot(page, 'fotograf-yuklendi');

		await win.getByRole('button', { name: 'Kaldır' }).click();
		await win.getByRole('status').filter({ hasText: 'Profil fotoğrafı kaldırıldı.' }).waitFor();
		t.eq((await profile()).user.profilFoto ?? null, null, 'fotoğraf kaldırıldı');
		// The message shows before the profile is fetched again; the button goes with the refetch.
		await t.waitFor(async () => (await win.getByRole('button', { name: 'Kaldır' }).count()) === 0, { timeout: 5_000 });
		t.eq(await win.getByRole('button', { name: 'Kaldır' }).count(), 0, '"Kaldır" düğmesi kayboldu');

		const fake = await upload(sahtePng());
		t.eq(fake.status, 415, 'resim olmayan dosya .png adıyla yüklenemez (415)');
		t.eq((await profile()).user.profilFoto ?? null, null, 'reddedilen dosya fotoğraf olmadı');
	});

	await t.step('şifre değiştirme: eşleşmeme, yanlış mevcut şifre, başarılı değişiklik', async () => {
		const win = page.locator('[data-window-frame=settings]');
		const form = win.getByRole('form', { name: 'Şifre Değiştir' });
		const yeni = rastgeleSifre();
		const fields = form.locator('input[type=password]');
		const submit = form.getByRole('button', { name: 'Şifreyi Değiştir' });

		await fields.nth(0).fill(me.sifre);
		await fields.nth(1).fill(yeni);
		await fields.nth(2).fill(`${yeni}x`);
		t.eq(await submit.isDisabled(), true, 'tekrar eşleşmiyorsa düğme kapalı');
		t.includes(await form.innerText(), 'Yeni şifreler eşleşmiyor.', 'eşleşmeme uyarısı görünüyor');

		await fields.nth(2).fill(yeni);
		await fields.nth(0).fill(`${me.sifre}-yanlis`);
		await submit.click();
		await win.getByRole('alert').filter({ hasText: 'Mevcut şifre hatalı.' }).waitFor();
		// (Nothing changed: the next attempt, with the real current password, goes through.)

		await fields.nth(0).fill(me.sifre);
		await submit.click();
		await win.getByRole('status').filter({ hasText: 'Şifreniz değiştirildi.' }).waitFor();
		t.eq(await fields.nth(0).inputValue(), '', 'başarılı değişiklikten sonra alanlar temizlendi');
		await t.shot(page, 'sifre-degisti');

		const old = await client(t.base).post('/api/auth/login', { eposta: me.eposta, sifre: me.sifre });
		t.check(old.status >= 400, 'eski şifre artık giriş yapmıyor', String(old.status));
		const fresh = await loginApi(t.base, me.eposta, yeni).catch(() => null);
		t.check(fresh, 'yeni şifre ile giriş yapılıyor');
		// Signing in again ended the earlier session (one session per account): carry on with the new one.
		if (fresh) me.api = fresh;
	});

	await t.step('şifre API: kural ihlalleri ve oturumsuz erişim', async () => {
		const c = client(t.base);
		t.eq((await c.get('/api/profil')).status, 401, 'oturumsuz profil okuma 401');
		t.eq((await c.patch('/api/profil', { bio: 'x' })).status, 401, 'oturumsuz profil yazma 401');
		t.eq((await c.post('/api/profil/sifre', { mevcut: 'a', yeni: 'b' })).status, 401, 'oturumsuz şifre değiştirme 401');
		t.eq((await c.del('/api/profil/foto')).status, 401, 'oturumsuz fotoğraf silme 401');
		const weak = await me.api.post('/api/profil/sifre', { mevcut: '', yeni: 'abc12345' });
		t.eq(weak.status, 400, 'mevcut şifre olmadan değişiklik yok (400)');
	});
}
