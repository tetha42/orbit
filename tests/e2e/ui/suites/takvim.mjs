// Menü çubuğundaki saat (#15): tıklayınca yukarıdan açılan takvim paneli. Tarihler hep "şimdi"ye göre hesaplanır
// (sabit tarih yok); etkinlikler yalnız `events: kullan` yetkisi olanlar için okunur, yetkisizde hiç istek atılmaz.
import { makeEvent, removeEvent, sweepEvents } from '../lib/etkinlik.mjs';

export const meta = { title: 'Takvim: saate tıklayınca ay paneli (açılış/kapanış, ay gezme, klavye, etkinlik işareti, hareketi azalt)' };

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthName = (d, locale) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);

const clock = (page) => page.locator('[data-clock-toggle]');
const panel = (page) => page.locator('[data-calendar-panel]');
const title = async (page) => ((await page.locator('[data-calendar-title]').textContent()) ?? '').trim().toLowerCase();
const dayCell = (page, key) => page.locator(`[data-calendar-day="${key}"]`);
const gridKeys = (page) => page.locator('[data-calendar-day]').evaluateAll((e) => e.map((x) => x.getAttribute('data-calendar-day')));
const focused = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-calendar-day') ?? null);
const open = async (page) => {
	await clock(page).click();
	await panel(page).waitFor();
};
const waitClosed = (page) => panel(page).waitFor({ state: 'detached', timeout: 3000 });

