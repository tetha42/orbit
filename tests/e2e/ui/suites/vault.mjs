// Vault: income/expense, edit, delete, allowance transfer, receipt upload, CSV, financial audit report.
// Use = read-only, Manage = full access, a project captain writes to their own project vault.
import fs from 'node:fs';
import { client } from '../lib/api.mjs';
import { dockApps, openApp } from '../lib/browser.mjs';
import { dialogReply } from '../lib/dialog.mjs';
import { temporaryMember, uniq } from '../lib/temporary.mjs';
import { vaultBalance, vaultRecords, vaultClear } from '../lib/vault.mjs';
import { png, fakePng } from '../lib/sample-file.mjs';
import { SESSION_COOKIE } from '../lib/api.mjs';
import { tr, trf } from '../lib/locale.mjs';

export const meta = { title: 'Vault: income/expense, edit, delete, transfer, receipt, CSV, audit report, roles' };

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

	// A member who may only read the vault, and a project of their own whose captain is "can".
	const reader = await temporaryMember(t, { permissions: { budget: 'use', settings: 'use' }, name: 'Casey Reader' });
	const team = (await admin.post('/api/teams', { action: 'createTeam', name: `E2E Project ${tag}`, category: 'Web & Mobile', description: 'Temporary project for treasury testing', capacity: 6, leadId: fx.users.can.id })).json?.team;
	if (!team) throw new Error('could not create the temporary project');
	const created = []; // general-vault entries this suite made
	t.cleanup(async () => {
		await vaultClear(admin, team.id);
		for (const id of created) await admin.del(`/api/budget?id=${encodeURIComponent(id)}`);
		await admin.post('/api/teams', { action: 'deleteTeam', teamId: team.id });
	});
	const find = async (description, teamId = null) => (await vaultRecords(admin, teamId)).find((r) => r.description === description);
	const track = (r) => r && created.push(r.id);
	const row = (win, description) => win.locator('tr[data-focus-id^="vault-row:"]', { hasText: description });
	const balanceText = (win) => win.locator('[data-testid=vault-balance][data-loaded]').first().innerText();

	const { page: zPage, context: zCtx } = await t.open('zeynep');
	const win = await openApp(zPage, 'budget');
	await win.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
	const start = await vaultBalance(admin);

	async function fillEntry(page, { type, category, amount, description, file }) {
		const m = page.getByRole('dialog', { name: tr('treasuryNewTitle') });
		await m.waitFor();
		await m.getByRole('radio', { name: type === 'income' ? tr('treasuryIncomeOption') : tr('treasuryExpenseOption') }).click();
		if (category) await m.locator('select').selectOption(category);
		await m.getByPlaceholder('1.250,00').fill(amount);
		await m.locator('textarea').fill(description);
		if (file) await m.locator('input[type=file]').setInputFiles(file);
		return m;
	}

	await t.step('income: "1.250,50" is typed in the UI, saved in minor units, and the balance increases', async () => {
		await win.getByRole('button', { name: tr('budgetNewEntry') }).click();
		const m = await fillEntry(zPage, { type: 'income', category: 'sponsorship', amount: '1.250,50', description: OPEN('income') });
		await t.shot(zPage, 'income-form');
		await m.getByRole('button', { name: tr('save') }).click();
		await row(win, OPEN('income')).waitFor();
		const r = await find(OPEN('income'));
		track(r);
		t.eq([r?.type, r?.amountMinor, r?.category], ['income', 125050, 'sponsorship'], 'record: type, amount (minor units) and category');
		t.eq(await vaultBalance(admin), start + 125050, 'balance increased by 1.250,50 ₺');
		t.includes(await balanceText(win), tl(start + 125050), 'the on-screen balance was updated too');
	});

	await t.step('expense: an expense exceeding the balance is rejected, a reasonable expense is saved', async () => {
		const bal = await vaultBalance(admin);
		await win.getByRole('button', { name: tr('budgetNewEntry') }).click();
		const m = await fillEntry(zPage, { type: 'expense', category: 'hardware', amount: tl(bal + 100), description: OPEN('oversized expense') });
		await m.getByText(tr('treasuryCannotOverdraft')).waitFor();
		t.eq(await m.getByRole('button', { name: tr('save') }).isDisabled(), true, 'the "Save" button is disabled for an expense exceeding the balance');
		await m.getByRole('button', { name: tr('cancel') }).click();
		const api = await zeynep.post('/api/budget', { type: 'expense', category: 'hardware', amountMinor: bal + 100, description: OPEN('oversized expense') });
		t.eq([api.status, api.json?.code], [409, 'INSUFFICIENT_FUNDS'], 'the API also rejects an expense exceeding the balance (409)');

		await win.getByRole('button', { name: tr('budgetNewEntry') }).click();
		const ok = await fillEntry(zPage, { type: 'expense', category: 'hardware', amount: '400,25', description: OPEN('expense') });
		await ok.getByRole('button', { name: tr('save') }).click();
		await row(win, OPEN('expense')).waitFor();
		const r = await find(OPEN('expense'));
		track(r);
		t.eq([r?.type, r?.amountMinor], ['expense', 40025], 'expense saved in minor units');
		t.eq(await vaultBalance(admin), bal - 40025, 'balance decreased by 400,25 ₺');
	});

	await t.step('API validations: amount, type, category, date, receipt link', async () => {
		const base = { type: 'income', category: 'sponsorship', amountMinor: 100, description: OPEN('validation') };
		const post = (patch) => zeynep.post('/api/budget', { ...base, ...patch });
		const control = await post({ description: OPEN('validation control') });
		t.eq(control.status, 200, 'control: a valid record is accepted (the other rejection reasons are tested one by one)');
		track(control.json);
		t.eq((await post({ amountMinor: -5 })).status, 400, 'negative amount rejected');
		t.eq((await post({ amountMinor: 1.5 })).status, 400, 'fractional minor units rejected');
		t.eq((await post({ type: 'gift' })).status, 400, 'unknown type rejected');
		t.eq((await post({ category: 'made-up' })).status, 400, 'unknown category rejected');
		t.eq((await post({ date: Date.now() + 30 * 86_400_000 })).status, 400, 'future date rejected');
		t.eq((await post({ receiptUrl: 'https://evil.example/receipt.png' })).status, 400, 'external receipt link rejected');
		t.eq((await post({ teamId: 'no-such-project' })).status, 404, 'missing project 404');
	});

	await t.step('edit: description and category change; amount and type do not', async () => {
		const before = await find(OPEN('expense'));
		await row(win, OPEN('expense')).getByRole('button', { name: `${tr('edit')}: ${OPEN('expense')}` }).click();
		const m = zPage.getByRole('dialog', { name: tr('treasuryEditTitle') });
		await m.waitFor();
		t.eq(await m.getByPlaceholder('1.250,00').count(), 0, 'amount cannot be typed in the edit form (locked)');
		await m.locator('select').selectOption('transport');
		await m.locator('textarea').fill(OPEN('expense corrected'));
		await m.getByRole('button', { name: tr('save') }).click();
		await row(win, OPEN('expense corrected')).waitFor();
		const after = await find(OPEN('expense corrected'));
		t.eq(after?.id, before?.id, 'the same record was edited');
		t.eq([after?.category, after?.amountMinor, after?.type], ['transport', 40025, 'expense'], 'category changed; amount and type are the same');
		t.includes(await row(win, OPEN('expense corrected')).innerText(), tr('treasuryEdited'), 'row shows the "edited" marker');
		const bad = await zeynep.patch('/api/budget', { id: before.id, amountMinor: 1 });
		t.eq(bad.status, 400, 'changing the amount through the API was rejected');
		t.eq((await zeynep.patch('/api/budget', { id: before.id, type: 'income' })).status, 400, 'changing the type through the API was rejected');
		await t.shot(zPage, 'edited');
	});

	await t.step('delete: confirmation is requested; the deleted expense amount returns to the balance', async () => {
		const bal = await vaultBalance(admin);
		const target = OPEN('expense corrected');
		await row(win, target).getByRole('button', { name: `${tr('delete')}: ${target}` }).click();
		const asked = await dialogReply(zPage, false);
		const expected = trf('treasuryDeleteRecordConfirm', { desc: target, amount: `₺${tl(40025)}` });
		t.includes(asked, expected, 'confirmation is requested before deleting');
		t.check(await find(target), 'the record was not deleted after cancelling');
		await row(win, target).getByRole('button', { name: `${tr('delete')}: ${target}` }).click();
		await dialogReply(zPage, true);
		await t.waitFor(async () => !(await find(target)));
		t.check(!(await find(target)), 'the record was deleted after confirming');
		t.eq(await vaultBalance(admin), bal + 40025, 'the balance came back by the expense amount');
		// An income record cannot be deleted once its money has been spent: the income cannot be removed when the whole balance is spent.
		const full = await vaultBalance(admin);
		const spent = (await admin.post('/api/budget', { type: 'expense', category: 'other', amountMinor: full, description: OPEN('spend it all') })).json;
		track(spent);
		const income = await find(OPEN('income'));
		const refuse = await admin.del(`/api/budget?id=${encodeURIComponent(income.id)}`);
		t.eq([refuse.status, refuse.json?.code], [409, 'INSUFFICIENT_FUNDS'], 'spent income cannot be deleted (409)');
		t.check(await find(OPEN('income')), 'the rejected deletion left the income in place');
		await admin.del(`/api/budget?id=${encodeURIComponent(spent.id)}`);
		created.splice(created.indexOf(spent.id), 1);
		t.eq(await vaultBalance(admin), full, 'the balance returned to its previous state after the spending was reverted');
	});

	await t.step('receipt: uploads, is linked to the record, and is visible to those with vault access; a fake file is rejected', async () => {
		await win.getByRole('button', { name: tr('budgetNewEntry') }).click();
		const m = await fillEntry(zPage, { type: 'income', category: 'sponsorship', amount: '10,00', description: OPEN('income with receipt'), file: png('receipt.png') });
		await m.getByText(tr('treasuryReceiptAttached')).waitFor();
		await m.getByRole('button', { name: tr('save') }).click();
		await row(win, OPEN('income with receipt')).waitFor();
		const r = await find(OPEN('income with receipt'));
		track(r);
		t.check(/^\/api\/uploads\/\d+_[a-f0-9]+\.(png|webp)$/.test(r?.receiptUrl ?? ''), 'the record carries the receipt URL', String(r?.receiptUrl));
		t.eq(await row(win, OPEN('income with receipt')).getByRole('link', { name: tr('treasuryReceipt') }).count(), 1, 'the row has the receipt link');
		t.eq((await zeynep.get(r.receiptUrl)).status, 200, 'the vault manager can view the receipt');
		t.eq((await reader.api.get(r.receiptUrl)).status, 200, 'the vault reader can see it too');
		t.check((await noAccess.get(r.receiptUrl)).status >= 403, 'a user without vault access cannot see the receipt', String((await noAccess.get(r.receiptUrl)).status));
		await t.shot(zPage, 'entry-with-receipt');

		const form = new FormData();
		form.append('file', new Blob([fakePng().buffer], { type: 'image/png' }), 'fake.png');
		const fake = await fetch(`${t.base}/api/upload`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${zeynep.token}` }, body: form });
		t.eq(fake.status, 415, 'a non-image file cannot be uploaded with a .png name (415)');
		const unauth = await fetch(`${t.base}/api/upload`, { method: 'POST', headers: { cookie: `${SESSION_COOKIE}=${reader.api.token}` }, body: form });
		t.eq(unauth.status, 403, 'a read-only member cannot upload receipts (403)');
	});

	await t.step('allowance transfer: two-sided record, insufficient-balance guard, deleting one side removes both', async () => {
		const g0 = await vaultBalance(admin);
		const p0 = await vaultBalance(admin, team.id);
		await win.getByRole('button', { name: tr('treasuryTransferGrant'), exact: true }).click();
		const m = zPage.getByRole('dialog', { name: tr('treasuryTransferTitle'), exact: true });
		await m.waitFor();
		await m.locator('select').nth(1).selectOption(team.id);
		await m.getByPlaceholder('5.000,00').fill('100,00');
		await m.getByPlaceholder(tr('treasuryTransferDescPlaceholder')).fill(OPEN('transfer'));
		await m.getByRole('button', { name: tr('treasuryTransferSubmit') }).click();
		await m.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await vaultBalance(admin, team.id)) === p0 + 10000);
		t.eq(await vaultBalance(admin), g0 - 10000, '100 ₺ left the general vault');
		t.eq(await vaultBalance(admin, team.id), p0 + 10000, '100 ₺ entered the project vault');
		const out = await find(OPEN('transfer'));
		const into = await find(OPEN('transfer'), team.id);
		t.eq([out?.type, into?.type], ['expense', 'income'], 'two sides: expense in the general vault, income in the project vault');
		t.check(out?.transferId && out.transferId === into?.transferId, 'both records carry the same transfer id');
		await t.shot(zPage, 'transfer');

		const tooMuch = await zeynep.post('/api/budget', { action: 'transfer', source: team.id, target: 'general', amountMinor: p0 + 10000 + 100, description: OPEN('excess transfer') });
		t.eq(tooMuch.status, 409, 'a transfer exceeding the source vault balance was rejected (409)');
		t.eq((await zeynep.post('/api/budget', { action: 'transfer', source: 'general', target: 'general', amountMinor: 100, description: OPEN('same') })).status, 400, 'source and target cannot be the same');

		await row(win, OPEN('transfer')).getByRole('button', { name: `${tr('delete')}: ${OPEN('transfer')}` }).click();
		const asked = await dialogReply(zPage, true);
		t.includes(asked, tr('treasuryRevertTransferConfirm').split('{target}')[0].trim(), 'deleting a transfer is asked as a "revert"');
		await t.waitFor(async () => !(await find(OPEN('transfer'))));
		t.eq([await vaultBalance(admin), await vaultBalance(admin, team.id)], [g0, p0], 'deleting one side restored both vaults');
		// Top up the project again for the captain test.
		const again = await zeynep.post('/api/budget', { action: 'transfer', source: 'general', target: team.id, amountMinor: 50000, description: OPEN('project allowance') });
		t.eq(again.status, 201, '500 ₺ allowance transferred to the project');
	});

	await t.step('CSV: visible records download as an Excel-compatible file', async () => {
		await win.getByLabel(tr('treasurySearchPlaceholder')).fill(tag);
		const [dl] = await Promise.all([zPage.waitForEvent('download'), win.getByRole('button', { name: 'CSV' }).click()]);
		const text = fs.readFileSync(await dl.path(), 'utf8');
		t.check(text.startsWith('﻿'), 'the file starts with a BOM (Turkish characters are not corrupted in Excel)');
		t.includes(text, [tr('treasuryColDate'), tr('treasuryColType'), tr('budgetColCategory'), tr('treasuryColDesc')].join(';'), 'header row is separated by semicolons');
		t.includes(text, OPEN('income'), 'the filtered record is in the file');
		t.includes(text, '1250.5', 'amount written as a number');
		const lines = text.trim().split('\n').length - 1;
		t.eq(lines, await win.locator('tr[data-focus-id^="vault-row:"]').count(), 'the number of rows in the file matches the screen (filter applied)');
		await win.getByLabel(tr('treasurySearchPlaceholder')).fill('');
	});

	await t.step('financial audit report: totals, transactions and signature lines', async () => {
		// The panel on screen was loaded before the last transfers (made over the API): reload it.
		await zPage.reload();
		await openApp(zPage, 'budget');
		await zPage.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
		await zPage.locator('[data-menubar-category=file]').click();
		const [popup] = await Promise.all([zPage.context().waitForEvent('page'), zPage.locator('[data-menu-item=export-pdf]').click()]);
		await popup.waitForLoadState('domcontentloaded');
		const body = await popup.locator('body').innerText();
		t.includes(body, `${tr('treasuryGeneralTitle')} — ${tr('treasuryAuditReportTitle')}`, 'report title');
		t.includes(body, tr('treasuryTotalIncome'), 'total income');
		t.includes(body, tr('treasuryNetBalance'), 'net balance');
		t.includes(body, tl(await vaultBalance(admin)), 'net balance in the report matches the vault');
		t.includes(body, OPEN('income'), 'transactions are listed');
		t.includes(body, tr('treasuryPrintPreparedBy'), 'signature line (prepared by)');
		t.includes(body, tr('treasuryPrintAuditedBy'), 'signature line (reviewed by)');
		await popup.close();
	});
	await t.close(zCtx);

	await t.step('Use = read-only: can see, cannot write', async () => {
		const { page } = await reader.open();
		const w = await openApp(page, 'budget');
		await w.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
		await row(w, OPEN('income')).waitFor();
		t.eq(await w.getByRole('button', { name: tr('budgetNewEntry') }).count(), 0, 'no "new record" button for the reader');
		t.eq(await w.getByRole('button', { name: tr('treasuryTransferGrant'), exact: true }).count(), 0, 'no "transfer allowance" button for the reader');
		t.eq(await w.getByRole('button', { name: new RegExp(`^(${tr('edit')}|${tr('delete')}):`) }).count(), 0, 'no edit/delete buttons for the reader');
		t.eq(await w.getByRole('button', { name: 'CSV' }).isEnabled(), true, 'the reader can download CSV');
		await t.shot(page, 'use-read-only');
		const id = (await find(OPEN('income')))?.id;
		const post = await reader.api.post('/api/budget', { type: 'income', category: 'sponsorship', amountMinor: 100, description: OPEN('reader cannot write') });
		t.eq(post.status, 403, 'the reader cannot add records (403)');
		t.eq((await reader.api.patch('/api/budget', { id, description: 'x' })).status, 403, 'the reader cannot edit (403)');
		t.eq((await reader.api.del(`/api/budget?id=${encodeURIComponent(id)}`)).status, 403, 'the reader cannot delete (403)');
		t.eq((await reader.api.post('/api/budget', { action: 'transfer', source: 'general', target: team.id, amountMinor: 100, description: OPEN('reader cannot transfer') })).status, 403, 'the reader cannot transfer (403)');
		t.eq((await reader.api.get('/api/budget')).status, 200, 'the reader can read the general vault');
		t.eq((await reader.api.get(`/api/budget?teamId=${team.id}`)).status, 200, 'the reader can read the project vault too');
		const vaults = (await reader.api.get('/api/budget/vaults')).json?.vaults ?? [];
		t.check(vaults.some((k) => k.teamId === team.id) && vaults.some((k) => k.teamId === null), 'the vault list contains the general and project vaults');
		t.check(!(await find(OPEN('reader cannot write'))), 'no rejected record was created');
	});

	await t.step('project captain writes to their own project vault (Teams → Project Vault)', async () => {
		const { page } = await t.open('can');
		t.excludes(await dockApps(page), 'budget', 'the captain does not have the Vault app in their Dock');
		const w = await openApp(page, 'teams');
		await w.locator(`[data-team-id="${team.id}"]`).getByRole('button', { name: tr('teamsWorkspace') }).click();
		await w.locator('[data-focus-section=vault]').click();
		await w.locator('[data-testid=vault-balance][data-loaded]').first().waitFor();
		t.includes(await balanceText(w), tl(50000), 'the project vault balance is the transferred allowance');
		t.eq(await w.getByRole('button', { name: tr('treasuryTransferGrant'), exact: true }).count(), 0, 'the captain cannot transfer an allowance');
		await w.getByRole('button', { name: tr('budgetNewEntry') }).click();
		const m = await fillEntry(page, { type: 'expense', category: 'hardware', amount: '125,00', description: OPEN('captain expense') });
		await m.getByRole('button', { name: tr('save') }).click();
		await row(w, OPEN('captain expense')).waitFor();
		const r = await find(OPEN('captain expense'), team.id);
		t.eq([r?.type, r?.amountMinor], ['expense', 12500], 'the captain expense was written to the project vault');
		t.eq(await vaultBalance(admin, team.id), 50000 - 12500, 'project balance decreased');
		await t.shot(page, 'captain-project-vault');

		// Boundaries: only their own project.
		const mine = { type: 'income', category: 'sponsorship', amountMinor: 100 };
		t.eq((await can.post('/api/budget', { ...mine, teamId: team.id, description: OPEN('captain income') })).status, 200, 'the captain can also write to their own project through the API');
		t.eq((await can.post('/api/budget', { ...mine, description: OPEN('captain to general') })).status, 403, 'the captain cannot write to the general vault (403)');
		t.eq((await can.get('/api/budget')).status, 403, 'the captain cannot read the general vault (403)');
		t.eq((await can.post('/api/budget', { ...mine, teamId: fx.content.team.team.id, description: OPEN('captain to another project') })).status, 403, 'the captain cannot write to another project vault (403)');
		t.eq((await can.post('/api/budget', { action: 'transfer', source: team.id, target: 'general', amountMinor: 100, description: OPEN('captain transfer') })).status, 403, 'the captain cannot transfer (403)');
		const vaults = (await can.get('/api/budget/vaults')).json?.vaults ?? [];
		t.eq(vaults.map((k) => k.teamId), [team.id], 'the captain vault list contains only their own project');
		t.eq((await ege.post('/api/budget', { ...mine, teamId: team.id, description: OPEN('another captain') })).status, 403, 'another project captain cannot write to this project (403)');
		t.check(!(await find(OPEN('captain to general'))) && !(await find(OPEN('another captain'), team.id)), 'no rejected records were created');
	});

	await t.step('News only: the Vault never appears, the API is closed', async () => {
		const { page } = await t.open('reader');
		t.excludes(await dockApps(page), 'budget', 'no Vault in the Dock');
		t.eq((await noAccess.get('/api/budget')).status, 403, 'read returns 403');
		t.eq((await noAccess.get('/api/budget/vaults')).status, 403, 'vault list returns 403');
		t.eq((await noAccess.post('/api/budget', { type: 'income', category: 'sponsorship', amountMinor: 100, description: OPEN('reader') })).status, 403, 'write returns 403');
		t.eq((await client(t.base).get('/api/budget')).status, 401, 'unauthenticated request returns 401');
	});
}
