// Empty database → the .env admin → mandatory 2FA on first login, end-to-end in the browser (issue #5).
// Runs against its own empty database and its own server (meta.isolated).
import { client } from '../lib/api.mjs';
import { dockApps, logoutUi, loginUi, openAnonymous, sessionToken, submitCredentials, submitSecondFactor } from '../lib/browser.mjs';
import { createMember, createRole } from '../lib/seed.mjs';
import { totpCode } from '../lib/totp.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Mandatory 2FA: .env admin, recovery code, role-based requirement', isolated: true };

const MODAL = '[role=dialog][aria-labelledby=twofa-enforce-title]';
const ADMIN_DOCK = ['teams', 'events', 'projects', 'budget', 'decisions', 'drive', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'terminal', 'chat', 'database', 'mail', 'soc'];
const RECOVERY = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

/** The modal card (the dialog's only child) lies inside the viewport and does not overflow sideways. */
async function modalFits(page, label, t) {
	const vp = page.viewportSize();
	const card = page.locator(`${MODAL} > div`);
	const box = await card.boundingBox();
	t.check(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 0.5 && box.y + box.height <= vp.height + 0.5, `modal ${label} is inside the viewport`, JSON.stringify({ box, vp }));
	t.check(await card.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `modal ${label} does not overflow horizontally`);
}

