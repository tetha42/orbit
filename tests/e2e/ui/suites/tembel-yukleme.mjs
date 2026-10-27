// Tembel yükleme: uygulama bileşenleri masaüstüyle birlikte indirilmez; bir uygulama ilk
// açıldığında kendi parçası (chunk) gelir, yeniden açılınca bir daha gelmez; bir rolün
// açamadığı uygulamanın kodu hiç indirilmez; bütün uygulamalar hatasız açılır.
//
// Ölçüm iki katmanlı: (1) paketleyiciden bağımsız: yeni JS isteği sayısı; (2) geliştirme
// sunucusunun (Turbopack) parçalarında modül tanımı ("[project]/…/NewsApp.tsx … (ecmascript)",
// yükleyici kaydı değil). (2) ilk açılan uygulamada görülemezse (başka paketleyici, üretim
// derlemesi) o kontroller "ölçülemedi" diye yazılır ve yalnız (1) denetlenir.
import { newContext, openApp, openWindows, waitDesktop } from '../lib/browser.mjs';
import { SESSION_COOKIE } from '../lib/api.mjs';
import { watchPage } from '../lib/desktop.mjs';

export const meta = { title: 'Tembel yükleme: uygulama kodu açılınca gelir, rolün açamadığı hiç gelmez, hata yok' };

const FILES = {
	teams: 'TeamsApp',
	events: 'EventsApp',
	budget: 'BudgetApp',
	decisions: 'DecisionsApp',
	certificates: 'CertificatesApp',
	inventory: 'InventoryApp',
	members: 'MemberDirectoryApp',
	notes: 'NotesApp',
	news: 'NewsApp',
	settings: 'SettingsApp',
	terminal: 'TerminalApp',
	projects: 'ProjectsApp',
	mail: 'MailApp',
};

/** Hata sayılmayan gürültü: WebGL testlerde kapalı, 3B arka plan statik görüntüye düşer. */
const NOISE = ['WebGL', 'webgl', '3D background'];

/** Sayfanın indirdiği JS dosyalarını ve içlerinde tanımlanan uygulama modüllerini izler. */
function trackScripts(page) {
	const urls = new Set();
	const defined = new Set();
	const pending = [];
	page.on('response', (res) => {
		const url = res.url().split('?')[0];
		if (!/\.js$/.test(url) || res.status() >= 400) return;
		urls.add(url);
		pending.push(
			res
				.text()
				.then((body) => {
					for (const [id, file] of Object.entries(FILES)) {
						if (body.includes(`WorkspaceApps/${file}.tsx [app-client] (ecmascript)", ((`)) defined.add(id);
					}
				})
				.catch(() => {})
		);
	});
	return {
		urls,
		defined,
		/** Ağ durulana kadar bekler (yarım saniye yeni JS gelmeyince). */
		async settle(page) {
			let last = -1;
			for (let i = 0; i < 40 && last !== urls.size; i++) {
				last = urls.size;
				await page.waitForTimeout(500);
			}
			await Promise.all(pending);
		},
	};
}

/** `key` hesabıyla oturum açmış bir sayfa; JS izleme sayfa yüklenmeden önce başlar. */
async function openTracked(t, key) {
	const c = await t.api(key);
	const context = t.track(await newContext(t.browser));
	await context.addCookies([{ name: SESSION_COOKIE, value: c.token, url: t.base }]);
	const page = await context.newPage();
	const js = trackScripts(page);
	await page.goto(t.base, { waitUntil: 'domcontentloaded', timeout: 90_000 });
	await waitDesktop(page);
	return { page, js };
}

/** Pencere içeriği yükleme yer tutucusundan çıktı mı (her uygulama kendi arayüzünü çizdi mi). */
const rendered = (page, appId) =>
	page.locator(`[data-window-frame=${appId}]`).evaluate((el) => !el.querySelector('[data-app-loading]') && (el.querySelector('[data-app-id]')?.childElementCount ?? 0) > 0);

