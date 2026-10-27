// Boş veritabanı → .env admini → ilk girişte zorunlu 2FA, tarayıcıda uçtan uca (issue #5).
// Kendi boş veritabanında ve kendi sunucusunda koşar (meta.isolated).
import { client } from '../lib/api.mjs';
import { dockApps, logoutUi, loginUi, openAnonymous, sessionToken, submitCredentials, submitSecondFactor } from '../lib/browser.mjs';
import { createMember, createRole } from '../lib/seed.mjs';
import { totpCode } from '../lib/totp.mjs';

export const meta = { title: 'Zorunlu 2FA: .env admini, kurtarma kodu, rol bazlı zorunluluk', isolated: true };

const MODAL = '[role=dialog][aria-labelledby=twofa-enforce-title]';
const ADMIN_DOCK = ['teams', 'events', 'projects', 'budget', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'terminal', 'mail'];
const RECOVERY = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/** The modal card (the dialog's only child) lies inside the viewport and does not overflow sideways. */
async function modalFits(page, label, t) {
	const vp = page.viewportSize();
	const card = page.locator(`${MODAL} > div`);
	const box = await card.boundingBox();
	t.check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5, `modal ${label} görünüm alanının içinde`, JSON.stringify({ box, vp }));
	t.check(await card.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `modal ${label} yatay taşmıyor`);
}

