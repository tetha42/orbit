// Pencere yöneticisi: sürükleme, sürüklerken bulanıklığın kapanması, boyutlandırma,
// kenara yapışma, öne gelme, trafik ışıkları ve kalıcılık. Yalnız ekranda görünenle ölçer
// (kutular, `data-` öznitelikleri); uygulamanın iç durumuna bağlı değildir.
import { openApp, openWindows, waitDesktop } from '../lib/browser.mjs';
import { SAVE_MS, dragWindow, frameBox, movingState, pointerDrag, reloadDesktop, resizeWindow, settle, swapSession, titlePoint, windowAt, windowControl } from '../lib/desktop.mjs';

export const meta = { title: 'Pencere yöneticisi: sürükleme, bulanıklık, boyut, yapışma, kalıcılık' };

const VW = 1440;

export default async function suite(t) {
	await t.step('sürükleme: pencere imleçle birlikte gider, boyutu değişmez', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const before = await frameBox(page, 'news');
		const after = await dragWindow(page, 'news', 160, 90);
		t.eq({ x: after.x, y: after.y }, { x: before.x + 160, y: before.y + 90 }, 'pencere tam imleç kadar kaydı');
		t.eq({ w: after.width, h: after.height }, { w: before.width, h: before.height }, 'sürükleme boyutu değiştirmedi');
		const back = await dragWindow(page, 'news', -160, -90);
		t.eq({ x: back.x, y: back.y }, { x: before.x, y: before.y }, 'geri sürüklenince eski yerine döndü');
		await t.shot(page, 'surukleme');
	});

	await t.step('sürüklerken bulanıklık kapanır, bırakınca geri gelir', async () => {
		// Saydamlık varsayılan olarak kapalı; buzlu cam yalnız açıkken vardır (tema paketi kapalı hâli sınar).
		const { page } = await t.open('can', { prefs: { transparency: true } });
		await openApp(page, 'news');
		const idle = await movingState(page, 'news');
		t.check(!idle.moving, 'sürükleme yokken [data-window-moving] yok');
		t.check(idle.blur !== 'none' && idle.blur.includes('blur'), 'sürükleme yokken pencere arka planı buzlu', idle.blur);

		const box = await frameBox(page, 'news');
		const from = titlePoint(box);
		await pointerDrag(page, from, { x: from.x + 120, y: from.y + 70 }, { hold: true });
		const during = await movingState(page, 'news');
		t.check(during.moving, 'sürüklerken [data-window-moving] var');
		t.eq(during.blur, 'none', 'sürüklerken pencere bulanıklığı kapalı');
		const other = await movingState(page, 'teams');
		t.eq(other.blur, 'none', 'sürüklerken öteki açık pencerenin de bulanıklığı kapalı');
		await t.shot(page, 'surukleme-sirasinda');
		await page.mouse.up();
		await settle(page);
		const after = await movingState(page, 'news');
		t.check(!after.moving, 'bırakınca [data-window-moving] kalktı');
		t.check(after.blur.includes('blur'), 'bırakınca bulanıklık geri geldi', after.blur);

		// Bırakma pencerenin dışında olsa da (imleç köşeye gitti) durum takılı kalmaz.
		const box2 = await frameBox(page, 'news');
		const p2 = titlePoint(box2);
		await pointerDrag(page, p2, { x: VW - 60, y: 600 }, { hold: true });
		t.check((await movingState(page, 'news')).moving, 'ikinci sürüklemede de işaret kondu');
		await page.mouse.up();
		await settle(page);
		t.check(!(await movingState(page, 'news')).moving, 'pencere dışında bırakınca da işaret kalktı');
	});

	await t.step('boyutlandırma: köşe ve kenarlar, alt sınır', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const b0 = await frameBox(page, 'news');

		const se = await resizeWindow(page, 'news', 'se', 100, 60);
		t.eq({ x: se.x, y: se.y, w: se.width, h: se.height }, { x: b0.x, y: b0.y, w: b0.width + 100, h: b0.height + 60 }, 'sağ-alt köşe: boyut büyüdü, yer sabit');

		const nw = await resizeWindow(page, 'news', 'nw', -50, -30);
		t.eq({ x: nw.x, y: nw.y, w: nw.width, h: nw.height }, { x: se.x - 50, y: se.y - 30, w: se.width + 50, h: se.height + 30 }, 'sol-üst köşe: yer ve boyut birlikte değişti');

		const e = await resizeWindow(page, 'news', 'e', 40, 0);
		t.eq({ w: e.width, h: e.height }, { w: nw.width + 40, h: nw.height }, 'doğu kenarı yalnız genişliği değiştirdi');
		const s = await resizeWindow(page, 'news', 's', 0, -40);
		t.eq({ w: s.width, h: s.height }, { w: e.width, h: e.height - 40 }, 'güney kenarı yalnız yüksekliği değiştirdi');
		const w = await resizeWindow(page, 'news', 'w', 30, 0);
		t.eq({ x: w.x, w: w.width }, { x: s.x + 30, w: s.width - 30 }, 'batı kenarı soldan daralttı');

		const tiny = await resizeWindow(page, 'news', 'e', -2000, 0);
		t.check(tiny.width >= 300 && tiny.width < w.width, 'çok daraltılınca pencere alt sınırda durdu, kaybolmadı', `genişlik ${tiny.width}`);
		const again = await resizeWindow(page, 'news', 'e', -300, 0);
		t.eq(again.width, tiny.width, 'alt sınırdan öteye gitmedi');
		await t.shot(page, 'boyutlandirma');
	});

	await t.step('kenara yapışma: sol, sağ, üst (büyüt) ve köşeler; çift tıkla geri', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const free = await frameBox(page, 'news');

		// Üst kenar: büyütür.
		await pointerDrag(page, titlePoint(free), { x: 700, y: 10 });
		const max = await frameBox(page, 'news');
		t.eq({ x: max.x, w: max.width }, { x: 0, w: VW }, 'üst kenara bırakınca pencere tüm genişliği kapladı');

		// Başlığa tek tıklamak büyütülmüş pencereyi bozmaz; çift tıklamak geri alır.
		await page.mouse.click(titlePoint(max).x, titlePoint(max).y);
		t.eq((await frameBox(page, 'news')).width, VW, 'büyütülmüş pencerenin başlığına tek tıklamak boyutu değiştirmedi');
		await page.mouse.dblclick(titlePoint(max).x, titlePoint(max).y);
		const restored = await frameBox(page, 'news');
		t.check(restored.width < VW, 'başlığa çift tıklayınca büyütme geri alındı', `genişlik ${restored.width}`);

		// Sol kenar: ekranın yarısı.
		await pointerDrag(page, titlePoint(restored), { x: 5, y: 450 });
		const left = await frameBox(page, 'news');
		t.eq({ x: left.x, w: left.width }, { x: 0, w: VW / 2 }, 'sol kenara bırakınca sol yarıya yapıştı');
		t.eq(left.height, max.height, 'sol yarı büyütülmüş pencerenin yüksekliğinde');
		await t.shot(page, 'sola-yapisti');

		await page.mouse.click(titlePoint(left).x, titlePoint(left).y);
		t.eq(await frameBox(page, 'news'), left, 'yapışık pencerenin başlığına tek tıklamak yapışmayı bozmadı');

		// Yapışık pencereyi çekince serbest boyutuna döner.
		await pointerDrag(page, titlePoint(left), { x: 700, y: 300 });
		const floating = await frameBox(page, 'news');
		t.check(floating.width !== VW / 2 && floating.width < VW, 'yapışık pencere çekilince yarım boyuttan çıktı', `genişlik ${floating.width}`);

		// Sağ kenar.
		await pointerDrag(page, titlePoint(floating), { x: VW - 5, y: 450 });
		const right = await frameBox(page, 'news');
		t.check(Math.abs(right.x - VW / 2) <= 1 && Math.abs(right.width - VW / 2) <= 1, 'sağ kenara bırakınca sağ yarıya yapıştı', JSON.stringify(right));

		// Köşeler: çeyrek.
		await pointerDrag(page, titlePoint(right), { x: 700, y: 300 });
		const f2 = await frameBox(page, 'news');
		await pointerDrag(page, titlePoint(f2), { x: 30, y: 30 });
		const tl = await frameBox(page, 'news');
		t.check(tl.x === 0 && tl.width === VW / 2 && tl.height < max.height * 0.75 && tl.y === max.y, 'sol-üst köşe: çeyrek (üstte)', JSON.stringify(tl));

		await pointerDrag(page, titlePoint(tl), { x: 700, y: 300 });
		const f3 = await frameBox(page, 'news');
		await pointerDrag(page, titlePoint(f3), { x: VW - 30, y: 870 });
		const br = await frameBox(page, 'news');
		t.check(br.x === VW / 2 && br.width === VW / 2 && br.y > 100 && br.height < max.height * 0.75, 'sağ-alt köşe: çeyrek (altta)', JSON.stringify(br));

		// Klavye: Ctrl+Alt+Sol sola yaslar, aynı tuş geri alır.
		await pointerDrag(page, titlePoint(br), { x: 700, y: 300 });
		await page.keyboard.press('Control+Alt+ArrowLeft');
		await settle(page);
		const key = await frameBox(page, 'news');
		t.eq({ x: key.x, w: key.width }, { x: 0, w: VW / 2 }, 'Ctrl+Alt+← pencereyi sol yarıya yasladı');
	});

	await t.step('hızlı bırakma: son kare çizilmeden bırakılsa da pencere imlecin bırakıldığı yere iner', async () => {
		// Bir hareket ve hemen bırakma: hareketin kare beklemesine (rAF) fırsat kalmaz.
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const before = await frameBox(page, 'news');
		const from = titlePoint(before);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move(from.x + 90, from.y + 60);
		await page.mouse.up();
		const moved = await frameBox(page, 'news');
		t.eq({ x: moved.x, y: moved.y }, { x: before.x + 90, y: before.y + 60 }, 'hızlı sürüklemede pencere bırakılan yere indi');

		const p2 = titlePoint(moved);
		await page.mouse.move(p2.x, p2.y);
		await page.mouse.down();
		await page.mouse.move(700, 10);
		await page.mouse.up();
		t.eq((await frameBox(page, 'news')).width, VW, 'hızlıca üst kenara bırakılan pencere büyüdü');
	});

	await t.step('öne gelme ve trafik ışıkları', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const news = await frameBox(page, 'news');
		const teams = await frameBox(page, 'teams');
		// İki pencerenin üst üste bindiği bir nokta.
		const px = Math.max(news.x, teams.x) + 40;
		const py = Math.max(news.y, teams.y) + 80;
		t.check(px < Math.min(news.x + news.width, teams.x + teams.width) && py < Math.min(news.y + news.height, teams.y + teams.height), 'iki pencere üst üste biniyor (test varsayımı)');
		t.eq(await windowAt(page, px, py), 'news', 'en son açılan pencere üstte');
		await page.mouse.click(titlePoint(teams).x, titlePoint(teams).y);
		t.eq(await windowAt(page, px, py), 'teams', 'başlığına tıklanan pencere öne geldi');

		await windowControl(page, 'news', 'minimize');
		await page.waitForTimeout(250);
		t.excludes(await openWindows(page), 'news', 'küçült: pencere gizlendi');
		await page.locator('[data-dock-app=news]').click();
		await page.waitForTimeout(250);
		t.includes(await openWindows(page), 'news', 'Dock simgesine tıklayınca küçültülen pencere döndü');

		await windowControl(page, 'news', 'maximize');
		t.eq((await frameBox(page, 'news')).width, VW, 'yeşil düğme büyüttü');
		await windowControl(page, 'news', 'maximize');
		t.check((await frameBox(page, 'news')).width < VW, 'yeşil düğme ikinci basışta geri aldı');

		await windowControl(page, 'news', 'close');
		await page.waitForTimeout(250);
		t.excludes(await openWindows(page), 'news', 'kapat: pencere kalktı');
		t.includes(await openWindows(page), 'teams', 'öteki pencere yerinde');
	});

	await t.step('kalıcılık: yer, boyut, büyütme ve kapatma yeniden yüklemeden sonra korunur', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		await dragWindow(page, 'news', 120, 80);
		const sized = await resizeWindow(page, 'news', 'se', 70, 50);
		const teamsBefore = await frameBox(page, 'teams');
		await page.waitForTimeout(SAVE_MS);
		await reloadDesktop(page, 'news');
		const news = await frameBox(page, 'news');
		t.eq(news, sized, 'sürüklenip boyutlandırılan pencere aynı yerde ve boyutta döndü');
		t.eq(await frameBox(page, 'teams'), teamsBefore, 'dokunulmayan pencere de yerinde');

		await windowControl(page, 'news', 'maximize');
		await page.waitForTimeout(SAVE_MS);
		await reloadDesktop(page, 'news');
		t.eq((await frameBox(page, 'news')).width, VW, 'büyütülmüş pencere büyük döndü');

		await windowControl(page, 'news', 'maximize');
		t.check((await frameBox(page, 'news')).width < VW, 'büyütülmüş pencere düğmeyle geri alındı');
		await windowControl(page, 'teams', 'close');
		await page.waitForTimeout(SAVE_MS);
		await reloadDesktop(page);
		t.excludes(await openWindows(page), 'teams', 'kapatılan pencere yeniden yüklemede açılmadı');
		t.includes(await openWindows(page), 'news', 'açık kalan pencere döndü');
		await t.shot(page, 'kalicilik');
	});

	await t.step('rol: kaydedilmiş pencere durumu rolün açamadığı uygulamayı geri getirmez', async () => {
		// Yönetim kurulu üyesi bütçe ve takım pencerelerini açık bırakır; aynı tarayıcıda
		// "Sadece Haberler" rolüyle oturum açılınca o pencereler görünmez, haber penceresi açılabilir.
		const { page, context } = await t.open('zeynep');
		await openApp(page, 'budget');
		await page.waitForTimeout(SAVE_MS);
		t.includes(await openWindows(page), 'budget', 'kurul üyesinde bütçe penceresi açık (kurulum)');

		const okur = await t.api('okur');
		await swapSession(context, t.base, okur.token);
		await reloadDesktop(page);
		await waitDesktop(page);
		const shown = await openWindows(page);
		t.sameSet(shown.filter((a) => a !== 'settings' && a !== 'news'), [], 'Sadece Haberler kullanıcısı yetkisi olmayan hiçbir pencere görmüyor', JSON.stringify(shown));
		t.sameSet(await page.locator('[data-dock-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-app'))), ['news', 'settings'], 'Dock yalnız izinli uygulamalar');
		await t.shot(page, 'rol-okur-kayitli-durum');
	});
}
