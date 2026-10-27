// Tema sistemi (#8): Açık/Koyu/Sistem, vurgu rengi, saydamlık, hareketi azalt; yenileyince korunma;
// açılışta flaş yok; saydamlık kapalıyken hiçbir yerde backdrop-filter yok; "cam" tek yerden açılıp kapanır.
// Tercihler tarayıcıda (localStorage `kulup_theme`) durur; sunucuya hiçbir şey yazılmaz, geri alınacak veri yok.
import { newContext, openApp, openSettingsTab, openWindows } from '../lib/browser.mjs';
import { dialogCevapla } from '../lib/diyalog.mjs';
import { frameBox, movingState, pointerDrag, reloadDesktop, rightClickDesktop, settle, titlePoint } from '../lib/desktop.mjs';

export const meta = { title: 'Tema: Açık/Koyu/Sistem, vurgu, saydamlık, hareket; kalıcılık, flaş yok, tek cam' };

const attrs = (page) =>
	page.evaluate(() => {
		const d = document.documentElement;
		return { theme: d.getAttribute('data-theme'), accent: d.getAttribute('data-accent'), transparency: d.getAttribute('data-transparency'), motion: d.getAttribute('data-motion') };
	});
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kulup_theme') || 'null'));
const waitAttr = (t, page, key, value, name) => t.waitFor(async () => (await attrs(page))[key] === value, { timeout: 3000, every: 50 }).then((ms) => t.check(ms >= 0, name, JSON.stringify({ istenen: value })));

/** CSS değişkenini bir yoklama öğesiyle çözer: gerçek renk ("rgb(...)"). */
const resolved = (page, expr) =>
	page.evaluate((v) => {
		const probe = document.createElement('i');
		probe.style.background = v;
		document.body.append(probe);
		const c = getComputedStyle(probe).backgroundColor;
		probe.remove();
		return c;
	}, expr);

/** Sayfadaki, hesaplanmış backdrop-filter'ı "none" olmayan öğeler. */
const glassElements = (page) =>
	page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).backdropFilter !== 'none').map((e) => `${e.tagName.toLowerCase()}${e.getAttribute('data-window-frame') ? `[${e.getAttribute('data-window-frame')}]` : ''}${e.hasAttribute('data-dock') ? '[dock]' : ''}${e.hasAttribute('data-topbar') ? '[topbar]' : ''}`));

const luminance = (rgb) => {
	const [r, g, b] = rgb.match(/[\d.]+/g).map(Number);
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};


