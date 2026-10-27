// Ayarlar → E-posta Hesabı yalnız SMTP'dir (IMAP / kulüp posta kutusu kaldırıldı, #10): panelde IMAP alanı
// ve IMAP testi yok, API imap_* alanı döndürmez, eski IMAP uçları yok, Posta'da yalnız portal bölümü var.
// Hiçbir şey kaydedilmez (SMTP ayarlarına dokunulmaz).
import { openApp, openSettingsTab } from '../lib/browser.mjs';

export const meta = { title: 'E-posta Hesabı yalnız SMTP; Posta yalnız portal içi (IMAP yok)' };

export default async function suite(t) {
	const admin = await t.api('admin');

	await t.step('API: ayarlarda imap_* yok; eski IMAP/kulüp uçları kaldırıldı', async () => {
		const res = await admin.get('/api/settings/smtp');
		t.eq(res.status, 200, 'GET /api/settings/smtp');
		t.eq(Object.keys(res.json).filter((k) => k.startsWith('imap')), [], 'yanıtta imap_* alanı yok');
		t.check('smtp_host' in res.json && 'hasPassword' in res.json, 'SMTP alanları yerinde');
		t.eq((await admin.post('/api/settings/imap/test', {})).status, 404, 'IMAP test ucu → 404');
		for (const path of ['/api/posta/kulup', '/api/posta/kulup/1', '/api/posta/kulup/1/ek/2']) {
			t.eq((await admin.get(path)).status, 404, `${path} → 404`);
		}
	});

	const { page } = await t.open('admin');

	await t.step('panel: SMTP alanları ve SMTP testi var, IMAP yok', async () => {
		const win = await openSettingsTab(page, 'smtp');
		await win.getByRole('heading', { name: 'E-Posta Hesabı' }).waitFor();
		const text = await win.innerText();
		t.check(!/imap|kulüp kutusu/i.test(text), 'panelde IMAP ya da Kulüp Kutusu ifadesi yok');
		t.eq(await win.locator('[data-imap-host], [data-imap-port], [data-imap-test]').count(), 0, 'IMAP alanları ve testi yok');
		t.check(/SMTP/.test(text), 'SMTP alanları var');
		t.eq(await win.getByRole('button', { name: /Ayarları Veritabanına Kaydet/ }).count(), 1, 'kaydet düğmesi var');
		await t.shot(page, 'eposta-hesabi');
	});

	await t.step('Posta: yalnız portal bölümü, Kulüp Kutusu yok', async () => {
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-section=portal]').waitFor();
		t.eq(await win.locator('[data-mail-section]').count(), 1, 'tek bölüm');
		t.eq(await win.locator('[data-mail-section=kulup]').count(), 0, 'Kulüp Kutusu bölümü yok');
		t.eq(await win.locator('[data-mail-folder]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mail-folder'))), ['gelen', 'gonderilen', 'arsiv', 'cop'], 'klasörler');
		await t.shot(page, 'posta-yalniz-portal');
	});
}
