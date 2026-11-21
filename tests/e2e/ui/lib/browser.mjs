// Chrome through playwright-core: prefers lean Playwright headless shell when headless, else Chrome/Chromium.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SESSION_COOKIE } from './api.mjs';
import { totpCode } from './totp.mjs';
import { tr } from './locale.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

export const DESKTOP = { width: 1440, height: 900 };
export const MOBILE = { width: 390, height: 844 };

// Prebuilt standalone server responds in milliseconds; cap page navigation waits at 30 s.
const GOTO = { waitUntil: 'domcontentloaded', timeout: 30_000 };
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

function findHeadlessShell() {
	try {
		const cacheDir = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), '.cache', 'ms-playwright');
		if (!fs.existsSync(cacheDir)) return null;
		const dirs = fs.readdirSync(cacheDir).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
		for (const dir of dirs) {
			const bin = path.join(cacheDir, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
			if (fs.existsSync(bin)) return bin;
		}
	} catch {
		// Fall back to Chrome/Chromium when cache directory is unreadable.
	}
	return null;
}

/**
 * One headless Chrome for the whole run; contexts are cheap, launches are not.
 *
 * WebGL is off: without a GPU the 3D wallpaper is drawn in software, takes several
 * cores and starves the page's timers (the permission poll, hover timeouts). The app
 * falls back to its static aurora, which is all these suites need. `E2E_WEBGL=1` turns it on.
 */
export async function launchBrowser({ headed = false, maxRenderers = 1 } = {}) {
	const args = [
		'--no-sandbox',
		'--no-zygote',
		'--disable-gpu',
		'--disable-gpu-compositing',
		'--disable-domain-reliability',
		'--enable-low-end-device-mode',
		'--disk-cache-size=16777216',
		'--media-cache-size=1',
		`--renderer-process-limit=${maxRenderers}`,
		'--js-flags=--max-old-space-size=64',
		...(process.env.E2E_WEBGL ? [] : ['--disable-3d-apis']),
	];
	const options = {
		headless: !headed,
		args,
		// Playwright keeps every background tab rendering at full speed. Tests drive one page
		// at a time; letting Chromium deprioritise occluded windows cuts idle compositor work
		// while timers stay unthrottled (the polling fallbacks in the SSE suite need those).
		ignoreDefaultArgs: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
	};
	const explicitPath = process.env.E2E_BROWSER_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
	if (explicitPath && fs.existsSync(explicitPath)) {
		return chromium.launch({ ...options, executablePath: explicitPath });
	}
	if (!headed) {
		const shellBin = findHeadlessShell();
		if (shellBin) {
			try {
				return await chromium.launch({ ...options, executablePath: shellBin });
			} catch {
				// Fall through to full browser channels if headless shell fails to start.
			}
		}
	}
	try {
		return await chromium.launch({ ...options, channel: 'chrome' });
	} catch (e) {
		const candidates = [
			'/usr/bin/google-chrome',
			'/usr/bin/google-chrome-stable',
			'/usr/bin/chromium',
			'/usr/bin/chromium-browser',
			'/usr/bin/brave',
			chromium.executablePath(),
		];
		const candidate = candidates.find((p) => p && fs.existsSync(p));
		if (!candidate) throw new Error(`Chrome/Chromium not found (${e.message}). Install Chromium or run \`pnpm exec playwright-core install chromium-headless-shell\`.`);
		return chromium.launch({ ...options, executablePath: candidate });
	}
}

/**
 * A browser context in the test locale. Outside installed apps the portal shows a
 * download page; development builds let a tab past it with a per-tab flag, which
 * is set before any page script runs.
 *
 * `prefs` seeds the appearance preferences (localStorage `club_theme`, e.g. `{ theme: 'dark' }`)
 * once, before the page's own scripts — a reload keeps what the page itself saved since;
 * `colorScheme` emulates the OS colour scheme.
 */
