// Kasa: gelir/gider, düzeltme, silme, ödenek aktarımı, fiş yükleme, CSV, mali denetim raporu.
// Kullan = salt okur, Yönet = tümü, proje kaptanı kendi proje kasasına yazar.
import fs from 'node:fs';
import { client } from '../lib/api.mjs';
import { dockApps, openApp } from '../lib/browser.mjs';
import { dialogCevapla } from '../lib/diyalog.mjs';
import { geciciUye, uniq } from '../lib/gecici.mjs';
import { kasaBakiye, kasaKayitlari, kasaTemizle } from '../lib/kasa.mjs';
import { png, sahtePng } from '../lib/ornek-dosya.mjs';
import { SESSION_COOKIE } from '../lib/api.mjs';

export const meta = { title: 'Kasa: gelir/gider, düzeltme, silme, aktarım, fiş, CSV, denetim raporu, roller' };

const tl = (kurus) => (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const zeynep = await t.api('zeynep');
	const can = await t.api('can');
	const ege = await t.api('ege');
	const okur = await t.api('okur');
	const tag = uniq();
	const ACIK = (s) => `E2E ${s} ${tag}`;

	// A member who may only read the kasa, and a project of its own whose captain is "can".
	const reader = await geciciUye(t, { izinler: { budget: 'kullan', settings: 'kullan' }, ad: 'Kasaokur' });
	const team = (await admin.post('/api/takimlar', { action: 'createTeam', ad: `E2E Proje ${tag}`, kategori: 'Web & Mobil', aciklama: 'Kasa testi için geçici proje', kontenjan: 6, liderId: fx.users.can.id })).json?.team;
	if (!team) throw new Error('geçici proje kurulamadı');
	const created = []; // general-kasa entries this suite made
	t.cleanup(async () => {
		await kasaTemizle(admin, team.id);
		for (const id of created) await admin.del(`/api/butce?id=${encodeURIComponent(id)}`);
		await admin.post('/api/takimlar', { action: 'deleteTeam', takimId: team.id });
	});
	const find = async (aciklama, takimId = null) => (await kasaKayitlari(admin, takimId)).find((r) => r.aciklama === aciklama);
	const track = (r) => r && created.push(r.id);
	const row = (win, aciklama) => win.locator('tr[data-focus-id^="kasa-row:"]', { hasText: aciklama });
	const balanceText = (win) => win.locator('[data-testid=kasa-balance][data-loaded]').first().innerText();

	const zPage = (await t.open('zeynep')).page;
	const win = await openApp(zPage, 'budget');
	await win.locator('[data-testid=kasa-balance][data-loaded]').first().waitFor();
	const start = await kasaBakiye(admin);

	async function fillEntry(page, { tur, kategori, tutar, aciklama, dosya }) {
		const m = page.getByRole('dialog', { name: 'Yeni kasa kaydı' });
		await m.waitFor();
		await m.getByRole('radio', { name: tur === 'gelir' ? /^Gelir/ : /^Gider/ }).click();
		if (kategori) await m.locator('select').selectOption(kategori);
		await m.getByPlaceholder('1.250,00').fill(tutar);
		await m.locator('textarea').fill(aciklama);
		if (dosya) await m.locator('input[type=file]').setInputFiles(dosya);
		return m;
	}

	await t.step('gelir: arayüzden "1.250,50" yazılır, kuruş olarak kaydedilir, bakiye artar', async () => {
		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(zPage, { tur: 'gelir', kategori: 'Sponsorluk', tutar: '1.250,50', aciklama: ACIK('gelir') });
		await t.shot(zPage, 'gelir-formu');
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, ACIK('gelir')).waitFor();
		const r = await find(ACIK('gelir'));
		track(r);
		t.eq([r?.tur, r?.tutarKurus, r?.kategori], ['gelir', 125050, 'Sponsorluk'], 'kayıt: tür, tutar (kuruş) ve kategori');
		t.eq(await kasaBakiye(admin), start + 125050, 'bakiye 1.250,50 ₺ arttı');
		t.includes(await balanceText(win), tl(start + 125050), 'ekrandaki bakiye de güncellendi');
	});

	await t.step('gider: bakiyeyi aşan gider reddedilir, makul gider kaydedilir', async () => {
		const bal = await kasaBakiye(admin);
		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(zPage, { tur: 'gider', kategori: 'Donanım', tutar: tl(bal + 100), aciklama: ACIK('çok büyük gider') });
		await m.getByText('kasa eksiye düşemez').waitFor();
		t.eq(await m.getByRole('button', { name: 'Kaydet' }).isDisabled(), true, 'bakiyeyi aşan giderde "Kaydet" kapalı');
		await m.getByRole('button', { name: 'Vazgeç' }).click();
		const api = await zeynep.post('/api/butce', { tur: 'gider', kategori: 'Donanım', tutarKurus: bal + 100, aciklama: ACIK('çok büyük gider') });
		t.eq([api.status, api.json?.code], [409, 'INSUFFICIENT_FUNDS'], 'API de bakiyeyi aşan gideri reddediyor (409)');

		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const ok = await fillEntry(zPage, { tur: 'gider', kategori: 'Donanım', tutar: '400,25', aciklama: ACIK('gider') });
		await ok.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, ACIK('gider')).waitFor();
		const r = await find(ACIK('gider'));
		track(r);
		t.eq([r?.tur, r?.tutarKurus], ['gider', 40025], 'gider kuruş olarak kaydedildi');
		t.eq(await kasaBakiye(admin), bal - 40025, 'bakiye 400,25 ₺ azaldı');
	});

	await t.step('API doğrulamaları: tutar, tür, kategori, tarih, fiş bağlantısı', async () => {
		const base = { tur: 'gelir', kategori: 'Sponsorluk', tutarKurus: 100, aciklama: ACIK('doğrulama') };
		const post = (patch) => zeynep.post('/api/butce', { ...base, ...patch });
		const control = await post({ aciklama: ACIK('doğrulama kontrolü') });
		t.eq(control.status, 200, 'kontrol: geçerli kayıt kabul edilir (diğer ret sebepleri tek tek sınanıyor)');
		track(control.json);
		t.eq((await post({ tutarKurus: -5 })).status, 400, 'negatif tutar reddedildi');
		t.eq((await post({ tutarKurus: 1.5 })).status, 400, 'kesirli kuruş reddedildi');
		t.eq((await post({ tur: 'hediye' })).status, 400, 'bilinmeyen tür reddedildi');
		t.eq((await post({ kategori: 'Uydurma' })).status, 400, 'bilinmeyen kategori reddedildi');
		t.eq((await post({ tarih: Date.now() + 30 * 86_400_000 })).status, 400, 'gelecek tarih reddedildi');
		t.eq((await post({ fisFotoUrl: 'https://kotu.example/fis.png' })).status, 400, 'dışarıdan fiş bağlantısı reddedildi');
		t.eq((await post({ takimId: 'yok-boyle-proje' })).status, 404, 'olmayan proje 404');
	});

	await t.step('düzeltme: açıklama ve kategori değişir; tutar ve tür değişmez', async () => {
		const before = await find(ACIK('gider'));
		await row(win, ACIK('gider')).getByRole('button', { name: `Düzelt: ${ACIK('gider')}` }).click();
		const m = zPage.getByRole('dialog', { name: 'Kaydı düzelt' });
		await m.waitFor();
		t.eq(await m.getByPlaceholder('1.250,00').count(), 0, 'düzeltme formunda tutar yazılamıyor (kilitli)');
		await m.locator('select').selectOption('Ulaşım');
		await m.locator('textarea').fill(ACIK('gider düzeltildi'));
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, ACIK('gider düzeltildi')).waitFor();
		const after = await find(ACIK('gider düzeltildi'));
		t.eq(after?.id, before?.id, 'aynı kayıt düzeltildi');
		t.eq([after?.kategori, after?.tutarKurus, after?.tur], ['Ulaşım', 40025, 'gider'], 'kategori değişti, tutar ve tür aynı');
		t.includes(await row(win, ACIK('gider düzeltildi')).innerText(), 'düzeltildi', 'satırda "düzeltildi" izi var');
		const bad = await zeynep.patch('/api/butce', { id: before.id, tutarKurus: 1 });
		t.eq(bad.status, 400, 'tutarı API ile değiştirmek reddedildi');
		t.eq((await zeynep.patch('/api/butce', { id: before.id, tur: 'gelir' })).status, 400, 'türü API ile değiştirmek reddedildi');
		await t.shot(zPage, 'duzeltildi');
	});

	await t.step('silme: onay sorulur; silinen giderin tutarı bakiyeye döner', async () => {
		const bal = await kasaBakiye(admin);
		const target = ACIK('gider düzeltildi');
		await row(win, target).getByRole('button', { name: `Sil: ${target}` }).click();
		const asked = await dialogCevapla(zPage, false);
		t.includes(asked, 'silinsin mi', 'silmeden önce onay isteniyor');
		t.check(await find(target), 'vazgeçince kayıt silinmedi');
		await row(win, target).getByRole('button', { name: `Sil: ${target}` }).click();
		await dialogCevapla(zPage, true);
		await t.waitFor(async () => !(await find(target)));
		t.check(!(await find(target)), 'onaylayınca kayıt silindi');
		t.eq(await kasaBakiye(admin), bal + 40025, 'bakiye giderin tutarı kadar geri geldi');
		// Para giren kayıt harcanmışsa silinemez: bakiyenin tamamı harcanınca gelir silinemez.
		const full = await kasaBakiye(admin);
		const spent = (await admin.post('/api/butce', { tur: 'gider', kategori: 'Diğer', tutarKurus: full, aciklama: ACIK('tümünü harca') })).json;
		track(spent);
		const income = await find(ACIK('gelir'));
		const refuse = await admin.del(`/api/butce?id=${encodeURIComponent(income.id)}`);
		t.eq([refuse.status, refuse.json?.code], [409, 'INSUFFICIENT_FUNDS'], 'harcanmış gelir silinemez (409)');
		t.check(await find(ACIK('gelir')), 'reddedilen silme geliri yerinde bıraktı');
		await admin.del(`/api/butce?id=${encodeURIComponent(spent.id)}`);
		created.splice(created.indexOf(spent.id), 1);
		t.eq(await kasaBakiye(admin), full, 'harcama geri alınınca bakiye eski haline döndü');
	});

	await t.step('fiş: yüklenir, kayda bağlanır, kasaya erişenler görür; sahte dosya reddedilir', async () => {
		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(zPage, { tur: 'gelir', kategori: 'Sponsorluk', tutar: '10,00', aciklama: ACIK('fişli gelir'), dosya: png('fis.png') });
		await m.getByText('Fiş ekli — görüntüle').waitFor();
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, ACIK('fişli gelir')).waitFor();
		const r = await find(ACIK('fişli gelir'));
		track(r);
		t.check(/^\/api\/uploads\/\d+_[a-f0-9]+\.png$/.test(r?.fisFotoUrl ?? ''), 'kayıt fişin adresini taşıyor', String(r?.fisFotoUrl));
		t.eq(await row(win, ACIK('fişli gelir')).getByRole('link', { name: 'Fiş' }).count(), 1, 'satırda "Fiş" bağlantısı var');
		t.eq((await zeynep.get(r.fisFotoUrl)).status, 200, 'Kasa yöneticisi fişi görüntüleyebiliyor');
		t.eq((await reader.api.get(r.fisFotoUrl)).status, 200, 'kasa okuyucusu da görüyor');
		t.check((await okur.get(r.fisFotoUrl)).status >= 403, 'kasaya erişimi olmayan fişi göremiyor', String((await okur.get(r.fisFotoUrl)).status));
		await t.shot(zPage, 'fisli-kayit');

		const form = new FormData();
		form.append('file', new Blob([sahtePng().buffer], { type: 'image/png' }), 'sahte.png');
		const fake = await fetch(`${t.base}/api/upload`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${zeynep.token}` }, body: form });
		t.eq(fake.status, 415, 'resim olmayan dosya .png adıyla yüklenemez (415)');
		const unauth = await fetch(`${t.base}/api/upload`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${reader.api.token}` }, body: form });
		t.eq(unauth.status, 403, 'yalnız okuyabilen üye fiş yükleyemez (403)');
	});

	await t.step('ödenek aktarımı: iki taraflı kayıt, yetersiz bakiye engeli, tek tarafı silince ikisi de gider', async () => {
		const g0 = await kasaBakiye(admin);
		const p0 = await kasaBakiye(admin, team.id);
		await win.getByRole('button', { name: 'Ödenek aktar', exact: true }).click();
		const m = zPage.getByRole('dialog', { name: 'Ödenek aktar', exact: true });
		await m.waitFor();
		await m.locator('select').nth(1).selectOption(team.id);
		await m.getByPlaceholder('5.000,00').fill('100,00');
		await m.getByPlaceholder(/Güz dönemi proje ödeneği/).fill(ACIK('aktarım'));
		await m.getByRole('button', { name: 'Aktar' }).click();
		await m.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await kasaBakiye(admin, team.id)) === p0 + 10000);
		t.eq(await kasaBakiye(admin), g0 - 10000, 'genel kasadan 100 ₺ çıktı');
		t.eq(await kasaBakiye(admin, team.id), p0 + 10000, 'proje kasasına 100 ₺ girdi');
		const out = await find(ACIK('aktarım'));
		const into = await find(ACIK('aktarım'), team.id);
		t.eq([out?.tur, into?.tur], ['gider', 'gelir'], 'iki taraf: genelde gider, projede gelir');
		t.check(out?.aktarimId && out.aktarimId === into?.aktarimId, 'iki kayıt aynı aktarım kimliğini taşıyor');
		await t.shot(zPage, 'aktarim');

		const tooMuch = await zeynep.post('/api/butce', { action: 'aktar', kaynak: team.id, hedef: 'genel', tutarKurus: p0 + 10000 + 100, aciklama: ACIK('fazla aktarım') });
		t.eq(tooMuch.status, 409, 'kaynak kasanın bakiyesini aşan aktarım reddedildi (409)');
		t.eq((await zeynep.post('/api/butce', { action: 'aktar', kaynak: 'genel', hedef: 'genel', tutarKurus: 100, aciklama: ACIK('aynı') })).status, 400, 'kaynak ve hedef aynı olamaz');

		await row(win, ACIK('aktarım')).getByRole('button', { name: `Sil: ${ACIK('aktarım')}` }).click();
		const asked = await dialogCevapla(zPage, true);
		t.includes(asked, 'ödenek aktarımı geri alınsın mı', 'aktarımı silmek "geri alma" olarak soruluyor');
		await t.waitFor(async () => !(await find(ACIK('aktarım'))));
		t.eq([await kasaBakiye(admin), await kasaBakiye(admin, team.id)], [g0, p0], 'tek tarafı silince iki kasa da eski haline döndü');
		// Kaptan testi için projeye yeniden ödenek.
		const again = await zeynep.post('/api/butce', { action: 'aktar', kaynak: 'genel', hedef: team.id, tutarKurus: 50000, aciklama: ACIK('proje ödeneği') });
		t.eq(again.status, 201, 'projeye 500 ₺ ödenek aktarıldı');
	});

	await t.step('CSV: görünen kayıtlar Excel uyumlu dosya olarak iner', async () => {
		await win.getByLabel('Kasa kayıtlarında ara').fill(tag);
		const [dl] = await Promise.all([zPage.waitForEvent('download'), win.getByRole('button', { name: 'CSV' }).click()]);
		const text = fs.readFileSync(await dl.path(), 'utf8');
		t.check(text.startsWith('﻿'), 'dosya BOM ile başlıyor (Türkçe karakterler Excel\'de bozulmaz)');
		t.includes(text, 'Tarih;Tür;Kategori;Açıklama', 'başlık satırı noktalı virgülle ayrılmış');
		t.includes(text, ACIK('gelir'), 'süzülen kayıt dosyada');
		t.includes(text, '1250.5', 'tutar sayı olarak yazıldı');
		const lines = text.trim().split('\n').length - 1;
		t.eq(lines, await win.locator('tr[data-focus-id^="kasa-row:"]').count(), 'dosyadaki satır sayısı ekrandakiyle aynı (süzgeç uygulandı)');
		await win.getByLabel('Kasa kayıtlarında ara').fill('');
	});

	await t.step('mali denetim raporu: toplamlar, hareketler ve imza satırları', async () => {
		// The panel on screen was loaded before the last transfers (made over the API): reload it.
		await zPage.reload();
		await openApp(zPage, 'budget');
		await zPage.locator('[data-testid=kasa-balance][data-loaded]').first().waitFor();
		await zPage.locator('[data-menubar-category=file]').click();
		const [popup] = await Promise.all([zPage.context().waitForEvent('page'), zPage.locator('[data-menu-item=export-pdf]').click()]);
		await popup.waitForLoadState('domcontentloaded');
		const body = await popup.locator('body').innerText();
		t.includes(body, 'Genel Kasa — Mali Denetim Raporu', 'rapor başlığı');
		t.includes(body, 'Toplam gelir', 'toplam gelir');
		t.includes(body, 'Net bakiye', 'net bakiye');
		t.includes(body, tl(await kasaBakiye(admin)), 'rapordaki net bakiye kasayla aynı');
		t.includes(body, ACIK('gelir'), 'hareketler listede');
		t.includes(body, 'Hazırlayan', 'imza satırı (Hazırlayan)');
		t.includes(body, 'Denetleyen', 'imza satırı (Denetleyen)');
		await popup.close();
	});

	await t.step('Kullan = salt okur: görür, yazamaz', async () => {
		const { page } = await reader.open();
		const w = await openApp(page, 'budget');
		await w.locator('[data-testid=kasa-balance][data-loaded]').first().waitFor();
		await row(w, ACIK('gelir')).waitFor();
		t.eq(await w.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).count(), 0, 'okuyucuda "yeni kayıt" yok');
		t.eq(await w.getByRole('button', { name: 'Ödenek aktar', exact: true }).count(), 0, 'okuyucuda "ödenek aktar" yok');
		t.eq(await w.getByRole('button', { name: /^(Düzelt|Sil):/ }).count(), 0, 'okuyucuda düzelt/sil düğmeleri yok');
		t.eq(await w.getByRole('button', { name: 'CSV' }).isEnabled(), true, 'okuyucu CSV alabiliyor');
		await t.shot(page, 'kullan-salt-okur');
		const id = (await find(ACIK('gelir')))?.id;
		const post = await reader.api.post('/api/butce', { tur: 'gelir', kategori: 'Sponsorluk', tutarKurus: 100, aciklama: ACIK('okuyucu yazamaz') });
		t.eq(post.status, 403, 'okuyucu kayıt ekleyemez (403)');
		t.eq((await reader.api.patch('/api/butce', { id, aciklama: 'x' })).status, 403, 'okuyucu düzeltemez (403)');
		t.eq((await reader.api.del(`/api/butce?id=${encodeURIComponent(id)}`)).status, 403, 'okuyucu silemez (403)');
		t.eq((await reader.api.post('/api/butce', { action: 'aktar', kaynak: 'genel', hedef: team.id, tutarKurus: 100, aciklama: ACIK('okuyucu aktaramaz') })).status, 403, 'okuyucu aktarım yapamaz (403)');
		t.eq((await reader.api.get('/api/butce')).status, 200, 'okuyucu genel kasayı okuyabilir');
		t.eq((await reader.api.get(`/api/butce?takimId=${team.id}`)).status, 200, 'okuyucu proje kasasını da okuyabilir');
		const kasalar = (await reader.api.get('/api/butce/kasalar')).json?.kasalar ?? [];
		t.check(kasalar.some((k) => k.takimId === team.id) && kasalar.some((k) => k.takimId === null), 'kasa listesinde genel ve proje kasaları var');
		t.check(!(await find(ACIK('okuyucu yazamaz'))), 'reddedilen kayıt oluşmadı');
	});

	await t.step('proje kaptanı kendi proje kasasına yazar (Takımlar → Proje Kasası)', async () => {
		const { page } = await t.open('can');
		t.excludes(await dockApps(page), 'budget', 'kaptanın Dock\'unda Kasa uygulaması yok');
		const w = await openApp(page, 'teams');
		await w.locator(`[data-team-id="${team.id}"]`).getByRole('button', { name: 'Çalışma Alanı' }).click();
		await w.locator('[data-focus-section=kasa]').click();
		await w.locator('[data-testid=kasa-balance][data-loaded]').first().waitFor();
		t.includes(await balanceText(w), tl(50000), 'proje kasasının bakiyesi aktarılan ödenek');
		t.eq(await w.getByRole('button', { name: 'Ödenek aktar', exact: true }).count(), 0, 'kaptan ödenek aktaramaz');
		await w.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(page, { tur: 'gider', kategori: 'Donanım', tutar: '125,00', aciklama: ACIK('kaptan gideri') });
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(w, ACIK('kaptan gideri')).waitFor();
		const r = await find(ACIK('kaptan gideri'), team.id);
		t.eq([r?.tur, r?.tutarKurus], ['gider', 12500], 'kaptanın gideri proje kasasına yazıldı');
		t.eq(await kasaBakiye(admin, team.id), 50000 - 12500, 'proje bakiyesi düştü');
		await t.shot(page, 'kaptan-proje-kasasi');

		// Sınırlar: yalnız kendi projesi.
		const mine = { tur: 'gelir', kategori: 'Sponsorluk', tutarKurus: 100 };
		t.eq((await can.post('/api/butce', { ...mine, takimId: team.id, aciklama: ACIK('kaptan geliri') })).status, 200, 'kaptan kendi projesine API ile de yazabilir');
		t.eq((await can.post('/api/butce', { ...mine, aciklama: ACIK('kaptan genele') })).status, 403, 'kaptan genel kasaya yazamaz (403)');
		t.eq((await can.get('/api/butce')).status, 403, 'kaptan genel kasayı okuyamaz (403)');
		t.eq((await can.post('/api/butce', { ...mine, takimId: fx.content.team.team.id, aciklama: ACIK('kaptan başka projeye') })).status, 403, 'kaptan başka projenin kasasına yazamaz (403)');
		t.eq((await can.post('/api/butce', { action: 'aktar', kaynak: team.id, hedef: 'genel', tutarKurus: 100, aciklama: ACIK('kaptan aktarımı') })).status, 403, 'kaptan aktarım yapamaz (403)');
		const kasalar = (await can.get('/api/butce/kasalar')).json?.kasalar ?? [];
		t.eq(kasalar.map((k) => k.takimId), [team.id], 'kaptanın kasa listesinde yalnız kendi projesi var');
		t.eq((await ege.post('/api/butce', { ...mine, takimId: team.id, aciklama: ACIK('başka kaptan') })).status, 403, 'başka projenin kaptanı bu projeye yazamaz (403)');
		t.check(!(await find(ACIK('kaptan genele'))) && !(await find(ACIK('başka kaptan'), team.id)), 'reddedilen kayıtlar oluşmadı');
	});

	await t.step('Sadece Haberler: Kasa hiç görünmez, API kapalı', async () => {
		const { page } = await t.open('okur');
		t.excludes(await dockApps(page), 'budget', 'Dock\'ta Kasa yok');
		t.eq((await okur.get('/api/butce')).status, 403, 'okuma 403');
		t.eq((await okur.get('/api/butce/kasalar')).status, 403, 'kasa listesi 403');
		t.eq((await okur.post('/api/butce', { tur: 'gelir', kategori: 'Sponsorluk', tutarKurus: 100, aciklama: ACIK('okur') })).status, 403, 'yazma 403');
		t.eq((await client(t.base).get('/api/butce')).status, 401, 'oturumsuz istek 401');
	});
}
