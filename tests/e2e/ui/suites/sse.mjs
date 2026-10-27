// Canlı olaylar (SSE, /api/olaylar) ve PostgreSQL NOTIFY: rol değişimi saniyeler içinde açık oturuma
// yansır (15 sn'lik yoklama beklenmeden), iki sunucu süreci aynı veritabanında birbirini duyar ve
// izin önbelleğini geçersiz kılar, yetkisiz istek 401 alır, kullanıcı başına bağlantı sınırı vardır,
// yeni bildirim zil sayacını sayfa yenilenmeden artırır ve SSE yokken davranış yoklamaya düşer.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/env.mjs';
import { client, SESSION_COOKIE } from '../lib/api.mjs';
import { dockApps, newContext, openApp, openSession, openWindows, waitDesktop } from '../lib/browser.mjs';
import { startServer } from '../lib/server.mjs';

export const meta = { title: 'Canlı olaylar (SSE + NOTIFY): anında yetki/bildirim, iki süreç, 401, bağlantı sınırı, yoklamaya düşüş' };

const UYE_DOCK = ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'mail'];
const HABER_DOCK = ['news', 'settings'];
/** SSE ile güncelleme: olay + /api/auth/me + çizim; yoklamanın 15 sn'sinden çok uzakta. */
const SSE_LIMIT_MS = 3_000;
/** Yoklamaya düşüş: en çok 15 sn + yanıt/çizim payı. */
const POLL_LIMIT_MS = 22_000;

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

/** Zildeki sayı (rozet yoksa 0). */
const badge = async (page) => {
	const el = page.locator('[data-notification-badge]');
	return (await el.count()) ? Number(await el.getAttribute('data-notification-badge')) : 0;
};

