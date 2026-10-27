// Bildirim merkezi: zil sayacı, panel, gruplama (sabit / yapılacak / yeni / önceki),
// okunmadı sayacının panel açılınca sıfırlanması, satırın uygulamayı açması, panelden
// başvuru reddetme ve role göre süzme. Paket kendi haberini, etkinliğini, görevini ve
// başvurusunu kurar; bitince siler.
import crypto from 'node:crypto';
import { openWindows } from '../lib/browser.mjs';

export const meta = { title: 'Bildirimler: panel, gruplama, okunmadı sayacı, role göre süzme' };

const DAY = 86_400_000;
/** Bir üyenin bu tarayıcıda hiç bakmadığı durumda "yeni" sayılan geçmiş (uygulamanın ilk bakış kuralı). */
const FIRST_LOOK_MS = 3 * DAY;

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

/** Zildeki sayı (rozet yoksa 0). */
const badge = async (page) => {
	const el = page.locator('[data-notification-badge]');
	return (await el.count()) ? Number(await el.getAttribute('data-notification-badge')) : 0;
};

const panel = (page) => page.locator('[data-notification-panel]');

async function openPanel(page) {
	await page.locator('[data-notification-toggle]').click();
	await panel(page).waitFor();
	// Liste yüklenene kadar "Yükleniyor" görünür; bir satır ya da boş durum bekle.
	await page.locator('[data-notification-panel] [data-notification-item], [data-notification-empty]').first().waitFor();
}

async function closePanel(page) {
	await page.locator('[data-notification-toggle]').click();
	await panel(page).waitFor({ state: 'detached' });
}

/** Paneldeki satırlar: { id, group, unread }. */
const rows = (page) =>
	page.locator('[data-notification-panel] [data-notification-item]').evaluateAll((els) =>
		els.map((e) => ({ id: e.getAttribute('data-notification-item'), group: e.closest('[data-notification-group]')?.getAttribute('data-notification-group') ?? '', unread: e.hasAttribute('data-unread') }))
	);

