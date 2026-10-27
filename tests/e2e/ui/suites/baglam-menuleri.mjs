// Sağ tık menüleri: masaüstü, pencere ve Dock bağlam menülerinin komutları gerçekten
// çalışıyor mu, menü ekranda kalıyor ve kapanıyor mu, rol "Yeni …" kısayollarını süzüyor mu.
// ("Çalışma Uygulaması Aç" alt menüsünün role göre içeriği `sag-tik` paketindedir.)
import { openApp, openWindows } from '../lib/browser.mjs';
import { frameBox, menuBox, menuItems, rightClickDesktop } from '../lib/desktop.mjs';

export const meta = { title: 'Bağlam menüleri: masaüstü, pencere ve Dock komutları; role göre kısayollar' };

const VIEW = { width: 1440, height: 900 };
const item = (page, id) => page.locator(`[data-menu-item=${id}]`);

/** Bir üst menü öğesinin üzerine gelip alt menüsünün açılmasını bekler. */
async function hoverSubmenu(page, parent, child) {
	await item(page, parent).hover();
	await item(page, child).waitFor();
}

const closed = async (page) => (await page.locator('[data-menu]').count()) === 0;

export default async function suite(t) {
	await t.step('masaüstü menüsü: ekranda kalır, dışarı tıklayınca ve Esc ile kapanır', async () => {
		const { page } = await t.open('can');
		await rightClickDesktop(page, VIEW.width - 8, VIEW.height - 130);
		await item(page, 'dt-open-tool').waitFor();
		const box = await menuBox(page);
		t.check(box.x >= 0 && box.y >= 0 && box.x + box.width <= VIEW.width && box.y + box.height <= VIEW.height, 'sağ alt köşede açılan menü ekranın içinde', JSON.stringify(box));
		await t.shot(page, 'masaustu-menusu-kose');
		await page.mouse.click(5, 450);
		t.check(await t.waitFor(() => closed(page), { timeout: 3000 }) >= 0, 'dışarı tıklayınca menü kapandı');

		await rightClickDesktop(page);
		await item(page, 'dt-open-tool').waitFor();
		await page.keyboard.press('Escape');
		t.check(await t.waitFor(() => closed(page), { timeout: 3000 }) >= 0, 'Esc menüyü kapattı');
	});

	await t.step('masaüstü menüsü: tema, hakkında, pencereleri düzenle', async () => {
		const { page } = await t.open('can');
		const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
		const before = await theme();
		await rightClickDesktop(page);
		await item(page, 'dt-theme').click();
		t.check((await t.waitFor(async () => (await theme()) !== before, { timeout: 3000 })) >= 0, `tema değişti (${before} → ${await theme()})`);
		t.check(await closed(page), 'komuttan sonra menü kapandı');
		await rightClickDesktop(page);
		await item(page, 'dt-theme').click();
		t.check((await t.waitFor(async () => (await theme()) === before, { timeout: 3000 })) >= 0, 'ikinci kez: tema geri döndü');

		await rightClickDesktop(page);
		await item(page, 'dt-about').click();
		await page.locator('[data-about-modal]').waitFor();
		t.eq(await page.locator('[data-about-modal]').count(), 1, '"Hakkında" penceresi açıldı');
		await page.keyboard.press('Escape');
		await page.locator('[data-about-modal]').waitFor({ state: 'detached' });

		// İki pencere: döşe → üst üste binmezler; hepsini küçült; hepsini kapat.
		await openApp(page, 'news');
		t.sameSet(await openWindows(page), ['teams', 'news'], 'iki pencere açık (kurulum)');
		await rightClickDesktop(page);
		await hoverSubmenu(page, 'dt-arrange-windows', 'dt-tile');
		await item(page, 'dt-tile').click();
		const a = await frameBox(page, 'teams');
		const b = await frameBox(page, 'news');
		const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
		t.check(!overlap, 'döşe: pencereler üst üste binmiyor', JSON.stringify({ a, b }));
		t.check(a.x >= 0 && b.x + b.width <= VIEW.width && a.x + a.width <= VIEW.width && b.x >= 0, 'döşe: pencereler ekranın içinde');
		await t.shot(page, 'dose');

		await rightClickDesktop(page);
		await hoverSubmenu(page, 'dt-arrange-windows', 'dt-minimize-all');
		await item(page, 'dt-minimize-all').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).length === 0, { timeout: 3000 })) >= 0, 'hepsini küçült: görünen pencere kalmadı');
		await page.locator('[data-dock-app=news]').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'küçültülen pencere Dock ile geri geldi');

		await rightClickDesktop(page);
		await hoverSubmenu(page, 'dt-arrange-windows', 'dt-close-all');
		await item(page, 'dt-close-all').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).length === 0, { timeout: 3000 })) >= 0, 'hepsini kapat: pencere kalmadı');
		// Kapatılan pencere Dock'tan açılınca yeniden görünür (küçültülmüş değil, kapalıydı).
		await openApp(page, 'teams');
		t.sameSet(await openWindows(page), ['teams'], 'kapatılandan sonra yalnız açılan pencere var');
	});

	await t.step('pencere menüsü: küçült ve kapat o pencereye uygulanır', async () => {
		const { page } = await t.open('can');
		const win = await openApp(page, 'news');
		const box = await frameBox(page, 'news');
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
		await item(page, 'app-close').waitFor();
		const items = await menuItems(page);
		t.includes(items, 'app-minimize', 'pencere menüsünde "küçült" var');
		await t.shot(page, 'pencere-menusu');
		await item(page, 'app-minimize').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'küçült: Haberler gizlendi');
		t.includes(await openWindows(page), 'teams', 'öteki pencereye dokunulmadı');

		await page.locator('[data-dock-app=news]').click();
		await win.waitFor();
		const box2 = await frameBox(page, 'news');
		await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2, { button: 'right' });
		await item(page, 'app-close').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'kapat: Haberler kapandı');
		t.includes(await openWindows(page), 'teams', 'Takımlar penceresi açık kaldı');
	});

	await t.step('Dock menüsü: aç, gizle, kapat, otomatik gizleme', async () => {
		const { page } = await t.open('can');
		const dock = (id) => page.locator(`[data-dock-app=${id}]`);
		await dock('news').click({ button: 'right' });
		await item(page, 'primary-action').waitFor();
		let items = await menuItems(page);
		t.excludes(items, 'dock-quit', 'kapalı uygulamada "kapat" yok');
		const box = await menuBox(page);
		// Dock çubuğunun (simgenin değil: üzerine gelinen simge büyüyüp yukarı kalkar) üst kenarı.
		const dockTop = await page.locator('[data-dock]').evaluate((el) => el.getBoundingClientRect().top);
		const iconBox = await dock('news').boundingBox();
		t.check(box && box.y + box.height <= dockTop + 4, 'Dock menüsü Dock çubuğunun üstünde açıldı', JSON.stringify({ box, dockTop }));
		t.check(box && box.x <= iconBox.x + iconBox.width / 2 && box.x + box.width >= iconBox.x + iconBox.width / 2, 'Dock menüsü simgenin hizasında', JSON.stringify({ box, iconBox }));
		await item(page, 'primary-action').click();
		await page.locator('[data-window-frame=news]').waitFor();
		t.includes(await openWindows(page), 'news', '"Aç" uygulamayı açtı');

		await dock('news').click({ button: 'right' });
		await item(page, 'dock-hide').waitFor();
		items = await menuItems(page);
		t.includes(items, 'dock-quit', 'açık uygulamada "kapat" var');
		await item(page, 'dock-hide').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, '"Gizle" pencereyi gizledi');
		await dock('news').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'Dock tıklaması gizlenen pencereyi geri getirdi');

		await dock('news').click({ button: 'right' });
		await item(page, 'dock-quit').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, '"Kapat" pencereyi kapattı');

		// Otomatik gizleme: açılınca imleç uzaktayken Dock görünmez olur, kapatılınca geri gelir.
		const dockOpacity = () => dock('teams').evaluate((el) => {
			let e = el;
			while (e && getComputedStyle(e).position !== 'fixed') e = e.parentElement;
			return Number(getComputedStyle(e ?? el).opacity);
		});
		await dock('teams').click({ button: 'right' });
		await hoverSubmenu(page, 'dock-options', 'opt-dock-autohide');
		await item(page, 'opt-dock-autohide').click();
		await page.mouse.move(700, 300);
		t.check((await t.waitFor(async () => (await dockOpacity()) === 0, { timeout: 4000 })) >= 0, 'otomatik gizleme: Dock gizlendi');
		await t.shot(page, 'dock-gizli');
		await page.mouse.move(720, VIEW.height - 3);
		t.check((await t.waitFor(async () => (await dockOpacity()) === 1, { timeout: 4000 })) >= 0, 'alt kenara gelince Dock göründü');
		await dock('teams').click({ button: 'right' });
		await hoverSubmenu(page, 'dock-options', 'opt-dock-autohide');
		await item(page, 'opt-dock-autohide').click();
		await page.mouse.move(700, 300);
		await page.waitForTimeout(800);
		t.eq(await dockOpacity(), 1, 'otomatik gizleme kapatılınca Dock görünür kaldı');
	});

	await t.step('rol: "Yeni …" kısayolları yalnız yönetene; Sadece Haberler kullanıcısının menüleri', async () => {
		const shortcuts = async (key) => {
			const { page } = await t.open(key);
			await page.locator('[data-dock-app=events]').click({ button: 'right' });
			await item(page, 'primary-action').waitFor();
			const items = await menuItems(page);
			await page.keyboard.press('Escape');
			return items;
		};
		t.includes(await shortcuts('zeynep'), 'dock-new-event', 'zeynep (etkinlik yöneticisi): Dock menüsünde "yeni etkinlik" var');
		t.excludes(await shortcuts('can'), 'dock-new-event', 'can (Üye): Dock menüsünde "yeni etkinlik" yok');

		const { page } = await t.open('okur');
		await rightClickDesktop(page);
		await item(page, 'dt-open-tool').waitFor();
		const desk = await menuItems(page);
		for (const id of ['dt-new-event', 'dt-new-member', 'dt-new-budget']) t.excludes(desk, id, `okur: masaüstü menüsünde ${id} yok`);
		await page.keyboard.press('Escape');
		await page.locator('[data-dock-app=news]').click({ button: 'right' });
		await item(page, 'primary-action').waitFor();
		t.check((await menuItems(page)).every((id) => !id.startsWith('dock-new-')), 'okur: Haberler Dock menüsünde "yeni …" kısayolu yok');
		await t.shot(page, 'okur-dock-menusu');
	});
}
