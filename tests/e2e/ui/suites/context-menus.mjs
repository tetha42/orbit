// Context menus: do the commands of the desktop, window and Dock context menus actually
// work, does the menu stay on screen and close, and does the role filter the "New …" shortcuts.
// (The role-based content of the "Open Workspace App" submenu lives in the `context-menu` package.)
import { openApp, openWindows } from '../lib/browser.mjs';
import { frameBox, menuBox, menuItems, rightClickDesktop } from '../lib/desktop.mjs';

export const meta = { title: 'Context menus: desktop, window and Dock commands; role-based shortcuts' };

const VIEW = { width: 1440, height: 900 };
const item = (page, id) => page.locator(`[data-menu-item=${id}]`);

/** Hovers a parent menu item and waits for its submenu to open. */
async function hoverSubmenu(page, parent, child) {
	await item(page, parent).hover();
	await item(page, child).waitFor();
}

const closed = async (page) => (await page.locator('[data-menu]').count()) === 0;

export default async function suite(t) {
	await t.step('desktop menu: stays on screen, closes on outside click and with Esc', async () => {
		const { page } = await t.open('can');
		await rightClickDesktop(page, VIEW.width - 8, VIEW.height - 130);
		await item(page, 'dt-open-tool').waitFor();
		const box = await menuBox(page);
		t.check(box.x >= 0 && box.y >= 0 && box.x + box.width <= VIEW.width && box.y + box.height <= VIEW.height, 'menu opened at the bottom-right corner stays inside the screen', JSON.stringify(box));
		await t.shot(page, 'masaustu-menusu-kose');
		await page.mouse.click(5, 450);
		t.check(await t.waitFor(() => closed(page), { timeout: 3000 }) >= 0, 'menu closed on outside click');

		await rightClickDesktop(page);
		await item(page, 'dt-open-tool').waitFor();
		await page.keyboard.press('Escape');
		t.check(await t.waitFor(() => closed(page), { timeout: 3000 }) >= 0, 'Esc closed the menu');
	});

	await t.step('desktop menu: theme, about, arrange windows', async () => {
		const { page } = await t.open('can');
		const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
		const before = await theme();
		await rightClickDesktop(page);
		await item(page, 'dt-theme').click();
		t.check((await t.waitFor(async () => (await theme()) !== before, { timeout: 3000 })) >= 0, `theme changed (${before} → ${await theme()})`);
		t.check(await closed(page), 'menu closed after the command');
		await rightClickDesktop(page);
		await item(page, 'dt-theme').click();
		t.check((await t.waitFor(async () => (await theme()) === before, { timeout: 3000 })) >= 0, 'second time: theme restored');

		await rightClickDesktop(page);
		await item(page, 'dt-about').click();
		await page.locator('[data-about-modal]').waitFor();
		t.eq(await page.locator('[data-about-modal]').count(), 1, 'About window opened');
		await page.keyboard.press('Escape');
		await page.locator('[data-about-modal]').waitFor({ state: 'detached' });

		// Two windows: tile → they do not overlap; minimize all; close all.
		await openApp(page, 'news');
		t.sameSet(await openWindows(page), ['teams', 'news'], 'two windows open (setup)');
		await rightClickDesktop(page);
		await hoverSubmenu(page, 'dt-arrange-windows', 'dt-tile');
		await item(page, 'dt-tile').click();
		const a = await frameBox(page, 'teams');
		const b = await frameBox(page, 'news');
		const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
		t.check(!overlap, 'tile: windows do not overlap', JSON.stringify({ a, b }));
		t.check(a.x >= 0 && b.x + b.width <= VIEW.width && a.x + a.width <= VIEW.width && b.x >= 0, 'tile: windows stay inside the screen');
		await t.shot(page, 'dose');

		await rightClickDesktop(page);
		await hoverSubmenu(page, 'dt-arrange-windows', 'dt-minimize-all');
		await item(page, 'dt-minimize-all').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).length === 0, { timeout: 3000 })) >= 0, 'minimize all: no visible windows remain');
		await page.locator('[data-dock-app=news]').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'minimized window restored via the Dock');

		await rightClickDesktop(page);
		await hoverSubmenu(page, 'dt-arrange-windows', 'dt-close-all');
		await item(page, 'dt-close-all').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).length === 0, { timeout: 3000 })) >= 0, 'close all: no windows remain');
		// A closed window reopens from the Dock (it was closed, not minimized).
		await openApp(page, 'teams');
		t.sameSet(await openWindows(page), ['teams'], 'after closing, only the newly opened window remains');
	});

	await t.step('window menu: minimize and close apply to that window', async () => {
		const { page } = await t.open('can');
		const win = await openApp(page, 'news');
		const box = await frameBox(page, 'news');
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
		await item(page, 'app-close').waitFor();
		const items = await menuItems(page);
		t.includes(items, 'app-minimize', 'window menu offers the minimize command');
		await t.shot(page, 'pencere-menusu');
		await item(page, 'app-minimize').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'minimize: News window hidden');
		t.includes(await openWindows(page), 'teams', 'the other window was not touched');

		await page.locator('[data-dock-app=news]').click();
		await win.waitFor();
		const box2 = await frameBox(page, 'news');
		await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height / 2, { button: 'right' });
		await item(page, 'app-close').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'close: News window closed');
		t.includes(await openWindows(page), 'teams', 'Teams window stayed open');
	});

	await t.step('Dock menu: open, hide, close, auto-hide', async () => {
		const { page } = await t.open('can');
		const dock = (id) => page.locator(`[data-dock-app=${id}]`);
		await dock('news').click({ button: 'right' });
		await item(page, 'primary-action').waitFor();
		let items = await menuItems(page);
		t.excludes(items, 'dock-quit', 'a closed app has no quit command');
		const box = await menuBox(page);
		// Top edge of the Dock bar (not the icon: a hovered icon grows and rises).
		const dockTop = await page.locator('[data-dock]').evaluate((el) => el.getBoundingClientRect().top);
		const iconBox = await dock('news').boundingBox();
		t.check(box && box.y + box.height <= dockTop + 4, 'Dock menu opened above the Dock bar', JSON.stringify({ box, dockTop }));
		t.check(box && box.x <= iconBox.x + iconBox.width / 2 && box.x + box.width >= iconBox.x + iconBox.width / 2, 'Dock menu is aligned with the icon', JSON.stringify({ box, iconBox }));
		await item(page, 'primary-action').click();
		await page.locator('[data-window-frame=news]').waitFor();
		t.includes(await openWindows(page), 'news', 'the open command launched the app');

		await dock('news').click({ button: 'right' });
		await item(page, 'dock-hide').waitFor();
		items = await menuItems(page);
		t.includes(items, 'dock-quit', 'an open app has a quit command');
		await item(page, 'dock-hide').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'the hide command hid the window');
		await dock('news').click();
		t.check((await t.waitFor(async () => (await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'Dock click restored the hidden window');

		await dock('news').click({ button: 'right' });
		await item(page, 'dock-quit').click();
		t.check((await t.waitFor(async () => !(await openWindows(page)).includes('news'), { timeout: 3000 })) >= 0, 'the quit command closed the window');

		// Auto-hide: once enabled, the Dock is invisible while the pointer is away and returns when disabled.
		const dockOpacity = () => dock('teams').evaluate((el) => {
			let e = el;
			while (e && getComputedStyle(e).position !== 'fixed') e = e.parentElement;
			return Number(getComputedStyle(e ?? el).opacity);
		});
		await dock('teams').click({ button: 'right' });
		await hoverSubmenu(page, 'dock-options', 'opt-dock-autohide');
		await item(page, 'opt-dock-autohide').click();
		await page.mouse.move(700, 300);
		t.check((await t.waitFor(async () => (await dockOpacity()) === 0, { timeout: 4000 })) >= 0, 'auto-hide: Dock hidden');
		await t.shot(page, 'dock-gizli');
		await page.mouse.move(720, VIEW.height - 3);
		t.check((await t.waitFor(async () => (await dockOpacity()) === 1, { timeout: 4000 })) >= 0, 'Dock appeared when the pointer reached the bottom edge');
		await dock('teams').click({ button: 'right' });
		await hoverSubmenu(page, 'dock-options', 'opt-dock-autohide');
		await item(page, 'opt-dock-autohide').click();
		await page.mouse.move(700, 300);
		await page.waitForTimeout(800);
		t.eq(await dockOpacity(), 1, 'after disabling auto-hide the Dock stayed visible');
	});

	await t.step('role: "New …" shortcuts only for managers; menus of the news-only user', async () => {
		const shortcuts = async (key) => {
			const { page, context } = await t.open(key);
			await page.locator('[data-dock-app=events]').click({ button: 'right' });
			await item(page, 'primary-action').waitFor();
			const items = await menuItems(page);
			await page.keyboard.press('Escape');
			await t.close(context);
			return items;
		};
		t.includes(await shortcuts('zeynep'), 'dock-new-event', 'zeynep (event manager): Dock menu has the new-event shortcut');
		t.excludes(await shortcuts('can'), 'dock-new-event', 'can (Member): Dock menu has no new-event shortcut');

		const { page } = await t.open('reader');
		await rightClickDesktop(page);
		await item(page, 'dt-open-tool').waitFor();
		const desk = await menuItems(page);
		for (const id of ['dt-new-event', 'dt-new-member', 'dt-new-budget']) t.excludes(desk, id, `reader: desktop menu has no ${id}`);
		await page.keyboard.press('Escape');
		await page.locator('[data-dock-app=news]').click({ button: 'right' });
		await item(page, 'primary-action').waitFor();
		t.check((await menuItems(page)).every((id) => !id.startsWith('dock-new-')), 'reader: News Dock menu has no "New …" shortcuts');
		await t.shot(page, 'okur-dock-menusu');
	});
}