export default async function suite(t) {
	await t.step('varsayılanlar: Sistem teması, mavi vurgu, saydamlık kapalı, hareket tam', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		t.eq(await attrs(page), { theme: 'light', accent: 'blue', transparency: 'off', motion: 'full' }, '<html> öznitelikleri varsayılan');
		t.eq(await stored(page), null, 'kullanıcı dokunmadıkça localStorage boş');
		const win = await openSettingsTab(page, 'appearance');
		t.eq(await win.locator('[data-theme-option]').evaluateAll((e) => e.map((x) => x.getAttribute('data-theme-option'))), ['light', 'dark', 'system'], 'üç tema kartı: Açık, Koyu, Sistem');
		t.eq(await win.locator('[data-theme-option=system]').getAttribute('aria-pressed'), 'true', 'Sistem seçili');
		t.eq(await win.locator('[data-accent-option]').count(), 6, '6 hazır vurgu rengi');
		t.eq(await win.locator('[data-accent-option=blue]').getAttribute('aria-pressed'), 'true', 'mavi seçili');
		t.eq(await win.locator('[data-setting=transparency]').getAttribute('aria-checked'), 'false', 'Saydamlık anahtarı varsayılan kapalı');
		t.eq(await win.locator('[data-setting=reduce-motion]').getAttribute('aria-checked'), 'false', 'Hareketi azalt kapalı (sistem azaltmıyor)');
		await t.shot(page, 'gorunum-varsayilan');
	});

	await t.step('Açık/Koyu: anında uygulanır, renkler gerçekten değişir, yenileyince korunur', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		const lightBg = luminance(await resolved(page, 'var(--window-bg)'));
		await win.locator('[data-theme-option=dark]').click();
		await waitAttr(t, page, 'theme', 'dark', 'Koyu: data-theme="dark" hemen yazıldı');
		t.check(luminance(await resolved(page, 'var(--window-bg)')) < 0.25 && lightBg > 0.9, 'pencere zemini koyulaştı');
		t.check(luminance(await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=settings]')).backgroundColor)) < 0.25, 'pencere çerçevesi gerçekten koyu');
		t.check(await page.evaluate(() => document.documentElement.classList.contains('dark') && getComputedStyle(document.documentElement).colorScheme === 'dark'), 'html.dark ve color-scheme: dark');
		t.eq((await stored(page)).theme, 'dark', 'tercih localStorage\'a yazıldı');
		await t.shot(page, 'koyu');
		await reloadDesktop(page);
		t.eq((await attrs(page)).theme, 'dark', 'yenileyince koyu kaldı');
		const win2 = await openSettingsTab(page, 'appearance');
		t.eq(await win2.locator('[data-theme-option=dark]').getAttribute('aria-pressed'), 'true', 'yenileyince Koyu kartı seçili');
		await win2.locator('[data-theme-option=light]').click();
		await waitAttr(t, page, 'theme', 'light', 'Açık: data-theme="light"');
		await reloadDesktop(page);
		t.eq((await attrs(page)).theme, 'light', 'yenileyince açık kaldı (sistem koyu olsa da değil: açıkça seçildi)');
	});

	await t.step('Sistem: prefers-color-scheme\'i izler, değişince anında uygular; açık seçim izlemez', async () => {
		const { page } = await t.open('can', { colorScheme: 'light', prefs: { theme: 'system' } });
		t.eq((await attrs(page)).theme, 'light', 'sistem açıkken açık');
		await page.emulateMedia({ colorScheme: 'dark' });
		await waitAttr(t, page, 'theme', 'dark', 'sistem koyuya dönünce sayfa yenilenmeden koyu oldu');
		await page.emulateMedia({ colorScheme: 'light' });
		await waitAttr(t, page, 'theme', 'light', 'sistem açığa dönünce açık oldu');
		await page.emulateMedia({ colorScheme: 'dark' });
		await waitAttr(t, page, 'theme', 'dark', 'tekrar koyu');
		await reloadDesktop(page);
		t.eq((await attrs(page)).theme, 'dark', 'yenileyince sistemin koyusu uygulanıyor (flaşsız yol: aşağıda)');

		const win = await openSettingsTab(page, 'appearance');
		await win.locator('[data-theme-option=light]').click();
		await waitAttr(t, page, 'theme', 'light', 'açık seçilince sistem koyu olsa da açık');
		await page.emulateMedia({ colorScheme: 'light' });
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.waitForTimeout(300);
		t.eq((await attrs(page)).theme, 'light', 'açık seçimdeyken sistem değişimi temayı oynatmıyor');
		await win.locator('[data-theme-option=system]').click();
		await waitAttr(t, page, 'theme', 'dark', 'Sistem\'e dönünce (sistem koyu) koyu');
		t.eq((await stored(page)).theme, 'system', 'tercih "system" olarak saklı');
	});

	await t.step('Sağ tık "Karanlık Mod" kısayolu ve Kontrol Merkezi açık/koyu arasında geçirir', async () => {
		const { page } = await t.open('can', { colorScheme: 'light', prefs: { theme: 'system' } });
		await rightClickDesktop(page);
		await page.locator('[data-menu-item=dt-theme]').click();
		await waitAttr(t, page, 'theme', 'dark', 'sağ tık menüsü koyuya çevirdi');
		t.eq((await stored(page)).theme, 'dark', 'kısayol açık bir tercih yazar');
		await rightClickDesktop(page);
		await page.locator('[data-menu-item=dt-theme]').click();
		await waitAttr(t, page, 'theme', 'light', 'ikinci kez açığa döndü');
	});

	await t.step('vurgu rengi: 6 renk, anında; seçili sekme, birincil düğme ve odak halkası ondan gelir; kalıcı', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		const seen = new Set();
		for (const id of ['blue', 'purple', 'pink', 'orange', 'green', 'graphite']) {
			await win.locator(`[data-accent-option=${id}]`).click();
			await waitAttr(t, page, 'accent', id, `vurgu ${id}`);
			const accent = await resolved(page, 'var(--accent)');
			seen.add(accent);
			t.eq(await resolved(page, 'var(--accent-blue)'), accent, `${id}: --accent-blue takma adı aynı renk`);
			t.eq(await win.locator('[data-settings-tab=appearance]').evaluate((e) => getComputedStyle(e).backgroundColor), accent, `${id}: seçili sekme vurgu renginde`);
		}
		t.eq(seen.size, 6, '6 vurgu 6 ayrı renk');

		await win.locator('[data-accent-option=purple]').click();
		const purple = await resolved(page, 'var(--accent)');
		// Birincil düğme: Dock'tan Haberler'in ortak "primaryBtn"ı yerine her pencerede bulunan iletişim kutusu düğmesi.
		await page.evaluate(() => {
			const b = document.createElement('button');
			b.id = 'tema-odak';
			b.textContent = 'x';
			document.body.prepend(b);
		});
		// Klavyeyle başlayan odak :focus-visible sayılır (fareyle tıklanan düğme sayılmaz).
		await page.keyboard.press('Tab');
		await page.evaluate(() => document.getElementById('tema-odak').focus());
		t.check(await page.evaluate(() => document.activeElement?.id === 'tema-odak'), 'klavye odağı yoklama düğmesine geldi');
		t.eq(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor), purple, 'odak halkası vurgu renginde');
		t.check((await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)) === 'solid', 'odak halkası çiziliyor');
		await page.evaluate(() => document.getElementById('tema-odak')?.remove());

		await win.locator('[data-theme-option=dark]').click();
		await waitAttr(t, page, 'theme', 'dark', 'koyuya geçildi');
		const purpleDark = await resolved(page, 'var(--accent)');
		t.check(purpleDark !== purple, 'koyu temada vurgu bir ton açılıyor', `${purple} → ${purpleDark}`);
		t.eq(await win.locator('[data-accent-option=purple]').evaluate((e) => getComputedStyle(e).backgroundColor), purpleDark, 'örnek daire de koyu temadaki rengi gösteriyor');
		await t.shot(page, 'vurgu-mor-koyu');
		await reloadDesktop(page);
		t.eq((await attrs(page)).accent, 'purple', 'yenileyince vurgu korundu');
		t.eq(await resolved(page, 'var(--accent)'), purpleDark, 'yenileyince renk aynı');
	});

	await t.step('saydamlık kapalı (varsayılan): hiçbir yerde backdrop-filter yok, yüzeyler opak', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		await openApp(page, 'news');
		await openSettingsTab(page, 'appearance');
		t.eq(await openWindows(page).then((w) => w.length >= 2), true, 'iki pencere açık');
		t.eq(await glassElements(page), [], 'saydamlık kapalı: hesaplanmış backdrop-filter "none" olmayan öğe yok');
		const frame = await page.evaluate(() => {
			const c = getComputedStyle(document.querySelector('[data-window-frame=news]'));
			return { filter: c.backdropFilter, bg: c.backgroundColor };
		});
		t.eq(frame.filter, 'none', 'pencere çerçevesi: backdrop-filter none');
		t.check(await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=news]')).contain.includes('layout')), 'pencere, sabit konumlu sayfalarının (Sheet) kapsayıcısı kalıyor: bulanıklık olmasa da contain: layout');
		t.check(/^rgb\(/.test(frame.bg), 'pencere arka planı opak (alfa yok)', frame.bg);
		const bars = await page.evaluate(() => ({
			top: getComputedStyle(document.querySelector('[data-topbar]')).backgroundColor,
			dock: getComputedStyle(document.querySelector('[data-dock]')).backgroundColor,
		}));
		t.check(/^rgb\(/.test(bars.top) && /^rgb\(/.test(bars.dock), 'menü çubuğu ve Dock opak', JSON.stringify(bars));
		await t.shot(page, 'saydamlik-kapali');
	});

	await t.step('saydamlık açık: cam her yerde tek tokendan gelir; sürüklerken kapanır, bırakınca döner; kalıcı', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		await openApp(page, 'news');
		const win = await openSettingsTab(page, 'appearance');
		await win.locator('[data-setting=transparency]').click();
		await waitAttr(t, page, 'transparency', 'on', 'data-transparency="on"');
		t.eq((await stored(page)).transparency, true, 'tercih saklandı');
		const glass = await glassElements(page);
		t.check(glass.includes('header[topbar]') && glass.includes('div[dock]') && glass.includes('div[news]') && glass.includes('div[settings]'), 'menü çubuğu, Dock ve pencereler buzlu', JSON.stringify(glass));
		const css = await page.evaluate(() => {
			const c = getComputedStyle(document.querySelector('[data-window-frame=news]'));
			return { filter: c.backdropFilter, bg: c.backgroundColor, topbar: getComputedStyle(document.querySelector('[data-topbar]')).backgroundColor };
		});
		t.check(css.filter.includes('blur'), 'pencere: blur var', css.filter);
		t.check(/rgba\(/.test(css.bg) && /rgba\(/.test(css.topbar), 'pencere ve menü çubuğu yarı saydam', JSON.stringify(css));
		await t.shot(page, 'saydamlik-acik');

		const idle = await movingState(page, 'news');
		t.check(!idle.moving && idle.blur.includes('blur'), 'sürükleme yokken buzlu', idle.blur);
		const box = await frameBox(page, 'news');
		const from = titlePoint(box);
		await pointerDrag(page, from, { x: from.x + 110, y: from.y + 60 }, { hold: true });
		const during = await movingState(page, 'news');
		t.check(during.moving && during.blur === 'none', 'sürüklerken data-window-moving var ve pencere bulanıklığı kapalı', JSON.stringify(during));
		t.eq((await movingState(page, 'settings')).blur, 'none', 'sürüklerken öteki pencere de opak/bulanıksız');
		await page.mouse.up();
		await settle(page);
		const after = await movingState(page, 'news');
		t.check(!after.moving && after.blur.includes('blur'), 'bırakınca bulanıklık geri geldi', after.blur);

		await reloadDesktop(page);
		t.eq((await attrs(page)).transparency, 'on', 'yenileyince saydamlık açık kaldı');
		const win2 = await openSettingsTab(page, 'appearance');
		t.eq(await win2.locator('[data-setting=transparency]').getAttribute('aria-checked'), 'true', 'anahtar açık görünüyor');
		await win2.locator('[data-setting=transparency]').click();
		await waitAttr(t, page, 'transparency', 'off', 'anahtar kapatılınca anında kapanır');
		await page.waitForTimeout(400);
		t.eq(await glassElements(page), [], 'kapatınca hiçbir yerde cam kalmadı');
	});

	await t.step('hareketi azalt: anahtar animasyonları kısaltır; varsayılan sistemin prefers-reduced-motion\'ı', async () => {
		const { page } = await t.open('can', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		const dur = () => page.evaluate(() => getComputedStyle(document.querySelector('[data-dock] button')).transitionDuration);
		t.eq((await attrs(page)).motion, 'full', 'başlangıçta tam hareket');
		const full = await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=settings]')).animationDuration);
		await win.locator('[data-setting=reduce-motion]').click();
		await waitAttr(t, page, 'motion', 'reduce', 'anahtar: data-motion="reduce"');
		t.check(parseFloat(await dur()) <= 0.01, 'Dock/pencere geçişleri ~0 sn', await dur());
		await page.locator('[data-dock-app=news]').click();
		await page.locator('[data-window-frame=news]').waitFor();
		const anim = await page.evaluate(() => getComputedStyle(document.querySelector('[data-window-frame=news]')).animationDuration);
		t.check(parseFloat(anim) <= 0.01, 'pencere açılış animasyonu kısaldı', `${full} → ${anim}`);
		t.eq((await stored(page)).reduceMotion, true, 'tercih saklandı');
		await reloadDesktop(page);
		t.eq((await attrs(page)).motion, 'reduce', 'yenileyince korundu');

		// Sistem varsayılanı: hiç dokunulmamış tercih sistemi izler; açık seçim sistemi geçersiz kılar.
		const fresh = await t.open('can', { colorScheme: 'light' });
		await fresh.page.emulateMedia({ reducedMotion: 'reduce' });
		await waitAttr(t, fresh.page, 'motion', 'reduce', 'dokunulmamış tercih: sistem "hareketi azalt" derse azaltılır (anında)');
		const w2 = await openSettingsTab(fresh.page, 'appearance');
		t.eq(await w2.locator('[data-setting=reduce-motion]').getAttribute('aria-checked'), 'true', 'anahtar sistemin değerini gösteriyor');
		await w2.locator('[data-setting=reduce-motion]').click();
		await waitAttr(t, fresh.page, 'motion', 'full', 'sistem azaltsa da kullanıcı kapatabilir');
		await fresh.page.emulateMedia({ reducedMotion: 'no-preference' });
		await fresh.page.emulateMedia({ reducedMotion: 'reduce' });
		await fresh.page.waitForTimeout(200);
		t.eq((await attrs(fresh.page)).motion, 'full', 'açık seçim sistem değişiminden etkilenmez');
	});

	await t.step('açılış flaşı yok: koyu tercihte ilk boyamadan önce koyu; <html> hiç açık görünmez', async () => {
		for (const [name, prefs, scheme] of [
			['kayıtlı koyu tercih', { theme: 'dark' }, 'light'],
			['Sistem + koyu işletim sistemi (kayıt yok)', null, 'dark'],
		]) {
			const context = t.track(await newContext(t.browser, { prefs, colorScheme: scheme }));
			await context.addInitScript(() => {
				// Belge başlarken <html> henüz olmayabilir: belgenin kendisini izle.
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
			t.check(info.first?.theme === 'dark', `${name}: ilk karede data-theme="dark"`, JSON.stringify(info.first));
			t.check(info.seen.length > 0 && info.seen.every((v) => v === 'dark'), `${name}: data-theme hiçbir zaman açık olmadı`, JSON.stringify(info.seen));
			// Giriş ekranı çizilmiş hâliyle koyu: sayfanın ortalama parlaklığı düşük.
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
			t.check(mean < 0.45, `${name}: ilk ekran görüntüsü koyu (ort. parlaklık ${mean.toFixed(2)})`);
			await t.shot(page, `ilk-boyama-${name}`);
		}
	});

	await t.step('gizli pencere: localStorage okunamazsa sessizce varsayılana düşer', async () => {
		const context = t.track(await newContext(t.browser, { colorScheme: 'dark' }));
		await context.addInitScript(() => {
			// Çerezleri kapalı tarayıcıdaki gibi: localStorage'a erişmek bile SecurityError fırlatır.
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
		t.check(JSON.stringify(got) === JSON.stringify({ theme: 'dark', accent: 'blue', transparency: 'off', motion: 'full' }), 'okuma hatasında varsayılanlar (Sistem = koyu işletim sistemi) yazıldı', `${JSON.stringify(got)} ${JSON.stringify(errors)} ${page.url()}`);
		t.eq(errors.filter((m) => /kulup_theme|SecurityError|denied/.test(m) && /theme|boot/i.test(m)), [], 'tema kodu hata fırlatmadı');
	});

	await t.step('rol boyutu: "Sadece Haberler" rolü de Görünüm ayarlarını değiştirebilir ve kalıcıdır', async () => {
		const { page } = await t.open('okur', { colorScheme: 'light' });
		const win = await openSettingsTab(page, 'appearance');
		t.eq(await win.locator('[data-theme-option]').count(), 3, 'tema kartları görünüyor');
		await win.locator('[data-theme-option=dark]').click();
		await win.locator('[data-accent-option=green]').click();
		await win.locator('[data-setting=transparency]').click();
		await win.locator('[data-setting=reduce-motion]').click();
		t.eq(await attrs(page), { theme: 'dark', accent: 'green', transparency: 'on', motion: 'reduce' }, 'dördü de anında uygulandı');
		await reloadDesktop(page);
		t.eq(await attrs(page), { theme: 'dark', accent: 'green', transparency: 'on', motion: 'reduce' }, 'yenileyince hepsi korundu');
		await t.shot(page, 'okur-gorunum');
	});

	await t.step('"Oturumu sıfırla" görünümü varsayılana döndürür; duvar kağıdı tek katalogdan döner', async () => {
		const { page } = await t.open('can', { colorScheme: 'light', prefs: { theme: 'dark', accent: 'pink', transparency: true, reduceMotion: true } });
		t.eq(await attrs(page), { theme: 'dark', accent: 'pink', transparency: 'on', motion: 'reduce' }, 'tohumlanan tercihler uygulandı');

		// Sonraki duvar kağıdı: katalogdaki sıra (3B Aurora → Ventura Light).
		await page.evaluate(() => localStorage.setItem('kulup_active_wallpaper', '3d-aurora'));
		await reloadDesktop(page);
		await rightClickDesktop(page);
		await page.locator('[data-menu-item=dt-next-wallpaper]').click();
		t.eq(await page.evaluate(() => localStorage.getItem('kulup_active_wallpaper')), '/wallpapers/ventura-2.webp', 'sonraki duvar kağıdı kataloğun ikincisi');

		const win = await openSettingsTab(page, 'storage');
		await win.getByRole('button', { name: 'Reset Session' }).click();
		await dialogCevapla(page, true);
		await waitAttr(t, page, 'accent', 'blue', 'sıfırlayınca vurgu mavi');
		t.eq(await stored(page), { theme: 'system', accent: 'blue', transparency: false, reduceMotion: null }, 'tercihler varsayılana döndü');
		t.eq(await page.evaluate(() => localStorage.getItem('kulup_active_wallpaper')), '3d-aurora', 'duvar kağıdı varsayılana döndü');
	});
}
