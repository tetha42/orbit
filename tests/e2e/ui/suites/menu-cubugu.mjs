// Üst menü çubuğu: MENU_YETKI (src/components/shell/TopBar/MenuBar.tsx) yetkisiz öğeyi hiç göstermez.
import { openApp } from '../lib/browser.mjs';

export const meta = { title: 'Menü çubuğu: yetkisiz öğeler görünmüyor' };

/** Opens a menu-bar category and returns the item ids in it. */
async function categoryItems(page, category) {
	await page.locator(`[data-menubar-category=${category}]`).click();
	const items = await page.locator('[data-menu-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-item')));
	return items;
}

/** Empties the menu state: clicking the bare desktop focuses the portal and closes menus. */
async function portalFocus(page) {
	await page.mouse.click(5, 450);
	await page.waitForTimeout(150);
}

const PORTAL_FILE = ['new-event', 'new-member', 'new-budget-entry', 'export-report'];

export default async function suite(t) {
	// Portal menüsü → Dosya: Yeni Etkinlik / Yeni Üye / Gelir-Gider / Faaliyet Raporu
	for (const [key, beklenen] of [
		['okur', []],
		['can', []],
		['zeynep', PORTAL_FILE],
		['admin', PORTAL_FILE],
	]) {
		await t.step(`${key}: portal Dosya menüsü`, async () => {
			const { page } = await t.open(key);
			await portalFocus(page);
			const items = await categoryItems(page, 'file');
			for (const id of PORTAL_FILE) {
				t.check(items.includes(id) === beklenen.includes(id), `${key}: "${id}" ${beklenen.includes(id) ? 'görünüyor' : 'görünmüyor'}`, JSON.stringify(items));
			}
			await t.shot(page, `${key}-dosya-menusu`);
		});
	}

	// Kararlar uygulaması → Belgeler: Yeni Karar (yönet) yalnız yönetene; yazdırma (kullan) herkese
	for (const [key, yeniKarar] of [['can', false], ['zeynep', true]]) {
		await t.step(`${key}: Kararlar uygulamasının Belgeler menüsü`, async () => {
			const { page } = await t.open(key);
			await openApp(page, 'decisions');
			const items = await categoryItems(page, 'file');
			t.check(items.includes('new-decision') === yeniKarar, `${key}: "Yeni Karar" ${yeniKarar ? 'görünüyor' : 'görünmüyor'}`, JSON.stringify(items));
			t.includes(items, 'print-petition', `${key}: kullan yetkisiyle gelen "Dilekçeyi Yazdır" görünüyor (olumlu kontrol)`);
			await t.shot(page, `${key}-kararlar-belgeler-menusu`);
		});
	}

	// Üye Rehberi → Kayıt: Yeni Üye (yönet) / Listeyi Dışa Aktar (kullan)
	for (const [key, yeniUye] of [['can', false], ['zeynep', true]]) {
		await t.step(`${key}: Üye Rehberi menüsü`, async () => {
			const { page } = await t.open(key);
			await openApp(page, 'members');
			const items = await categoryItems(page, 'file');
			t.check(items.includes('add-member') === yeniUye, `${key}: "Yeni Üye Ekle" ${yeniUye ? 'görünüyor' : 'görünmüyor'}`, JSON.stringify(items));
			t.includes(items, 'export-roster', `${key}: "Üye Listesini Dışa Aktar" görünüyor`);
		});
	}
}
