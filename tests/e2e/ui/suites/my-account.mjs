// Hesabım (Ayarlar → Hesap): profil, şifre değiştirme, fotoğraf.
// Şifre ve fotoğraf yalnız bu paketin kurduğu GEÇİCİ üyede değişir; fikstür hesaplarına dokunulmaz.
import { SESSION_COOKIE, client, loginApi } from '../lib/api.mjs';
import { dockApps, openSettingsTab } from '../lib/browser.mjs';
import { temporaryMember, randomPassword } from '../lib/temporary.mjs';
import { png, fakePng } from '../lib/sample-file.mjs';

export const meta = { title: 'Hesabım: profil, şifre değiştirme, fotoğraf (geçici üye)' };

export default async function suite(t) {
	// "Sadece Haberler" rolünde: yetkisi en az olan üye de kendi hesabını yönetebilir.
	const me = await temporaryMember(t, { roleId: t.fx.roles.news, name: 'Hesap' });
	const profile = async () => (await me.api.get('/api/profile')).json;
	const upload = async (file) => {
		const form = new FormData();
		form.append('file', new Blob([file.buffer], { type: file.mimeType }), file.name);
		const res = await fetch(`${t.base}/api/profile/photo`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${me.api.token}` }, body: form });
		return { status: res.status, json: await res.json().catch(() => null) };
	};

	const { page } = await me.open();
	await t.step('Hesabım açılıyor: kimlik bilgileri salt okunur', async () => {
		t.eq(await dockApps(page), ['news', 'settings'], 'Sadece Haberler üyesi yalnız Haberler ve Ayarlar görüyor');
		const win = await openSettingsTab(page, 'account');
		await win.getByRole('heading', { name: `${me.name} ${me.surname}` }).waitFor();
		const text = await win.innerText();
		t.includes(text, me.email, 'e-posta görünüyor');
		const form = win.getByRole('form', { name: 'Profil' });
		t.eq(await form.locator(`input[value="${me.email}"]`).isDisabled(), true, 'e-posta alanı değiştirilemez');
		t.eq(await win.locator('[data-role-badge]').first().getAttribute('data-role-badge'), 'Sadece Haberler', 'rol rozeti üyenin rolü');
		await t.shot(page, 'hesabim');
	});

	await t.step('profil: bölüm, sınıf ve hakkımda kaydediliyor', async () => {
		const win = page.locator('[data-window-frame=settings]');
		const form = win.getByRole('form', { name: 'Profil' });
		const save = form.getByRole('button', { name: 'Kaydet' });
		t.eq(await save.isDisabled(), true, 'değişiklik yokken "Kaydet" kapalı');
		const selects = form.locator('select');
		const current = (await profile()).user.department;
		const target = (await selects.nth(0).locator('option').allTextContents()).find((d) => d !== current);
		await selects.nth(0).selectOption({ label: target });
		await selects.nth(1).selectOption('4');
		const bio = `E2E hakkımda ${Date.now().toString(36)}`;
		await form.locator('textarea').fill(bio);
		await save.click();
		await win.getByRole('status').filter({ hasText: 'Profiliniz güncellendi.' }).waitFor();
		const u = (await profile()).user;
		t.eq(u.department, target, 'bölüm kaydedildi');
		t.eq(u.grade, 4, 'sınıf kaydedildi');
		t.eq(u.bio, bio, 'hakkımda kaydedildi');
		t.eq(await save.isDisabled(), true, 'kaydedince "Kaydet" yeniden kapandı');
		await t.shot(page, 'profil-kaydedildi');
	});

	await t.step('profil API: kimlik alanları ve geçersiz değerler reddedilir', async () => {
		const before = (await profile()).user;
		const r = await me.api.patch('/api/profile', { name: 'Başkası', email: 'baska@club.test', roleId: t.fx.roles.management, grade: 3 });
		t.eq(r.status, 200, 'bilinen alan kaydedildi');
		const after = (await profile()).user;
		t.eq([after.name, after.email, after.roleInfo?.name], [before.name, before.email, before.roleInfo?.name], 'ad, e-posta ve rol bu uçtan değişmiyor');
		t.eq((await me.api.patch('/api/profile', { grade: 99 })).status, 400, 'sınıf 99 reddedildi');
		t.eq((await me.api.patch('/api/profile', { department: 'Olmayan Bölüm' })).status, 400, 'listede olmayan bölüm reddedildi');
		t.eq((await me.api.patch('/api/profile', { bio: 'x'.repeat(5000) })).status, 400, 'çok uzun hakkımda reddedildi');
	});

	await t.step('fotoğraf: yükleme, görünme, kaldırma', async () => {
		const win = page.locator('[data-window-frame=settings]');
		await win.locator('input[type=file]').setInputFiles(png());
		await win.getByRole('status').filter({ hasText: 'Profil fotoğrafı güncellendi.' }).waitFor();
		const photo = (await profile()).user.profilePhoto;
		t.check(/^\/api\/uploads\/\d+_[a-f0-9]+\.(webp|jpg)$/.test(photo ?? ''), 'fotoğraf sunucuda saklandı', String(photo));
		const served = await me.api.get(photo);
		t.eq(served.status, 200, 'fotoğraf adresi sahibine görüntü veriyor');
		const other = await (await t.api('can')).get(photo);
		t.eq(other.status, 200, 'profil fotoğrafı diğer üyelere de açık');
		await win.locator('img[src*="/api/uploads/"], img[src*="uploads"]').first().waitFor();
		t.eq(await win.getByRole('button', { name: 'Kaldır' }).count(), 1, '"Kaldır" düğmesi çıktı');
		await t.shot(page, 'fotograf-yuklendi');

		await win.getByRole('button', { name: 'Kaldır' }).click();
		await win.getByRole('status').filter({ hasText: 'Profil fotoğrafı kaldırıldı.' }).waitFor();
		t.eq((await profile()).user.profilePhoto ?? null, null, 'fotoğraf kaldırıldı');
		// The message shows before the profile is fetched again; the button goes with the refetch.
		await t.waitFor(async () => (await win.getByRole('button', { name: 'Kaldır' }).count()) === 0, { timeout: 5_000 });
		t.eq(await win.getByRole('button', { name: 'Kaldır' }).count(), 0, '"Kaldır" düğmesi kayboldu');

		const fake = await upload(fakePng());
		t.eq(fake.status, 415, 'resim olmayan dosya .png adıyla yüklenemez (415)');
		t.eq((await profile()).user.profilePhoto ?? null, null, 'reddedilen dosya fotoğraf olmadı');
	});

	await t.step('şifre değiştirme: eşleşmeme, yanlış mevcut şifre, başarılı değişiklik', async () => {
		const win = page.locator('[data-window-frame=settings]');
		const form = win.getByRole('form', { name: 'Şifre Değiştir' });
		const fresh = randomPassword();
		const fields = form.locator('input[type=password]');
		const submit = form.getByRole('button', { name: 'Şifreyi Değiştir' });

		await fields.nth(0).fill(me.password);
		await fields.nth(1).fill(fresh);
		await fields.nth(2).fill(`${fresh}x`);
		t.eq(await submit.isDisabled(), true, 'tekrar eşleşmiyorsa düğme kapalı');
		t.includes(await form.innerText(), 'Yeni şifreler eşleşmiyor.', 'eşleşmeme uyarısı görünüyor');

		await fields.nth(2).fill(fresh);
		await fields.nth(0).fill(`${me.password}-yanlis`);
		await submit.click();
		await win.getByRole('alert').filter({ hasText: 'Mevcut şifre hatalı.' }).waitFor();
		// (Nothing changed: the next attempt, with the real current password, goes through.)

		await fields.nth(0).fill(me.password);
		await submit.click();
		await win.getByRole('status').filter({ hasText: 'Şifreniz değiştirildi.' }).waitFor();
		t.eq(await fields.nth(0).inputValue(), '', 'başarılı değişiklikten sonra alanlar temizlendi');
		await t.shot(page, 'sifre-degisti');

		const old = await client(t.base).post('/api/auth/login', { email: me.email, password: me.password });
		t.check(old.status >= 400, 'eski şifre artık giriş yapmıyor', String(old.status));
		const loggedIn = await loginApi(t.base, me.email, fresh).catch(() => null);
		t.check(loggedIn, 'yeni şifre ile giriş yapılıyor');
		// Signing in again ended the earlier session (one session per account): carry on with the new one.
		if (loggedIn) me.api = loggedIn;
	});

	await t.step('şifre API: kural ihlalleri ve oturumsuz erişim', async () => {
		const c = client(t.base);
		t.eq((await c.get('/api/profile')).status, 401, 'oturumsuz profil okuma 401');
		t.eq((await c.patch('/api/profile', { bio: 'x' })).status, 401, 'oturumsuz profil yazma 401');
		t.eq((await c.post('/api/profile/password', { current: 'a', fresh: 'b' })).status, 401, 'oturumsuz şifre değiştirme 401');
		t.eq((await c.del('/api/profile/photo')).status, 401, 'oturumsuz fotoğraf silme 401');
		const weak = await me.api.post('/api/profile/password', { current: '', fresh: 'abc12345' });
		t.eq(weak.status, 400, 'mevcut şifre olmadan değişiklik yok (400)');
	});
}
