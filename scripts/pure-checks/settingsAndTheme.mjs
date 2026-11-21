import assert from 'node:assert/strict';
import { SETTINGS_SECTIONS, SETTINGS_TAB_IDS } from '../../src/configs/settings.config.ts';
import { emailDomainAllowed, normalizeMembershipPolicy } from '../../src/lib/membershipPolicy.ts';
import { SETUP_GENERAL_MESSAGE, createSetupCache, setupResponse } from '../../src/lib/setup.ts';
import {
	ACCENTS,
	DEFAULT_THEME_PREFS,
	THEME_STORAGE_KEY,
	htmlAttributes,
	parseThemePrefs,
	resolveReduceMotion,
	resolveTheme,
	serializeThemePrefs,
	themeBootScript,
	toggledTheme,
} from '../../src/core/theme/pure.ts';
import {
	DEFAULT_WALLPAPER,
	WALLPAPERS,
	isAuroraWallpaper,
	nextWallpaper,
	wallpaperInfo,
	wallpaperPreview,
} from '../../src/core/theme/wallpapers.ts';
import { check, checkAsync } from './runner.mjs';

export function runSettingsAndThemeChecks() {
	check('settings: one section per tab, system pages flagged', () => {
		assert.deepEqual(SETTINGS_SECTIONS.map((s) => s.id).sort(), [...SETTINGS_TAB_IDS].sort());
		assert.deepEqual(SETTINGS_SECTIONS.filter((s) => s.system).map((s) => s.id).sort(), ['community', 'forms', 'integrations', 'legal', 'membership', 'privacy', 'roles', 'smtp', 'teams']);
		for (const s of SETTINGS_SECTIONS) assert.ok(s.labelKey && s.group, s.id);
	});

	check('membership policy: defaults, clamps and e-mail domains', () => {
		const policy = normalizeMembershipPolicy({
			selfRegistration: 'closed',
			adminCreate: false,
			inviteEnabled: false,
			emailVerification: false,
			reapplyCooldownDays: -5,
			inviteExpiryDays: 999,
			maxOpenApplications: 9,
			allowedEmailDomains: ['@orbit.test', 'orbit.test', 'university.edu.tr', ''],
		});
		assert.equal(policy.selfRegistration, 'closed');
		assert.equal(policy.adminCreate, false);
		assert.equal(policy.inviteEnabled, false);
		assert.equal(policy.emailVerification, false);
		assert.equal(policy.reapplyCooldownDays, 0);
		assert.equal(policy.inviteExpiryDays, 90);
		assert.equal(policy.maxOpenApplications, 5);
		assert.deepEqual(policy.allowedEmailDomains, ['orbit.test', 'university.edu.tr']);

		assert.equal(emailDomainAllowed('a@orbit.test', policy.allowedEmailDomains), true);
		assert.equal(emailDomainAllowed('a@sub.orbit.test', policy.allowedEmailDomains), true);
		assert.equal(emailDomainAllowed('a@orbit.test.evil.com', policy.allowedEmailDomains), false);
		assert.equal(emailDomainAllowed('a@elsewhere.com', policy.allowedEmailDomains), false);
		assert.equal(emailDomainAllowed('a@elsewhere.com', []), true);
	});

	check('setup: production never carries the reason, development does', () => {
		const missing = { ready: false, reason: 'BOOTSTRAP_ADMIN_EMAIL ve BOOTSTRAP_ADMIN_PASSWORD tan\u0131ml\u0131 de\u011fil.' };
		assert.deepEqual(setupResponse({ ready: true }, 'production'), { ready: true });
		assert.deepEqual(setupResponse(missing, 'production'), { ready: false, message: SETUP_GENERAL_MESSAGE });
		assert.equal(JSON.stringify(setupResponse(missing, 'production')).includes('BOOTSTRAP'), false);
		assert.equal(setupResponse(missing, 'development').reason, missing.reason);
		assert.equal(setupResponse(missing, undefined).reason, missing.reason);
		assert.equal(setupResponse({ ready: true, reason: 'x' }, 'development').reason, undefined);
	});

	checkAsync('setup: lookups are shared for the cache window', async () => {
		let calls = 0;
		let clock = 1000;
		const get = createSetupCache(async () => ({ ready: ++calls > 1 }), 5000, () => clock);
		const [a, b] = await Promise.all([get(), get()]);
		assert.equal(calls, 1);
		assert.deepEqual([a.ready, b.ready], [false, false]);
		clock += 4999;
		await get();
		assert.equal(calls, 1);
		clock += 1;
		assert.equal((await get()).ready, true);
		assert.equal(calls, 2);
	});

	check('theme: preferences parse field by field and fall back to the defaults', () => {
		assert.deepEqual(parseThemePrefs(null), DEFAULT_THEME_PREFS);
		assert.deepEqual(parseThemePrefs(''), DEFAULT_THEME_PREFS);
		assert.deepEqual(parseThemePrefs('{bozuk'), DEFAULT_THEME_PREFS);
		assert.deepEqual(parseThemePrefs('42'), DEFAULT_THEME_PREFS);
		assert.deepEqual(parseThemePrefs('{"theme":"dark","accent":"pink","transparency":true,"reduceMotion":false}'), { theme: 'dark', accent: 'pink', transparency: true, reduceMotion: false });
		assert.deepEqual(parseThemePrefs('{"theme":"mor","accent":"kirmizi","transparency":"evet","reduceMotion":1}'), DEFAULT_THEME_PREFS);
		assert.equal(parseThemePrefs('{"theme":"light","accent":"nope"}').theme, 'light');
		const prefs = { theme: 'light', accent: 'green', transparency: true, reduceMotion: true };
		assert.deepEqual(parseThemePrefs(serializeThemePrefs(prefs)), prefs);
		assert.equal(DEFAULT_THEME_PREFS.transparency, false);
		assert.equal(ACCENTS.length, 6);
	});

	check('theme: system follows the OS, an explicit choice does not', () => {
		assert.equal(resolveTheme('system', true), 'dark');
		assert.equal(resolveTheme('system', false), 'light');
		assert.equal(resolveTheme('light', true), 'light');
		assert.equal(resolveTheme('dark', false), 'dark');
		assert.equal(toggledTheme('dark'), 'light');
		assert.equal(toggledTheme('light'), 'dark');
		assert.equal(resolveReduceMotion(null, true), true);
		assert.equal(resolveReduceMotion(null, false), false);
		assert.equal(resolveReduceMotion(false, true), false);
		assert.equal(resolveReduceMotion(true, false), true);
	});

	checkAsync('theme: the <head> boot script writes what htmlAttributes says', async () => {
		const { runInNewContext } = await import('node:vm');
		const boot = (stored, dark, reduced, broken = false) => {
			const attrs = {};
			const classes = new Set();
			const document = { documentElement: { setAttribute: (k, v) => (attrs[k] = v), classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } } };
			const localStorage = { getItem: (k) => (broken ? assert.fail('unreachable') : k === THEME_STORAGE_KEY ? stored : null) };
			const matchMedia = (q) => ({ matches: q.includes('color-scheme') ? dark : reduced });
			if (broken) localStorage.getItem = () => { throw new Error('SecurityError'); };
			runInNewContext(themeBootScript(), { document, localStorage, matchMedia });
			return { attrs, dark: classes.has('dark') };
		};
		const stored = [
			null,
			'{bozuk',
			'{"theme":"dark"}',
			'{"theme":"light","accent":"purple","transparency":true}',
			'{"theme":"system","accent":"graphite","reduceMotion":false}',
			'{"theme":"system","reduceMotion":true,"transparency":false}',
			'{"theme":"x","accent":"y","transparency":"on","reduceMotion":"yes"}',
		];
		for (const raw of stored) {
			for (const dark of [false, true]) {
				for (const reduced of [false, true]) {
					const a = htmlAttributes(parseThemePrefs(raw), dark, reduced);
					const got = boot(raw, dark, reduced);
					assert.deepEqual(got.attrs, { 'data-theme': a.theme, 'data-accent': a.accent, 'data-transparency': a.transparency, 'data-motion': a.motion }, String(raw));
					assert.equal(got.dark, a.theme === 'dark');
				}
			}
		}
		// A storage error (private window): defaults, no throw.
		const fallback = boot(null, true, false, true);
		assert.deepEqual(fallback.attrs, { 'data-theme': 'dark', 'data-accent': 'blue', 'data-transparency': 'off', 'data-motion': 'full' });
	});

	check('theme: one wallpaper catalogue, walked in order', () => {
		assert.equal(new Set(WALLPAPERS.map((w) => w.id)).size, WALLPAPERS.length);
		assert.equal(new Set(WALLPAPERS.map((w) => w.src)).size, WALLPAPERS.length);
		assert.equal(DEFAULT_WALLPAPER, WALLPAPERS[1].src);
		assert.equal(nextWallpaper(WALLPAPERS[0].src), WALLPAPERS[1].src);
		assert.equal(nextWallpaper(WALLPAPERS[WALLPAPERS.length - 1].src), WALLPAPERS[0].src);
		assert.equal(nextWallpaper('/wallpapers/bilinmeyen.jpg'), WALLPAPERS[0].src);
		assert.equal(isAuroraWallpaper('3d-aurora'), true);
		assert.equal(isAuroraWallpaper('/wallpapers/3D-Aurora.webp'), true);
		assert.equal(isAuroraWallpaper('/wallpapers/39620.webp'), false);
		assert.equal(wallpaperPreview('3d-aurora'), '/wallpapers/3D-Aurora.webp');
		assert.equal(wallpaperPreview('/wallpapers/39620.webp'), '/wallpapers/39620.webp');
		assert.equal(wallpaperInfo('/baska.jpg').id, 'custom');
	});

	check('wallpapers: legacy national wallpaper is purged from the catalogue', () => {
		assert.equal(WALLPAPERS.some((wallpaper) => wallpaper.src === '/wallpapers/crescent-star-1.jpeg'), false);
	});
}