const groupOf = (list, id) => list.find((r) => r.id === id)?.group ?? '(yok)';

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const stamp = Date.now().toString(36);

	// --- veri: haber (önemli + normal), yakın etkinlik, ege'ye görev, bekleyen başvuru ---
	const news = must(await admin.post('/api/haberler', { baslik: `Bildirim testi haberi ${stamp}`, icerik: 'Bildirim paketi için.', kategori: 'genel', yayinDurumu: 'yayinda' }), 'haber');
	t.cleanup(() => admin.del(`/api/haberler?id=${news.id}`));
	const pinned = must(await admin.post('/api/haberler', { baslik: `Önemli duyuru ${stamp}`, icerik: 'Sabitlenen duyuru.', kategori: 'genel', yayinDurumu: 'yayinda', onemliMi: true }), 'önemli haber');
	t.cleanup(() => admin.del(`/api/haberler?id=${pinned.id}`));

	const start = Date.now() + 2 * 3600_000;
	const event = must(await admin.post('/api/etkinlikler', { action: 'createEvent', baslik: `Bildirim etkinliği ${stamp}`, aciklama: 'Bildirim paketi', tur: 'atolye', konum: 'D-101', baslangic: start, bitis: start + 3600_000, kapasite: 10, durum: 'yayinda' }), 'etkinlik');
	t.cleanup(() => admin.post('/api/etkinlikler', { action: 'deleteEvent', etkinlikId: event.id }));

	const team = fx.content.team.team ?? fx.content.team;
	const task = must(await admin.post('/api/takimlar', { action: 'addTask', takimId: team.id, baslik: `Bildirim görevi ${stamp}`, atananUyeId: fx.users.ege.id, teslimTarihi: Date.now() + DAY }), 'görev').gorev;
	t.cleanup(() => admin.post('/api/takimlar', { action: 'deleteTask', gorevId: task.id }));

	// Başvuru: kayıt formunun API'si. Şifre rastgele, hiçbir yere yazılmaz.
	const reg = await fetch(`${t.base}/api/auth/register`, {
		method: 'POST',
		// Kayıt ucu IP başına dakikada 5 istek kabul eder; diğer paketlerin denemeleriyle çakışmasın.
		headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.77.${crypto.randomInt(255)}.${crypto.randomInt(255)}` },
		body: JSON.stringify({ ad: 'Başvuru', soyad: `Test ${stamp}`, eposta: `basvuru-${stamp}@kulup.test`, sifre: crypto.randomBytes(12).toString('hex'), bolum: 'Fizik', sinif: 1, kvkkKabul: true }),
	}).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
	const applicant = must(reg, 'başvuru').user;
	t.cleanup(() => admin.del(`/api/uyeler?id=${applicant.id}`));

	const ids = { news: `news:${news.id}`, pinned: `news:${pinned.id}`, event: `event:${event.id}`, task: `task:${task.id}`, approval: `approval:${applicant.id}` };

	await t.step('API: her rol yalnız kendi uygulamalarının bildirimini alır', async () => {
		const feed = async (key) => must(await (await t.api(key)).get('/api/bildirimler'), `bildirimler ${key}`).items.map((i) => i.id);
		const okur = await feed('okur');
		t.includes(okur, ids.news, 'okur: haber bildirimi var');
		for (const k of ['event', 'task', 'approval']) t.excludes(okur, ids[k], `okur: ${k} bildirimi yok`);
		const can = await feed('can');
		t.includes(can, ids.event, 'can: etkinlik bildirimi var');
		t.excludes(can, ids.approval, 'can (Üye): başvuru onayı bildirimi yok');
		t.excludes(can, ids.task, "can: ege'nin görevi yok");
		const zeynep = await feed('zeynep');
		t.includes(zeynep, ids.approval, 'zeynep (Yönetim Kurulu): başvuru onayı var');
	});

	await t.step('ege: zil sayacı, panel grupları, okundu', async () => {
		const ege = await t.api('ege');
		const api = must(await ege.get('/api/bildirimler'), 'bildirimler ege');
		const { page } = await t.open('ege');
		// Bu tarayıcıda ilk bakış: yapılacaklar + son 3 gündeki bilgi bildirimleri.
		const expected = api.counts.actionRequired + api.items.filter((i) => i.priority === 'info' && i.at > api.generatedAt - FIRST_LOOK_MS).length;
		t.check((await t.waitFor(async () => (await badge(page)) === expected)) >= 0, `zil sayacı ilk açılışta ${expected}`, `gelen ${await badge(page)}`);

		await openPanel(page);
		const first = await rows(page);
		t.sameSet(first.map((r) => r.id), api.items.map((i) => i.id), 'paneldeki satırlar API ile aynı');
		t.eq(groupOf(first, ids.pinned), 'pinned', 'önemli haber en üstte sabit');
		t.eq(groupOf(first, ids.task), 'action', 'yaklaşan görev "yapılacak" grubunda');
		t.eq(groupOf(first, ids.news), 'fresh', 'yeni haber "yeni" grubunda');
		t.eq(groupOf(first, ids.event), 'fresh', 'yeni etkinlik "yeni" grubunda');
		t.check(first.find((r) => r.id === ids.news)?.unread, 'yeni haber okunmadı işaretli');
		t.excludes(first.map((r) => r.id), ids.approval, 'Üye rolü başvuru onayını görmüyor');
		await t.shot(page, 'ege-panel-ilk');
		t.eq(await badge(page), api.counts.actionRequired, 'panel açılınca sayaçta yalnız yapılacaklar kaldı');

		await closePanel(page);
		await openPanel(page);
		const second = await rows(page);
		t.eq(groupOf(second, ids.news), 'earlier', 'ikinci açılışta haber "önceki" grubunda');
		t.check(!second.find((r) => r.id === ids.news)?.unread, 'ikinci açılışta okunmadı işareti yok');
		t.eq(groupOf(second, ids.task), 'action', 'görev okunsa da "yapılacak"ta kalıyor');
		await closePanel(page);

		// Yeni bir haber: yeniden yüklemeden sonra sayaç bir artar (son bakış tarayıcıda saklı).
		const late = must(await admin.post('/api/haberler', { baslik: `Sonradan gelen ${stamp}`, icerik: 'Yeni.', kategori: 'genel', yayinDurumu: 'yayinda' }), 'ikinci haber');
		t.cleanup(() => admin.del(`/api/haberler?id=${late.id}`));
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.locator('[data-notification-toggle]').waitFor();
		t.check((await t.waitFor(async () => (await badge(page)) === api.counts.actionRequired + 1)) >= 0, 'yeniden yüklemede sayaç yalnız yeni haber kadar arttı', `gelen ${await badge(page)}`);
		await openPanel(page);
		const third = await rows(page);
		t.eq(groupOf(third, `news:${late.id}`), 'fresh', 'sonradan gelen haber "yeni"de');
		t.eq(groupOf(third, ids.news), 'earlier', 'önce görülen haber "önceki"de kaldı');

		// Satıra tıklamak uygulamayı açar ve paneli kapatır.
		await page.locator(`[data-notification-item="news:${late.id}"] button`).first().click();
		await panel(page).waitFor({ state: 'detached' });
		await page.locator('[data-window-frame=news]').waitFor();
		t.includes(await openWindows(page), 'news', 'haber satırı Haberler penceresini açtı');
	});

	await t.step('zeynep: başvuru panelde, reddedilince listeden çıkar', async () => {
		const { page } = await t.open('zeynep');
		await openPanel(page);
		const list = await rows(page);
		t.eq(groupOf(list, ids.approval), 'action', 'başvuru "yapılacak" grubunda');
		const row = page.locator(`[data-notification-item="${ids.approval}"]`);
		t.eq(await row.locator('[data-notification-action]').count(), 2, 'onayla ve reddet düğmeleri var');
		await t.shot(page, 'zeynep-basvuru');
		await row.locator('[data-notification-action=reddet]').click();
		const dialog = page.locator('[role=alertdialog]');
		await dialog.waitFor();
		await dialog.getByRole('button').last().click();
		await row.waitFor({ state: 'detached' });
		t.eq(await row.count(), 0, 'reddedilen başvuru panelden kalktı');
		const after = must(await (await t.api('zeynep')).get('/api/bildirimler'), 'bildirimler zeynep').items.map((i) => i.id);
		t.excludes(after, ids.approval, 'API de başvuruyu artık göstermiyor');
	});

	await t.step('okur (Sadece Haberler): yalnız haber bildirimleri; etkinlik/görev/başvuru yok', async () => {
		const { page } = await t.open('okur');
		await openPanel(page);
		const list = await rows(page);
		t.check(list.length > 0, 'okur panelinde satır var');
		t.sameSet([...new Set(list.map((r) => r.id.split(':')[0]))], ['news'], 'okur yalnız haber bildirimi görüyor');
		for (const k of ['event', 'task', 'approval']) t.excludes(list.map((r) => r.id), ids[k], `okur: ${k} satırı yok`);
		await t.shot(page, 'okur-panel');
		// Satır uygulamayı açar; rolün açamadığı bir pencere açılmadı.
		t.sameSet((await openWindows(page)).filter((a) => a !== 'news' && a !== 'settings'), [], 'okur için izinsiz pencere yok');
	});
}
