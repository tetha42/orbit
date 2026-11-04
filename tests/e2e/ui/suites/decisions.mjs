// Kararlar (Resmi Evrak): belge yazma, düzenleme, kilitleme (kilit açma yalnız Admin),
// evrak sayısı, herkese açık doğrulama sayfası özeti ve rol sınırları.
import { client } from '../lib/api.mjs';
import { dockApps, openApp } from '../lib/browser.mjs';
import { dialogReply } from '../lib/diyalog.mjs';
import { uniq } from '../lib/temporary.mjs';

export const meta = { title: 'Kararlar: belge yazma/düzenleme/kilit, evrak sayısı, doğrulama sayfası, roller' };

/** 2026005 → "2026/005", the way the portal prints it. */
const document = (no) => `${Math.floor(no / 1000)}/${String(no % 1000).padStart(3, '0')}`;

export default async function suite(t) {
	const admin = await t.api('admin');
	const zeynep = await t.api('zeynep');
	const can = await t.api('can');
	const reader = await t.api('reader');
	const tag = uniq();
	const year = new Date().getFullYear();
	const TITLE = `E2E Karar ${tag}`;
	const TITLE_2 = `E2E Gizli Evrak ${tag}`;
	const CONTENT = 'Yönetim Kurulu bu denemeyi oy birliği ile kabul etmiştir.';

	// Whatever the suite made goes: a locked document is unlocked first (the admin may), then deleted.
	const made = [];
	t.cleanup(async () => {
		for (const id of made) {
			await admin.post('/api/decisions', { action: 'unlock', id });
			await admin.del(`/api/decisions?id=${encodeURIComponent(id)}`);
		}
	});
	const list = async (c = admin) => (await c.get('/api/decisions')).json;
	const byTitle = async (title, c = admin) => (await list(c)).find((d) => d.title === title);
	const row = (win, title) => win.locator('[data-focus-id^="decision:"]', { hasText: title });

	const before = await list();
	const maxBefore = Math.max(year * 1000, ...before.map((d) => d.decisionNo).filter((n) => Math.floor(n / 1000) === year));

	let doc = null; // the public document written in the UI
	let secret = null; // the members-hidden one written over the API

	const zeynepPage = (await t.open('zeynep')).page;
	const zWin = await openApp(zeynepPage, 'decisions');

	await t.step('Yönetim Kurulu arayüzden belge yazıyor; evrak sayısı yıl/sıra', async () => {
		await zWin.getByRole('button', { name: 'Yeni Evrak' }).click();
		await zWin.getByText('Yönetim Kurulu Karar Tutanağı').click();
		const form = zWin.locator('form');
		await form.locator('input[type=text]').fill(TITLE);
		await form.locator('textarea').nth(0).fill('1. Deneme gündemi');
		await form.locator('textarea').nth(1).fill(CONTENT);
		await t.shot(zeynepPage, 'yeni-evrak-formu');
		await form.getByRole('button', { name: 'Evrakı Mühürle & Kaydet' }).click();
		await row(zWin, TITLE).waitFor();

		doc = await byTitle(TITLE);
		t.check(doc, 'belge API listesinde');
		if (!doc) return;
		made.push(doc.id);
		t.eq(doc.decisionNo, maxBefore + 1, 'evrak numarası bir öncekinin devamı');
		t.eq(Math.floor(doc.decisionNo / 1000), year, 'numara bu yılın (YYYYnnn)');
		t.eq(doc.documentType, 'resolution', 'seçilen şablonun belge türü kaydedildi');
		t.eq(Number(doc.isPublicOpen), 1, 'arayüzden yazılan belge üyelere açık');
		t.eq(Number(doc.isLocked), 0, 'yeni belge kilitli değil');
		t.check(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/.test(doc.summary ?? ''), 'içerik özeti XXXX-XXXX-XXXX-XXXX biçiminde', doc.summary);
		const listed = await row(zWin, TITLE).innerText();
		t.includes(listed, `Sayı: ${document(doc.decisionNo)}`, 'listede evrak sayısı YYYY/nnn biçiminde');
		const page = await zWin.innerText();
		t.includes(page, `Evrak No: ${document(doc.decisionNo)}`, 'belge görünümü evrak numarasını gösteriyor');
		t.includes(page, `Doğrulama Kodu: BEU-EVRAK-${doc.decisionNo}`, 'basılı doğrulama kodu numarayla aynı');
		t.includes(page, doc.summary, 'basılı içerik özeti sunucudakiyle aynı');
		await t.shot(zeynepPage, 'belge-gorunumu');
	});

	await t.step('belge numaraları art arda gidiyor (API)', async () => {
		const res = await zeynep.post('/api/decisions', { title: TITLE_2, content: CONTENT, documentType: 'event_permission', isPublicOpen: false });
		t.eq(res.status, 201, 'Yönetim Kurulu API ile belge yazabiliyor');
		secret = res.json;
		if (secret?.id) made.push(secret.id);
		t.eq(secret?.decisionNo, (doc?.decisionNo ?? -1) + 1, 'ikinci belge bir sonraki numarayı aldı');
		const bad = await zeynep.post('/api/decisions', { title: 'ab', content: CONTENT });
		t.eq(bad.status, 400, 'çok kısa başlık reddedildi');
		const bad2 = await zeynep.post('/api/decisions', { title: TITLE, content: 'kısa' });
		t.eq(bad2.status, 400, 'çok kısa içerik reddedildi');
		const bad3 = await zeynep.post('/api/decisions', { title: TITLE, content: CONTENT, documentType: 'yok_boyle_tur' });
		t.eq(bad3.status, 400, 'bilinmeyen belge türü reddedildi');
	});

	await t.step('düzenleme: başlık ve metin değişir, içerik özeti de değişir', async () => {
		if (!doc) return;
		const oldSummary = doc.summary;
		await row(zWin, TITLE).click();
		await zWin.getByRole('button', { name: 'Düzenle' }).click();
		const sheet = zeynepPage.getByRole('dialog', { name: `Belge ${document(doc.decisionNo)}` });
		await sheet.waitFor();
		const fresh = `${TITLE} (düzeltildi)`;
		await sheet.locator('input[required]').fill(fresh);
		await sheet.locator('textarea[required]').fill(`${CONTENT} Metin düzeltilmiştir.`);
		await sheet.getByRole('button', { name: 'Kaydet' }).click();
		await sheet.waitFor({ state: 'detached' });
		await row(zWin, fresh).waitFor();
		const after = await byTitle(fresh);
		t.check(after, 'yeni başlık API listesinde');
		t.eq(after?.id, doc.id, 'aynı belge güncellendi (yeni belge açılmadı)');
		t.eq(after?.decisionNo, doc.decisionNo, 'evrak numarası değişmedi');
		t.check(after && after.summary !== oldSummary, 'içerik özeti metinle birlikte değişti', `${oldSummary} → ${after?.summary}`);
		doc = after ?? doc;
		await t.shot(zeynepPage, 'belge-duzenlendi');

		// "Üyelere açık" kutusu kamuyaAcikMi alanını değiştirir.
		await zWin.getByRole('button', { name: 'Düzenle' }).click();
		await sheet.waitFor();
		await sheet.getByRole('checkbox').uncheck();
		await sheet.getByRole('button', { name: 'Kaydet' }).click();
		await sheet.waitFor({ state: 'detached' });
		await t.waitFor(async () => Number((await byTitle(fresh))?.isPublicOpen) === 0);
		t.eq(Number((await byTitle(fresh))?.isPublicOpen), 0, 'kutu kapatılınca belge üyelerden gizlendi');
		await zWin.getByRole('button', { name: 'Düzenle' }).click();
		await sheet.waitFor();
		await sheet.getByRole('checkbox').check();
		await sheet.getByRole('button', { name: 'Kaydet' }).click();
		await sheet.waitFor({ state: 'detached' });
		await t.waitFor(async () => Number((await byTitle(fresh))?.isPublicOpen) === 1);
		t.eq(Number((await byTitle(fresh))?.isPublicOpen), 1, 'kutu açılınca belge tekrar üyelere açık');
		doc = await byTitle(fresh);
	});

	await t.step('kilitleme: vazgeçilirse kilitlenmez; onaylanınca düzenleme ve silme kapanır', async () => {
		if (!doc) return;
		await row(zWin, doc.title).click();
		await zWin.getByRole('button', { name: 'Onayla ve Kilitle' }).click();
		const asked = await dialogReply(zeynepPage, false);
		t.includes(asked, `Belge ${document(doc.decisionNo)} onaylanıp kilitlenecek`, 'onay penceresi belgeyi adıyla soruyor');
		t.eq(Number((await byTitle(doc.title))?.isLocked), 0, 'vazgeçince belge kilitlenmedi');

		await zWin.getByRole('button', { name: 'Onayla ve Kilitle' }).click();
		await dialogReply(zeynepPage, true);
		await zWin.getByText('Kilitli', { exact: true }).waitFor();
		t.eq(Number((await byTitle(doc.title))?.isLocked), 1, 'onaylayınca belge kilitlendi');
		for (const name of ['Düzenle', 'Onayla ve Kilitle', 'Sil']) {
			t.eq(await zWin.getByRole('button', { name }).count(), 0, `kilitli belgede "${name}" düğmesi yok`);
		}
		t.eq(await zWin.getByRole('button', { name: 'Kilidi Aç' }).count(), 0, 'Yönetim Kurulu kilidi açamaz: "Kilidi Aç" yok');
		t.eq(await zWin.getByRole('button', { name: 'Resmi SKS Dilekçesi Al' }).count(), 1, 'kilitli belge için resmi dilekçe alınabiliyor');
		await t.shot(zeynepPage, 'belge-kilitli');

		const patch = await zeynep.patch('/api/decisions', { id: doc.id, title: 'Kilitliyken değişmemeli' });
		t.eq(patch.status, 409, 'kilitli belge API ile de düzenlenemiyor (409)');
		const del = await zeynep.del(`/api/decisions?id=${encodeURIComponent(doc.id)}`);
		t.eq(del.status, 409, 'kilitli belge API ile de silinemiyor (409)');
		const unlock = await zeynep.post('/api/decisions', { action: 'unlock', id: doc.id });
		t.eq(unlock.status, 403, 'Yönetim Kurulu API ile kilit açamıyor (403)');
		t.eq(Number((await byTitle(doc.title))?.isLocked), 1, 'reddedilen istekler sonrası belge hâlâ kilitli');
	});

	await t.step('doğrulama sayfası (herkese açık): numara, durum ve içerik özeti', async () => {
		if (!doc || !secret) return;
		const { page } = await t.anonymous();
		const open = async (no) => {
			await page.goto(`${t.base}/dogrula/BEU-EVRAK-${no}`, { waitUntil: 'domcontentloaded' });
			await page.locator('main').waitFor();
			return page.locator('main').textContent();
		};
		const fresh = await byTitle(doc.title);
		let text = await open(fresh.decisionNo);
		t.includes(text, 'İmzalı ve kilitli belge', 'kilitli belge "imzalı ve kilitli" görünüyor');
		t.includes(text, document(fresh.decisionNo), 'sayfa evrak sayısını gösteriyor');
		t.includes(text, fresh.title, 'herkese açık belgenin konusu görünüyor');
		t.includes(text, fresh.summary, 'sayfadaki içerik özeti sunucudakiyle aynı');
		await t.shot(page, 'dogrulama-kilitli');

		text = await open(secret.decisionNo);
		t.includes(text, 'Kayıtlı — henüz kilitlenmemiş', 'kilitsiz belge "henüz kilitlenmemiş" diyor');
		t.includes(text, 'yalnızca yönetim kuruluna açıktır', 'gizli belgenin içeriği açık değil');
		t.excludes(text, TITLE_2, 'gizli belgenin konusu sayfada yok');
		const hidden = (await list()).find((d) => d.id === secret.id);
		t.includes(text, hidden.summary, 'gizli belgenin yalnız özeti görünüyor');

		text = await open(9999999);
		t.includes(text, 'Belge Bulunamadı', 'olmayan numara "Belge Bulunamadı"');
		await t.shot(page, 'dogrulama-yok');
	});

	await t.step('kilit açma yalnız Admin: arayüzde "Kilidi Aç"; açılınca belge düzenlenebilir', async () => {
		if (!doc) return;
		const { page } = await t.open('admin');
		const win = await openApp(page, 'decisions');
		await row(win, doc.title).click();
		await win.getByRole('button', { name: 'Kilidi Aç' }).click();
		const asked = await dialogReply(page, true);
		t.includes(asked, `Belge ${document(doc.decisionNo)} kilidi açılsın mı?`, 'kilit açma onay penceresi belgeyi soruyor');
		await win.getByRole('button', { name: 'Düzenle' }).waitFor();
		t.eq(Number((await byTitle(doc.title))?.isLocked), 0, 'Admin kilidi açtı');
		t.eq(await win.getByRole('button', { name: 'Kilidi Aç' }).count(), 0, 'kilit açılınca "Kilidi Aç" kayboldu');
		const ok = await zeynep.patch('/api/decisions', { id: doc.id, agenda: 'Kilit açıldıktan sonra düzenlendi' });
		t.eq(ok.status, 200, 'kilit açılınca düzenleme yeniden mümkün');
		await t.shot(page, 'admin-kilit-acti');
	});

	await t.step('silme: kilitsiz belge arayüzden silinir', async () => {
		const victim = await admin.post('/api/decisions', { title: `E2E Silinecek ${tag}`, content: CONTENT });
		t.eq(victim.status, 201, 'silinecek belge yazıldı');
		if (victim.json?.id) made.push(victim.json.id);
		// The list on screen was loaded before this document existed: reopen the desktop to refetch.
		await zeynepPage.reload();
		const win = await openApp(zeynepPage, 'decisions');
		await win.getByPlaceholder('Evrak, konu veya içerik ara...').fill(`Silinecek ${tag}`);
		await row(win, `E2E Silinecek ${tag}`).click();
		await win.getByRole('button', { name: 'Sil' }).click();
		const asked = await dialogReply(zeynepPage, true);
		t.includes(asked, 'kalıcı olarak silinsin mi', 'silme onayı soruluyor');
		await t.waitFor(async () => !(await byTitle(`E2E Silinecek ${tag}`)));
		t.check(!(await byTitle(`E2E Silinecek ${tag}`)), 'belge silindi');
	});

	await t.step('Üye (Kullan): belgeleri okur, yazamaz; gizli belgeyi görmez', async () => {
		const { page } = await t.open('can');
		const win = await openApp(page, 'decisions');
		await win.getByText('Salt Okunur').waitFor();
		t.eq(await win.getByRole('button', { name: 'Yeni Evrak' }).count(), 0, 'Üye: "Yeni Evrak" düğmesi yok');
		const visible = await list(can);
		t.check(visible.some((d) => d.id === doc?.id), 'Üye herkese açık belgeyi API ile okuyor');
		t.check(!visible.some((d) => d.id === secret?.id), 'Üye gizli belgeyi API listesinde görmüyor');
		await row(win, doc?.title ?? TITLE).waitFor();
		t.eq(await row(win, TITLE_2).count(), 0, 'Üye gizli belgeyi arayüzde görmüyor');
		await row(win, doc?.title ?? TITLE).click();
		for (const name of ['Düzenle', 'Onayla ve Kilitle', 'Sil', 'Kilidi Aç']) {
			t.eq(await win.getByRole('button', { name }).count(), 0, `Üye: "${name}" düğmesi yok`);
		}
		await t.shot(page, 'uye-salt-okur');

		t.eq((await can.post('/api/decisions', { title: 'Üye yazamaz', content: CONTENT })).status, 403, 'Üye belge yazamaz (403)');
		t.eq((await can.patch('/api/decisions', { id: doc?.id, title: 'Üye düzeltemez' })).status, 403, 'Üye belge düzenleyemez (403)');
		t.eq((await can.del(`/api/decisions?id=${encodeURIComponent(doc?.id ?? 'x')}`)).status, 403, 'Üye belge silemez (403)');
		t.eq((await can.post('/api/decisions', { action: 'lock', id: doc?.id })).status, 403, 'Üye belge kilitleyemez (403)');
		t.eq((await can.post('/api/decisions', { action: 'unlock', id: doc?.id })).status, 403, 'Üye kilit açamaz (403)');
		t.eq((await byTitle(doc?.title ?? TITLE))?.title, doc?.title, 'reddedilen isteklerden sonra belge değişmedi');
	});

	await t.step('Sadece Haberler: Kararlar uygulaması hiç yok, API kapalı', async () => {
		const { page } = await t.open('reader');
		t.eq(await dockApps(page), ['news', 'settings'], 'Dock\'ta Kararlar yok');
		t.eq((await reader.get('/api/decisions')).status, 403, 'okuma 403');
		t.eq((await reader.post('/api/decisions', { title: TITLE, content: CONTENT })).status, 403, 'yazma 403');
		const anon = client(t.base);
		t.eq((await anon.get('/api/decisions')).status, 401, 'oturumsuz istek 401');
	});

	await t.step('Yönetim Kurulu gizli belgeyi görüyor', async () => {
		if (!secret) return;
		const visible = await list(zeynep);
		t.check(visible.some((d) => d.id === secret.id), 'Yönetim Kurulu gizli belgeyi görüyor');
	});
}
