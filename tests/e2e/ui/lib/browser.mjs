// Chrome through playwright-core: the system's Google Chrome, never a download.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { SESSION_COOKIE } from './api.mjs';
import { totpCode } from './totp.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };

// A dev server compiles on demand and the machine may be busy: wait for the HTML, not for every asset.
const GOTO = { waitUntil: 'domcontentloaded', timeout: 90_000 };

/**
 * One headless Chrome for the whole run; contexts are cheap, launches are not.
 *
 * WebGL is off: without a GPU the 3D wallpaper is drawn in software, takes several
 * cores and starves the page's timers (the permission poll, hover timeouts). The app
 * falls back to its static aurora, which is all these suites need. `E2E_WEBGL=1` turns it on.
 */
export async function launchBrowser({ headed = false } = {}) {
	const args = ['--no-sandbox', ...(process.env.E2E_WEBGL ? [] : ['--disable-3d-apis'])];
	const options = { headless: !headed, args };
	try {
		return await chromium.launch({ ...options, channel: 'chrome' });
	} catch (e) {
		const path = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
		if (!path) throw new Error(`Google Chrome not found (${e.message}). Install it; this suite never downloads a browser.`);
		return chromium.launch({ ...options, executablePath: path });
	}
}

/**
 * A browser context in the test locale. Outside installed apps the portal shows a
 * download page; development builds let a tab past it with a per-tab flag, which
 * is set before any page script runs.
 *
 * `prefs` seeds the appearance preferences (localStorage `kulup_theme`, e.g. `{ theme: 'dark' }`)
 * once, before the page's own scripts — a reload keeps what the page itself saved since;
 * `colorScheme` emulates the OS colour scheme.
 */
export async function newContext(browser, { viewport = DESKTOP, prefs = null, colorScheme = undefined } = {}) {
	const context = await browser.newContext({ viewport, locale: 'tr-TR', colorScheme });
	if (prefs) {
		await context.addInitScript((json) => {
			try {
				if (sessionStorage.getItem('e2e_prefs_seeded')) return;
				sessionStorage.setItem('e2e_prefs_seeded', '1');
				localStorage.setItem('kulup_theme', json);
			} catch {
				// no storage
			}
		}, JSON.stringify(prefs));
	}
	await context.addInitScript(() => {
		try {
			sessionStorage.setItem('beu_pwa_dev_bypass', '1');
		} catch {
			// no storage: the page shows the download page, and the test says so
		}
		// The dev overlay's issue badge (the WebGL errors of the flag above) would sit on every screenshot.
		document.addEventListener('DOMContentLoaded', () => {
			const style = document.createElement('style');
			style.textContent = 'nextjs-portal { display: none !important; }';
			document.head.appendChild(style);
		});
	});
	return context;
}

/**
 * A page that is already signed in as the holder of `token` (a session token from
 * `client().token`), so a suite that is not about signing in skips the form.
 */
export async function openSession(browser, base, token, { viewport = DESKTOP, prefs, colorScheme } = {}) {
	const context = await newContext(browser, { viewport, prefs, colorScheme });
	await context.addCookies([{ name: SESSION_COOKIE, value: token, url: base }]);
	const page = await context.newPage();
	await page.goto(base, GOTO);
	await waitDesktop(page);
	return { context, page };
}

/** A page at the sign-in screen, no session. */
export async function openAnonymous(browser, base, { viewport = DESKTOP, prefs, colorScheme } = {}) {
	const context = await newContext(browser, { viewport, prefs, colorScheme });
	const page = await context.newPage();
	await page.goto(base, GOTO);
	await page.locator('input[type=email]').waitFor();
	return { context, page };
}

/** The desktop (or the phone launcher) has rendered for a signed-in member. */
export async function waitDesktop(page) {
	await page.locator('[data-dock-app], [data-no-role-notice], [data-launcher-app], [data-mobile-nav], [role=dialog][aria-labelledby=twofa-enforce-title]').first().waitFor({ timeout: 30_000 });
}

/** On the phone the app grid is the "Uygulamalar" tab of the bottom bar; the first screen is the cockpit. */
export async function showLauncherApps(page) {
	await page.locator('[data-mobile-tab=apps]').click();
	await page.locator('[data-launcher-app]').first().waitFor();
}

/** Step one of the sign-in screen: e-mail and password. */
export async function submitCredentials(page, eposta, sifre) {
	await page.locator('input[type=email]').fill(eposta);
	await page.locator('input[type=password]').fill(sifre);
	await page.locator('form button[type=submit]').click();
}

/** Step two: the authenticator code or a recovery code (the form must already be showing). */
export async function submitSecondFactor(page, code) {
	const input = page.locator('input[autocomplete=one-time-code]');
	await input.fill(code);
	await page.getByRole('button', { name: 'Doğrula ve Giriş Yap' }).click();
}

/**
 * Signs in through the form and waits for the desktop. For an account with a second
 * factor pass `{ totp: secret }` (a code is made for it) or `{ code }` (a recovery code).
 */
export async function loginUi(page, eposta, sifre, { totp, code } = {}) {
	await submitCredentials(page, eposta, sifre);
	if (totp || code) {
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		await submitSecondFactor(page, code ?? (await totpCode(totp)));
	}
	await waitDesktop(page);
}

/** The apps in the dock, by id. */
export const dockApps = (page) => page.locator('[data-dock-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-app')));

/** The apps with an open window, by id. */
export const openWindows = (page) =>
	page.locator('[data-window-frame]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getAttribute('data-window-frame')));

/** Opens an app from the dock and returns its window. */
export async function openApp(page, appId) {
	await page.locator(`[data-dock-app=${appId}]`).click();
	const win = page.locator(`[data-window-frame=${appId}]`);
	await win.waitFor();
	return win;
}

/** Settings → one of its tabs (`roles`, `security`, `smtp`, …); returns the Settings window. */
export async function openSettingsTab(page, tab) {
	const win = await openApp(page, 'settings');
	await win.locator(`[data-settings-tab=${tab}]`).click();
	return win;
}

/** Signs out through the logo menu in the top bar and waits for the sign-in screen. */
export async function logoutUi(page) {
	await page.locator('[data-menubar-category=apple]').click();
	await page.locator('[data-menu-item=logout]').click();
	await page.locator('input[type=email]').waitFor();
}

/** The session token a browser context holds (to make an API client of the same session). */
export async function sessionToken(context, base) {
	const cookie = (await context.cookies(base)).find((c) => c.name === SESSION_COOKIE);
	return cookie?.value ?? '';
}

/** Right-clicks the bare desktop and returns the app ids offered under "open a tool". */
export async function desktopToolMenu(page) {
	await page.mouse.click(5, 450, { button: 'right' });
	const menu = page.locator('[data-menu-item=dt-open-tool]');
	await menu.waitFor();
	await menu.hover();
	await page.locator('[data-menu-item^=dt-app-]').first().waitFor();
	return page.locator('[data-menu-item^=dt-app-]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-item').slice('dt-app-'.length)));
}
