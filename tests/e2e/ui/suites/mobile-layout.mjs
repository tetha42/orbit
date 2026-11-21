// Mobile launcher (390×844): only permitted apps and the role badge.
import { dockApps } from '../lib/browser.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Mobile launcher: permitted apps and the role badge' };

/** Tiles that drew no icon at all (a blank square). */
const blankTiles = (page) => page.locator('[data-launcher-app]').evaluateAll((els) => els.filter((e) => !e.querySelector('svg, img')).map((e) => e.getAttribute('data-launcher-app')));

/** The grid lives on the "Apps" tab of the bottom bar; the first tab is the cockpit. */
const openAppsTab = async (page) => {
	await page.locator('[data-mobile-tab=apps]').click();
	await page.locator('[data-launcher-app]').first().waitFor();
};

const launcher = (page) => page.locator('[data-launcher-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-launcher-app')));

export default async function suite(t) {
	await t.step('"News Only" (reader): only News and Settings + badge', async () => {
		const { page } = await t.open('reader', { mobile: true });
		// First screen is the cockpit: the role badge sits in its header, the grid is one tab away.
		await page.locator('[data-mobile-nav]').waitFor();
		const badge = page.locator(`[data-role-badge="${t.fx.roleNames.news}"]`);
		t.eq(await badge.count(), 1, 'the news-only role badge is visible');
		t.check(await badge.isVisible(), 'badge is visible on screen');
		t.eq(await page.locator('[data-no-role-notice]').count(), 0, 'a user with a role does not get the no-role notice');
		await openAppsTab(page);
		t.sameSet(await launcher(page), ['chat', 'news', 'settings'], 'launcher shows only permitted apps');
		t.eq(await blankTiles(page), [], 'every tile has an icon (the News tile is not blank)');
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		t.check(overflow <= 0, 'no horizontal overflow', `${overflow}px`);
		await t.shot(page, 'okur-baslatici');

		// Tapping opens the app full screen; the back button returns.
		await page.locator('[data-launcher-app=news]').click();
		await page.getByRole('button', { name: tr('back') }).waitFor();
		await t.shot(page, 'okur-haberler-acik');
		await page.getByRole('button', { name: tr('back') }).click();
		await page.locator('[data-launcher-app]').first().waitFor();
	});

	await t.step('"Member" (can): apps of the Member role', async () => {
		const { page } = await t.open('can', { mobile: true });
		await page.locator('[data-mobile-nav]').waitFor();
		t.eq(await page.locator('[data-role-badge="Member"]').count(), 1, 'role badge shows "Member"');
		await openAppsTab(page);
		t.sameSet(await launcher(page), ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail', 'chat'], 'launcher = apps of the Member role');
		await t.shot(page, 'can-baslatici');
	});

	await t.step('admin: launcher shows the same apps as the desktop Dock', async () => {
		const desktop = await t.open('admin');
		const dock = await dockApps(desktop.page);
		const { page } = await t.open('admin', { mobile: true });
		await page.locator('[data-mobile-nav]').waitFor();
		t.eq(await page.locator('[data-role-badge="Admin"]').count(), 1, 'role badge shows "Admin"');
		await openAppsTab(page);
		t.sameSet(await launcher(page), dock, 'launcher = Dock');
		t.includes(await launcher(page), 'budget', 'admin has the budget app (positive check)');
		t.eq(await blankTiles(page), [], 'admin: every tile has an icon');
		await t.shot(page, 'admin-baslatici');
	});
}
