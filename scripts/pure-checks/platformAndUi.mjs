import assert from 'node:assert/strict';
import { detectBrowser, detectPlatform, isInstalledApp } from '../../src/lib/client/pwaDetect.ts';
import { fill, foldSearchText, foldTr, scoreMatch, slugify, uniqueSlug } from '../../src/lib/text.ts';
import { groupNotifications, unreadCount } from '../../src/lib/notifications.ts';
import { dayOffset, formatBytes, relativeTime } from '../../src/core/data/format.ts';
import { isSafeImageUrl } from '../../src/types/news.ts';
import { UA, check, checkAsync } from './runner.mjs';

export function runPlatformAndUiChecks() {
	check('an iPhone is iOS, not macOS (its UA contains "like Mac OS X")', () => {
		assert.equal(detectPlatform(UA.iphoneSafari, 5), 'ios');
		assert.equal(detectPlatform(UA.iphoneSafari), 'ios');
	});
	check('a Mac without a touch screen is macOS', () => {
		assert.equal(detectPlatform(UA.macSafari, 0), 'macos');
	});
	check('an iPad reporting a Mac UA is told apart by its touch points', () => {
		assert.equal(detectPlatform(UA.macSafari, 5), 'ios');
	});
	check('other platforms', () => {
		assert.equal(detectPlatform(UA.androidChrome, 5), 'android');
		assert.equal(detectPlatform(UA.windowsEdge), 'windows');
		assert.equal(detectPlatform(UA.linuxFirefox), 'linux');
		assert.equal(detectPlatform(UA.linuxChrome), 'linux');
		assert.equal(detectPlatform('', 0), 'windows');
	});

	check('browser families', () => {
		assert.equal(detectBrowser(UA.linuxFirefox), 'firefox');
		assert.equal(detectBrowser(UA.firefoxIos), 'firefox');
		assert.equal(detectBrowser(UA.linuxChrome), 'chromium');
		assert.equal(detectBrowser(UA.windowsEdge), 'chromium');
		assert.equal(detectBrowser(UA.androidChrome), 'chromium');
		assert.equal(detectBrowser(UA.iphoneSafari), 'safari');
		assert.equal(detectBrowser(UA.macSafari), 'safari');
	});
	check('in-app browsers are recognised before the engine they embed', () => {
		assert.equal(detectBrowser(UA.iosInstagram), 'inapp');
		assert.equal(detectBrowser(UA.androidWebView), 'inapp');
	});

	const none = {
		standalone: false,
		minimalUi: false,
		windowControlsOverlay: false,
		navigatorStandalone: false,
		androidAppReferrer: false,
	};
	check('a plain browser tab is not an installed app', () => {
		assert.equal(isInstalledApp(none), false);
	});
	check('every installed display mode counts', () => {
		for (const key of Object.keys(none)) {
			assert.equal(isInstalledApp({ ...none, [key]: true }), true, key);
		}
	});
	check('fullscreen is not one of the signals (F11 must not lift the wall)', () => {
		assert.equal(Object.keys(none).some((key) => /fullscreen/i.test(key)), false);
	});

	check('foldSearchText: Turkish and ASCII spellings meet', () => {
		assert.equal(foldSearchText('\u0130SPARTA'), 'isparta');
		assert.equal(foldSearchText('Isparta'), 'isparta');
		assert.equal(foldSearchText('\u0131sparta'), 'isparta');
		assert.equal(foldSearchText('G\u00fcvenlik \u00d6\u011frenci \u00c7al\u0131\u015fma \u015eube A\u011fa\u00e7'), 'guvenlik ogrenci calisma sube agac');
		assert.equal(foldSearchText('B\u0130LG\u0130SAYAR M\u00dcHEND\u0130SL\u0130\u011e\u0130'), 'bilgisayar muhendisligi');
		assert.equal(foldSearchText(null), '');
		assert.equal(foldSearchText(undefined), '');
		assert.equal(foldTr('\u0130SPARTA'), 'isparta');
	});
	check('scoreMatch: every query word must hit', () => {
		const team = [{ text: 'Web & Mobil Platform Ekibi', weight: 3 }, { text: 'Yaz\u0131l\u0131m', weight: 1 }];
		assert.ok(scoreMatch('web mobil', team) > 0);
		assert.equal(scoreMatch('web robotik', team), 0);
		assert.equal(scoreMatch('', team), 0);
		assert.equal(scoreMatch('   ', team), 0);
	});
	check('scoreMatch: accent-insensitive in both directions', () => {
		assert.ok(scoreMatch('guvenlik', [{ text: 'Siber G\u00fcvenlik', weight: 1 }]) > 0);
		assert.ok(scoreMatch('g\u00fcvenlik', [{ text: 'siber guvenlik', weight: 1 }]) > 0);
		assert.ok(scoreMatch('ISPARTA', [{ text: '\u0131sparta', weight: 1 }]) > 0);
	});
	check('scoreMatch: a word start outranks a substring, and a title outranks a body', () => {
		const start = scoreMatch('aut', [{ text: 'Autonomous drone', weight: 1 }]);
		const inside = scoreMatch('aut', [{ text: 'Cauterize', weight: 1 }]);
		assert.ok(start > inside && inside > 0, `${start} vs ${inside}`);
		const title = scoreMatch('iha', [{ text: '\u0130HA tak\u0131m\u0131', weight: 3 }]);
		const body = scoreMatch('iha', [{ text: '\u0130HA tak\u0131m\u0131', weight: 1 }]);
		assert.ok(title > body);
	});

	check('fill: replaces named placeholders and leaves unknown ones', () => {
		assert.equal(fill('{n} days left', { n: 3 }), '3 days left');
		assert.equal(fill('{a} and {b}', { a: 'x', b: 2 }), 'x and 2');
		assert.equal(fill('{missing}', {}), '{missing}');
		assert.equal(fill('plain text', { n: 1 }), 'plain text');
	});

	const HOUR = 3_600_000;
	const item = (id, priority, at, extra = {}) => ({
		id, kind: 'news', priority, at, data: { title: id }, target: { appId: 'news' }, ...extra,
	});

	check('groupNotifications: pinned, to-dos by deadline, new vs earlier', () => {
		const items = [
			item('old-news', 'info', 100),
			item('new-news', 'info', 900),
			item('urgent', 'info', 500, { urgent: true }),
			item('task-late', 'action', 50, { dueAt: 2000 }),
			item('task-soon', 'action', 60, { dueAt: 1000 }),
			item('newer-news', 'info', 950),
		];
		const g = groupNotifications(items, 400);
		assert.equal(g.pinned?.id, 'urgent');
		assert.deepEqual(g.action.map((i) => i.id), ['task-soon', 'task-late']);
		assert.deepEqual(g.fresh.map((i) => i.id), ['newer-news', 'new-news']);
		assert.deepEqual(g.earlier.map((i) => i.id), ['old-news']);
		assert.ok(!g.fresh.concat(g.earlier).some((i) => i.id === 'urgent'), 'the pinned item is not listed twice');
	});
	check('groupNotifications: nothing pinned when nothing is urgent, and no input mutation', () => {
		const items = [item('a', 'info', 1), item('b', 'action', 2)];
		const copy = JSON.stringify(items);
		assert.equal(groupNotifications(items, 0).pinned, null);
		assert.equal(JSON.stringify(items), copy);
	});

	check('unreadCount: to-dos always count, information only once it is newer than the last look', () => {
		const response = {
			generatedAt: 1000,
			counts: { actionRequired: 3, total: 5 },
			items: [item('a', 'info', 800), item('b', 'info', 300), item('c', 'action', 10)],
		};
		assert.equal(unreadCount(response, 500), 3 + 1);
		assert.equal(unreadCount(response, 0), 3 + 2);
		assert.equal(unreadCount(response, 900), 3);
		assert.equal(unreadCount(null, 0), 0);
	});

	check('dayOffset: calendar days in local time, not 24 h windows', () => {
		const noon = new Date(2026, 5, 10, 12, 0).getTime();
		assert.equal(dayOffset(new Date(2026, 5, 10, 23, 59).getTime(), noon), 0);
		assert.equal(dayOffset(new Date(2026, 5, 10, 0, 1).getTime(), noon), 0);
		assert.equal(dayOffset(new Date(2026, 5, 11, 0, 1).getTime(), noon), 1);
		assert.equal(dayOffset(new Date(2026, 5, 9, 23, 59).getTime(), noon), -1);
		assert.equal(dayOffset(new Date(2026, 5, 13, 8, 0).getTime(), noon), 3);
	});

	check('relativeTime: picks a natural unit, in the requested language', () => {
		const now = new Date(2026, 5, 10, 12, 0).getTime();
		assert.match(relativeTime(now - 2 * HOUR, now, 'tr'), /2 saat \u00f6nce/);
		assert.match(relativeTime(now - 5 * 60_000, now, 'en'), /5 minutes ago/);
		assert.match(relativeTime(now - 20_000, now, 'en'), /now/);
		assert.match(relativeTime(new Date(2026, 5, 9, 9, 0).getTime(), now, 'tr'), /d\u00fcn/);
		assert.match(relativeTime(new Date(2026, 5, 12, 9, 0).getTime(), now, 'en'), /in 2 days/);
	});

	check('formatBytes: scales byte sizes with units cleanly', () => {
		assert.equal(formatBytes(0), '0 B');
		assert.equal(formatBytes(-10), '0 B');
		assert.equal(formatBytes(500), '500 B');
		assert.equal(formatBytes(1024), '1.0 KB');
		assert.equal(formatBytes(1536), '1.5 KB');
		assert.equal(formatBytes(1024 * 1024 * 5), '5.0 MB');
		assert.equal(formatBytes(1024 * 1024 * 1024 * 2.5), '2.5 GB');
	});

	check('slugify: Turkish letters are transliterated, not dropped', () => {
		assert.equal(slugify('G\u00fcz D\u00f6nemi Python & Makine \u00d6\u011frenmesi At\u00f6lyeleri Ba\u015fl\u0131yor'), 'guz-donemi-python-makine-ogrenmesi-atolyeleri-basliyor');
		assert.equal(slugify('Siber G\u00fcvenlik'), 'siber-guvenlik');
		assert.equal(slugify('I\u015eIK \u0130LE \u00c7ALI\u015eMA'), 'isik-ile-calisma');
		assert.equal(slugify('  --Merhaba,   D\u00fcnya!!  '), 'merhaba-dunya');
	});
	check('slugify: length is capped without leaving a trailing dash, and junk gives an empty slug', () => {
		const long = slugify('word '.repeat(40), 30);
		assert.ok(long.length <= 30 && !long.endsWith('-'), long);
		assert.equal(slugify('!!! 🎉'), '');
		assert.equal(slugify(''), '');
	});
	checkAsync('uniqueSlug: numbers a slug that is taken, and falls back when there is nothing to slug', async () => {
		const taken = new Set(['news', 'news-2']);
		assert.equal(await uniqueSlug('news', async (c) => taken.has(c)), 'news-3');
		assert.equal(await uniqueSlug('fresh', async (c) => taken.has(c)), 'fresh');
		assert.equal(await uniqueSlug('', async () => false, 'news'), 'news');
	});
	check('isSafeImageUrl: https and the portal presets only, nothing that can break out of url(...)', () => {
		assert.ok(isSafeImageUrl('https://cdn.example.org/a/b.png?x=1'));
		assert.ok(isSafeImageUrl('/app-icons/vscode/256.png'));
		for (const bad of [
			'http://insecure.example.org/a.png',
			'javascript:alert(1)',
			'data:image/png;base64,AAAA',
			'https://x.org/a.png);background:red',
			'https://x.org/a"b.png',
			"https://x.org/a'b.png",
			'/app-icons/../../etc/passwd',
			'/uploads/secret.png',
			'//evil.example.org/a.png',
			'',
		]) {
			assert.ok(!isSafeImageUrl(bad), bad);
		}
	});
}