export default async function suite(t) {
	await t.step('okur: uygulama kodu açılınca gelir, yeniden açılınca gelmez, izinsiz kod hiç gelmez', async () => {
		const { page, js } = await openTracked(t, 'okur');
		await js.settle(page);
		t.eq(await openWindows(page), [], 'okur masaüstü boş açıldı (kurulum)');
		const atStart = new Set(js.urls);

		await openApp(page, 'news');
		t.check((await t.waitFor(() => rendered(page, 'news'), { timeout: 30_000 })) >= 0, 'Haberler penceresi içeriğini çizdi');
		await js.settle(page);
		const afterNews = [...js.urls].filter((u) => !atStart.has(u));
		t.check(afterNews.length > 0, `Haberler ilk açılışta yeni JS indirdi (${afterNews.length} dosya)`);

		// Paketleyici modül tanımını görünür kılıyor mu (geliştirme sunucusu: evet)?
		const measurable = js.defined.size > 0;
		if (measurable) t.check(js.defined.has('news'), 'Haberler modülü açılınca tanımlandı');
		else console.log('  not: modül tanımı bu paketleyicide görünmüyor; yalnız istek sayısı denetlendi');

		// Kapat → aç: yeni indirme yok.
		await page.locator('[data-window-frame=news] [data-window-control=close]').click();
		await page.locator('[data-window-frame=news]').waitFor({ state: 'detached' }).catch(() => {});
		const beforeReopen = js.urls.size;
		await openApp(page, 'news');
		await js.settle(page);
		t.eq(js.urls.size, beforeReopen, 'yeniden açılan Haberler için yeni JS indirilmedi');

		await openApp(page, 'settings');
		t.check((await t.waitFor(() => rendered(page, 'settings'), { timeout: 30_000 })) >= 0, 'Ayarlar penceresi içeriğini çizdi');
		await js.settle(page);
		t.check(js.urls.size > beforeReopen, 'Ayarlar ilk açılışta kendi JS dosyasını indirdi');

		if (measurable) {
			t.check(js.defined.has('settings'), 'Ayarlar modülü açılınca tanımlandı');
			const others = Object.keys(FILES).filter((id) => id !== 'news' && id !== 'settings');
			t.sameSet([...js.defined].filter((id) => others.includes(id)), [], 'Sadece Haberler kullanıcısının tarayıcısına başka hiçbir uygulamanın kodu inmedi');
		}
		await t.shot(page, 'okur-haber-ayarlar');
	});

	await t.step('admin: masaüstü açılırken yalnız açık pencerenin kodu gelir; bütün uygulamalar hatasız açılır', async () => {
		const { page, js } = await openTracked(t, 'admin');
		const watch = watchPage(page, { ignore: NOISE });
		await js.settle(page);
		const open = await openWindows(page);
		if (js.defined.size > 0 || open.length > 0) {
			const extra = [...js.defined].filter((id) => !open.includes(id));
			t.sameSet(extra, [], `açılışta yalnız açık pencerelerin (${open.join(', ') || 'yok'}) kodu tanımlandı`);
		}
		const apps = await page.locator('[data-dock-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-app')));
		t.check(apps.length >= 10, `admin Dock'ta ${apps.length} uygulama`);
		for (const id of apps) {
			await openApp(page, id);
			const ok = (await t.waitFor(() => rendered(page, id), { timeout: 30_000 })) >= 0;
			t.check(ok, `${id}: açıldı ve içeriğini çizdi`);
			// Açılan pencere ötekilerin üstünü kapatmasın diye kapatılır; kod önbellekte kalır.
			await page.locator(`[data-window-frame=${id}] [data-window-control=close]`).click();
		}
		await js.settle(page);
		if (js.defined.size > 0) t.sameSet([...js.defined].filter((id) => apps.includes(id)), apps, 'açılan her uygulamanın modülü tanımlandı');
		t.eq(watch.problems, [], 'uygulamalar açılırken konsol hatası, yakalanmamış istisna ya da başarısız JS isteği yok');
		watch.stop();
		await t.shot(page, 'admin-hepsi-acildi');
	});
}
