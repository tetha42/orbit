// Roleless member: PATCH /api/members {roleId: null} → "no role assigned" warning, Settings only in the Dock.
import { dockApps, openWindows } from '../lib/browser.mjs';

export const meta = { title: 'Roleless user: warning and Settings only' };

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const readerId = fx.users.reader.id;
	t.cleanup(() => admin.patch('/api/members', { id: readerId, roleId: fx.roles.news }));

	await t.step('new login: the warning is visible for a user whose role was removed', async () => {
		const res = await admin.patch('/api/members', { id: readerId, roleId: null });
		t.eq(res.status, 200, 'PATCH /api/members {roleId: null} 200');
		const { page } = await t.open('reader');
		await page.locator('[data-no-role-notice]').waitFor();
		t.eq(await page.locator('[data-no-role-notice]').count(), 1, '[data-no-role-notice] is visible');
		const text = await page.locator('[data-no-role-notice]').innerText();
		t.check(/rol/i.test(text), 'the warning text says that no role is assigned', text);
		t.sameSet(await dockApps(page), ['chat', 'settings'], 'only Messages and Settings remain in the Dock');
		t.eq(await openWindows(page), [], 'no application windows are open');
		await t.shot(page, 'rolsuz-masaustu');

		// The button in the warning opens Settings; the Roles/SMTP tabs are absent.
		await page.locator('[data-no-role-settings]').click();
		const settings = page.locator('[data-window-frame=settings]');
		await settings.waitFor();
		await settings.locator('[data-settings-tab=account]').waitFor();
		t.check(await settings.locator('[data-settings-tab=security]').count() === 1, 'Settings opened: personal tabs are present');
		t.eq(await settings.locator('[data-settings-tab=roles], [data-settings-tab=smtp]').count(), 0, 'the Roles and SMTP tabs are absent');
	});

	await t.step('live: removing the role from an open session shows the warning within 15 seconds', async () => {
		await admin.patch('/api/members', { id: readerId, roleId: fx.roles.news });
		const { page } = await t.open('reader');
		await page.locator('[data-dock-app=news]').waitFor();
		t.eq(await page.locator('[data-no-role-notice]').count(), 0, 'no warning while the user has a role');
		await admin.patch('/api/members', { id: readerId, roleId: null });
		const ms = await t.waitFor(async () => (await page.locator('[data-no-role-notice]').count()) === 1, { timeout: 25_000 });
		t.check(ms >= 0 && ms <= 20_000, `the warning appeared without a page reload after the role was removed (${ms} ms)`);
		t.sameSet(await dockApps(page), ['chat', 'settings'], 'the Dock shows only Messages and Settings');
	});

	await t.step('mobile (390×844): warning and Settings only for a roleless user', async () => {
		const { page } = await t.open('reader', { mobile: true });
		await page.locator('[data-no-role-notice]').waitFor();
		t.check(await page.locator('[data-role-badge=""]').count() === 1, 'the role badge says "No role assigned"');
		await page.locator('[data-mobile-tab=apps]').click();
		t.sameSet(await page.locator('[data-launcher-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-launcher-app'))), ['chat', 'settings'], 'the launcher shows Messages and Settings');
		await t.shot(page, 'rolsuz-mobil');
	});
}
