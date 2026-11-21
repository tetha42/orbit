// Desktop context menu: the real items of the "Open Workspace App" submenu.
// (The old check passed with an empty list: here an empty list is also a failure.)
import { desktopToolMenu } from '../lib/browser.mjs';

export const meta = { title: 'Context menu: submenu items by role' };

const MENU = (page) => page.locator('[data-menu-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-item')));

const CASES = [
	{ key: 'reader', apps: ['chat', 'news', 'settings'], fresh: [] },
	{ key: 'can', apps: ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail', 'chat'], fresh: [] },
	{ key: 'zeynep', apps: ['teams', 'events', 'projects', 'budget', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail', 'chat'], fresh: ['dt-new-event', 'dt-new-member', 'dt-new-budget'] },
	{ key: 'admin', apps: ['teams', 'events', 'projects', 'budget', 'decisions', 'drive', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'terminal', 'mail', 'chat', 'database', 'soc'], fresh: ['dt-new-event', 'dt-new-member', 'dt-new-budget'] },
];

export default async function suite(t) {
	for (const c of CASES) {
		await t.step(`${c.key}: context submenu`, async () => {
			const { page } = await t.open(c.key);
			const apps = await desktopToolMenu(page);
			t.check(apps.length > 0, `${c.key}: submenu is not empty (${apps.length} items)`);
			t.sameSet(apps, c.apps, `${c.key}: submenu contains exactly the permitted apps`);
			const all = await MENU(page);
			for (const id of ['dt-new-event', 'dt-new-member', 'dt-new-budget']) {
				t.check(all.includes(id) === c.fresh.includes(id), `${c.key}: "${id}" ${c.fresh.includes(id) ? 'set' : 'none'}`, JSON.stringify(all));
			}
			await t.shot(page, `${c.key}-context-submenu`);
		});
	}

	await t.step('submenu item opens the app', async () => {
		const { page } = await t.open('reader');
		await desktopToolMenu(page);
		await page.locator('[data-menu-item=dt-app-news]').click();
		await page.locator('[data-window-frame=news]').waitFor();
		t.eq(await page.locator('[data-window-frame=news]').count(), 1, 'News window opened from the context menu');
	});
}