export async function newContext(
	browser,
	{ viewport = DESKTOP, prefs = null, colorScheme = undefined, reducedMotion = 'reduce', stubWallpapers = true } = {}
) {
	// Most suites are about data and behaviour, not animation. Asking the app for reduced
	// motion sets `data-motion=reduce`, which stops the shell's transitions/animations and
	// is the single biggest CPU saver in a long run. Suites that assert motion pass
	// `reducedMotion: 'no-preference'` explicitly.
	// Ask Chromium to block service workers so production `/sw.js` does not spin up extra worker
	// processes or intercept network requests watched by suites such as `lazy-loading` and `sse`.
	const context = await browser.newContext({
		viewport,
		locale: 'tr-TR',
		colorScheme,
		reducedMotion,
		serviceWorkers: 'block',
	});
	if (stubWallpapers) {
		await context.route('**/wallpapers/**', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'image/png',
				body: TINY_PNG,
				headers: { 'cache-control': 'public, max-age=3600' },
			})
		);
	}
	if (prefs) {
		await context.addInitScript((json) => {
			try {
				if (sessionStorage.getItem('e2e_prefs_seeded')) return;
				sessionStorage.setItem('e2e_prefs_seeded', '1');
				localStorage.setItem('club_theme', json);
			} catch {
				// no storage
			}
		}, JSON.stringify(prefs));
	}
	await context.addInitScript(() => {
		try {
			sessionStorage.setItem('orbit_pwa_installed_session_v2', '1');
			sessionStorage.setItem('beu_pwa_dev_bypass', '1');
			sessionStorage.setItem('orbit_pwa_dev_bypass', '1');
			if (!sessionStorage.getItem('e2e_locale_seeded')) {
				sessionStorage.setItem('e2e_locale_seeded', '1');
				localStorage.setItem('orbit_locale', 'tr');
			}
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
export async function openSession(
	browser,
	base,
	token,
	{ viewport = DESKTOP, prefs, colorScheme, reducedMotion, stubWallpapers = true } = {}
) {
	const context = await newContext(browser, { viewport, prefs, colorScheme, reducedMotion, stubWallpapers });
	await context.addCookies([{ name: SESSION_COOKIE, value: token, url: base }]);
	const page = await context.newPage();
	await page.goto(base, GOTO);
	await waitDesktop(page);
	await page.waitForTimeout(50);
	return { context, page };
}

/** A page at the sign-in screen, no session. */
export async function openAnonymous(
	browser,
	base,
	{ viewport = DESKTOP, prefs, colorScheme, reducedMotion, stubWallpapers = true } = {}
) {
	const context = await newContext(browser, { viewport, prefs, colorScheme, reducedMotion, stubWallpapers });
	const page = await context.newPage();
	await page.goto(base, GOTO);
	await page.locator('input[type=email]').waitFor();
	return { context, page };
}

/** The desktop (or the phone launcher) has rendered for a signed-in member. */
export async function waitDesktop(page) {
	await page.locator('[data-dock-app], [data-no-role-notice], [data-launcher-app], [data-mobile-nav], [role=dialog][aria-labelledby=twofa-enforce-title]').first().waitFor({ timeout: 20_000 });
}

/** On the phone the app grid is the apps tab of the bottom bar; the first screen is the cockpit. */
export async function showLauncherApps(page) {
	await page.locator('[data-mobile-tab=apps]').click();
	await page.locator('[data-launcher-app]').first().waitFor();
}

/** Step one of the sign-in screen: e-mail and password. */
export async function submitCredentials(page, email, password) {
	await page.locator('input[type=email]').fill(email);
	await page.locator('input[type=password]').fill(password);
	await page.locator('form button[type=submit]').click();
}

/** Step two: the authenticator code or a recovery code (the form must already be showing). */
export async function submitSecondFactor(page, code) {
	const input = page.locator('input[autocomplete=one-time-code]');
	await input.fill(code);
	await page.getByRole('button', { name: tr('auth2faVerifyBtn') }).click();
}

/**
 * Signs in through the form and waits for the desktop. For an account with a second
 * factor pass `{ totp: secret }` (a code is made for it) or `{ code }` (a recovery code).
 */
export async function loginUi(page, email, password, { totp, code } = {}) {
	await submitCredentials(page, email, password);
	if (totp || code) {
		await page.locator('input[autocomplete=one-time-code]').waitFor();
		let scope = '';
		try {
			scope = new URL(page.url()).origin;
		} catch {
			// Fallback to default scope when URL is unavailable.
		}
		await submitSecondFactor(page, code ?? (await totpCode(totp, scope)));
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
	const item = page.locator(`[data-dock-app=${appId}]`);
	const reveal = async () => {
		// A maximised window hides the Dock; moving the pointer to the bottom edge brings it
		// back, exactly as a member does before clicking another app.
		const size = page.viewportSize() ?? DESKTOP;
		await page.mouse.move(size.width / 2, size.height - 2);
		await page.waitForTimeout(320);
	};
	// A roamed layout can land while the click is in flight and cover the Dock, so retry:
	// the click is idempotent (opening an open app only focuses it).
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			await item.click({ timeout: 3000 });
			break;
		} catch (e) {
			if (attempt === 2) throw e;
			await reveal();
		}
	}
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