/** Bir SSE akışını açar; gelen olay adlarını toplar, bitince `ended` true olur. */
async function openStream(base, token) {
	const ac = new AbortController();
	const res = await fetch(`${base}/api/olaylar`, { headers: { cookie: `${SESSION_COOKIE}=${token}` }, signal: ac.signal });
	const stream = { res, events: [], ended: false, text: '', close: () => ac.abort() };
	if (res.status !== 200) return stream;
	(async () => {
		const reader = res.body.getReader();
		const dec = new TextDecoder();
		try {
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				stream.text += dec.decode(value);
				stream.events = [...stream.text.matchAll(/^event: (.+)$/gm)].map((x) => x[1]);
			}
		} catch {
			// aborted by the test
		}
		stream.ended = true;
	})();
	return stream;
}

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const canId = fx.users.can.id;
	const setRole = (rolId) => admin.patch('/api/uyeler', { id: canId, rolId });
	t.cleanup(() => setRole(fx.roles.uye));
	const stamp = Date.now().toString(36);

	// ---- (a) rol değişimi ≤ ~3 sn içinde açık oturuma yansır -----------------------------------
	await t.step('SSE: admin rolü değiştirir → üyenin ekranı yoklama beklemeden güncellenir', async () => {
		const { page } = await t.open('can');
		const opened = [];
		page.on('request', (r) => r.url().includes('/api/olaylar') && opened.push(r.url()));
		await page.reload({ waitUntil: 'domcontentloaded' });
		await waitDesktop(page);
		await openApp(page, 'events');
		t.sameSet(await dockApps(page), UYE_DOCK, 'başlangıç: Dock Üye rolünün uygulamaları');
		t.check(await t.waitFor(() => opened.length > 0, { timeout: 8000 }) >= 0, 'sayfa /api/olaylar akışını açtı');
		// Akışın açılması (ilk bayt) için kısa bir pay; ardından değişiklik.
		await t.sleep(1000);

		t.eq((await setRole(fx.roles.haber)).status, 200, 'PATCH /api/uyeler {rolId: Sadece Haberler} 200');
		const ms = await t.waitFor(async () => !(await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= SSE_LIMIT_MS, `Dock'tan Etkinlikler kayboldu (${ms} ms ≤ ${SSE_LIMIT_MS}; yoklama olsaydı ~15 sn)`);
		t.sameSet(await dockApps(page), HABER_DOCK, 'Dock yalnız Haberler ve Ayarlar');
		t.excludes(await openWindows(page), 'events', 'açık Etkinlikler penceresi kapandı');
		await t.shot(page, 'sse-rol-degisti');

		await setRole(fx.roles.uye);
		const geri = await t.waitFor(async () => (await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(geri >= 0 && geri <= SSE_LIMIT_MS, `rol geri verilince Dock güncellendi (${geri} ms)`);
	});

	// ---- oturum-sonlandi: başka cihazda giriş ---------------------------------------------------
	await t.step('SSE: başka cihazda giriş → bu cihazın oturumu anında sonlanır', async () => {
		const { page } = await t.open('ege');
		await t.sleep(1000);
		const started = Date.now();
		await t.api('ege', { fresh: true }); // yeni giriş: önceki oturum biter
		const ok = await page.locator('input[type=email]').waitFor({ timeout: 10_000 }).then(() => true, () => false);
		const ms = Date.now() - started;
		t.check(ok && ms <= SSE_LIMIT_MS + 2000, `eski oturum giriş ekranına döndü (${ms} ms; yoklama olsaydı ~15 sn)`);
	});

	// ---- (c) yetkisiz istek ve bağlantı sınırı ---------------------------------------------------
	await t.step('SSE: oturumsuz / geçersiz oturum 401, başlıklar doğru', async () => {
		const anon = await fetch(`${t.base}/api/olaylar`);
		t.eq(anon.status, 401, 'oturumsuz GET /api/olaylar 401');
		const bad = await fetch(`${t.base}/api/olaylar`, { headers: { cookie: `${SESSION_COOKIE}=gecersiz-belirtec` } });
		t.eq(bad.status, 401, 'geçersiz oturum çerezi 401');
		const s = await openStream(t.base, (await t.api('can')).token);
		t.eq(s.res.status, 200, 'geçerli oturum 200');
		t.check((s.res.headers.get('content-type') ?? '').startsWith('text/event-stream'), 'Content-Type text/event-stream');
		t.eq(s.res.headers.get('cache-control'), 'no-store, no-transform', 'Cache-Control: no-store, no-transform');
		t.eq(s.res.headers.get('x-accel-buffering'), 'no', 'X-Accel-Buffering: no');
		await t.sleep(300);
		t.check(s.text.includes(': baglandi'), 'ilk baytlar hemen geldi (akış açık)');
		s.close();
	});

	await t.step('SSE: kullanıcı başına en çok 8 bağlantı; fazlası en eskileri kapatır', async () => {
		const token = (await t.api('can')).token;
		const streams = [];
		for (let i = 0; i < 10; i++) streams.push(await openStream(t.base, token));
		await t.sleep(800);
		t.check(streams.slice(0, 2).every((s) => s.ended), 'en eski 2 akış sunucu tarafından kapatıldı');
		t.check(streams.slice(2).every((s) => !s.ended && s.res.status === 200), 'son 8 akış açık');
		// Açık kalanlar hâlâ olay alıyor (kapatılan eskiler yüzünden hub bozulmadı).
		await setRole(fx.roles.haber);
		await t.sleep(800);
		t.check(streams.slice(2).every((s) => s.events.includes('yetki-degisti')), 'açık 8 akışın hepsi yetki-degisti aldı');
		t.check(!streams.slice(0, 2).some((s) => s.events.length), 'kapatılanlar olay almadı');
		await setRole(fx.roles.uye);
		for (const s of streams) s.close();
		await t.sleep(300);
		// Sınır, kapatılan akışları sayar: yeni bir akış yine açılabiliyor.
		const again = await openStream(t.base, token);
		t.eq(again.res.status, 200, 'akışlar kapanınca yeni akış açılıyor');
		again.close();
	});

	await t.step('SSE: olay yalnız işaret taşır (içerik/veri yok) ve başkasının olayı gelmez', async () => {
		const canTok = (await t.api('can')).token;
		const egeTok = (await t.api('ege')).token;
		const sCan = await openStream(t.base, canTok);
		const sEge = await openStream(t.base, egeTok);
		await t.sleep(500);
		await setRole(fx.roles.haber);
		await t.sleep(800);
		t.includes(sCan.events, 'yetki-degisti', 'rolü değişen üye yetki-degisti aldı');
		t.eq(sEge.events, [], 'rolü değişmeyen üye olay almadı');
		const payloads = [...sCan.text.matchAll(/^data: (.*)$/gm)].map((m) => m[1]);
		t.check(payloads.length > 0 && payloads.every((p) => p === '{}'), 'olay verisi boş ({}) — sızan alan yok');
		await setRole(fx.roles.uye);
		sCan.close();
		sEge.close();
	});

	// ---- (d) bildirim olayı: zil sayacı sayfa yenilenmeden artar -------------------------------
	await t.step('SSE: yeni haber → zil sayacı sayfa yenilenmeden artar', async () => {
		const { page } = await t.open('can');
		await page.locator('[data-notification-toggle]').waitFor();
		await t.sleep(1500);
		const before = await badge(page);
		const haber = must(await admin.post('/api/haberler', { baslik: `SSE bildirim haberi ${stamp}`, icerik: 'Canlı bildirim.', kategori: 'genel', yayinDurumu: 'yayinda' }), 'haber');
		t.cleanup(() => admin.del(`/api/haberler?id=${haber.id}`));
		const ms = await t.waitFor(async () => (await badge(page)) > before, { timeout: 20_000, every: 100 });
		t.check(ms >= 0 && ms <= SSE_LIMIT_MS, `zil sayacı ${before} → ${await badge(page)} (${ms} ms; yoklama 60 sn'de bir)`);
		await t.shot(page, 'sse-zil-artti');
	});

	// ---- SSE yokken: yoklamaya düşüş ------------------------------------------------------------
	await t.step('SSE engellenince davranış 15 sn yoklamaya düşer, işlev kaybı yok', async () => {
		const token = (await t.api('can')).token;
		const context = t.track(await newContext(t.browser));
		await context.addCookies([{ name: SESSION_COOKIE, value: token, url: t.base }]);
		let blocked = 0;
		await context.route('**/api/olaylar', (route) => {
			blocked++;
			return route.abort();
		});
		const page = await context.newPage();
		await page.goto(t.base, { waitUntil: 'domcontentloaded' });
		await waitDesktop(page);
		t.sameSet(await dockApps(page), UYE_DOCK, 'akış engelli: masaüstü yine de açıldı');
		t.check(await t.waitFor(() => blocked > 0, { timeout: 8000 }) >= 0, '/api/olaylar denemesi engellendi');
		await t.sleep(500);
		await setRole(fx.roles.haber);
		const ms = await t.waitFor(async () => !(await dockApps(page)).includes('events'), { timeout: 30_000, every: 250 });
		t.check(ms >= 0 && ms <= POLL_LIMIT_MS, `yoklamayla Dock güncellendi (${ms} ms ≤ ${POLL_LIMIT_MS})`);
		await setRole(fx.roles.uye);
	});

	await t.step('SSE yok (EventSource tanımsız) → yoklama çalışır', async () => {
		const token = (await t.api('can')).token;
		const context = t.track(await newContext(t.browser));
		await context.addInitScript(() => {
			delete window.EventSource;
		});
		await context.addCookies([{ name: SESSION_COOKIE, value: token, url: t.base }]);
		const page = await context.newPage();
		await page.goto(t.base, { waitUntil: 'domcontentloaded' });
		await waitDesktop(page);
		await t.sleep(500);
		await setRole(fx.roles.haber);
		const ms = await t.waitFor(async () => !(await dockApps(page)).includes('events'), { timeout: 30_000, every: 250 });
		t.check(ms >= 0 && ms <= POLL_LIMIT_MS, `EventSource olmadan yoklamayla Dock güncellendi (${ms} ms)`);
		await setRole(fx.roles.uye);
	});

	// ---- (b) iki sunucu süreci, aynı veritabanı -------------------------------------------------
	const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';
	if (!databaseUrl) {
		console.log('atlandı: iki süreç denemesi E2E_DATABASE_URL (veya DATABASE_URL) ister');
		return;
	}
	await t.step('NOTIFY: ikinci sunucu süreci (aynı veritabanı) rol değişimini duyar, izin önbelleği geçersiz kalır', async () => {
		const portA = Number(new URL(t.base).port);
		// A second `next dev` in the same checkout (own build folder, BEU_DIST_DIR) rewrites
		// next-env.d.ts and tsconfig.json to mention it; put them back afterwards.
		const touched = ['next-env.d.ts', 'tsconfig.json'].map((f) => [path.join(ROOT, f), fs.readFileSync(path.join(ROOT, f), 'utf8')]);
		t.cleanup(() => {
			for (const [file, text] of touched) fs.writeFileSync(file, text);
			fs.rmSync(path.join(ROOT, '.next-b'), { recursive: true, force: true });
		});
		const second = await startServer({
			port: portA + 1,
			name: 'server-sse-b',
			env: {
				DATABASE_URL: databaseUrl,
				BOOTSTRAP_ADMIN_EMAIL: fx.admin.eposta,
				BOOTSTRAP_ADMIN_PASSWORD: fx.admin.sifre,
				NEXT_TELEMETRY_DISABLED: '1',
				BEU_DIST_DIR: '.next-b',
			},
		});
		t.cleanup(() => second.stop());
		const baseB = second.base;
		const canA = await t.api('can');
		const canB = client(baseB, canA.token); // aynı oturum belirteci, öbür süreç

		// (1) B'ye bağlı oturumun ekranı, A'da yapılan rol değişimiyle güncellenir.
		const { context, page } = await openSession(t.browser, baseB, canA.token);
		t.track(context);
		t.sameSet(await dockApps(page), UYE_DOCK, 'B sürecine bağlı oturum: başlangıç Dock');
		await t.sleep(1500); // B'nin akışı ve LISTEN bağlantısı hazır
		t.eq((await setRole(fx.roles.haber)).status, 200, 'A sürecinde rol değişti');
		const ms = await t.waitFor(async () => !(await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= SSE_LIMIT_MS + 1000, `B sürecindeki ekran NOTIFY ile güncellendi (${ms} ms; yoklama ~15 sn)`);
		await setRole(fx.roles.uye);
		await t.waitFor(async () => (await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });

		// (2) B'nin 5 sn'lik izin önbelleği, A'daki rol düzenlemesiyle hemen geçersiz kalır.
		const rolAd = `E2E SSE ${stamp}`;
		const rol = must(await admin.post('/api/roller', { ad: rolAd, renk: '#8e8e93', aciklama: 'SSE önbellek', ikiAdimZorunlu: false, izinler: { news: 'kullan', events: 'kullan', settings: 'kullan' } }), 'rol');
		t.cleanup(() => admin.del('/api/roller', { id: rol.id, tasi: fx.roles.uye }));
		must(await setRole(rol.id), 'üyeye rol');
		t.eq((await canB.get('/api/etkinlikler')).status, 200, 'B: Etkinlikler izinli (izin önbelleğe alındı)');
		t.eq((await canB.get('/api/etkinlikler')).status, 200, 'B: ikinci istek önbellekten 200');
		const edit = await admin.patch('/api/roller', { id: rol.id, ad: rolAd, renk: '#8e8e93', aciklama: 'SSE önbellek', ikiAdimZorunlu: false, izinler: { news: 'kullan', settings: 'kullan' } });
		t.eq(edit.status, 200, 'A: rolden Etkinlikler izni kaldırıldı');
		const cacheMs = await t.waitFor(async () => (await canB.get('/api/etkinlikler')).status === 403, { timeout: 8000, every: 100 });
		t.check(cacheMs >= 0 && cacheMs < 2500, `B'nin önbelleği NOTIFY ile geçersiz kaldı (${cacheMs} ms; TTL olsaydı ~5000 ms'ye kadar 200 dönerdi)`);
		await setRole(fx.roles.uye);
	});
}