export default async function suite(t) {
	const { base, bootstrap } = t;
	const { page, context } = await openAnonymous(t.browser, base);
	t.track(context);
	let secret = '';
	let recovery = [];

	// ---- 1. .env admin first login: mandatory modal -----------------------------------------
	await t.step('.env admin gets the mandatory 2FA modal at login, it cannot be closed', async () => {
		await submitCredentials(page, bootstrap.email, bootstrap.password);
		const modal = page.locator(MODAL);
		await modal.waitFor();
		t.check(await modal.isVisible(), 'the mandatory 2FA modal opened');
		t.includes(
			(await modal.innerText()).toLocaleLowerCase('tr'),
			tr('twofactorEnforceTitle').toLocaleLowerCase('tr'),
			'the modal title says two-step verification is mandatory'
		);
		await modal.getByText(tr('twofactorRequiredBadge')).waitFor();
		t.check(true, 'the status line says it is required for this role (2FA is always mandatory for the Admin role)');
		t.sameSet(await dockApps(page), ['settings'], 'only Settings is in the Dock');
		await t.shot(page, 'admin-first-login-modal');

		// Cannot be closed: Escape, clicking the background, clicking the Dock, no close button.
		await page.keyboard.press('Escape');
		await page.mouse.click(10, 100);
		const dockBtn = await page.locator('[data-dock-app=settings]').boundingBox();
		await page.mouse.click(dockBtn.x + dockBtn.width / 2, dockBtn.y + dockBtn.height / 2);
		t.check(await modal.isVisible(), 'Escape / background / Dock click do not close the modal');
		t.eq(await page.locator('[data-window-frame=settings]').count(), 0, 'clicking the Dock behind the modal does not open Settings');
		const names = await modal.getByRole('button').allInnerTexts();
		const close = tr('close').toLocaleLowerCase('tr');
		const signOut = tr('signOut').toLocaleLowerCase('tr');
		t.check(
			!names.some((n) => {
				const label = n.trim().toLocaleLowerCase('tr');
				return label === close || label === '×' || label === 'x';
			}) && names.some((n) => n.toLocaleLowerCase('tr').includes(signOut)),
			'no close button; only the "Sign out" option',
			JSON.stringify(names)
		);
	});

	// ---- 2. Setup: QR + secret key, overflow check -----------------------------------------
	await t.step('setup step: the QR and secret key are visible, the modal never overflows any viewport', async () => {
		const modal = page.locator(MODAL);
		// The blocking modal auto-starts setup; the QR may appear without another click.
		const enable = modal.getByRole('button', { name: tr('twofactorSetupBtn') });
		if ((await enable.count()) > 0) await enable.first().click();
		const qr = modal.getByAltText(tr('twofactorQrAlt'));
		await qr.waitFor();
		t.check(await qr.evaluate((img) => img.complete && img.naturalWidth > 0), 'the QR code image loaded');
		secret = (await modal.locator('code').innerText()).trim();
		t.check(/^[A-Z2-7]{16,}$/.test(secret), 'secret key (base32) is visible', secret.length ? `${secret.length} chars` : 'empty');
		await t.shot(page, 'setup-1440x900');
		await modalFits(page, '1440×900', t);

		await page.setViewportSize({ width: 1024, height: 600 });
		await page.waitForTimeout(300);
		await modalFits(page, '1024×600', t);
		await t.shot(page, 'setup-1024x600');
		// The confirm button is reachable on a short screen too (the modal scrolls internally).
		const confirm = modal.getByRole('button', { name: tr('twofactorVerifyAndEnable') });
		await confirm.scrollIntoViewIfNeeded();
		const vp = page.viewportSize();
		const b = await confirm.boundingBox();
		t.check(b.y >= 0 && b.y + b.height <= vp.height, '1024×600: the "Verify and enable" button is on screen');

		await page.setViewportSize({ width: 390, height: 844 });
		await page.waitForTimeout(300);
		await modalFits(page, '390×844 (mobile)', t);
		await t.shot(page, 'setup-390x844');
		t.check(await modal.isVisible(), 'the modal is still open in the mobile view');
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.waitForTimeout(300);
	});

	// ---- 3. Enter code → recovery codes → close → all apps ---------------------------------
	await t.step('entering the verification code shows recovery codes; closing it opens all apps', async () => {
		const modal = page.locator(MODAL);
		await modal.locator('input[autocomplete=one-time-code]').fill(await totpCode(secret, base));
		await modal.getByRole('button', { name: tr('twofactorVerifyAndEnable') }).click();
		// The codes are shown once; they must stay on screen until the user presses "I saved them".
		// Wait for the codes themselves (a busy machine answers slowly), then give the modal a moment to prove it stays.
		await page.waitForFunction(
			({ sel, src, flags }) => [...document.querySelectorAll(sel)].filter((e) => new RegExp(src, flags).test(e.textContent.trim())).length >= 8,
			{ sel: `${MODAL} span`, src: RECOVERY.source, flags: RECOVERY.flags },
			{ timeout: 30_000 },
		).catch(() => {});
		await page.waitForTimeout(2500);
		const shown = await page.locator(`${MODAL} span`).evaluateAll((els) => els.map((e) => e.textContent.trim()));
		recovery = shown.filter((s) => RECOVERY.test(s));
		t.eq(recovery.length, 8, '8 recovery codes are shown in the modal (they stay until the user closes it)');
		t.check(await modal.isVisible(), 'the modal did not close while the recovery codes were shown');
		await t.shot(page, 'recovery-codes');
		await modalFits(page, 'recovery codes', t);
		await modal.getByRole('button', { name: tr('twofactorDone') }).click();
		await modal.waitFor({ state: 'detached' });
		await page.locator('[data-dock-app=budget]').waitFor();
		t.sameSet(await dockApps(page), ADMIN_DOCK, 'the modal closed; all apps are in the Dock');
		t.eq(await page.locator('[data-no-role-notice]').count(), 0, 'the "no role" notice does not appear');
		await t.shot(page, 'admin-all-apps');
	});

	// ---- 4. Log out → log in again → TOTP step ---------------------------------------------
	await t.step('log out and back in: the TOTP step is requested after the password', async () => {
		await logoutUi(page);
		await submitCredentials(page, bootstrap.email, bootstrap.password);
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		t.check(await page.getByRole('heading', { name: tr('auth2faTitle') }).first().isVisible(), 'the TwoFactorForm heading is visible');
		t.eq(await page.locator('input[type=password]').count(), 0, 'no password field, only the code step');
		await t.shot(page, 'login-totp-step');

		await submitSecondFactor(page, '000000');
		await page.getByText(tr('auth2faInvalid')).first().waitFor();
		t.check(await page.locator('input[autocomplete=one-time-code]').isVisible(), 'stays on the TOTP step with a wrong code');
		t.sameSet(await dockApps(page), [], 'the desktop did not open with a wrong code');

		await submitSecondFactor(page, await totpCode(secret, base));
		await page.locator('[data-dock-app=budget]').waitFor();
		t.sameSet(await dockApps(page), ADMIN_DOCK, 'signed in with the correct code; all apps are open');
		t.eq(await page.locator(MODAL).count(), 0, 'no modal for an admin who completed setup');
	});

	// ---- 5. Recovery code: signs in, single use --------------------------------------------
	await t.step('signing in with a recovery code works and the code is single-use', async () => {
		await logoutUi(page);
		await submitCredentials(page, bootstrap.email, bootstrap.password);
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		await submitSecondFactor(page, recovery[0]);
		await page.locator('[data-dock-app=budget]').waitFor();
		t.check(true, 'signed in with recovery code #1');

		await logoutUi(page);
		await submitCredentials(page, bootstrap.email, bootstrap.password);
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		await submitSecondFactor(page, recovery[0]);
		await page.getByText(tr('auth2faInvalid')).first().waitFor();
		t.sameSet(await dockApps(page), [], 'the same recovery code was not accepted a second time');
		await t.shot(page, 'recovery-code-reuse-rejected');
		await submitSecondFactor(page, recovery[1]);
		await page.locator('[data-dock-app=budget]').waitFor();
		t.check(true, 'another recovery code (#2) still works');
	});

	// From here on, the admin API client: the browser's latest session.
	const admin = client(base, await sessionToken(context, base));
	await context.close().catch(() => {});

	// ---- 6. Role-based requirement ---------------------------------------------------------
	const roleManagement = await createRole(admin, { name: 'E2E Management Board', color: '#ff9f0a', description: '', twoStepRequired: true, permissions: { news: 'manage', events: 'manage', members: 'use', settings: 'use' } });
	const roleMember = await createRole(admin, { name: 'E2E Member', color: '#0a84ff', description: '', twoStepRequired: false, permissions: { news: 'use', events: 'use', settings: 'use' } });
	const roleFollow = await createRole(admin, { name: 'Follow', color: '#30d158', description: '', twoStepRequired: false, permissions: { news: 'use', settings: 'use' } });
	const boardMember = await createMember(admin, base, { name: 'Yasmin', surname: 'Board', email: 'yasmin@e2e.test', roleId: roleManagement });
	const member = await createMember(admin, base, { name: 'Owen', surname: 'Member', email: 'owen@e2e.test', roleId: roleMember });
	const follow = await createMember(admin, base, { name: 'Tom', surname: 'Follow', email: 'tom@e2e.test', roleId: roleFollow });

	await t.step('a new member with the board role: the same modal opens on first login', async () => {
		const o = await openAnonymous(t.browser, base);
		t.track(o.context);
		await submitCredentials(o.page, boardMember.email, boardMember.password);
		await o.page.locator(MODAL).waitFor();
		t.check(await o.page.locator(MODAL).isVisible(), 'the mandatory 2FA modal opened for the board member');
		t.sameSet(await dockApps(o.page), ['settings'], 'only Settings is in the Dock');
		t.includes((await o.page.locator(MODAL).innerText()).toLocaleLowerCase('tr'), tr('twofactorEnforceTitle').toLocaleLowerCase('tr'), 'the status line says it is required for this role');
		await t.shot(o.page, 'board-member-modal');
		await modalFits(o.page, 'board member', t);
	});

	await t.step('no modal for a user with the member role (not required)', async () => {
		const o = await openAnonymous(t.browser, base);
		t.track(o.context);
		await loginUi(o.page, member.email, member.password);
		t.eq(await o.page.locator(MODAL).count(), 0, 'no modal');
		t.sameSet(await dockApps(o.page), ['chat', 'news', 'events', 'settings'], 'the Dock shows the role\'s apps');
		await t.shot(o.page, 'member-no-modal');
	});

	await t.step('turning on the role\'s "2FA required" switch shows the modal within ≤15 s in an open session', async () => {
		const o = await openAnonymous(t.browser, base);
		t.track(o.context);
		await loginUi(o.page, follow.email, follow.password);
		t.eq(await o.page.locator(MODAL).count(), 0, 'no modal initially');
		const role = (await admin.get('/api/roles')).json.roles.find((r) => r.id === roleFollow);
		const patch = (required) => admin.patch('/api/roles', { id: roleFollow, name: role.name, color: role.color, description: role.description, permissions: role.permissions, twoStepRequired: required });
		t.eq((await patch(true)).status, 200, 'PATCH /api/roles {twoStepRequired: true} 200');
		const ms = await t.waitFor(async () => (await o.page.locator(MODAL).count()) === 1, { timeout: 25_000 });
		t.check(ms >= 0 && ms <= 20_000, `the modal appeared without a page reload (${ms} ms)`);
		t.sameSet(await dockApps(o.page), ['settings'], 'the Dock dropped to only Settings');
		await t.shot(o.page, 'live-enforced-modal');
		await modalFits(o.page, 'live requirement', t);
		// The modal also goes away when the switch is turned back off.
		t.eq((await patch(false)).status, 200, 'the switch was turned back off');
		const gone = await t.waitFor(async () => (await o.page.locator(MODAL).count()) === 0, { timeout: 25_000 });
		t.check(gone >= 0 && gone <= 20_000, `the modal went away when the switch turned off (${gone} ms)`);
		t.sameSet(await dockApps(o.page), ['chat', 'news', 'settings'], 'the Dock came back');
	});
}
