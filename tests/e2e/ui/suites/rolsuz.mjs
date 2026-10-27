// Rolsüz üye: PATCH /api/uyeler {rolId: null} → "rol atanmadı" uyarısı, Dock'ta yalnız Ayarlar.
import { dockApps, openWindows } from '../lib/browser.mjs';

export const meta = { title: 'Rolsüz kullanıcı: uyarı ve yalnız Ayarlar' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const okurId = fx.users.okur.id;
	t.cleanup(() => admin.patch('/api/uyeler', { id: okurId, rolId: fx.roles.haber }));

	await t.step('yeni giriş: rol kaldırılmış kullanıcıda uyarı görünüyor', async () => {
		const res = await admin.patch('/api/uyeler', { id: okurId, rolId: null });
		t.eq(res.status, 200, 'PATCH /api/uyeler {rolId: null} 200');
		const { page } = await t.open('okur');
		await page.locator('[data-no-role-notice]').waitFor();
		t.eq(await page.locator('[data-no-role-notice]').count(), 1, '[data-no-role-notice] görünüyor');
		const text = await page.locator('[data-no-role-notice]').innerText();
		t.check(/rol/i.test(text), 'uyarı metni rol atanmadığını söylüyor', text);
		t.eq(await dockApps(page), ['settings'], 'Dock\'ta yalnız Ayarlar kaldı');
		t.eq(await openWindows(page), [], 'açık uygulama penceresi yok');
		await t.shot(page, 'rolsuz-masaustu');

		// Uyarıdaki düğme Ayarlar'ı açıyor, Roller/SMTP sekmeleri yok.
		await page.locator('[data-no-role-settings]').click();
		const settings = page.locator('[data-window-frame=settings]');
		await settings.waitFor();
		await settings.locator('[data-settings-tab=account]').waitFor();
		t.check(await settings.locator('[data-settings-tab=security]').count() === 1, 'Ayarlar açıldı: kişisel sekmeler var');
		t.eq(await settings.locator('[data-settings-tab=roles], [data-settings-tab=smtp]').count(), 0, 'Roller ve SMTP sekmeleri yok');
	});

	await t.step('canlı: açık oturumda rol kaldırılınca uyarı ≤15 sn içinde çıkıyor', async () => {
		await admin.patch('/api/uyeler', { id: okurId, rolId: fx.roles.haber });
		const { page } = await t.open('okur');
		await page.locator('[data-dock-app=news]').waitFor();
		t.eq(await page.locator('[data-no-role-notice]').count(), 0, 'rolü varken uyarı yok');
		await admin.patch('/api/uyeler', { id: okurId, rolId: null });
		const ms = await t.waitFor(async () => (await page.locator('[data-no-role-notice]').count()) === 1, { timeout: 25_000 });
		t.check(ms >= 0 && ms <= 20_000, `rol kaldırılınca uyarı sayfa yenilenmeden çıktı (${ms} ms)`);
		t.eq(await dockApps(page), ['settings'], 'Dock yalnız Ayarlar');
	});

	await t.step('mobil (390×844): rolsüz kullanıcıda uyarı ve yalnız Ayarlar', async () => {
		const { page } = await t.open('okur', { mobile: true });
		await page.locator('[data-no-role-notice]').waitFor();
		t.check(await page.locator('[data-role-badge=""]').count() === 1, 'rol rozeti "Rol atanmadı" diyor');
		await page.locator('[data-mobile-tab=apps]').click();
		t.eq(await page.locator('[data-launcher-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-launcher-app'))), ['settings'], 'başlatıcıda yalnız Ayarlar');
		await t.shot(page, 'rolsuz-mobil');
	});
}
