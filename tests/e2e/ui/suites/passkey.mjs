// Passkey sign-in: real registration and login with Chrome's virtual WebAuthn authenticator (CDP).
// A verified passkey completes authentication directly without TOTP even for roles requiring 2FA
// (src/app/api/auth/passkey/login/verify/route.ts), and passkey sessions unlock critical apps
// (Database Studio and Terminal) automatically without secondary 2FA or password prompts.
import { dockApps, logoutUi, openApp, openSettingsTab, waitDesktop } from '../lib/browser.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Passkey: sign-in skips TOTP even for 2FA-required roles and unlocks critical apps automatically' };

const NICK = 'e2e-passkey';

/** A software authenticator that says yes to every prompt, on this page's browser context. */
async function virtualAuthenticator(context, page) {
	const cdp = await context.newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
	});
	return cdp;
}

async function addPasskey(page) {
	const settings = await openSettingsTab(page, 'security');
	await settings.getByPlaceholder(tr('passkeyDeviceNamePh')).fill(NICK);
	await settings.getByRole('button', { name: tr('passkeyAddBtn') }).click();
	await settings.getByText(tr('passkeyAdded')).waitFor();
	await settings.getByText(NICK, { exact: true }).waitFor();
}

async function signInWithPasskey(page, email) {
	await page.locator('input[type=email]').fill(email);
	await page.getByRole('button', { name: tr('authPasskeySignIn') }).click();
}

export default async function suite(t) {
	const { fx } = t;
	const removePasskeys = async (key) => {
		const c = await t.api(key);
		const list = (await c.get('/api/auth/passkey')).json?.passkeys ?? [];
		for (const pk of list.filter((p) => p.nickname === NICK)) await c.del('/api/auth/passkey', { id: pk.id });
	};
	t.cleanup(() => removePasskeys('admin'));
	t.cleanup(() => removePasskeys('ege'));

	await t.step('admin (Admin role: 2FA required, TOTP enabled): passkey opens desktop and critical apps without 2FA', async () => {
		const { page, context } = await t.open('admin');
		await virtualAuthenticator(context, page);
		await addPasskey(page);
		await t.shot(page, 'admin-passkey-added');
		t.check(true, 'passkey registered with the virtual authenticator (Settings → Security)');

		// Logout → email + passkey only → desktop must open directly without a TOTP challenge
		await logoutUi(page);
		await signInWithPasskey(page, fx.admin.email);
		const otp = page.locator('input[autocomplete=one-time-code]');
		const failure = page
			.getByText(tr('passkeyCancelled'))
			.or(page.getByText(tr('passkeySaveFailed')))
			.or(page.getByText(tr('passkeyAddFailed')))
			.or(page.getByText(tr('twofactorVerifyError')));
		const reached = await Promise.race([
			otp.waitFor({ timeout: 15_000 }).then(() => 'totp'),
			page.locator('[data-dock-app=budget]').waitFor({ timeout: 15_000 }).then(() => 'desktop'),
			failure.first().waitFor({ timeout: 15_000 }).then(() => 'error'),
		]).catch(() => 'nothing');
		await t.shot(page, 'admin-after-passkey');
		t.eq(reached, 'desktop', 'desktop opened directly after passkey without requesting TOTP');
		t.eq(await otp.count(), 0, 'no TwoFactorForm TOTP input rendered');
		await waitDesktop(page);
		await t.adopt('admin', context);

		const adminApi = await t.api('admin');
		const me = await adminApi.get('/api/auth/me');
		t.eq(me.status, 200, 'GET /api/auth/me returns 200 for passkey session');
		t.eq(me.json?.user?.authMethod, 'passkey', 'session authMethod is recorded as passkey');
		t.eq(me.json?.user?.mustSetup2fa, false, 'mustSetup2fa is false for passkey session');

		// Critical app 1: Database Studio opens directly without TOTP or manual unlock button
		const dbWin = await openApp(page, 'database');
		await dbWin.getByPlaceholder(tr('dbSearchTable')).waitFor({ timeout: 15_000 });
		t.eq(await dbWin.locator('input[autocomplete=one-time-code]').count(), 0, 'Database Studio shows no TOTP prompt');
		t.eq(await dbWin.getByRole('button', { name: tr('dbPasskeyOpen') }).count(), 0, 'Database Studio auto-unlocked without manual passkey prompt');
		const tablesRes = await adminApi.get('/api/database/tables');
		t.eq(tablesRes.status, 200, 'GET /api/database/tables succeeds for passkey admin even without x-db-token');

		// Critical app 2: Terminal opens a session with no TOTP code on passkey session
		const termRes = await adminApi.post('/api/terminal/session', { cols: 80, rows: 24 });
		t.eq(termRes.status, 200, 'POST /api/terminal/session succeeds without TOTP code on passkey session');
		t.eq(termRes.json?.authMethod, 'passkey', 'terminal session reports authMethod passkey');
		if (termRes.json?.sessionId) {
			await adminApi.del(`/api/terminal/session?sessionId=${encodeURIComponent(termRes.json.sessionId)}`);
		}
	});

	await t.step('ege (Member role: 2FA not required): passkey alone suffices', async () => {
		const { page, context } = await t.open('ege');
		await virtualAuthenticator(context, page);
		await addPasskey(page);
		await logoutUi(page);
		await signInWithPasskey(page, fx.users.ege.email);
		await page.locator('[data-dock-app]').first().waitFor();
		t.check((await dockApps(page)).length > 0, 'desktop opened directly with the passkey (TOTP not requested)');
		t.eq(await page.locator('input[autocomplete=one-time-code]').count(), 0, 'no TOTP step');
		await t.shot(page, 'ege-passkey-login');
		await t.adopt('ege', context);
		const egeApi = await t.api('ege');
		const me = await egeApi.get('/api/auth/me');
		t.eq(me.json?.user?.authMethod, 'passkey', 'member session authMethod is recorded as passkey');
		const mine = ((await egeApi.get('/api/auth/passkey')).json?.passkeys ?? []).find((p) => p.nickname === NICK);
		t.check(mine && mine.deviceType && Number(mine.lastUsage) > 0, 'device type and last usage populated in the passkey list', JSON.stringify(mine));
	});
}
