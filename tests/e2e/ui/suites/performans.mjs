// Performans ölçümü (isteğe bağlı: yalnız `pnpm e2e performans` ile koşar).
//
// 3B duvar kağıdı açık (kendi Chrome'u, WebGL açık) üç durum ölçülür: boş masaüstü,
// 3 pencere + 3B, 3 pencere varken pencere sürükleme. Her biri için rAF ile FPS ve kare
// süreleri, React DevTools kancasıyla commit sayısı ve uzun görevler. Sonuç bir tablo olarak
// basılır ve tests/e2e/.tmp/perf-<tarih>.json dosyasına yazılır (#11 öncesi/sonrası karşılaştırması için).
//
// Eşikler bilerek gevşek; gerekçeleri aşağıda `FLOOR` yanında.
import { SESSION_COOKIE } from '../lib/api.mjs';
import { newContext, openApp, openWindows, waitDesktop } from '../lib/browser.mjs';
import { frameBox, rightClickDesktop, titlePoint } from '../lib/desktop.mjs';
import { installProbe, launchWebglBrowser, machine, measure, printTable, reactHooked, webglInfo, writeReport } from '../lib/perf.mjs';

export const meta = { title: 'Performans: FPS ve React commit sayımı (3B açık) — yalnız adıyla koşar', optIn: true };

const MEASURE_MS = 5000;
// Saydamlık varsayılan olarak kapalıdır (#8). `PERF_TRANSPARENCY=on pnpm e2e performans` buzlu camı açıp ölçer.
const TRANSPARENCY = process.env.PERF_TRANSPARENCY === 'on';

const FLOOR = {
	// Takılma/donma yakalayıcısı, akıcılık hedefi değil. Ölçüm (16 çekirdek, yük ~4.5, SwiftShader):
	// pencereler açıkken 3B sahne dondurulur ve sayfa 59-60 FPS çizer; yarısı taban seçildi.
	fps: 30,
	// Boş masaüstünde 3B sahne çalışır; yazılım GPU'sunda (SwiftShader/llvmpipe) sahne bir kareyi
	// ~300 ms'de çizer (~3 FPS) ve bu ortamın sınırıdır, uygulamanın değil: orada yalnız raporlanır,
	// donanım GPU'sunda aynı `fps` tabanı uygulanır.
	softwareGpu: /swiftshader|llvmpipe|software/i,
	// Sürükleme pencereyi stil yazarak taşır, masaüstünü yeniden çizdirmez: 5 sn'lik, ~140 hareketli
	// bir sürüklemede 10 commit ölçüldü (basma, odak, bırakma, saat). Kare hızından bağımsız, olay
	// sayısına bağlı; hareket başına commit'e dönülürse (eski davranış) yüzlerce olur.
	dragCommits: 20,
};

async function openMeasured(t, browser, key) {
	const c = await t.api(key);
	const context = t.track(await newContext(browser, { prefs: TRANSPARENCY ? { transparency: true } : null }));
	await installProbe(context);
	await context.addCookies([{ name: SESSION_COOKIE, value: c.token, url: t.base }]);
	const page = await context.newPage();
	await page.goto(t.base, { waitUntil: 'domcontentloaded', timeout: 90_000 });
	await waitDesktop(page);
	return page;
}

async function closeAll(page) {
	if ((await openWindows(page)).length === 0) return;
	await rightClickDesktop(page);
	await page.locator('[data-menu-item=dt-arrange-windows]').hover();
	await page.locator('[data-menu-item=dt-close-all]').click();
	await page.waitForFunction(() => document.querySelectorAll('[data-window-frame]').length === 0, null, { timeout: 5000 }).catch(() => {});
}

/** Pencereyi başlığından tutup ~`ms` boyunca daire çizdirir (her ~16 ms'de bir hareket). */
async function circleDrag(page, appId, ms) {
	const box = await frameBox(page, appId);
	const c = titlePoint(box);
	await page.mouse.move(c.x, c.y);
	await page.mouse.down();
	const start = Date.now();
	let moves = 0;
	while (Date.now() - start < ms) {
		const a = (Date.now() - start) / 600;
		await page.mouse.move(c.x + Math.round(120 * Math.cos(a)) - 120, c.y + 150 + Math.round(90 * Math.sin(a)));
		moves++;
		await page.waitForTimeout(16);
	}
	await page.mouse.up();
	return moves;
}

