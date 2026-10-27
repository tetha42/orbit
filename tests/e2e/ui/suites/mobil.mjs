// Mobil başlatıcı (390×844): yalnız izinli uygulamalar ve rol rozeti.
import { dockApps } from '../lib/browser.mjs';

export const meta = { title: 'Mobil başlatıcı: izinli uygulamalar ve rol rozeti' };

/** Tiles that drew no icon at all (a blank square). */
const blankTiles = (page) => page.locator('[data-launcher-app]').evaluateAll((els) => els.filter((e) => !e.querySelector('svg, img')).map((e) => e.getAttribute('data-launcher-app')));

/** The grid lives on the "Uygulamalar" tab of the bottom bar; the first tab is the cockpit. */
const openAppsTab = async (page) => {
	await page.locator('[data-mobile-tab=apps]').click();
	await page.locator('[data-launcher-app]').first().waitFor();
};

const launcher = (page) => page.locator('[data-launcher-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-launcher-app')));

export default async function suite(t) {
	await t.step('"Sadece Haberler" (okur): yalnız Haberler ve Ayarlar + rozet', async () => {
		const { page } = await t.open('okur', { mobile: true });
		// First screen is the cockpit: the role badge sits in its header, the grid is one tab away.
		await page.locator('[data-mobile-nav]').waitFor();
		const badge = page.locator('[data-role-badge="Sadece Haberler"]');
		t.eq(await badge.count(), 1, 'rol rozeti "Sadece Haberler" görünüyor');
		t.check(await badge.isVisible(), 'rozet ekranda görünür');
		t.eq(await page.locator('[data-no-role-notice]').count(), 0, 'rolü olan kullanıcıya "rol yok" uyarısı çıkmıyor');
		await openAppsTab(page);
		t.sameSet(await launcher(page), ['news', 'settings'], 'başlatıcıda yalnız izinli uygulamalar');
		t.eq(await blankTiles(page), [], 'her karoda simge var (Haberler karosu boş kalmıyor)');
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		t.check(overflow <= 0, 'yatay taşma yok', `${overflow}px`);
		await t.shot(page, 'okur-baslatici');

		// Dokununca uygulama tam ekran açılıyor, Geri dönüyor.
		await page.locator('[data-launcher-app=news]').click();
		await page.getByRole('button', { name: 'Geri' }).waitFor();
		await t.shot(page, 'okur-haberler-acik');
		await page.getByRole('button', { name: 'Geri' }).click();
		await page.locator('[data-launcher-app]').first().waitFor();
	});

	await t.step('"Üye" (can): Üye rolünün uygulamaları', async () => {
		const { page } = await t.open('can', { mobile: true });
		await page.locator('[data-mobile-nav]').waitFor();
		t.eq(await page.locator('[data-role-badge="Üye"]').count(), 1, 'rol rozeti "Üye"');
		await openAppsTab(page);
		t.sameSet(await launcher(page), ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail'], 'başlatıcı = Üye rolünün uygulamaları');
		await t.shot(page, 'can-baslatici');
	});

	await t.step('admin: başlatıcı masaüstü Dock\'uyla aynı uygulamaları gösteriyor', async () => {
		const desktop = await t.open('admin');
		const dock = await dockApps(desktop.page);
		const { page } = await t.open('admin', { mobile: true });
		await page.locator('[data-mobile-nav]').waitFor();
		t.eq(await page.locator('[data-role-badge="Admin"]').count(), 1, 'rol rozeti "Admin"');
		await openAppsTab(page);
		t.sameSet(await launcher(page), dock, 'başlatıcı = Dock');
		t.includes(await launcher(page), 'budget', 'admin için Kasa var (olumlu kontrol)');
		t.eq(await blankTiles(page), [], 'admin: her karoda simge var');
		await t.shot(page, 'admin-baslatici');
	});
}
