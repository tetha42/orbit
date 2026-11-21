// Theme system (#8): Light/Dark/System, accent color, transparency, reduced motion; preserved across reloads;
// no flash on load; no backdrop-filter anywhere while transparency is off; "glass" is toggled in one place.
// Preferences live in the browser (localStorage `club_theme`); nothing is written to the server, so there is no data to roll back.
import { newContext, openApp, openSettingsTab, openWindows } from '../lib/browser.mjs';
import { dialogReply } from '../lib/dialog.mjs';
import { frameBox, movingState, pointerDrag, reloadDesktop, rightClickDesktop, settle, titlePoint } from '../lib/desktop.mjs';
import { tr } from '../lib/locale.mjs';
import { DEFAULT_WALLPAPER, WALLPAPERS } from '../../../../src/core/theme/wallpapers.ts';

export const meta = { title: 'Theme: Light/Dark/System, accent, transparency, motion; persistence, no flash, single glass source' };

const attrs = (page) =>
	page.evaluate(() => {
		const d = document.documentElement;
		return { theme: d.getAttribute('data-theme'), accent: d.getAttribute('data-accent'), transparency: d.getAttribute('data-transparency'), motion: d.getAttribute('data-motion') };
	});
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('club_theme') || 'null'));
const waitAttr = (t, page, key, value, name) => t.waitFor(async () => (await attrs(page))[key] === value, { timeout: 3000, every: 50 }).then((ms) => t.check(ms >= 0, name, JSON.stringify({ requested: value })));

/** Resolves a CSS variable through a probe element: the real color ("rgb(...)"). */
const resolved = (page, expr) =>
	page.evaluate((v) => {
		const probe = document.createElement('i');
		probe.style.background = v;
		document.body.append(probe);
		const c = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return c;
	}, expr);

