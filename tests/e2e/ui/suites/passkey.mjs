// Passkey ile giriş: Chrome'un sanal WebAuthn kimlik doğrulayıcısıyla (CDP) gerçek kayıt ve giriş.
// Rol 2FA'yı zorunlu kılıyorsa ve TOTP açıksa passkey'den sonra da TOTP istenir
// (src/app/api/auth/passkey/login/verify/route.ts); zorunlu değilse passkey tek başına yeter.
import { dockApps, logoutUi, openSettingsTab } from '../lib/browser.mjs';
import { totpCode } from '../lib/totp.mjs';

export const meta = { title: 'Passkey: zorunlu 2FA rolünde TOTP isteniyor, diğerinde tek başına yetiyor' };

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
	await settings.getByPlaceholder('Örn. iPhone, YubiKey').fill(NICK);
	await settings.getByRole('button', { name: 'Passkey Ekle' }).click();
	await settings.getByText('Passkey eklendi').waitFor();
	await settings.getByText(NICK, { exact: true }).waitFor();
}

async function signInWithPasskey(page, eposta) {
	await page.locator('input[type=email]').fill(eposta);
	await page.getByRole('button', { name: 'Passkey ile giriş yap' }).click();
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

	await t.step('admin (Admin rolü: 2FA zorunlu, TOTP açık): passkey kaydı', async () => {
		const { page, context } = await t.open('admin');
		await virtualAuthenticator(context, page);
		await addPasskey(page);
		await t.shot(page, 'admin-passkey-eklendi');
		t.check(true, 'sanal kimlik doğrulayıcıyla passkey kaydedildi (Ayarlar → Güvenlik)');

		// Çıkış → yalnız e-posta + passkey → TOTP adımı istenmeli
		await logoutUi(page);
		await signInWithPasskey(page, fx.admin.eposta);
		const otp = page.locator('input[autocomplete=one-time-code]');
		const reached = await Promise.race([
			otp.waitFor({ timeout: 15_000 }).then(() => 'totp'),
			page.locator('[data-dock-app]').first().waitFor({ timeout: 15_000 }).then(() => 'desktop'),
			page.getByText(/doğrulanamadı|yapılamadı|iptal/i).first().waitFor({ timeout: 15_000 }).then(() => 'error'),
		]).catch(() => 'nothing');
		await t.shot(page, 'admin-passkey-sonrasi');
		t.eq(reached, 'totp', 'passkey sonrası TOTP adımı isteniyor (TwoFactorForm)');
		t.eq(await dockApps(page), [], 'TOTP girilmeden masaüstü açılmadı');
		if (reached === 'totp') {
			await otp.fill(await totpCode(fx.adminTotp));
			await page.getByRole('button', { name: 'Doğrula ve Giriş Yap' }).click();
			await page.locator('[data-dock-app=budget]').waitFor();
			t.check(true, 'passkey + TOTP ile giriş tamamlandı, bütün uygulamalar açık');
			await t.adopt('admin', context);
		}
	});

	await t.step('ege (Üye rolü: 2FA zorunlu değil): passkey tek başına yetiyor', async () => {
		const { page, context } = await t.open('ege');
		await virtualAuthenticator(context, page);
		await addPasskey(page);
		await logoutUi(page);
		await signInWithPasskey(page, fx.users.ege.eposta);
		await page.locator('[data-dock-app]').first().waitFor();
		t.check((await dockApps(page)).length > 0, 'passkey ile doğrudan masaüstü açıldı (TOTP istenmedi)');
		t.eq(await page.locator('input[autocomplete=one-time-code]').count(), 0, 'TOTP adımı yok');
		await t.shot(page, 'ege-passkey-giris');
		await t.adopt('ege', context);
		// Kayıt satırı camelCase kolonlarını (deviceType, sonKullanma) doğru okuyor.
		const mine = ((await (await t.api('ege')).get('/api/auth/passkey')).json?.passkeys ?? []).find((p) => p.nickname === NICK);
		t.check(mine && mine.deviceType && Number(mine.sonKullanma) > 0, 'passkey listesinde cihaz türü ve son kullanım dolu', JSON.stringify(mine));
	});
}
