// Posta: kişi bulma ve mesaj başlatma. İki geçici üye birbirini ada, soyada, e-postaya, bölüme
// ve öğrenci numarasına göre arayıp bulur ve mesajlaşır; arama yalnız ad döndürür (e-posta,
// bölüm, öğrenci no, parola sızmaz); Posta'sız rol arama uçlarında 403 görür ve alıcı
// listesinde seçilemez; son yazışılanlar öneri olur; Üye Rehberi'nden ve Spotlight'tan
// "Mesaj gönder" Posta'yı alıcı seçili açar; Posta'sı olmayan rol (Üye Rehberi'ni açsa da) ve
// "Sadece Haberler" bunları göremez. Paket kendi üyelerini ve rolünü kurar, bitince siler.
import { dockApps, openApp, showLauncherApps } from '../lib/browser.mjs';
import { toast } from '../lib/arayuz.mjs';
import { newMember, runTag } from '../lib/uyelik.mjs';

export const meta = { title: 'Posta kişiler: arama (ad/e-posta/bölüm/no), öneri, çoklu alıcı, Üye Rehberi ve Spotlight\'tan mesaj, sızıntı' };

const must = (r, what) => {
	if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`);
	return r.json;
};

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const tag = runTag();
	const digits = String(Date.now()).slice(-7);

	const ipek = await newMember(t, admin, { label: 'kisi-a', ad: 'İpek', soyad: 'Arayan', rolId: fx.roles.uye, bolum: `Astrofizik ${tag}`, ogrenciNo: `71${digits}` });
	const isil = await newMember(t, admin, { label: 'kisi-b', ad: 'Işıl', soyad: 'Çağlar', rolId: fx.roles.uye, bolum: `Biyofizik ${tag}`, ogrenciNo: `72${digits}` });
	const yan = await newMember(t, admin, { label: 'kisi-c', ad: 'Yan', soyad: 'Aday', rolId: fx.roles.uye, bolum: `Jeofizik ${tag}`, ogrenciNo: `73${digits}` });
	const haber = await newMember(t, admin, { label: 'kisi-h', ad: 'Haber', soyad: 'Okuru', rolId: fx.roles.haber, bolum: `Sosyoloji ${tag}`, ogrenciNo: `74${digits}` });
	const [iApi, sApi, yApi, hApi] = await Promise.all([ipek.api(), isil.api(), yan.api(), haber.api()]);

	const roleId = must(
		await admin.post('/api/roller', { ad: `E2E Rehber ${tag}`, renk: '#8e8e93', aciklama: 'Üye Rehberi var, Posta yok', ikiAdimZorunlu: false, izinler: { members: 'kullan', news: 'kullan', settings: 'kullan' } }),
		'rol'
	).id;
	t.cleanup(() => admin.del('/api/roller', { id: roleId, tasi: fx.roles.uye }));
	const rehberci = await newMember(t, admin, { label: 'kisi-r', ad: 'Rehber', soyad: 'Okuru', rolId: roleId });
	const rApi = await rehberci.api();

	const lookup = async (api, q) => (await api.get(`/api/posta/alicilar?q=${encodeURIComponent(q)}`)).json;
	const ids = (body) => (body?.alicilar ?? []).map((a) => a.id);

	await t.step('API: ad, soyad (Türkçe harfler katlanarak), e-posta, bölüm ve öğrenci no ile bulunur', async () => {
		t.includes(ids(await lookup(iApi, 'isil')), isil.id, 'ad: "isil" → Işıl');
		t.includes(ids(await lookup(iApi, 'IŞIL')), isil.id, 'ad: "IŞIL" → Işıl');
		t.includes(ids(await lookup(iApi, 'caglar')), isil.id, 'soyad: "caglar" → Çağlar');
		t.includes(ids(await lookup(iApi, 'ÇAĞLAR')), isil.id, 'soyad: "ÇAĞLAR" → Çağlar');
		t.includes(ids(await lookup(sApi, 'ipek')), ipek.id, 'ad: "ipek" → İpek (İ → i)');
		t.includes(ids(await lookup(sApi, 'İPEK arayan')), ipek.id, 'ad + soyad birlikte');
		t.includes(ids(await lookup(sApi, 'arayan ipek')), ipek.id, 'sıra fark etmez');
		t.eq(ids(await lookup(iApi, isil.eposta.split('@')[0])), [isil.id], 'e-posta (baştan): yalnız o kişi');
		t.eq(ids(await lookup(iApi, isil.eposta.toUpperCase())), [isil.id], 'tam e-posta, büyük harf');
		t.eq(ids(await lookup(iApi, `Biyofizik ${tag}`)), [isil.id], 'bölüm');
		t.eq(ids(await lookup(iApi, `72${digits}`)), [isil.id], 'öğrenci no');
		t.eq(ids(await lookup(iApi, `biyofizik ${tag} caglar`)), [isil.id], 'bölüm + soyad (her sözcük eşleşmeli)');
		t.eq(ids(await lookup(iApi, `biyofizik ${tag} arayan`)), [], 'bölüm başkasının: eşleşme yok');
		// Kendisi aranamaz; Posta'sız rol listede görünür ama ulaşılamaz işaretli.
		t.excludes(ids(await lookup(iApi, 'ipek')), ipek.id, 'kendisi sonuçta yok');
		const h = (await lookup(iApi, `Sosyoloji ${tag}`)).alicilar;
		t.eq(h.map((a) => [a.id, a.ulasilabilir]), [[haber.id, false]], 'Posta’sız rol: bulunur, ulasilabilir=false');
		t.eq((await lookup(iApi, `Astrofizik ${tag}`)).alicilar.length, 0, 'kendi bölümünü arayınca kendisi çıkmaz');
	});

	await t.step('API: arama kişisel veri sızdırmaz, joker karakterler düz metindir', async () => {
		const sample = [await lookup(iApi, isil.eposta), await lookup(iApi, `72${digits}`), await lookup(iApi, `Biyofizik ${tag}`), await lookup(iApi, 'isil')];
		for (const body of sample) {
			for (const a of body.alicilar) t.eq(Object.keys(a).sort(), ['ad', 'id', 'soyad', 'ulasilabilir'], 'her satır yalnız id, ad, soyad, ulasilabilir');
		}
		// The answer repeats the search text (`q`), which may be the e-mail address itself; the rows are what must not carry it.
		const raw = JSON.stringify(sample.map((body) => body.alicilar));
		for (const [secret, what] of [[isil.eposta, 'e-posta'], [`72${digits}`, 'öğrenci no'], [`Biyofizik ${tag}`, 'bölüm'], ['sifre', 'parola alanı'], ['hash', 'özet alanı'], ['rolId', 'rol kimliği'], ['totp', 'TOTP']]) {
			t.check(!raw.toLowerCase().includes(secret.toLowerCase()), `yanıtta ${what} yok`);
		}
		t.eq(ids(await lookup(iApi, '%')), [], '"%" joker değil');
		t.eq(ids(await lookup(iApi, '_')), [], '"_" joker değil');
		t.eq(ids(await lookup(iApi, '\\')), [], 'ters bölü joker değil');
		t.eq(ids(await lookup(iApi, "' OR '1'='1")), [], 'SQL parçası düz metin');
		// E-posta/öğrenci no kısa parçayla ve alan adıyla taranamaz.
		t.eq(ids(await lookup(iApi, 'e2e.test')), [], 'e-posta alan adı parçası eşleşmez (baştan eşleşir)');
		t.eq(ids(await lookup(iApi, `72${digits}`.slice(0, 2))), [], 'öğrenci no’nun iki karakteri eşleşmez');
		const long = await lookup(iApi, 'a'.repeat(300));
		t.eq(long.q.length, 64, 'arama metni 64 karakterle sınırlı');
		// En çok 20 kişi.
		const wide = (await lookup(iApi, 'e')).alicilar.length;
		t.check(wide <= 20, `en çok 20 sonuç (${wide})`);
		t.eq((await iApi.get(`/api/posta/alicilar?id=${encodeURIComponent(isil.id)}`)).json.alicilar.map((a) => a.id), [isil.id], 'kimlikle tek kişi');
		t.eq((await iApi.get(`/api/posta/alicilar?id=${encodeURIComponent(ipek.id)}`)).json.alicilar, [], 'kendi kimliği: boş');
		t.eq((await iApi.get('/api/posta/alicilar?id=olmayan')).json.alicilar, [], 'olmayan kimlik: boş');
		const reach = (await iApi.get('/api/posta/alicilar?ulasilabilir=1')).json;
		t.eq(Object.keys(reach), ['idler'], 'ulasilabilir=1 yalnız kimlik listesi döner');
		t.includes(reach.idler, isil.id, 'ulaşılabilir listesinde berk');
		t.excludes(reach.idler, haber.id, 'Posta’sız rol listede yok');
		t.excludes(reach.idler, ipek.id, 'kendisi yok');
		// Aktif olmayan üye bulunmaz.
		const mezun = await newMember(t, admin, { label: 'kisi-m', ad: 'Mezun', soyad: 'Eski', rolId: fx.roles.uye });
		t.includes(ids(await lookup(iApi, mezun.soyad)), mezun.id, 'aktif üye bulunur');
		t.eq((await admin.patch('/api/uyeler', { id: mezun.id, durum: 'mezun' })).status, 200, 'üye mezun yapıldı');
		t.eq(ids(await lookup(iApi, mezun.soyad)), [], 'mezun (aktif değil) bulunmaz');
	});

	await t.step('API: Posta’sız rol arama uçlarının hiçbirine giremez (403); aramada kişi önerisi çıkmaz', async () => {
		for (const path of ['/api/posta/alicilar', '/api/posta/alicilar?q=isil', `/api/posta/alicilar?id=${isil.id}`, '/api/posta/alicilar?ulasilabilir=1']) {
			t.eq((await hApi.get(path)).status, 403, `Posta’sız GET ${path} → 403`);
			t.eq((await rApi.get(path)).status, 403, `Üye Rehberi var, Posta yok: GET ${path} → 403`);
		}
		const hits = async (api, q) => (await api.get(`/api/search?q=${encodeURIComponent(q)}`)).json?.hits ?? [];
		const compose = (list) => list.filter((h) => h.id.startsWith('compose:'));
		const mine = compose(await hits(iApi, 'caglar'));
		t.eq(mine.map((h) => [h.id, h.kind, h.appId, h.target.section, h.target.itemId]), [[`compose:${isil.id}`, 'message', 'mail', 'compose', isil.id]], 'Posta’lı rol: "caglar" → Işıl için "mesaj gönder" sonucu');
		t.eq(Object.keys(mine[0] ?? {}).sort(), ['appId', 'id', 'kind', 'score', 'target', 'title'], 'sonuç yalnız ad taşır (alt başlık yok)');
		t.eq(compose(await hits(iApi, `Sosyoloji ${tag}`)), [], 'rolü Posta’yı açmayan kişi için sonuç yok');
		t.check(!JSON.stringify(await hits(iApi, isil.eposta)).includes(isil.eposta), 'e-posta ile aramada e-posta yanıtta yok');
		for (const [who, api] of [['Posta’sız rol', hApi], ['Üye Rehberi var, Posta yok', rApi]]) {
			t.eq(compose(await hits(api, 'caglar')), [], `${who}: aramada kişi mesajı yok`);
		}
		// Üye Rehberi'ni açabilen Posta'sız rol Işıl'ı rehber sonucunda görür; "mesaj" sonucu değil.
		t.eq((await hits(rApi, 'caglar')).filter((h) => h.kind === 'message'), [], 'Rehberci: hiçbir mesaj sonucu yok');
	});

	await t.step('API: öneriler son yazışılanlardır; kimseyle yazışılmadıysa dizin başı listelenir', async () => {
		const empty = await lookup(yApi, '');
		t.eq(empty.oneri, false, 'yazışma yokken öneri değil, dizin başı');
		t.check(empty.alicilar.length > 0 && empty.alicilar.length <= 20, 'yine de liste boş değil');
		t.eq((await lookup(iApi, '')).oneri, false, 'ipek: henüz yazışma yok');
		must(await iApi.post('/api/posta', { konu: `Öneri ${tag}`, govde: 'ilk', alicilar: [isil.id] }), 'ilk mesaj');
		await t.sleep(20);
		const first = await lookup(iApi, '');
		t.eq([first.oneri, ids(first)], [true, [isil.id]], 'ilk yazışmadan sonra öneri: Işıl');
		await t.sleep(20);
		must(await iApi.post('/api/posta', { konu: `Öneri 2 ${tag}`, govde: 'ikinci', alicilar: [yan.id, isil.id] }), 'ikinci mesaj');
		const second = await lookup(iApi, '');
		t.eq(second.oneri, true, 'öneri işaretli');
		t.sameSet(ids(second), [yan.id, isil.id], 'iki kişi öneride');
		t.includes(ids(await lookup(sApi, '')), ipek.id, 'Işıl için de kendisine yazan kişi öneride');
	});

	await t.step('arayüz (ipek): "Kişi bul" ile ara, klavye ile seç, Backspace ile kaldır, çoklu alıcı, boş sonuç', async () => {
		const { page } = await ipek.open();
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-find]').click();
		const sheet = page.getByRole('dialog', { name: 'Kişi Bul ve Yaz' });
		await sheet.waitFor();
		const input = sheet.locator('[data-mail-recipient-input]');
		t.check(await input.evaluate((el) => el === document.activeElement), 'alıcı kutusu odakta');
		// Boş kutuda son yazışılanlar öneri.
		await sheet.locator('[data-mail-recent]').waitFor();
		t.eq((await sheet.locator('[data-mail-recent]').textContent()).trim(), 'Son yazışılanlar', 'öneri başlığı');
		const recentIds = await sheet.locator('[data-mail-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mail-option')));
		t.sameSet(recentIds, [yan.id, isil.id], 'öneriler: yazışılan iki kişi');
		await t.shot(page, 'kisi-bul-oneri');

		// E-posta ile ara, ok tuşu + Enter ile seç.
		await input.fill(isil.eposta.split('@')[0]);
		const opt = sheet.locator(`[data-mail-option="${isil.id}"]`);
		await opt.waitFor();
		// The list shows the earlier suggestions until the debounced answer for the typed text arrives.
		await t.waitFor(async () => (await sheet.locator('[data-mail-option]').count()) === 1);
		t.eq(await sheet.locator('[data-mail-option]').count(), 1, 'e-posta: tek sonuç');
		t.check(!(await sheet.locator('[data-mail-suggestions]').innerText()).includes(isil.eposta), 'liste e-postayı göstermiyor');
		t.eq(await opt.getAttribute('aria-selected'), 'true', 'ilk ulaşılabilir sonuç seçili');
		await input.press('Enter');
		await sheet.locator(`[data-mail-chip="${isil.id}"]`).waitFor();
		t.eq(await input.inputValue(), '', 'seçince kutu temizlendi');
		// Bölümle ara; seçili olan sonuçta tekrar çıkmaz.
		await input.fill(`Jeofizik ${tag}`);
		await sheet.locator(`[data-mail-option="${yan.id}"]`).waitFor();
		await input.press('ArrowDown');
		await input.press('Enter');
		await sheet.locator(`[data-mail-chip="${yan.id}"]`).waitFor();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 2, 'iki alıcı çip olarak eklendi');
		// Backspace boş kutuda son çipi kaldırır; çipin düğmesi seçileni kaldırır.
		await input.press('Backspace');
		await sheet.locator(`[data-mail-chip="${yan.id}"]`).waitFor({ state: 'detached' });
		t.eq(await sheet.locator('[data-mail-chip]').count(), 1, 'Backspace son çipi kaldırdı');
		await sheet.locator(`[data-mail-chip="${isil.id}"] button`).click();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 0, 'çipin kaldır düğmesi çalıştı');
		// Öğrenci no ile ara.
		await input.fill(`73${digits}`);
		await sheet.locator(`[data-mail-option="${yan.id}"]`).waitFor();
		await t.waitFor(async () => (await sheet.locator('[data-mail-option]').count()) === 1);
		t.eq(await sheet.locator('[data-mail-option]').count(), 1, 'öğrenci no: tek sonuç');
		// Posta'sız rol: görünür, soluk/kapalı, Enter ile seçilmez, ok tuşu ona basmaz.
		await input.fill(`Sosyoloji ${tag}`);
		const closed = sheet.locator(`[data-mail-option="${haber.id}"]`);
		await closed.waitFor();
		t.check(await closed.isDisabled(), 'Posta’sız rol seçilemez');
		t.eq(await closed.getAttribute('aria-disabled'), 'true', 'aria-disabled');
		t.check(/Posta’yı açmıyor/.test(await closed.innerText()), 'nedeni yazıyor');
		await input.press('Enter');
		t.eq(await sheet.locator('[data-mail-chip]').count(), 0, 'Enter Posta’sız kişiyi seçmedi');
		await t.shot(page, 'kisi-bul-kapali');
		// Eşleşme yok.
		await input.fill(`yok-boyle-biri-${tag}`);
		await sheet.locator('[data-mail-no-matches]').waitFor();
		t.eq(await sheet.locator('[data-mail-no-matches]').innerText(), 'Eşleşen üye yok.', 'boş sonuç mesajı');
		await t.shot(page, 'kisi-bul-bos');
		// Tamam: iki kişiye birden gönder.
		await input.fill('');
		await sheet.locator(`[data-mail-option="${isil.id}"]`).click();
		await input.fill('yan');
		await sheet.locator(`[data-mail-option="${yan.id}"]`).click();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 2, 'çoklu alıcı: iki çip');
		await sheet.locator('[data-mail-subject]').fill(`Çoklu ${tag}`);
		await sheet.locator('[data-mail-body]').fill('İki kişiye birden.');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, 'Mesaj gönderildi.');
		await sheet.waitFor({ state: 'detached' });
		const toIsil = must(await sApi.get('/api/posta?klasor=gelen'), 'liste').konular.find((k) => k.konu === `Çoklu ${tag}`);
		const toYan = must(await yApi.get('/api/posta?klasor=gelen'), 'liste').konular.find((k) => k.konu === `Çoklu ${tag}`);
		t.check(toIsil && toYan, 'iki alıcının da gelen kutusuna düştü');
	});

	await t.step('arayüz: iki üye birbirini bulup mesajlaşır (Işıl ipek’i arar, yazar; ipek yanıtlar)', async () => {
		const { page } = await isil.open();
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-compose]').click();
		const sheet = page.getByRole('dialog', { name: 'Yeni Mesaj' });
		const input = sheet.locator('[data-mail-recipient-input]');
		await input.fill(`Astrofizik ${tag}`);
		await sheet.locator(`[data-mail-option="${ipek.id}"]`).click();
		await sheet.locator('[data-mail-subject]').fill(`Selam ${tag}`);
		await sheet.locator('[data-mail-body]').fill('Seni bölümünden buldum.');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, 'Mesaj gönderildi.');
		const got = must(await iApi.get('/api/posta?klasor=gelen'), 'ipek gelen').konular.find((k) => k.konu === `Selam ${tag}`);
		t.check(got, 'ipek mesajı aldı');
		const ip = (await ipek.open()).page;
		const iWin = await openApp(ip, 'mail');
		await iWin.locator(`[data-mail-thread="${got.id}"]`).click();
		await iWin.locator('[data-mail-reply]').fill('Buldun beni, merhaba!');
		await iWin.locator('[data-mail-reply-send]').click();
		await toast(ip, 'Yanıt gönderildi.');
		t.eq(must(await sApi.get(`/api/posta/${got.id}`), 'konu').mesajlar.length, 2, 'Işıl yanıtı görüyor: iki mesaj');
		await t.shot(ip, 'ikili-yazisma');
	});

	await t.step('arayüz (ipek): Üye Rehberi’nde "Mesaj gönder" yalnız ulaşılabilir kişide; tıklayınca Posta alıcı seçili açılır', async () => {
		t.eq((await iApi.get('/api/uyeler')).status, 200, 'önkoşul: ipek Üye Rehberi’ni açabiliyor');
		const { page } = await ipek.open();
		const dir = await openApp(page, 'members');
		await dir.locator(`[data-focus-id="member:${isil.id}"]`).waitFor();
		const btn = dir.locator(`[data-member-message="${isil.id}"]`);
		await btn.waitFor();
		t.eq(await dir.locator(`[data-member-message="${haber.id}"]`).count(), 0, 'rolü Posta’yı açmayan kişide düğme yok');
		t.eq(await dir.locator(`[data-member-message="${ipek.id}"]`).count(), 0, 'kendi satırında düğme yok');
		t.eq(await dir.locator(`[data-focus-id="member:${haber.id}"]`).count(), 1, 'o kişi satırda duruyor (yalnız düğme yok)');
		t.check((await btn.getAttribute('aria-label')).includes('Işıl'), 'düğme kişiyi adıyla söylüyor', await btn.getAttribute('aria-label'));
		await t.shot(page, 'rehber-mesaj-gonder');
		await btn.click();
		const mail = page.locator('[data-window-frame=mail]');
		await mail.waitFor();
		const sheet = page.getByRole('dialog', { name: 'Yeni Mesaj' });
		await sheet.locator(`[data-mail-chip="${isil.id}"]`).waitFor();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 1, 'Posta yazma penceresi o alıcı seçili açıldı');
		t.check(await sheet.locator('[data-mail-subject]').evaluate((el) => el === document.activeElement), 'imleç konu alanında');
		await t.shot(page, 'rehberden-yazma');
		await sheet.locator('[data-mail-subject]').fill(`Rehberden ${tag}`);
		await sheet.locator('[data-mail-body]').fill('Üye Rehberi’nden geldim.');
		await sheet.locator('[data-mail-send]').click();
		await toast(page, 'Mesaj gönderildi.');
		t.check(must(await sApi.get('/api/posta?klasor=gelen'), 'liste').konular.some((k) => k.konu === `Rehberden ${tag}`), 'Işıl mesajı aldı');
	});

	await t.step('arayüz (Spotlight): kişi arayınca "Mesaj gönder" sonucu Posta’yı alıcı seçili açar', async () => {
		const { page } = await ipek.open();
		await page.locator('[data-dock-app=mail]').waitFor();
		await page.keyboard.press('Control+Space');
		await page.locator('input[role=combobox][maxlength="120"]').fill('çağlar');
		const row = page.locator('[aria-label="Arama sonuçları"] [role=option]').filter({ hasText: 'Mesaj gönder: Işıl' });
		await row.first().waitFor();
		t.eq(await row.count(), 1, 'tek "Mesaj gönder" sonucu');
		await t.shot(page, 'spotlight-mesaj-gonder');
		await row.first().click();
		const sheet = page.getByRole('dialog', { name: 'Yeni Mesaj' });
		await sheet.locator(`[data-mail-chip="${isil.id}"]`).waitFor();
		t.eq(await sheet.locator('[data-mail-chip]').count(), 1, 'Spotlight: Posta alıcı seçili açıldı');
	});

	await t.step('Üye Rehberi var, Posta yok: rehberde düğme yok, Dock’ta Posta yok, Spotlight kişi mesajı önermiyor', async () => {
		const { page } = await rehberci.open();
		const dir = await openApp(page, 'members');
		await dir.locator(`[data-focus-id="member:${isil.id}"]`).waitFor();
		await page.waitForTimeout(600);
		t.eq(await dir.locator('[data-member-message]').count(), 0, 'hiçbir satırda "Mesaj gönder" yok');
		t.excludes(await dockApps(page), 'mail', 'Dock’ta Posta yok');
		await page.keyboard.press('Control+Space');
		await page.locator('input[role=combobox][maxlength="120"]').fill('çağlar');
		await page.locator('[aria-label="Arama sonuçları"] [role=option]').filter({ hasText: 'Çağlar' }).first().waitFor();
		t.eq(await page.locator('[aria-label="Arama sonuçları"] [role=option]').filter({ hasText: 'Mesaj gönder' }).count(), 0, 'Spotlight "Mesaj gönder" önermiyor');
		await t.shot(page, 'rehberci-postasiz');
	});

	await t.step('"Sadece Haberler": Üye Rehberi de Posta da yok (Dock, API, Spotlight)', async () => {
		const { page } = await haber.open();
		await page.locator('[data-dock-app=news]').waitFor();
		const apps = await dockApps(page);
		t.excludes(apps, 'mail', 'Dock’ta Posta yok');
		t.excludes(apps, 'members', 'Dock’ta Üye Rehberi yok');
		t.eq((await hApi.get('/api/uyeler')).status, 403, 'GET /api/uyeler → 403');
		t.eq((await hApi.get('/api/posta/alicilar?q=caglar')).status, 403, 'GET /api/posta/alicilar → 403');
		await page.keyboard.press('Control+Space');
		await page.locator('input[role=combobox][maxlength="120"]').fill('çağlar');
		await page.waitForTimeout(700);
		const text = await page.locator('[aria-label="Arama sonuçları"]').innerText();
		t.check(!/Çağlar|Mesaj gönder/.test(text), 'Spotlight kişiyi de mesajı da göstermiyor');
		await t.shot(page, 'haber-kisi-yok');
	});

	await t.step('mobil: kişi arama ve seçim çalışır', async () => {
		const { page } = await ipek.open({ mobile: true });
		await showLauncherApps(page);
		await page.locator('[data-launcher-app=mail]').click();
		await page.getByRole('button', { name: 'Geri' }).waitFor();
		await t.shot(page, 'mobil-posta');
		const win = page.locator('[data-mail-app]');
		await win.locator('[data-mail-find]').waitFor();
		await win.locator('[data-mail-find]').click();
		const sheet = page.getByRole('dialog', { name: 'Kişi Bul ve Yaz' });
		await sheet.locator('[data-mail-recipient-input]').fill('caglar');
		await sheet.locator(`[data-mail-option="${isil.id}"]`).click();
		await sheet.locator(`[data-mail-chip="${isil.id}"]`).waitFor();
		await t.shot(page, 'mobil-kisi-bul');
	});
}