export default async function suite(t) {
	const browser = await launchWebglBrowser();
	t.cleanup(() => browser.close());
	const rows = [];
	const report = { schema: 1, date: new Date().toISOString(), transparency: TRANSPARENCY, base: t.base, viewport: t.viewport.DESKTOP, measureMs: MEASURE_MS, machine: machine(browser), webgl: null, scenarios: [] };
	const record = (scenario, m, extra = {}) => {
		const row = { scenario, ...m, ...extra };
		rows.push(row);
		report.scenarios.push(row);
		return row;
	};

	await t.step('admin: boş masaüstü, 3 pencere + 3B, sürükleme', async () => {
		const page = await openMeasured(t, browser, 'admin');
		const gl = await webglInfo(page);
		report.webgl = gl.renderer || null;
		t.check(await reactHooked(page), 'React DevTools kancasına bağlandı (commit sayımı geçerli)');

		await closeAll(page);
		await page.waitForTimeout(2500);
		const scene = await webglInfo(page);
		if (gl.renderer) t.check(scene.scene, `boş masaüstünde 3B sahne çalışıyor (${gl.renderer})`);
		else console.log('  not: WebGL yok; 3B sahne ölçülemedi, ölçümler statik arka planla');
		const idle = record('bos-masaustu', await measure(page, MEASURE_MS), { scene: scene.scene });
		await t.shot(page, 'bos-masaustu');

		for (const id of ['teams', 'news', 'notes']) await openApp(page, id);
		await page.locator('[data-window-frame=notes] [data-app-id]').waitFor();
		await page.waitForTimeout(2500);
		t.eq((await openWindows(page)).length, 3, '3 pencere açık');
		const three = record('3-pencere-3b', await measure(page, MEASURE_MS), { scene: (await webglInfo(page)).scene });
		await t.shot(page, '3-pencere');

		let moves = 0;
		const drag = record('surukleme', await measure(page, MEASURE_MS, async () => {
			moves = await circleDrag(page, 'news', MEASURE_MS - 300);
		}));
		drag.pointerMoves = moves;
		t.check(moves > 50, `sürükleme boyunca ${moves} imleç hareketi`);

		const software = FLOOR.softwareGpu.test(gl.renderer) || !gl.renderer;
		if (software) console.log(`  not: yazılım GPU'su (${gl.renderer || 'WebGL yok'}): 3B sahnenin çalıştığı boş masaüstü FPS'i (${idle.fps}) yalnız raporlanır`);
		else t.check(idle.fps >= FLOOR.fps, `boş masaüstü (3B çalışıyor): ${idle.fps} FPS >= gevşek taban ${FLOOR.fps}`, JSON.stringify(idle));
		report.softwareGpu = software;
		for (const [name, m] of [['3 pencere + 3B', three], ['sürükleme', drag]]) {
			t.check(m.fps >= FLOOR.fps, `${name}: ${m.fps} FPS >= gevşek taban ${FLOOR.fps}`, JSON.stringify(m));
		}
		t.check(drag.commits <= FLOOR.dragCommits, `sürükleme: ${drag.commits} React commit'i (${moves} hareket) <= ${FLOOR.dragCommits}`);
	});

	await t.step('rol: Sadece Haberler kullanıcısının boş masaüstü; 3 pencere açamaz', async () => {
		const page = await openMeasured(t, browser, 'okur');
		const dock = await page.locator('[data-dock-app]').count();
		t.eq(dock, 2, 'okur Dock\'ta yalnız 2 uygulama görüyor: 3 pencereli senaryo bu rol için kurulamaz');
		await page.waitForTimeout(2500);
		const gl = await webglInfo(page);
		const m = record('okur-bos-masaustu', await measure(page, MEASURE_MS), { scene: gl.scene });
		if (!FLOOR.softwareGpu.test(gl.renderer) && gl.renderer) t.check(m.fps >= FLOOR.fps, `okur boş masaüstü: ${m.fps} FPS >= ${FLOOR.fps}`);
		t.check(m.commitsPerSecond < 5, `okur boş masaüstü boşta: ${m.commitsPerSecond} commit/sn (< 5; boşta yeniden çizim yok)`);
	});

	console.log(`\n  Performans (${report.machine.cpus} çekirdek, yük ${report.machine.loadAverage.join('/')}, WebGL: ${report.webgl ?? 'yok'})`);
	printTable(rows);
	const file = writeReport(report);
	console.log(`  JSON: ${file}`);
	t.check(Boolean(file), 'ölçüm JSON dosyası yazıldı');
}
