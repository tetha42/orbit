// Settings → Email Account is SMTP only (IMAP / club mailbox removed, #10): the panel has no IMAP field
// and no IMAP test, the API returns no imap_* field, the legacy IMAP endpoints are gone, and Mail has only the portal section.
// Nothing is saved (SMTP settings are not touched).
import { openApp, openSettingsTab } from '../lib/browser.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Email Account is SMTP only; Mail is portal-only (no IMAP)' };

export default async function suite(t) {
	const admin = await t.api('admin');

	await t.step('API: no imap_* in settings; legacy IMAP/club endpoints removed', async () => {
		const res = await admin.get('/api/settings/smtp');
		t.eq(res.status, 200, 'GET /api/settings/smtp');
		t.eq(Object.keys(res.json).filter((k) => k.startsWith('imap')), [], 'response has no imap_* field');
		t.check('smtp_host' in res.json && 'hasPassword' in res.json, 'SMTP fields are present');
		t.eq((await admin.post('/api/settings/imap/test', {})).status, 404, 'IMAP test endpoint → 404');
		for (const path of ['/api/messages/kulup', '/api/messages/kulup/1', '/api/messages/kulup/1/ek/2']) {
			t.eq((await admin.get(path)).status, 404, `${path} → 404`);
		}
	});

	const { page } = await t.open('admin');

	await t.step('panel: SMTP fields and SMTP test present, no IMAP', async () => {
		const win = await openSettingsTab(page, 'smtp');
		await win.getByRole('heading', { name: tr('tabSmtp') }).waitFor();
		const text = await win.innerText();
		t.check(!/imap|club mailbox/i.test(text), 'panel has no IMAP or club mailbox wording');
		t.eq(await win.locator('[data-imap-host], [data-imap-port], [data-imap-test]').count(), 0, 'no IMAP fields or test');
		t.check(/SMTP/.test(text), 'SMTP fields present');
		t.eq(await win.getByRole('button', { name: tr('smtpSaveBtn') }).count(), 1, 'save button present');
		await t.shot(page, 'email-account');
	});

	await t.step('Mail: portal section only, no club mailbox', async () => {
		const win = await openApp(page, 'mail');
		await win.locator('[data-mail-section=portal]').waitFor();
		t.eq(await win.locator('[data-mail-section]').count(), 1, 'a single section');
		t.eq(await win.locator('[data-mail-section=kulup]').count(), 0, 'no club mailbox section');
		t.eq(await win.locator('[data-mail-folder]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mail-folder'))), ['inbox', 'sent', 'archived', 'trash'], 'folders');
		await t.shot(page, 'mail-portal-only');
	});
}
