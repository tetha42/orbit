// Masaüstü sağ tık menüsü: "Çalışma Uygulaması Aç" alt menüsünün gerçek öğeleri.
// (Eski kontrol boş listeyle geçiyordu: burada listenin boş olması da başarısızlıktır.)
import { desktopToolMenu } from '../lib/browser.mjs';

export const meta = { title: 'Sağ tık menüsü: alt menü öğeleri role göre' };

const MENU = (page) => page.locator('[data-menu-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-item')));

const CASES = [
	{ key: 'okur', apps: ['news', 'settings'], yeni: [] },
	{ key: 'can', apps: ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail'], yeni: [] },
	{ key: 'zeynep', apps: ['teams', 'events', 'projects', 'budget', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail'], yeni: ['dt-new-event', 'dt-new-member', 'dt-new-budget'] },
	{ key: 'admin', apps: ['teams', 'events', 'projects', 'budget', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'terminal', 'mail'], yeni: ['dt-new-event', 'dt-new-member', 'dt-new-budget'] },
];

export default async function suite(t) {
	for (const c of CASES) {
		await t.step(`${c.key}: sağ tık alt menüsü`, async () => {
			const { page } = await t.open(c.key);
			const apps = await desktopToolMenu(page);
			t.check(apps.length > 0, `${c.key}: alt menü boş değil (${apps.length} öğe)`);
			t.sameSet(apps, c.apps, `${c.key}: alt menüde tam olarak izinli uygulamalar var`);
			const all = await MENU(page);
			for (const id of ['dt-new-event', 'dt-new-member', 'dt-new-budget']) {
				t.check(all.includes(id) === c.yeni.includes(id), `${c.key}: "${id}" ${c.yeni.includes(id) ? 'var' : 'yok'}`, JSON.stringify(all));
			}
			await t.shot(page, `${c.key}-sag-tik-alt-menu`);
		});
	}

	await t.step('alt menü öğesi uygulamayı açıyor', async () => {
		const { page } = await t.open('okur');
		await desktopToolMenu(page);
		await page.locator('[data-menu-item=dt-app-news]').click();
		await page.locator('[data-window-frame=news]').waitFor();
		t.eq(await page.locator('[data-window-frame=news]').count(), 1, 'Haberler penceresi sağ tık menüsünden açıldı');
	});
}