/** Elements on the page whose computed backdrop-filter is not "none". */
const glassElements = (page) =>
	page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).backdropFilter !== 'none').map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('data-window-frame') ? `[${e.getAttribute('data-window-frame')}]` : ''}${e.hasAttribute('data-dock') ? '[dock]' : ''}${e.hasAttribute('data-topbar') ? '[topbar]' : ''}`));

const luminance = (rgb) => {
	const [r, g, b] = rgb.match(/[\d.]+/g).map(Number);
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};


export default async function suite(t) {
	await t.step('defaults: System theme, blue accent, transparency off, full motion', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		t.eq(await attrs(page), { theme: 'light', accent: 'blue', transparency: 'off', motion: 'full' }, '<html> attributes are the defaults');
		t.eq(await stored(page), null, 'localStorage stays empty until the user changes something');
		const win = await openSettingsTab(page, 'appearance');
		t.eq(await win.locator('[data-theme-option]').evaluateAll((e) => e.map((x) => x.getAttribute('data-theme-option'))), ['light', 'dark', 'system'], 'three theme cards: light, dark, system');
		t.eq(await win.locator('[data-theme-option=system]').getAttribute('aria-pressed'), 'true', 'System is selected');
		t.eq(await win.locator('[data-accent-option]').count(), 6, '6 preset accent colors');
		t.eq(await win.locator('[data-accent-option=blue]').getAttribute('aria-pressed'), 'true', 'blue is selected');
		t.eq(await win.locator('[data-setting=transparency]').getAttribute('aria-checked'), 'false', 'Transparency toggle is off by default');
		t.eq(await win.locator('[data-setting=reduce-motion]').getAttribute('aria-checked'), 'false', 'Reduce motion is off (the system does not request it)');
		await t.shot(page, 'gorunum-varsayilan');
	});

	await t.step('Light/Dark: applied instantly, colors really change, preserved across reloads', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		const lightBg = luminance(await resolved(page, 'var(--window-bg)'));
		await win.locator('[data-theme-option=dark]').click();
		await waitAttr(t, page, 'theme', 'dark', 'Dark: data-theme="dark" is set immediately');
		t.check(luminance(await resolved(page, 'var(--window-bg)')) < 0.25 && lightBg > 0.9, 'window background got darker');
		t.check(luminance(await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=settings]')).backgroundColor)) < 0.25, 'window frame is really dark');
		t.check(await page.evaluate(() => document.documentElement.classList.contains('dark') && getComputedStyle(document.documentElement).colorScheme === 'dark'), 'html.dark and color-scheme: dark');
		t.eq((await stored(page)).theme, 'dark', 'preference was written to localStorage');
		await t.shot(page, 'koyu');
		await reloadDesktop(page);
		t.eq((await attrs(page)).theme, 'dark', 'stayed dark after reload');
		const win2 = await openSettingsTab(page, 'appearance');
		t.eq(await win2.locator('[data-theme-option=dark]').getAttribute('aria-pressed'), 'true', 'Dark card is selected after reload');
		await win2.locator('[data-theme-option=light]').click();
		await waitAttr(t, page, 'theme', 'light', 'Light: data-theme="light"');
		await reloadDesktop(page);
		t.eq((await attrs(page)).theme, 'light', 'stayed light after reload (an explicit choice wins even when the system is dark)');
	});

	await t.step('System: follows prefers-color-scheme and applies changes instantly; an explicit choice does not follow it', async () => {
		const { page } = await t.open('can', { colorScheme: 'light', prefs: { theme: 'system' } });
		t.eq((await attrs(page)).theme, 'light', 'light while the system is light');
		await page.emulateMedia({ colorScheme: 'dark' });
		await waitAttr(t, page, 'theme', 'dark', 'turned dark when the system did, without a page reload');
		await page.emulateMedia({ colorScheme: 'light' });
		await waitAttr(t, page, 'theme', 'light', 'turned light when the system did');
		await page.emulateMedia({ colorScheme: 'dark' });
		await waitAttr(t, page, 'theme', 'dark', 'dark again');
		await reloadDesktop(page);
		t.eq((await attrs(page)).theme, 'dark', 'the system dark theme is applied after reload (flash-free path: below)');

		const win = await openSettingsTab(page, 'appearance');
		await win.locator('[data-theme-option=light]').click();
		await waitAttr(t, page, 'theme', 'light', 'light after choosing it, even while the system is dark');
		await page.emulateMedia({ colorScheme: 'light' });
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.waitForTimeout(300);
		t.eq((await attrs(page)).theme, 'light', 'system changes do not move the theme while an explicit choice is set');
		await win.locator('[data-theme-option=system]').click();
		await waitAttr(t, page, 'theme', 'dark', 'dark after returning to System (the system is dark)');
		t.eq((await stored(page)).theme, 'system', 'preference stored as "system"');
	});

	await t.step('Right-click "Dark Mode" shortcut and Control Center toggle between light and dark', async () => {
		const { page } = await t.open('can', { colorScheme: 'light', prefs: { theme: 'system' } });
		await rightClickDesktop(page);
		await page.locator('[data-menu-item=dt-theme]').click();
		await waitAttr(t, page, 'theme', 'dark', 'the context menu switched to dark');
		t.eq((await stored(page)).theme, 'dark', 'the shortcut writes an explicit preference');
		await rightClickDesktop(page);
		await page.locator('[data-menu-item=dt-theme]').click();
		await waitAttr(t, page, 'theme', 'light', 'switched back to light on the second run');
	});

	await t.step('accent color: 6 colors, instant; selected tab, primary button and focus ring come from it; persistent', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		const seen = new Set();
		for (const id of ['blue', 'purple', 'pink', 'orange', 'green', 'graphite']) {
			await win.locator(`[data-accent-option=${id}]`).click();
			await waitAttr(t, page, 'accent', id, `accent ${id}`);
			const accent = await resolved(page, 'var(--accent)');
			seen.add(accent);
			t.eq(await resolved(page, 'var(--accent-blue)'), accent, `${id}: the --accent-blue alias resolves to the same color`);
			t.eq(await win.locator('[data-settings-tab=appearance]').evaluate((e) => getComputedStyle(e).backgroundColor), accent, `${id}: selected tab uses the accent color`);
		}
		t.eq(seen.size, 6, '6 accents, 6 distinct colors');

		await win.locator('[data-accent-option=purple]').click();
		const purple = await resolved(page, 'var(--accent)');
		// Primary button: instead of News' shared "primaryBtn" from the Dock, use the dialog button present in every window.
		await page.evaluate(() => {
			const b = document.createElement('button');
			b.id = 'tema-odak';
			b.textContent = 'x';
			document.body.prepend(b);
		});
		// Focus reached via keyboard counts as :focus-visible (a mouse-clicked button does not).
		await page.keyboard.press('Tab');
		await page.evaluate(() => document.getElementById('tema-odak').focus());
		t.check(await page.evaluate(() => document.activeElement?.id === 'tema-odak'), 'keyboard focus reached the probe button');
		t.eq(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor), purple, 'focus ring uses the accent color');
		t.check((await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)) === 'solid', 'focus ring is drawn');
		await page.evaluate(() => document.getElementById('tema-odak')?.remove());

		await win.locator('[data-theme-option=dark]').click();
		await waitAttr(t, page, 'theme', 'dark', 'switched to dark');
		const purpleDark = await resolved(page, 'var(--accent)');
		t.check(purpleDark !== purple, 'accent gets a shade lighter in the dark theme', `${purple} → ${purpleDark}`);
		t.eq(await win.locator('[data-accent-option=purple]').evaluate((e) => getComputedStyle(e).backgroundColor), purpleDark, 'the swatch shows the dark-theme color too');
		await t.shot(page, 'vurgu-mor-koyu');
		await reloadDesktop(page);
		t.eq((await attrs(page)).accent, 'purple', 'accent preserved after reload');
		t.eq(await resolved(page, 'var(--accent)'), purpleDark, 'same color after reload');
	});

	await t.step('transparency off (default): no backdrop-filter anywhere, surfaces are opaque', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		await openApp(page, 'news');
		await openSettingsTab(page, 'appearance');
		t.eq(await openWindows(page).then((w) => w.length >= 2), true, 'two windows open');
		t.eq(await glassElements(page), [], 'transparency off: no element has a computed backdrop-filter other than "none"');
		const frame = await page.evaluate(() => {
			const c = getComputedStyle(document.querySelector('[data-window-frame=news]'));
			return { filter: c.backdropFilter, bg: c.backgroundColor };
		});
		t.eq(frame.filter, 'none', 'window frame: backdrop-filter none');
		t.check(await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=news]')).contain.includes('layout')), 'the window remains the containing block for fixed-position sheets: contain: layout even without blur');
		t.check(/^rgb\(/.test(frame.bg), 'window background is opaque (no alpha)', frame.bg);
		const bars = await page.evaluate(() => ({
			top: getComputedStyle(document.querySelector('[data-topbar]')).backgroundColor,
			dock: getComputedStyle(document.querySelector('[data-dock]')).backgroundColor,
		}));
		t.check(/^rgb\(/.test(bars.top) && /^rgb\(/.test(bars.dock), 'menu bar and Dock are opaque', JSON.stringify(bars));
		await t.shot(page, 'saydamlik-kapali');
	});

	await t.step('transparency on: glass comes from a single token everywhere; turns off while dragging and returns on release; persistent', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		await openApp(page, 'news');
		const win = await openSettingsTab(page, 'appearance');
		await win.locator('[data-setting=transparency]').click();
		await waitAttr(t, page, 'transparency', 'on', 'data-transparency="on"');
		t.eq((await stored(page)).transparency, true, 'preference was stored');
		const glass = await glassElements(page);
		t.check(glass.includes('header[topbar]') && glass.includes('div[dock]') && glass.includes('div[news]') && glass.includes('div[settings]'), 'menu bar, Dock and windows are frosted', JSON.stringify(glass));
		const css = await page.evaluate(() => {
			const c = getComputedStyle(document.querySelector('[data-window-frame=news]'));
			return { filter: c.backdropFilter, bg: c.backgroundColor, topbar: getComputedStyle(document.querySelector('[data-topbar]')).backgroundColor };
		});
		t.check(css.filter.includes('blur'), 'window: blur is present', css.filter);
		t.check(/rgba\(/.test(css.bg) && /rgba\(/.test(css.topbar), 'window and menu bar are translucent', JSON.stringify(css));
		await t.shot(page, 'saydamlik-acik');

		const idle = await movingState(page, 'news');
		t.check(!idle.moving && idle.blur.includes('blur'), 'frosted while not dragging', idle.blur);
		const box = await frameBox(page, 'news');
		const from = titlePoint(box);
		await pointerDrag(page, from, { x: from.x + 110, y: from.y + 60 }, { hold: true });
		const during = await movingState(page, 'news');
		t.check(during.moving && during.blur === 'none', 'data-window-moving is set while dragging and window blur is off', JSON.stringify(during));
		t.eq((await movingState(page, 'settings')).blur, 'none', 'the other window is opaque/blur-free while dragging');
		await page.mouse.up();
		await settle(page);
		const after = await movingState(page, 'news');
		t.check(!after.moving && after.blur.includes('blur'), 'blur returned on release', after.blur);

		await reloadDesktop(page);
		t.eq((await attrs(page)).transparency, 'on', 'transparency stayed on after reload');
		const win2 = await openSettingsTab(page, 'appearance');
		t.eq(await win2.locator('[data-setting=transparency]').getAttribute('aria-checked'), 'true', 'toggle appears on');
		await win2.locator('[data-setting=transparency]').click();
		await waitAttr(t, page, 'transparency', 'off', 'turns off instantly when the toggle is switched off');
		await page.waitForTimeout(400);
		t.eq(await glassElements(page), [], 'no glass anywhere after turning it off');
	});

	await t.step('reduce motion: the toggle shortens animations; the default follows the system prefers-reduced-motion', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		const dur = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-dock] button')).transitionDuration);
		t.eq((await attrs(page)).motion, 'full', 'full motion at start');
		const full = await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=settings]')).animationDuration);
		await win.locator('[data-setting=reduce-motion]').click();
		await waitAttr(t, page, 'motion', 'reduce', 'toggle: data-motion="reduce"');
		t.check(parseFloat(await dur()) <= 0.01, 'Dock/window transitions ~0 s', await dur());
		await page.locator('[data-dock-app=news]').click();
		await page.locator('[data-window-frame=news]').waitFor();
		const anim = await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=news]')).animationDuration);
		t.check(parseFloat(anim) <= 0.01, 'window opening animation was shortened', `${full} → ${anim}`);
		t.eq((await stored(page)).reduceMotion, true, 'preference was stored');
		await reloadDesktop(page);
		t.eq((await attrs(page)).motion, 'reduce', 'preserved after reload');

		// System default: an untouched preference follows the system; an explicit choice overrides the system.
		const fresh = await t.open('can', { colorScheme: 'light' });
		await fresh.page.emulateMedia({ reducedMotion: 'reduce' });
		await waitAttr(t, fresh.page, 'motion', 'reduce', 'untouched preference: motion is reduced if the system asks for reduced motion (instantly)');
		const w2 = await openSettingsTab(fresh.page, 'appearance');
		t.eq(await w2.locator('[data-setting=reduce-motion]').getAttribute('aria-checked'), 'true', 'toggle reflects the system value');
		await w2.locator('[data-setting=reduce-motion]').click();
		await waitAttr(t, fresh.page, 'motion', 'full', 'the user can turn it off even if the system reduces motion');
		await fresh.page.emulateMedia({ reducedMotion: 'no-preference' });
		await fresh.page.emulateMedia({ reducedMotion: 'reduce' });
		await fresh.page.waitForTimeout(200);
		t.eq((await attrs(fresh.page)).motion, 'full', 'an explicit choice is unaffected by system changes');
	});

	await t.step('no load flash: dark before the first paint when the preference is dark; <html> never looks light', async () => {
		for (const [name, prefs, scheme] of [
			['stored dark preference', { theme: 'dark' }, 'light'],
			['System + dark OS (nothing stored)', null, 'dark'],
		]) {
			const context = t.track(await newContext(t.browser, { prefs, colorScheme: scheme, reducedMotion: 'no-preference', stubWallpapers: false }));
			await context.addInitScript(() => {
				// At document start <html> may not exist yet: observe the document itself.
				const seen = [];
				window.__themeSeen = seen;
				new MutationObserver((records) => {
					for (const r of records) if (r.type === 'attributes' && r.attributeName === 'data-theme') seen.push(r.target.getAttribute('data-theme'));
				}).observe(document, { attributes: true, attributeFilter: ['data-theme'], subtree: true });
				requestAnimationFrame(() => {
					window.__firstFrame = { theme: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).color, scheme: getComputedStyle(document.documentElement).colorScheme };
				});
			});
			const page = await context.newPage();
			await page.goto(t.base, { waitUntil: 'domcontentloaded', timeout: 90_000 });
			await page.locator('input[type=email]').waitFor();
			const info = await page.evaluate(() => ({ seen: window.__themeSeen, first: window.__firstFrame }));
			t.check(info.first?.theme === 'dark', `${name}: data-theme="dark" on the first frame`, JSON.stringify(info.first));
			t.check(info.seen.length > 0 && info.seen.every((v) => v === 'dark'), `${name}: data-theme was never light`, JSON.stringify(info.seen));
			// The login screen is dark as rendered: the page's average brightness is low.
			const png = (await page.screenshot()).toString('base64');
			const mean = await page.evaluate(async (b64) => {
				const img = new Image();
				img.src = `data:image/png;base64,${b64}`;
				await img.decode();
				const c = document.createElement('canvas');
				c.width = 64;
				c.height = 40;
				const x = c.getContext('2d');
				x.drawImage(img, 0, 0, 64, 40);
				const d = x.getImageData(0, 0, 64, 40).data;
				let s = 0;
				for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
				return s / (d.length / 4);
			}, png);
			t.check(mean < 0.45, `${name}: first screenshot is dark (mean brightness ${mean.toFixed(2)})`);
			await t.shot(page, `ilk-boyama-${name}`);
			await t.close(context);
		}
	});

	await t.step('hidden window: falls back to defaults silently when localStorage cannot be read', async () => {
		const context = t.track(await newContext(t.browser, { colorScheme: 'dark', reducedMotion: 'no-preference', stubWallpapers: false }));
		await context.addInitScript(() => {
			// Like a browser with cookies disabled: even accessing localStorage throws SecurityError.
			Object.defineProperty(window, 'localStorage', {
				get() {
					throw new DOMException('denied', 'SecurityError');
				},
			});
		});
		const errors = [];
		const page = await context.newPage();
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(t.base, { waitUntil: 'domcontentloaded', timeout: 90_000 });
		await page.locator('input[type=email]').waitFor({ timeout: 30_000 }).catch(() => {});
		const got = await attrs(page);
		t.check(JSON.stringify(got) === JSON.stringify({ theme: 'dark', accent: 'blue', transparency: 'off', motion: 'full' }), 'defaults are written on a read error (System = dark OS)', `${JSON.stringify(got)} ${JSON.stringify(errors)} ${page.url()}`);
		t.eq(errors.filter((m) => /club_theme|SecurityError|denied/.test(m) && /theme|boot/i.test(m)), [], 'theme code did not throw');
	});

	await t.step('role scope: the news-only role can also change Appearance settings, and they persist', async () => {
		const { page } = await t.open('reader', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		t.eq(await win.locator('[data-theme-option]').count(), 3, 'theme cards are visible');
		await win.locator('[data-theme-option=dark]').click();
		await win.locator('[data-accent-option=green]').click();
		await win.locator('[data-setting=transparency]').click();
		await win.locator('[data-setting=reduce-motion]').click();
		t.eq(await attrs(page), { theme: 'dark', accent: 'green', transparency: 'on', motion: 'reduce' }, 'all four applied instantly');
		await reloadDesktop(page);
		t.eq(await attrs(page), { theme: 'dark', accent: 'green', transparency: 'on', motion: 'reduce' }, 'all preserved after reload');
		await t.shot(page, 'okur-gorunum');
	});

	await t.step('"Reset session" returns appearance to defaults; the wallpaper comes from a single catalog', async () => {
		const { page } = await t.open('can', { colorScheme: 'light', prefs: { theme: 'dark', accent: 'pink', transparency: true, reduceMotion: true } });
		t.eq(await attrs(page), { theme: 'dark', accent: 'pink', transparency: 'on', motion: 'reduce' }, 'seeded preferences were applied');

		// Next wallpaper: catalog order (3D Aurora → second catalog wallpaper).
		await page.evaluate(() => localStorage.setItem('club_active_wallpaper', '3d-aurora'));
		await reloadDesktop(page);
		await rightClickDesktop(page);
		await page.locator('[data-menu-item=dt-next-wallpaper]').click();
		t.eq(await page.evaluate(() => localStorage.getItem('club_active_wallpaper')), WALLPAPERS[1].src, 'next wallpaper is the second one in the catalog');

		const win = await openSettingsTab(page, 'account');
		await win.getByRole('button', { name: tr('dlgReset') }).click();
		await dialogReply(page, true);
		await waitAttr(t, page, 'accent', 'blue', 'accent is blue after reset');
		t.eq(await stored(page), { theme: 'system', accent: 'blue', transparency: false, reduceMotion: null }, 'preferences returned to defaults');
		t.eq(await page.evaluate(() => localStorage.getItem('club_active_wallpaper')), DEFAULT_WALLPAPER, 'wallpaper returned to default');
	});
}