export default async function suite(t) {
	const admin = await t.api('admin');
	await sweepEvents(admin);

	const now = new Date();
	const todayKey = keyOf(now);

	await t.step('saate tıklayınca panel açılıyor: doğru ay, bugün vurgulu, Pazartesi başlangıçlı; yukarıdan aşağı animasyon', async () => {
		const { page } = await t.open('can');
		t.eq(await clock(page).getAttribute('aria-expanded'), 'false', 'kapalıyken aria-expanded=false');
		t.eq(await panel(page).count(), 0, 'kapalıyken panel yok');
		await open(page);
		t.eq(await clock(page).getAttribute('aria-expanded'), 'true', 'açıkken aria-expanded=true');
		t.eq(await title(page), monthName(now, 'tr-TR').toLowerCase(), 'başlıkta içinde bulunulan ay ve yıl');
		const today = page.locator('[data-calendar-day][data-today]');
		t.eq(await today.count(), 1, 'tek bir bugün hücresi');
		t.eq(await today.getAttribute('data-calendar-day'), todayKey, 'vurgulu gün bugün');
		t.eq(await today.getAttribute('aria-current'), 'date', 'bugün aria-current=date');
		const keys = await gridKeys(page);
		t.eq(keys.length, 42, '6 hafta (sabit yükseklik)');
		const [y, m, d] = keys[0].split('-').map(Number);
		t.eq(new Date(y, m - 1, d).getDay(), 1, 'tr: ilk sütun Pazartesi');
		const names = await page.locator('[data-calendar-panel] [data-calendar-weekday]').allTextContents();
		const monday = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(new Date(2023, 0, 2));
		t.eq(names[0], monday, 'haftanın günü başlığı Pazartesi ile başlıyor', JSON.stringify(names));
		t.check((await page.locator('[data-calendar-day]:not([data-outside])').count()) === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), 'ay içi gün sayısı doğru');
		// Animasyon: yukarıdan aşağı, transform + opacity.
		const anim = await panel(page).evaluate((el) => {
			const cs = getComputedStyle(el);
			const rules = [...document.styleSheets].flatMap((sh) => [...sh.cssRules]).filter((r) => r.type === CSSRule.KEYFRAMES_RULE && r.name === cs.animationName);
			const frames = rules[0] ? [...rules[0].cssRules] : [];
			const props = [...new Set(frames.flatMap((f) => [...f.style]))];
			return { name: cs.animationName, ms: parseFloat(cs.animationDuration) * 1000, props, from: frames[0]?.style.getPropertyValue('transform') };
		});
		t.check(/calendarDrop/.test(anim.name) && anim.ms >= 100, 'açılış animasyonu tanımlı (calendarDrop)', JSON.stringify(anim));
		t.sameSet(anim.props, ['opacity', 'transform'], 'yalnız transform ve opacity animasyonu', JSON.stringify(anim));
		t.check(/-\d/.test(anim.from ?? ''), 'yukarıdan aşağı: başlangıç Y ofseti negatif', anim.from);
		// Açılış animasyonu bitmeden konum ölçülürse panel hâlâ yukarıdadır (yük altında aralıklı kırmızı veriyordu).
		await panel(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
		const box = await panel(page).boundingBox();
		const bar = await page.locator('[data-topbar]').boundingBox();
		t.check(box.y >= bar.y + bar.height - 2, 'panel menü çubuğunun altından açılıyor', JSON.stringify({ box, bar }));
		t.check(box.x >= 0 && box.x + box.width <= 1440, 'ekran dışına taşmıyor');
		await t.shot(page, 'acik-masaustu');
	});

	await t.step('kapanış yolları: Esc, saate tekrar tıklama, dışarı tıklama', async () => {
		const { page } = await t.open('can');
		await open(page);
		await page.keyboard.press('Escape');
		await waitClosed(page);
		t.eq(await clock(page).getAttribute('aria-expanded'), 'false', 'Esc: kapandı, aria-expanded=false');
		await open(page);
		await clock(page).click();
		await waitClosed(page);
		t.check(true, 'saate tekrar tıklama: kapandı');
		await open(page);
		await page.mouse.click(400, 500);
		await waitClosed(page);
		t.check(true, 'dışarı tıklama: kapandı');
		await open(page);
		await panel(page).click({ position: { x: 30, y: 6 } });
		t.eq(await panel(page).count(), 1, 'panelin içine tıklamak kapatmıyor');
	});

	await t.step('ay değiştirme: önceki/sonraki ok, Bugün', async () => {
		const { page } = await t.open('can');
		await open(page);
		const here = await title(page);
		await page.locator('[data-calendar-next]').click();
		t.eq(await title(page), monthName(new Date(now.getFullYear(), now.getMonth() + 1, 1), 'tr-TR').toLowerCase(), 'sonraki ay');
		await page.locator('[data-calendar-prev]').click();
		await page.locator('[data-calendar-prev]').click();
		t.eq(await title(page), monthName(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'tr-TR').toLowerCase(), 'önceki ay');
		await page.locator('[data-calendar-prev]').click();
		t.eq(await page.locator('[data-calendar-day][data-today]').count(), 0, 'iki ay geride bugün hücresi yok');
		await page.locator('[data-calendar-today]').click();
		t.eq(await title(page), here, 'Bugün: içinde bulunulan aya döndü');
		t.eq(await page.locator('[data-calendar-day][data-today]').getAttribute('data-calendar-day'), todayKey, 'Bugün: bugün yine vurgulu');
		// Yıl sınırı: 12 ay ileri = gelecek yıl aynı ay.
		for (let i = 0; i < 12; i++) await page.locator('[data-calendar-next]').click();
		t.eq(await title(page), monthName(new Date(now.getFullYear() + 1, now.getMonth(), 1), 'tr-TR').toLowerCase(), '12 ay sonra: gelecek yıl');
	});

	await t.step('klavye: ok tuşlarıyla gün gezme, PageDown/PageUp ay, Esc saate döner', async () => {
		const { page } = await t.open('can');
		await open(page);
		await dayCell(page, todayKey).focus();
		const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		await page.keyboard.press('ArrowRight');
		t.eq(await focused(page), keyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)), 'Sağ ok: ertesi gün odakta');
		await page.keyboard.press('ArrowDown');
		t.eq(await focused(page), keyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 8)), 'Aşağı ok: +7 gün');
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowUp');
		t.eq(await focused(page), keyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 0)), 'Sol + Yukarı ok: bugüne dönüş');
		for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
		const far = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 40);
		t.eq(await focused(page), keyOf(far), '40 gün sonrası: ay değişse de odak günde');
		t.eq(await title(page), monthName(far, 'tr-TR').toLowerCase(), 'ay başlığı odaktaki günle birlikte değişti');
		await page.keyboard.press('PageUp');
		t.eq(await title(page), monthName(new Date(far.getFullYear(), far.getMonth() - 1, 1), 'tr-TR').toLowerCase(), 'PageUp: önceki ay');
		t.eq(await page.locator('[data-calendar-day][tabindex="0"]').count(), 1, 'tek sekme durağı (roving tabindex)');
		await page.keyboard.press('Escape');
		await waitClosed(page);
		t.check(await clock(page).evaluate((el) => el === document.activeElement), 'Esc: odak saat düğmesine döndü');
		// Klavyeyle (Enter) açılış.
		await page.keyboard.press('Enter');
		await panel(page).waitFor();
		t.check(true, 'Enter: saat düğmesi klavyeyle açıyor');
	});

	await t.step('başka panel açılınca takvim kapanıyor ve tersi (aynı anda tek panel); dil: en Pazar başlangıçlı', async () => {
		const { page } = await t.open('can');
		await open(page);
		await page.locator('button[title="Denetim Merkezi"]').click();
		await waitClosed(page);
		t.check(true, 'Denetim Merkezi açılınca takvim kapandı');
		await page.locator('[data-clock-toggle]').click();
		await panel(page).waitFor();
		t.eq(await page.locator('input[type=range]').count(), 0, 'takvim açılınca Denetim Merkezi kapandı');
		await page.locator('[data-notification-toggle]').click();
		await waitClosed(page);
		t.check(await page.locator('[data-notification-panel]').count() === 1, 'bildirim paneli açılınca takvim kapandı, bildirim paneli açık');
		await clock(page).click();
		await panel(page).waitFor();
		t.eq(await page.locator('[data-notification-panel]').count(), 0, 'takvim açılınca bildirim paneli kapandı');
		// Esc yalnız takvimi değil her şeyi kapatır; İngilizce: Pazar başlangıçlı, İngilizce ay adı.
		await page.keyboard.press('Escape');
		await waitClosed(page);
		await page.evaluate(() => localStorage.setItem('kulup_language', 'en'));
		await page.reload();
		await page.locator('[data-dock-app]').first().waitFor();
		await open(page);
		t.eq(await title(page), monthName(now, 'en-US').toLowerCase(), 'en: İngilizce ay adı');
		const keys = await gridKeys(page);
		const [y, m, d] = keys[0].split('-').map(Number);
		t.eq(new Date(y, m - 1, d).getDay(), 0, 'en: ilk sütun Pazar');
		const names = await page.locator('[data-calendar-panel] [data-calendar-weekday]').allTextContents();
		t.eq(names[0], new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(2023, 0, 1)), 'en: haftanın günü başlığı Sun', JSON.stringify(names));
		t.eq(await page.locator('[data-calendar-today]').textContent(), 'Today', 'en: "Today" düğmesi');
		await t.shot(page, 'acik-en');
		await page.evaluate(() => localStorage.removeItem('kulup_language'));
	});

	await t.step('etkinlik işareti: events=kullan yetkisinde o gün işaretli ve listede; yetkisizde hiç istek yok', async () => {
		const ev = await makeEvent(t, admin, { label: 'takvim', startMin: 2 * 24 * 60 + 5 });
		const start = new Date(Date.now() + (2 * 24 * 60 + 5) * 60_000);
		const key = keyOf(start);
		const { page } = await t.open('can');
		const reqs = [];
		page.on('request', (r) => r.url().includes('/api/etkinlikler') && reqs.push(r.url()));
		await open(page);
		await dayCell(page, key).waitFor();
		await page.waitForFunction((k) => document.querySelector(`[data-calendar-day="${k}"]`)?.hasAttribute('data-has-event'), key, { timeout: 5000 });
		t.eq(await dayCell(page, key).getAttribute('data-has-event'), '', 'etkinlik günü işaretli');
		t.check(reqs.length >= 1, 'yetkili rol açılışta /api/etkinlikler okudu', String(reqs.length));
		await dayCell(page, key).click();
		t.check((await page.locator(`[data-calendar-event="${ev.id}"]`).count()) === 1, 'güne tıklayınca etkinlik listede', ev.baslik);
		t.check((await page.locator(`[data-calendar-event="${ev.id}"]`).textContent()).includes(ev.baslik), 'etkinlik başlığı görünüyor');
		// Beklenen: ızgaradaki, (taslak/iptal olmayan) bir etkinliğin değdiği günler — fikstürdeki etkinlikler de dahil.
		const all = (await admin.get('/api/etkinlikler')).json.etkinlikler.filter((e) => e.durum !== 'taslak' && e.durum !== 'iptal');
		const touched = new Set();
		for (const e of all) for (let d = new Date(new Date(e.baslangic).setHours(0, 0, 0, 0)); d.getTime() <= e.bitis; d.setDate(d.getDate() + 1)) touched.add(keyOf(d));
		const shown = await gridKeys(page);
		const expected = shown.filter((k) => touched.has(k)).sort();
		const marked = await page.locator('[data-calendar-day][data-has-event]').evaluateAll((e) => e.map((x) => x.getAttribute('data-calendar-day')).sort());
		t.eq(marked, expected, 'işaretli günler = etkinliklerin değdiği günler (fazla/eksik işaret yok)');
		await t.shot(page, 'etkinlik-isareti');
		await page.keyboard.press('Escape');

		// Yetkisiz (yalnız Haberler): sekme açılmadan da, panel açıkken de /api/etkinlikler'e istek yok; liste kutusu da yok.
		const { page: okur } = await t.open('okur');
		const okurReqs = [];
		okur.on('request', (r) => r.url().includes('/api/etkinlikler') && okurReqs.push(r.url()));
		await open(okur);
		await okur.locator('[data-calendar-next]').click();
		await okur.waitForTimeout(800);
		t.eq(okurReqs, [], 'events yetkisi olmayan rol: /api/etkinlikler\'e hiç istek atılmadı');
		t.eq(await okur.locator('[data-calendar-day][data-has-event]').count(), 0, 'işaret yok');
		t.eq(await okur.locator('[data-calendar-agenda]').count(), 0, 'etkinlik listesi kutusu yok');
		t.eq(await okur.locator('[data-calendar-day]').count(), 42, 'takvim yine de açılıyor');
		await removeEvent(admin, ev.id);
	});

	await t.step('hareketi azalt: açıkken animasyon yok (1ms), kapalıyken var', async () => {
		const read = (page) => panel(page).evaluate((el) => ({ ms: parseFloat(getComputedStyle(el).animationDuration) * 1000, motion: document.documentElement.getAttribute('data-motion') }));
		const { page: calm } = await t.open('can', { prefs: { reduceMotion: true } });
		await open(calm);
		const a = await read(calm);
		t.eq(a.motion, 'reduce', 'data-motion=reduce');
		t.check(a.ms <= 1, 'hareketi azalt açık: animasyon süresi ≤ 1ms', JSON.stringify(a));
		t.eq(await panel(calm).evaluate((el) => document.getAnimations().filter((x) => x.effect?.target === el && x.playState === 'running' && x.effect.getComputedTiming().duration > 5).length), 0, 'çalışan gerçek animasyon yok');
		const { page: full } = await t.open('can', { prefs: { reduceMotion: false } });
		await open(full);
		const b = await read(full);
		t.eq(b.motion, 'full', 'data-motion=full');
		t.check(b.ms >= 100, 'hareketi azalt kapalı: animasyon var', JSON.stringify(b));
	});

	await t.step('koyu tema + vurgu rengi: tokenlar izleniyor; dar masaüstü (768) taşma yok; 390×844 mobilde taşma yok', async () => {
		const { page } = await t.open('can', { prefs: { theme: 'dark', accent: 'purple' } });
		await open(page);
		const css = await page.evaluate(() => {
			const probe = (v) => {
				const i = document.createElement('i');
				i.style.background = v;
				document.body.append(i);
				const c = getComputedStyle(i).backgroundColor;
				i.remove();
				return c;
			};
			const today = getComputedStyle(document.querySelector('[data-calendar-day][data-today]')).backgroundColor;
			const bg = getComputedStyle(document.querySelector('[data-calendar-panel]')).backgroundColor;
			return { today, accent: probe('var(--accent)'), bg, menuBg: probe('var(--menu-bg)') };
		});
		t.eq(css.today, css.accent, 'bugün hücresi --accent rengini izliyor (mor)');
		t.eq(css.bg, css.menuBg, 'panel zemini --menu-bg');
		await t.shot(page, 'acik-koyu');
		await page.setViewportSize({ width: 768, height: 800 });
		await page.waitForTimeout(200);
		const box = await panel(page).boundingBox();
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		t.check(box.x >= 0 && box.x + box.width <= 768 && overflow <= 0, '768 genişlikte panel ekran içinde, sayfa taşmıyor', JSON.stringify({ box, overflow }));
		await t.shot(page, 'acik-768');
		const { page: mobile } = await t.open('can', { mobile: true });
		await mobile.locator('[data-mobile-nav]').waitFor();
		const mo = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		t.check(mo <= 0, '390×844: yatay taşma yok', `${mo}px`);
		t.eq(await mobile.locator('[data-clock-toggle]').count(), 0, 'mobil başlatıcıda menü çubuğu (ve saat) yok; takvim masaüstüne özgü');
		await t.shot(mobile, 'mobil-390');
	});
}