export default async function suite(t) {
	const { base, bootstrap } = t;
	const { page, context } = await openAnonymous(t.browser, base);
	t.track(context);
	let secret = '';
	let recovery = [];

	// ---- 1. .env admini ilk giriş: zorunlu modal ------------------------------------------
	await t.step('.env admini girişte zorunlu 2FA modalı açılıyor, kapatılamıyor', async () => {
		await submitCredentials(page, bootstrap.eposta, bootstrap.sifre);
		const modal = page.locator(MODAL);
		await modal.waitFor();
		t.check(await modal.isVisible(), 'zorunlu 2FA modalı açıldı');
		t.check((await modal.innerText()).includes('İki adımlı doğrulama zorunlu'), 'modal başlığı "İki adımlı doğrulama zorunlu"');
		await modal.getByText('bu rol için zorunlu').waitFor();
		t.check(true, 'durum satırı "bu rol için zorunlu" diyor (Admin rolünde 2FA her zaman zorunlu)');
		t.eq(await dockApps(page), ['settings'], 'Dock\'ta yalnız Ayarlar var');
		await t.shot(page, 'admin-ilk-giris-modal');

		// Kapatılamaz: Escape, arka plana tıklama, Dock'a tıklama, kapatma düğmesi yok.
		await page.keyboard.press('Escape');
		await page.mouse.click(10, 100);
		const dockBtn = await page.locator('[data-dock-app=settings]').boundingBox();
		await page.mouse.click(dockBtn.x + dockBtn.width / 2, dockBtn.y + dockBtn.height / 2);
		t.check(await modal.isVisible(), 'Escape / arka plan / Dock tıklaması modalı kapatmıyor');
		t.eq(await page.locator('[data-window-frame=settings]').count(), 0, 'modalın arkasındaki Dock\'a tıklamak Ayarlar\'ı açmıyor');
		const names = await modal.getByRole('button').allInnerTexts();
		t.check(!names.some((n) => /^(kapat|×|x)$/i.test(n.trim())) && names.some((n) => n.includes('Oturumu kapat')), 'kapatma düğmesi yok; yalnız "Oturumu kapat"', JSON.stringify(names));
	});

	// ---- 2. Kurulum: QR + gizli anahtar, taşma kontrolü -----------------------------------
	await t.step('kurulum adımı: QR ve gizli anahtar görünüyor, modal hiçbir pencerede taşmıyor', async () => {
		const modal = page.locator(MODAL);
		await modal.getByRole('button', { name: 'İki Adımlı Doğrulamayı Etkinleştir' }).click();
		const qr = modal.locator('img[alt="İki adımlı doğrulama QR kodu"]');
		await qr.waitFor();
		t.check(await qr.evaluate((img) => img.complete && img.naturalWidth > 0), 'QR kod görseli yüklendi');
		secret = (await modal.locator('code').innerText()).trim();
		t.check(/^[A-Z2-7]{16,}$/.test(secret), 'gizli anahtar (base32) görünüyor', secret.length ? `${secret.length} karakter` : 'boş');
		await t.shot(page, 'kurulum-1440x900');
		await modalFits(page, '1440×900', t);

		await page.setViewportSize({ width: 1024, height: 600 });
		await page.waitForTimeout(300);
		await modalFits(page, '1024×600', t);
		await t.shot(page, 'kurulum-1024x600');
		// Alçak ekranda da onay düğmesine ulaşılıyor (modal kendi içinde kayıyor).
		const confirm = modal.getByRole('button', { name: 'Doğrula ve Etkinleştir' });
		await confirm.scrollIntoViewIfNeeded();
		const vp = page.viewportSize();
		const b = await confirm.boundingBox();
		t.check(b.y >= 0 && b.y + b.height <= vp.height, '1024×600: "Doğrula ve Etkinleştir" düğmesi ekranda');

		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(300);
		await modalFits(page, '390×844 (mobil)', t);
		await t.shot(page, 'kurulum-390x844');
		t.check(await modal.isVisible(), 'mobil görünümde modal hâlâ açık');
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.waitForTimeout(300);
	});

	// ---- 3. Kod gir → kurtarma kodları → kapat → tüm uygulamalar --------------------------
	await t.step('doğrulama kodu girilince kurtarma kodları gösteriliyor, kapatınca tüm uygulamalar açılıyor', async () => {
		const modal = page.locator(MODAL);
		await modal.locator('input[autocomplete=one-time-code]').fill(await totpCode(secret));
		await modal.getByRole('button', { name: 'Doğrula ve Etkinleştir' }).click();
		// Kodlar bir kez gösterilir; kullanıcı "Kaydettim"e basana kadar ekranda kalmalı.
		// Wait for the codes themselves (a busy machine answers slowly), then give the modal a moment to prove it stays.
		await page.waitForFunction(
			({ sel, src, flags }) => [...document.querySelectorAll(sel)].filter((e) => new RegExp(src, flags).test(e.textContent.trim())).length >= 8,
			{ sel: `${MODAL} span`, src: RECOVERY.source, flags: RECOVERY.flags },
			{ timeout: 30_000 },
		).catch(() => {});
		await page.waitForTimeout(2500);
		const shown = await page.locator(`${MODAL} span`).evaluateAll((els) => els.map((e) => e.textContent.trim()));
		recovery = shown.filter((s) => RECOVERY.test(s));
		t.eq(recovery.length, 8, 'modalda 8 kurtarma kodu gösteriliyor (kullanıcı kapatana kadar kalıyor)');
		t.check(await modal.isVisible(), 'kurtarma kodları ekranındayken modal kapanmadı');
		await t.shot(page, 'kurtarma-kodlari');
		await modalFits(page, 'kurtarma kodları', t);
		await modal.getByRole('button', { name: 'Kaydettim, kapat' }).click();
		await modal.waitFor({ state: 'detached' });
		await page.locator('[data-dock-app=budget]').waitFor();
		t.sameSet(await dockApps(page), ADMIN_DOCK, 'modal kapandı; bütün uygulamalar Dock\'ta');
		t.eq(await page.locator('[data-no-role-notice]').count(), 0, '"rol yok" uyarısı çıkmıyor');
		await t.shot(page, 'admin-tum-uygulamalar');
	});

	// ---- 4. Çıkış → yeniden giriş → TOTP adımı -------------------------------------------
	await t.step('çıkış, yeniden giriş: şifreden sonra TOTP adımı isteniyor', async () => {
		await logoutUi(page);
		await submitCredentials(page, bootstrap.eposta, bootstrap.sifre);
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		t.check(await page.getByText('İki adımlı doğrulama', { exact: true }).first().isVisible(), 'TwoFactorForm başlığı görünüyor');
		t.eq(await page.locator('input[type=password]').count(), 0, 'parola alanı yok, yalnız kod adımı');
		await t.shot(page, 'giris-totp-adimi');

		await submitSecondFactor(page, '000000');
		await page.getByText(/geçersiz|hatalı|yanlış/i).first().waitFor();
		t.check(await page.locator('input[autocomplete=one-time-code]').isVisible(), 'yanlış kodda TOTP adımında kalıyor');
		t.eq(await dockApps(page), [], 'yanlış kodla masaüstü açılmadı');

		await submitSecondFactor(page, await totpCode(secret));
		await page.locator('[data-dock-app=budget]').waitFor();
		t.sameSet(await dockApps(page), ADMIN_DOCK, 'doğru kodla girildi, bütün uygulamalar açık');
		t.eq(await page.locator(MODAL).count(), 0, 'kurulumu bitmiş admine modal çıkmıyor');
	});

	// ---- 5. Kurtarma kodu: giriş yapar, tek kullanımlık -----------------------------------
	await t.step('kurtarma koduyla giriş çalışıyor ve kod tek kullanımlık', async () => {
		await logoutUi(page);
		await submitCredentials(page, bootstrap.eposta, bootstrap.sifre);
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		await submitSecondFactor(page, recovery[0]);
		await page.locator('[data-dock-app=budget]').waitFor();
		t.check(true, 'kurtarma kodu #1 ile giriş yapıldı');

		await logoutUi(page);
		await submitCredentials(page, bootstrap.eposta, bootstrap.sifre);
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		await submitSecondFactor(page, recovery[0]);
		await page.getByText(/geçersiz|hatalı|yanlış/i).first().waitFor();
		t.eq(await dockApps(page), [], 'aynı kurtarma kodu ikinci kez kabul edilmedi');
		await t.shot(page, 'kurtarma-kodu-ikinci-kullanim-reddedildi');
		await submitSecondFactor(page, recovery[1]);
		await page.locator('[data-dock-app=budget]').waitFor();
		t.check(true, 'başka bir kurtarma kodu (#2) hâlâ çalışıyor');
	});

	// Buradan sonra admin API istemcisi: tarayıcının son oturumu.
	const admin = client(base, await sessionToken(context, base));

	// ---- 6. Rol bazlı zorunluluk ---------------------------------------------------------
	const rolYonetim = await createRole(admin, { ad: 'Yönetim Kurulu', renk: '#ff9f0a', aciklama: '', ikiAdimZorunlu: true, izinler: { news: 'yonet', events: 'yonet', members: 'kullan', settings: 'kullan' } });
	const rolUye = await createRole(admin, { ad: 'Üye', renk: '#0a84ff', aciklama: '', ikiAdimZorunlu: false, izinler: { news: 'kullan', events: 'kullan', settings: 'kullan' } });
	const rolTakip = await createRole(admin, { ad: 'Takip', renk: '#30d158', aciklama: '', ikiAdimZorunlu: false, izinler: { news: 'kullan', settings: 'kullan' } });
	const yk = await createMember(admin, base, { ad: 'Yasemin', soyad: 'Kurul', eposta: 'yasemin@e2e.test', rolId: rolYonetim });
	const uye = await createMember(admin, base, { ad: 'Ugur', soyad: 'Uye', eposta: 'ugur@e2e.test', rolId: rolUye });
	const takip = await createMember(admin, base, { ad: 'Tuna', soyad: 'Takip', eposta: 'tuna@e2e.test', rolId: rolTakip });

	await t.step('"Yönetim Kurulu" rolündeki yeni üye: ilk girişte aynı modal açılıyor', async () => {
		const o = await openAnonymous(t.browser, base);
		t.track(o.context);
		await submitCredentials(o.page, yk.eposta, yk.sifre);
		await o.page.locator(MODAL).waitFor();
		t.check(await o.page.locator(MODAL).isVisible(), 'Yönetim Kurulu üyesine zorunlu 2FA modalı açıldı');
		t.eq(await dockApps(o.page), ['settings'], 'Dock\'ta yalnız Ayarlar');
		t.check((await o.page.locator(MODAL).innerText()).includes('zorunlu'), 'durum satırı "bu rol için zorunlu" diyor');
		await t.shot(o.page, 'yonetim-kurulu-modal');
		await modalFits(o.page, 'Yönetim Kurulu', t);
	});

	await t.step('"Üye" rolündeki (zorunlu değil) kullanıcıda modal açılmıyor', async () => {
		const o = await openAnonymous(t.browser, base);
		t.track(o.context);
		await loginUi(o.page, uye.eposta, uye.sifre);
		t.eq(await o.page.locator(MODAL).count(), 0, 'modal yok');
		t.sameSet(await dockApps(o.page), ['news', 'events', 'settings'], 'Dock rolün uygulamalarını gösteriyor');
		await t.shot(o.page, 'uye-modal-yok');
	});

	await t.step('admin rolün "2FA zorunlu" anahtarını açınca açık oturumda ≤15 sn içinde modal beliriyor', async () => {
		const o = await openAnonymous(t.browser, base);
		t.track(o.context);
		await loginUi(o.page, takip.eposta, takip.sifre);
		t.eq(await o.page.locator(MODAL).count(), 0, 'başlangıçta modal yok');
		const rol = (await admin.get('/api/roller')).json.roller.find((r) => r.id === rolTakip);
		const patch = (zorunlu) => admin.patch('/api/roller', { id: rolTakip, ad: rol.ad, renk: rol.renk, aciklama: rol.aciklama, izinler: rol.izinler, ikiAdimZorunlu: zorunlu });
		t.eq((await patch(true)).status, 200, 'PATCH /api/roller {ikiAdimZorunlu: true} 200');
		const ms = await t.waitFor(async () => (await o.page.locator(MODAL).count()) === 1, { timeout: 25_000 });
		t.check(ms >= 0 && ms <= 20_000, `modal sayfa yenilenmeden belirdi (${ms} ms)`);
		t.eq(await dockApps(o.page), ['settings'], 'Dock yalnız Ayarlar\'a indi');
		await t.shot(o.page, 'canli-zorunlu-modal');
		await modalFits(o.page, 'canlı zorunluluk', t);
		// Anahtar geri kapanınca modal da kalkıyor.
		t.eq((await patch(false)).status, 200, 'anahtar geri kapatıldı');
		const gone = await t.waitFor(async () => (await o.page.locator(MODAL).count()) === 0, { timeout: 25_000 });
		t.check(gone >= 0 && gone <= 20_000, `anahtar kapanınca modal kalktı (${gone} ms)`);
		t.sameSet(await dockApps(o.page), ['news', 'settings'], 'Dock geri geldi');
	});
}
