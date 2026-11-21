// My Account (Settings → Account): profile, password change, photo.
// The password and photo are changed only on the TEMPORARY member this suite creates; fixture accounts are not touched.
import { SESSION_COOKIE, client, loginApi } from '../lib/api.mjs';
import { dockApps, openSettingsTab } from '../lib/browser.mjs';
import { temporaryMember, randomPassword } from '../lib/temporary.mjs';
import { png, fakePng } from '../lib/sample-file.mjs';
import { en, tr } from '../lib/locale.mjs';

export const meta = { title: 'My Account: profile, password change, photo (temporary member)' };

export default async function suite(t) {
	// With the "News Only" role: even the least privileged member can manage their own account.
	const me = await temporaryMember(t, { roleId: t.fx.roles.news, name: 'Account' });
	const profile = async () => (await me.api.get('/api/profile')).json;
	const upload = async (file) => {
		const form = new FormData();
		form.append('file', new Blob([file.buffer], { type: file.mimeType }), file.name);
		const res = await fetch(`${t.base}/api/profile/photo`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${me.api.token}` }, body: form });
		return { status: res.status, json: await res.json().catch(() => null) };
	};

	const { page } = await me.open();
	await t.step('My Account opens: identity fields are read-only', async () => {
		t.sameSet(await dockApps(page), ['chat', 'news', 'settings'], 'News-Only member sees only News, Messages and Settings');
		const win = await openSettingsTab(page, 'account');
		await win.getByRole('heading', { name: `${me.name} ${me.surname}` }).waitFor();
		const text = await win.innerText();
		t.includes(text, me.email, 'e-mail visible');
		const form = win.getByRole('form', { name: tr('acProfile') });
		t.eq(await form.locator(`input[value="${me.email}"]`).isDisabled(), true, 'e-mail field cannot be changed');
		t.eq(await win.locator('[data-role-badge]').first().getAttribute('data-role-badge'), t.fx.roleNames.news, "role badge shows the member's role");
		await t.shot(page, 'my-account');
	});

	await t.step('profile: department, grade and bio are saved', async () => {
		const win = page.locator('[data-window-frame=settings]');
		const form = win.getByRole('form', { name: tr('acProfile') });
		const save = form.getByRole('button', { name: tr('acSave') });
		t.eq(await save.isDisabled(), true, 'save button disabled with no changes');
		const selects = form.locator('select');
		const current = (await profile()).user.department;
		const target = (await selects.nth(0).locator('option').allTextContents()).find((d) => d !== current);
		await selects.nth(0).selectOption({ label: target });
		await selects.nth(1).selectOption('4');
		const bio = `E2E about me ${Date.now().toString(36)}`;
		await form.locator('textarea').fill(bio);
		await save.click();
		await win.getByRole('status').filter({ hasText: tr('acSaved') }).waitFor();
		const u = (await profile()).user;
		t.eq(u.department, target, 'department saved');
		t.eq(u.grade, 4, 'grade saved');
		t.eq(u.bio, bio, 'bio saved');
		t.eq(await save.isDisabled(), true, 'save button disabled again after saving');
		await t.shot(page, 'profile-saved');
	});

	await t.step('profile API: identity fields and invalid values are rejected', async () => {
		const before = (await profile()).user;
		const r = await me.api.patch('/api/profile', { name: 'Someone Else', email: 'other@club.test', roleId: t.fx.roles.management, grade: 3 });
		t.eq(r.status, 200, 'known field saved');
		const after = (await profile()).user;
		t.eq([after.name, after.email, after.roleInfo?.name], [before.name, before.email, before.roleInfo?.name], 'name, e-mail and role do not change through this endpoint');
		t.eq((await me.api.patch('/api/profile', { grade: 99 })).status, 400, 'grade 99 rejected');
		t.eq((await me.api.patch('/api/profile', { department: 'Nonexistent Department' })).status, 400, 'department not in the list rejected');
		t.eq((await me.api.patch('/api/profile', { bio: 'x'.repeat(5000) })).status, 400, 'too-long bio rejected');
	});

	await t.step('photo: upload, display, removal', async () => {
		const win = page.locator('[data-window-frame=settings]');
		await win.locator('input[type=file]').setInputFiles(png());
		await win.getByRole('status').filter({ hasText: tr('acPhotoSaved') }).waitFor();
		const photo = (await profile()).user.profilePhoto;
		t.check(/^\/api\/uploads\/\d+_[a-f0-9]+\.(webp|jpg)$/.test(photo ?? ''), 'photo stored on the server', String(photo));
		const served = await me.api.get(photo);
		t.eq(served.status, 200, 'photo URL serves the image to its owner');
		const other = await (await t.api('can')).get(photo);
		t.eq(other.status, 200, 'profile photo is also visible to other members');
		await win.locator('img[src*="/api/uploads/"], img[src*="uploads"]').first().waitFor();
		t.eq(await win.getByRole('button', { name: tr('acRemovePhoto') }).count(), 1, 'remove button appeared');
		await t.shot(page, 'photo-uploaded');

		await win.getByRole('button', { name: tr('acRemovePhoto') }).click();
		await win.getByRole('status').filter({ hasText: tr('acPhotoRemoved') }).waitFor();
		t.eq((await profile()).user.profilePhoto ?? null, null, 'photo removed');
		// The message shows before the profile is fetched again; the button goes with the refetch.
		await t.waitFor(async () => (await win.getByRole('button', { name: tr('acRemovePhoto') }).count()) === 0, { timeout: 5_000 });
		t.eq(await win.getByRole('button', { name: tr('acRemovePhoto') }).count(), 0, 'remove button disappeared');

		const fake = await upload(fakePng());
		t.eq(fake.status, 415, 'a non-image file cannot be uploaded under a .png name (415)');
		t.eq((await profile()).user.profilePhoto ?? null, null, 'rejected file did not become the photo');
	});

	await t.step('language: the chosen interface language is stored on the account and follows a new session', async () => {
		t.eq((await me.api.get('/api/auth/me')).json.user.preferredLanguage, 'tr', 'the member starts in Turkish');
		const win = await openSettingsTab(page, 'language');
		await win.getByRole('button', { name: new RegExp(en('settingsLangPreview')) }).click();
		await t.waitFor(() => page.evaluate(() => document.documentElement.lang === 'en'));
		t.eq(await page.evaluate(() => document.documentElement.lang), 'en', 'the interface switches immediately');
		await win.getByRole('heading', { name: en('settingsLangTitle') }).waitFor();
		const saved = await t.waitFor(async () => (await me.api.get('/api/auth/me')).json.user.preferredLanguage === 'en');
		t.check(saved >= 0, 'the account language is saved');

		const fresh = await me.open();
		await fresh.page.locator('[data-dock-app]').first().waitFor();
		t.eq(await fresh.page.evaluate(() => document.documentElement.lang), 'en', 'a new session starts in the account language');

		await win.getByRole('button', { name: new RegExp(tr('settingsLangPreview')) }).click();
		await t.waitFor(() => page.evaluate(() => document.documentElement.lang === 'tr'));
		const back = await t.waitFor(async () => (await me.api.get('/api/auth/me')).json.user.preferredLanguage === 'tr');
		t.check(back >= 0, 'switching back stores Turkish again');
		await win.locator('[data-settings-tab=account]').click();
	});
	await t.step('password change: mismatch, wrong current password, successful change', async () => {
		const win = page.locator('[data-window-frame=settings]');
		const form = win.getByRole('form', { name: tr('acPassword') });
		const fresh = randomPassword();
		const fields = form.locator('input[type=password]');
		const submit = form.getByRole('button', { name: tr('acChangePassword') });

		await fields.nth(0).fill(me.password);
		await fields.nth(1).fill(fresh);
		await fields.nth(2).fill(`${fresh}x`);
		t.eq(await submit.isDisabled(), true, 'button disabled when the repeat does not match');
		t.includes(await form.innerText(), tr('acMismatch'), 'mismatch warning shown');

		await fields.nth(2).fill(fresh);
		await fields.nth(0).fill(`${me.password}-wrong`);
		await submit.click();
		await win.getByRole('alert').filter({ hasText: tr('acCurrentWrong') }).waitFor();
		// (Nothing changed: the next attempt, with the real current password, goes through.)

		await fields.nth(0).fill(me.password);
		await submit.click();
		await win.getByRole('status').filter({ hasText: tr('acPasswordChanged') }).waitFor();
		t.eq(await fields.nth(0).inputValue(), '', 'fields cleared after a successful change');
		await t.shot(page, 'password-changed');

		const old = await client(t.base).post('/api/auth/login', { email: me.email, password: me.password });
		t.check(old.status >= 400, 'old password no longer signs in', String(old.status));
		const loggedIn = await loginApi(t.base, me.email, fresh).catch(() => null);
		t.check(loggedIn, 'signs in with the new password');
		// Signing in again ended the earlier session (one session per account): carry on with the new one.
		if (loggedIn) me.api = loggedIn;
	});

	await t.step('password API: rule violations and unauthenticated access', async () => {
		const c = client(t.base);
		t.eq((await c.get('/api/profile')).status, 401, 'unauthenticated profile read 401');
		t.eq((await c.patch('/api/profile', { bio: 'x' })).status, 401, 'unauthenticated profile write 401');
		t.eq((await c.post('/api/profile/password', { current: 'a', fresh: 'b' })).status, 401, 'unauthenticated password change 401');
		t.eq((await c.del('/api/profile/photo')).status, 401, 'unauthenticated photo delete 401');
		const weak = await me.api.post('/api/profile/password', { current: '', fresh: 'abc12345' });
		t.eq(weak.status, 400, 'no change without the current password (400)');
	});

}
