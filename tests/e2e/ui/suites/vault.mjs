// Kasa: gelir/gider, düzeltme, silme, ödenek aktarımı, fiş yükleme, CSV, mali denetim raporu.
// Kullan = salt okur, Yönet = tümü, proje kaptanı kendi proje kasasına yazar.
import fs from 'node:fs';
import { client } from '../lib/api.mjs';
import { dockApps, openApp } from '../lib/browser.mjs';
import { dialogReply } from '../lib/diyalog.mjs';
import { temporaryMember, uniq } from '../lib/temporary.mjs';
import { vaultBalance, vaultRecords, vaultClear } from '../lib/vault.mjs';
import { png, fakePng } from '../lib/sample-file.mjs';
import { SESSION_COOKIE } from '../lib/api.mjs';

export const meta = { title: 'Kasa: gelir/gider, düzeltme, silme, aktarım, fiş, CSV, denetim raporu, roller' };

const tl = (minor) => (minor / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const zeynep = await t.api('zeynep');
	const can = await t.api('can');
	const ege = await t.api('ege');
	const noAccess = await t.api('reader');
	const tag = uniq();
	const OPEN = (s) => `E2E ${s} ${tag}`;

	// A member who may only read the kasa, and a project of its own whose captain is "can".
	const reader = await temporaryMember(t, { permissions: { budget: 'use', settings: 'use' }, name: 'Kasaokur' });
	const team = (await admin.post('/api/takimlar', { action: 'createTeam', name: `E2E Proje ${tag}`, category: 'Web & Mobil', description: 'Kasa testi için geçici proje', capacity: 6, leadId: fx.users.can.id })).json?.team;
	if (!team) throw new Error('geçici proje kurulamadı');
	const created = []; // general-kasa entries this suite made
	t.cleanup(async () => {
		await vaultClear(admin, team.id);
		for (const id of created) await admin.del(`/api/butce?id=${encodeURIComponent(id)}`);
		await admin.post('/api/takimlar', { action: 'deleteTeam', teamId: team.id });
	});
	const find = async (description, teamId = null) => (await vaultRecords(admin, teamId)).find((r) => r.description === description);
	const track = (r) => r && created.push(r.id);
	const row = (win, description) => win.locator('tr[data-focus-id^="kasa-row:"]', { hasText: description });
	const balanceText = (win) => win.locator('[data-testid=vault-balance][data-loaded]').first().innerText();

	const zPage = (await t.open('zeynep')).page;
	const win = await openApp(zPage, 'budget');
	await win.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
	const start = await vaultBalance(admin);

	async function fillEntry(page, { typeValue, category, amount, description, file }) {
		const m = page.getByRole('dialog', { name: 'Yeni kasa kaydı' });
		await m.waitFor();
		await m.getByRole('radio', { name: typeValue === 'income' ? /^Gelir/ : /^Gider/ }).click();
		if (category) await m.locator('select').selectOption(category);
		await m.getByPlaceholder('1.250,00').fill(amount);
		await m.locator('textarea').fill(description);
		if (file) await m.locator('input[type=file]').setInputFiles(file);
		return m;
	}

	await t.step('gelir: arayüzden "1.250,50" yazılır, kuruş olarak kaydedilir, bakiye artar', async () => {
		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(zPage, { typeValue: 'income', category: 'Sponsorluk', amount: '1.250,50', description: OPEN('income') });
		await t.shot(zPage, 'gelir-formu');
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, OPEN('income')).waitFor();
		const r = await find(OPEN('income'));
		track(r);
		t.eq([r?.typeValue, r?.amountMinor, r?.category], ['income', 125050, 'Sponsorluk'], 'kayıt: tür, tutar (kuruş) ve kategori');
		t.eq(await vaultBalance(admin), start + 125050, 'bakiye 1.250,50 ₺ arttı');
		t.includes(await balanceText(win), tl(start + 125050), 'ekrandaki bakiye de güncellendi');
	});

	await t.step('gider: bakiyeyi aşan gider reddedilir, makul gider kaydedilir', async () => {
		const bal = await vaultBalance(admin);
		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(zPage, { typeValue: 'expense', category: 'Donanım', amount: tl(bal + 100), description: OPEN('çok büyük gider') });
		await m.getByText('kasa eksiye düşemez').waitFor();
		t.eq(await m.getByRole('button', { name: 'Kaydet' }).isDisabled(), true, 'bakiyeyi aşan giderde "Kaydet" kapalı');
		await m.getByRole('button', { name: 'Vazgeç' }).click();
		const api = await zeynep.post('/api/butce', { typeValue: 'expense', category: 'Donanım', amountMinor: bal + 100, description: OPEN('çok büyük gider') });
		t.eq([api.status, api.json?.code], [409, 'INSUFFICIENT_FUNDS'], 'API de bakiyeyi aşan gideri reddediyor (409)');

		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const ok = await fillEntry(zPage, { typeValue: 'expense', category: 'Donanım', amount: '400,25', description: OPEN('expense') });
		await ok.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, OPEN('expense')).waitFor();
		const r = await find(OPEN('expense'));
		track(r);
		t.eq([r?.typeValue, r?.amountMinor], ['expense', 40025], 'gider kuruş olarak kaydedildi');
		t.eq(await vaultBalance(admin), bal - 40025, 'bakiye 400,25 ₺ azaldı');
	});

	await t.step('API doğrulamaları: tutar, tür, kategori, tarih, fiş bağlantısı', async () => {
		const base = { typeValue: 'income', category: 'Sponsorluk', amountMinor: 100, description: OPEN('doğrulama') };
		const post = (patch) => zeynep.post('/api/butce', { ...base, ...patch });
		const control = await post({ description: OPEN('doğrulama kontrolü') });
		t.eq(control.status, 200, 'kontrol: geçerli kayıt kabul edilir (diğer ret sebepleri tek tek sınanıyor)');
		track(control.json);
		t.eq((await post({ amountMinor: -5 })).status, 400, 'negatif tutar reddedildi');
		t.eq((await post({ amountMinor: 1.5 })).status, 400, 'kesirli kuruş reddedildi');
		t.eq((await post({ typeValue: 'hediye' })).status, 400, 'bilinmeyen tür reddedildi');
		t.eq((await post({ category: 'Uydurma' })).status, 400, 'bilinmeyen kategori reddedildi');
		t.eq((await post({ date: Date.now() + 30 * 86_400_000 })).status, 400, 'gelecek tarih reddedildi');
		t.eq((await post({ receiptPhotoUrl: 'https://kotu.example/fis.png' })).status, 400, 'dışarıdan fiş bağlantısı reddedildi');
		t.eq((await post({ teamId: 'yok-boyle-proje' })).status, 404, 'olmayan proje 404');
	});

	await t.step('düzeltme: açıklama ve kategori değişir; tutar ve tür değişmez', async () => {
		const before = await find(OPEN('expense'));
		await row(win, OPEN('expense')).getByRole('button', { name: `Düzelt: ${OPEN('expense')}` }).click();
		const m = zPage.getByRole('dialog', { name: 'Kaydı düzelt' });
		await m.waitFor();
		t.eq(await m.getByPlaceholder('1.250,00').count(), 0, 'düzeltme formunda tutar yazılamıyor (kilitli)');
		await m.locator('select').selectOption('Ulaşım');
		await m.locator('textarea').fill(OPEN('gider düzeltildi'));
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, OPEN('gider düzeltildi')).waitFor();
		const after = await find(OPEN('gider düzeltildi'));
		t.eq(after?.id, before?.id, 'aynı kayıt düzeltildi');
		t.eq([after?.category, after?.amountMinor, after?.typeValue], ['Ulaşım', 40025, 'expense'], 'kategori değişti, tutar ve tür aynı');
		t.includes(await row(win, OPEN('gider düzeltildi')).innerText(), 'düzeltildi', 'satırda "düzeltildi" izi var');
		const bad = await zeynep.patch('/api/butce', { id: before.id, amountMinor: 1 });
		t.eq(bad.status, 400, 'tutarı API ile değiştirmek reddedildi');
		t.eq((await zeynep.patch('/api/butce', { id: before.id, typeValue: 'income' })).status, 400, 'türü API ile değiştirmek reddedildi');
		await t.shot(zPage, 'duzeltildi');
	});

	await t.step('silme: onay sorulur; silinen giderin tutarı bakiyeye döner', async () => {
		const bal = await vaultBalance(admin);
		const target = OPEN('gider düzeltildi');
		await row(win, target).getByRole('button', { name: `Sil: ${target}` }).click();
		const asked = await dialogReply(zPage, false);
		t.includes(asked, 'silinsin mi', 'silmeden önce onay isteniyor');
		t.check(await find(target), 'vazgeçince kayıt silinmedi');
		await row(win, target).getByRole('button', { name: `Sil: ${target}` }).click();
		await dialogReply(zPage, true);
		await t.waitFor(async () => !(await find(target)));
		t.check(!(await find(target)), 'onaylayınca kayıt silindi');
		t.eq(await vaultBalance(admin), bal + 40025, 'bakiye giderin tutarı kadar geri geldi');
		// Para giren kayıt harcanmışsa silinemez: bakiyenin tamamı harcanınca gelir silinemez.
		const full = await vaultBalance(admin);
		const spent = (await admin.post('/api/butce', { typeValue: 'expense', category: 'Diğer', amountMinor: full, description: OPEN('tümünü harca') })).json;
		track(spent);
		const income = await find(OPEN('income'));
		const refuse = await admin.del(`/api/butce?id=${encodeURIComponent(income.id)}`);
		t.eq([refuse.status, refuse.json?.code], [409, 'INSUFFICIENT_FUNDS'], 'harcanmış gelir silinemez (409)');
		t.check(await find(OPEN('income')), 'reddedilen silme geliri yerinde bıraktı');
		await admin.del(`/api/butce?id=${encodeURIComponent(spent.id)}`);
		created.splice(created.indexOf(spent.id), 1);
		t.eq(await vaultBalance(admin), full, 'harcama geri alınınca bakiye eski haline döndü');
	});

	await t.step('fiş: yüklenir, kayda bağlanır, kasaya erişenler görür; sahte dosya reddedilir', async () => {
		await win.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(zPage, { typeValue: 'income', category: 'Sponsorluk', amount: '10,00', description: OPEN('fişli gelir'), file: png('fis.png') });
		await m.getByText('Fiş ekli — görüntüle').waitFor();
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(win, OPEN('fişli gelir')).waitFor();
		const r = await find(OPEN('fişli gelir'));
		track(r);
		t.check(/^\/api\/uploads\/\d+_[a-f0-9]+\.png$/.test(r?.receiptPhotoUrl ?? ''), 'kayıt fişin adresini taşıyor', String(r?.receiptPhotoUrl));
		t.eq(await row(win, OPEN('fişli gelir')).getByRole('link', { name: 'Fiş' }).count(), 1, 'satırda "Fiş" bağlantısı var');
		t.eq((await zeynep.get(r.receiptPhotoUrl)).status, 200, 'Kasa yöneticisi fişi görüntüleyebiliyor');
		t.eq((await reader.api.get(r.receiptPhotoUrl)).status, 200, 'kasa okuyucusu da görüyor');
		t.check((await noAccess.get(r.receiptPhotoUrl)).status >= 403, 'kasaya erişimi olmayan fişi göremiyor', String((await noAccess.get(r.receiptPhotoUrl)).status));
		await t.shot(zPage, 'fisli-kayit');

		const form = new FormData();
		form.append('file', new Blob([fakePng().buffer], { type: 'image/png' }), 'sahte.png');
		const fake = await fetch(`${t.base}/api/upload`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${zeynep.token}` }, body: form });
		t.eq(fake.status, 415, 'resim olmayan dosya .png adıyla yüklenemez (415)');
		const unauth = await fetch(`${t.base}/api/upload`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${reader.api.token}` }, body: form });
		t.eq(unauth.status, 403, 'yalnız okuyabilen üye fiş yükleyemez (403)');
	});

	await t.step('ödenek aktarımı: iki taraflı kayıt, yetersiz bakiye engeli, tek tarafı silince ikisi de gider', async () => {
		const g0 = await vaultBalance(admin);
		const p0 = await vaultBalance(admin, team.id);
		await win.getByRole('button', { name: 'Ödenek aktar', exact: true }).click();
		const m = zPage.getByRole('dialog', { name: 'Ödenek aktar', exact: true });
		await m.waitFor();
		await m.locator('select').nth(1).selectOption(team.id);
		await m.getByPlaceholder('5.000,00').fill('100,00');
		await m.getByPlaceholder(/Güz dönemi proje ödeneği/).fill(OPEN('aktarım'));
		await m.getByRole('button', { name: 'Aktar' }).click();
		await m.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await vaultBalance(admin, team.id)) === p0 + 10000);
		t.eq(await vaultBalance(admin), g0 - 10000, 'genel kasadan 100 ₺ çıktı');
		t.eq(await vaultBalance(admin, team.id), p0 + 10000, 'proje kasasına 100 ₺ girdi');
		const out = await find(OPEN('aktarım'));
		const into = await find(OPEN('aktarım'), team.id);
		t.eq([out?.typeValue, into?.typeValue], ['expense', 'income'], 'iki taraf: genelde gider, projede gelir');
		t.check(out?.transferId && out.transferId === into?.transferId, 'iki kayıt aynı aktarım kimliğini taşıyor');
		await t.shot(zPage, 'transfer');

		const tooMuch = await zeynep.post('/api/butce', { action: 'transfer', source: team.id, target: 'general', amountMinor: p0 + 10000 + 100, description: OPEN('fazla aktarım') });
		t.eq(tooMuch.status, 409, 'kaynak kasanın bakiyesini aşan aktarım reddedildi (409)');
		t.eq((await zeynep.post('/api/butce', { action: 'transfer', source: 'general', target: 'general', amountMinor: 100, description: OPEN('aynı') })).status, 400, 'kaynak ve hedef aynı olamaz');

		await row(win, OPEN('aktarım')).getByRole('button', { name: `Sil: ${OPEN('aktarım')}` }).click();
		const asked = await dialogReply(zPage, true);
		t.includes(asked, 'ödenek aktarımı geri alınsın mı', 'aktarımı silmek "geri alma" olarak soruluyor');
		await t.waitFor(async () => !(await find(OPEN('aktarım'))));
		t.eq([await vaultBalance(admin), await vaultBalance(admin, team.id)], [g0, p0], 'tek tarafı silince iki kasa da eski haline döndü');
		// Kaptan testi için projeye yeniden ödenek.
		const again = await zeynep.post('/api/butce', { action: 'transfer', source: 'general', target: team.id, amountMinor: 50000, description: OPEN('proje ödeneği') });
		t.eq(again.status, 201, 'projeye 500 ₺ ödenek aktarıldı');
	});

	await t.step('CSV: görünen kayıtlar Excel uyumlu dosya olarak iner', async () => {
		await win.getByLabel('Kasa kayıtlarında ara').fill(tag);
		const [dl] = await Promise.all([zPage.waitForEvent('download'), win.getByRole('button', { name: 'CSV' }).click()]);
		const text = fs.readFileSync(await dl.path(), 'utf8');
		t.check(text.startsWith('﻿'), 'dosya BOM ile başlıyor (Türkçe karakterler Excel\'de bozulmaz)');
		t.includes(text, 'Tarih;Tür;Kategori;Açıklama', 'başlık satırı noktalı virgülle ayrılmış');
		t.includes(text, OPEN('income'), 'süzülen kayıt dosyada');
		t.includes(text, '1250.5', 'tutar sayı olarak yazıldı');
		const lines = text.trim().split('\n').length - 1;
		t.eq(lines, await win.locator('tr[data-focus-id^="kasa-row:"]').count(), 'dosyadaki satır sayısı ekrandakiyle aynı (süzgeç uygulandı)');
		await win.getByLabel('Kasa kayıtlarında ara').fill('');
	});

	await t.step('mali denetim raporu: toplamlar, hareketler ve imza satırları', async () => {
		// The panel on screen was loaded before the last transfers (made over the API): reload it.
		await zPage.reload();
		await openApp(zPage, 'budget');
		await zPage.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
		await zPage.locator('[data-menubar-category=file]').click();
		const [popup] = await Promise.all([zPage.context().waitForEvent('page'), zPage.locator('[data-menu-item=export-pdf]').click()]);
		await popup.waitForLoadState('domcontentloaded');
		const body = await popup.locator('body').innerText();
		t.includes(body, 'Genel Kasa — Mali Denetim Raporu', 'rapor başlığı');
		t.includes(body, 'Toplam gelir', 'toplam gelir');
		t.includes(body, 'Net bakiye', 'net bakiye');
		t.includes(body, tl(await vaultBalance(admin)), 'rapordaki net bakiye kasayla aynı');
		t.includes(body, OPEN('income'), 'hareketler listede');
		t.includes(body, 'Hazırlayan', 'imza satırı (Hazırlayan)');
		t.includes(body, 'Denetleyen', 'imza satırı (Denetleyen)');
		await popup.close();
	});

	await t.step('Kullan = salt okur: görür, yazamaz', async () => {
		const { page } = await reader.open();
		const w = await openApp(page, 'budget');
		await w.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
		await row(w, OPEN('income')).waitFor();
		t.eq(await w.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).count(), 0, 'okuyucuda "yeni kayıt" yok');
		t.eq(await w.getByRole('button', { name: 'Ödenek aktar', exact: true }).count(), 0, 'okuyucuda "ödenek aktar" yok');
		t.eq(await w.getByRole('button', { name: /^(Düzelt|Sil):/ }).count(), 0, 'okuyucuda düzelt/sil düğmeleri yok');
		t.eq(await w.getByRole('button', { name: 'CSV' }).isEnabled(), true, 'okuyucu CSV alabiliyor');
		await t.shot(page, 'kullan-salt-okur');
		const id = (await find(OPEN('income')))?.id;
		const post = await reader.api.post('/api/butce', { typeValue: 'income', category: 'Sponsorluk', amountMinor: 100, description: OPEN('okuyucu yazamaz') });
		t.eq(post.status, 403, 'okuyucu kayıt ekleyemez (403)');
		t.eq((await reader.api.patch('/api/butce', { id, description: 'x' })).status, 403, 'okuyucu düzeltemez (403)');
		t.eq((await reader.api.del(`/api/butce?id=${encodeURIComponent(id)}`)).status, 403, 'okuyucu silemez (403)');
		t.eq((await reader.api.post('/api/butce', { action: 'transfer', source: 'general', target: team.id, amountMinor: 100, description: OPEN('okuyucu aktaramaz') })).status, 403, 'okuyucu aktarım yapamaz (403)');
		t.eq((await reader.api.get('/api/butce')).status, 200, 'okuyucu genel kasayı okuyabilir');
		t.eq((await reader.api.get(`/api/butce?teamId=${team.id}`)).status, 200, 'okuyucu proje kasasını da okuyabilir');
		const vaults = (await reader.api.get('/api/butce/kasalar')).json?.vaults ?? [];
		t.check(vaults.some((k) => k.teamId === team.id) && vaults.some((k) => k.teamId === null), 'kasa listesinde genel ve proje kasaları var');
		t.check(!(await find(OPEN('okuyucu yazamaz'))), 'reddedilen kayıt oluşmadı');
	});

	await t.step('proje kaptanı kendi proje kasasına yazar (Takımlar → Proje Kasası)', async () => {
		const { page } = await t.open('can');
		t.excludes(await dockApps(page), 'budget', 'kaptanın Dock\'unda Kasa uygulaması yok');
		const w = await openApp(page, 'teams');
		await w.locator(`[data-team-id="${team.id}"]`).getByRole('button', { name: 'Çalışma Alanı' }).click();
		await w.locator('[data-focus-section=kasa]').click();
		await w.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
		t.includes(await balanceText(w), tl(50000), 'proje kasasının bakiyesi aktarılan ödenek');
		t.eq(await w.getByRole('button', { name: 'Ödenek aktar', exact: true }).count(), 0, 'kaptan ödenek aktaramaz');
		await w.getByRole('button', { name: 'Yeni Gelir / Gider Girişi' }).click();
		const m = await fillEntry(page, { typeValue: 'expense', category: 'Donanım', amount: '125,00', description: OPEN('kaptan gideri') });
		await m.getByRole('button', { name: 'Kaydet' }).click();
		await row(w, OPEN('kaptan gideri')).waitFor();
		const r = await find(OPEN('kaptan gideri'), team.id);
		t.eq([r?.typeValue, r?.amountMinor], ['expense', 12500], 'kaptanın gideri proje kasasına yazıldı');
		t.eq(await vaultBalance(admin, team.id), 50000 - 12500, 'proje bakiyesi düştü');
		await t.shot(page, 'kaptan-proje-kasasi');

		// Sınırlar: yalnız kendi projesi.
		const mine = { typeValue: 'income', category: 'Sponsorluk', amountMinor: 100 };
		t.eq((await can.post('/api/butce', { ...mine, teamId: team.id, description: OPEN('kaptan geliri') })).status, 200, 'kaptan kendi projesine API ile de yazabilir');
		t.eq((await can.post('/api/butce', { ...mine, description: OPEN('kaptan genele') })).status, 403, 'kaptan genel kasaya yazamaz (403)');
		t.eq((await can.get('/api/butce')).status, 403, 'kaptan genel kasayı okuyamaz (403)');
		t.eq((await can.post('/api/butce', { ...mine, teamId: fx.content.team.team.id, description: OPEN('kaptan başka projeye') })).status, 403, 'kaptan başka projenin kasasına yazamaz (403)');
		t.eq((await can.post('/api/butce', { action: 'transfer', source: team.id, target: 'general', amountMinor: 100, description: OPEN('kaptan aktarımı') })).status, 403, 'kaptan aktarım yapamaz (403)');
		const vaults = (await can.get('/api/butce/kasalar')).json?.vaults ?? [];
		t.eq(vaults.map((k) => k.teamId), [team.id], 'kaptanın kasa listesinde yalnız kendi projesi var');
		t.eq((await ege.post('/api/butce', { ...mine, teamId: team.id, description: OPEN('başka kaptan') })).status, 403, 'başka projenin kaptanı bu projeye yazamaz (403)');
		t.check(!(await find(OPEN('kaptan genele'))) && !(await find(OPEN('başka kaptan'), team.id)), 'reddedilen kayıtlar oluşmadı');
	});

	await t.step('Sadece Haberler: Kasa hiç görünmez, API kapalı', async () => {
		const { page } = await t.open('reader');
		t.excludes(await dockApps(page), 'budget', 'Dock\'ta Kasa yok');
		t.eq((await noAccess.get('/api/butce')).status, 403, 'okuma 403');
		t.eq((await noAccess.get('/api/butce/kasalar')).status, 403, 'kasa listesi 403');
		t.eq((await noAccess.post('/api/butce', { typeValue: 'income', category: 'Sponsorluk', amountMinor: 100, description: OPEN('reader') })).status, 403, 'yazma 403');
		t.eq((await client(t.base).get('/api/butce')).status, 401, 'oturumsuz istek 401');
	});
}
