// Inventory: adding, borrowing, returning, extending, label printing, faulty/lost, and role boundaries.
import { client } from '../lib/api.mjs';
import { dockApps, openApp } from '../lib/browser.mjs';
import { dialogReply } from '../lib/dialog.mjs';
import { uniq } from '../lib/temporary.mjs';
import { tr } from '../lib/locale.mjs';

export const meta = { title: 'Inventory: add, borrow/return/extend, label, faulty/lost, roles' };

const DAY = 86_400_000;

export default async function suite(t) {
	const admin = await t.api('admin');
	const zeynep = await t.api('zeynep');
	const can = await t.api('can');
	const ege = await t.api('ege');
	const reader = await t.api('reader');
	const tag = uniq().toUpperCase();
	const CODE = `E2E-${tag}`;
	const CODE_2 = `E2E-${tag}-B`;
	const NAME = `E2E Oscilloscope ${tag}`;
	const LOCATION = 'E2E Test Shelf';
	const ids = [];

	// The items go: a borrowed one is returned first (the server refuses to delete it).
	t.cleanup(async () => {
		for (const id of ids) {
			await admin.post('/api/inventory', { action: 'return', inventoryId: id });
			await admin.post('/api/inventory', { action: 'delete', inventoryId: id });
		}
	});
	const items = async (c = admin) => (await c.get('/api/inventory')).json;
	const item = async (code = CODE) => (await items()).find((i) => i.code === code);
	const card = (win, code = CODE) => win.locator(`[data-item-code="${code}"]`);
	const sheet = (page, name) => page.getByRole('dialog', { name });
	const detailLabel = (code = CODE) => `${code} ${tr('invDetailsBtn').toLocaleLowerCase('tr')}`;

	let id = null;

	await t.step('Board adds an item through the UI; the code is uppercased', async () => {
		const zPage = (await t.open('zeynep')).page;
		const zWin = await openApp(zPage, 'inventory');
		await zWin.getByRole('button', { name: tr('invNewEquipment') }).click();
		const form = sheet(zPage, tr('invNewEquipment'));
		await form.waitFor();
		await form.getByPlaceholder('LAB-RPI-006').fill(CODE.toLowerCase());
		await form.getByPlaceholder(tr('invItemNamePh')).fill(NAME);
		await form.getByPlaceholder(tr('invLocationPh')).fill(LOCATION);
		await form.getByRole('button', { name: tr('invNewEquipment') }).click();
		await card(zWin).waitFor();
		const it = await item();
		t.check(it, 'item is in the API list (code stored uppercased)');
		id = it?.id ?? null;
		if (id) ids.push(id);
		t.eq(it?.status, 'available', 'new item is available');
		t.eq(it?.location, LOCATION, 'location was stored');
		t.includes((await card(zWin).textContent()).toLocaleLowerCase('tr'), tr('reportInvAvailable'), 'the card shows the item as available');
		await t.shot(zPage, 'item-added');

		const dup = await zeynep.post('/api/inventory', { action: 'create', code: CODE, name: NAME, category: tr('invCatSensor'), location: 'Another shelf' });
		t.eq(dup.status, 409, 'the same code cannot be added twice (409)');
		const badCode = await zeynep.post('/api/inventory', { action: 'create', code: 'lower case!', name: NAME, category: tr('invCatSensor'), location: 'Shelf' });
		t.eq(badCode.status, 400, 'an invalid code is rejected (400)');
	});

	const { page: canPage, context: canCtx } = await t.open('can');
	const cWin = await openApp(canPage, 'inventory');

	await t.step('Member borrows the item (borrow action → on-loan badge)', async () => {
		await card(cWin).getByRole('button', { name: tr('invActionBorrow') }).click();
		const m = sheet(canPage, tr('invActionBorrow'));
		await m.waitFor();
		await m.getByRole('button', { name: tr('invActionBorrow') }).click();
		await card(cWin).getByText(tr('invWithYou')).waitFor();
		const it = await item();
		t.eq(it?.status, 'on_loan', 'item is on loan');
		t.eq(it?.holderUserId, t.fx.users.can.id, 'borrowed by Can');
		const days = Math.round((it.dueDate - Date.now()) / DAY);
		t.check(days >= 13 && days <= 15, `default loan period is 14 days (${days})`);
		t.eq(await card(cWin).getByRole('button', { name: tr('invActionReturn') }).count(), 1, 'the return button appears on the card');
		t.includes(await cWin.getByRole('button', { name: tr('invMyItems', { n: 1 }) }).innerText(), '(1)', 'held-items counter shows 1');
		await t.shot(canPage, 'odunc-alindi');
	});

	await t.step('someone else cannot return, extend, or borrow it', async () => {
		const r = await ege.post('/api/inventory', { action: 'return', inventoryId: id });
		t.eq(r.status, 403, 'another member cannot return it (403)');
		const u = await ege.post('/api/inventory', { action: 'extend', inventoryId: id, dueDate: Date.now() + 20 * DAY });
		t.eq(u.status, 403, 'another member cannot extend it (403)');
		const o = await ege.post('/api/inventory', { action: 'borrow', inventoryId: id });
		t.eq(o.status, 409, 'an item on loan cannot be borrowed (409)');
		t.eq((await item())?.holderUserId, t.fx.users.can.id, 'item is still with Can');
		const { page } = await t.open('ege');
		const win = await openApp(page, 'inventory');
		await card(win).waitFor();
		t.eq(await card(win).getByRole('button', { name: tr('invActionReturn') }).count(), 0, 'no return button on Ege\'s screen');
		t.includes(await card(win).innerText(), t.fx.users.can.name, 'Ege can see who is holding it');
	});

	await t.step('extension: a member cannot go beyond 30 days', async () => {
		const before = (await item()).dueDate;
		await card(cWin).getByRole('button', { name: tr('invDetailsBtn') }).click();
		const detail = sheet(canPage, detailLabel());
		await detail.waitFor();
		await detail.getByRole('button', { name: tr('invExtendLoan') }).click();
		const m = sheet(canPage, tr('invExtendLoan'));
		await m.waitFor();
		await m.getByRole('button', { name: tr('invExtendLoan') }).click();
		await m.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await item()).dueDate > before);
		const after = (await item()).dueDate;
		t.check(after > before, 'due date moved later', `${before} → ${after}`);
		const tooLong = await can.post('/api/inventory', { action: 'extend', inventoryId: id, dueDate: Date.now() + 60 * DAY });
		t.eq(tooLong.status, 400, 'a member asking for 60 days is rejected (400)');
		const past = await can.post('/api/inventory', { action: 'extend', inventoryId: id, dueDate: Date.now() - DAY });
		t.eq(past.status, 400, 'a past date is rejected (400)');
	});

	await t.step('label: the QR code is visible and the print action opens a window that prints the code', async () => {
		const detail = sheet(canPage, detailLabel());
		if (!(await detail.count())) {
			await card(cWin).getByRole('button', { name: tr('invDetailsBtn') }).click();
			await detail.waitFor();
		}
		await detail.getByRole('img', { name: `${CODE} QR` }).waitFor();
		const printBtn = detail.getByRole('button', { name: tr('invPrintQr') });
		await t.waitFor(async () => await printBtn.isEnabled());
		const [popup] = await Promise.all([canPage.context().waitForEvent('page'), printBtn.click()]);
		await popup.waitForLoadState('domcontentloaded');
		const label = await popup.locator('.label').innerText();
		t.includes(label, CODE, 'the label prints the item code');
		t.includes(label, NAME, 'the label prints the item name');
		t.eq(await popup.locator('.label img').count(), 1, 'the label includes a QR code image');
		await popup.close();
		const hist = (await zeynep.get(`/api/inventory?history=${encodeURIComponent(id)}`)).json.movements.map((h) => h.type);
		for (const itemType of ['add', 'loan', 'extend']) t.includes(hist, itemType, `history contains a "${itemType}" entry`);
		await detail.getByRole('button', { name: 'Close' }).click();
	});

	await t.step('return: reporting a fault takes the item out of service', async () => {
		await card(cWin).getByRole('button', { name: tr('invActionReturn') }).click();
		const m = sheet(canPage, tr('invActionReturn'));
		await m.waitFor();
		await m.getByRole('checkbox').check();
		await m.getByRole('textbox').fill('Channel 2 probe is not sending a signal');
		await m.getByRole('button', { name: tr('invActionReturn') }).click();
		await m.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await item())?.status === 'faulty');
		const it = await item();
		t.eq(it?.status, 'faulty', 'the item with a reported fault is marked faulty');
		t.eq(it?.holderUserId, null, 'custody was closed');
		t.eq(await card(cWin).getByRole('button', { name: tr('invActionBorrow') }).count(), 0, 'a faulty item cannot be borrowed');
		const o = await can.post('/api/inventory', { action: 'borrow', inventoryId: id });
		t.eq(o.status, 409, 'a faulty item cannot be borrowed through the API either (409)');
		await t.shot(canPage, 'faulty');
	});
	await t.close(canCtx);

	await t.step('Board: repaired → lend on behalf of a member → lost → found → delete', async () => {
		const zPage = (await t.open('zeynep')).page;
		const win = await openApp(zPage, 'inventory');
		await card(win).getByRole('button', { name: tr('invDetailsBtn') }).click();
		const detail = sheet(zPage, detailLabel());
		await detail.waitFor();

		await detail.getByRole('button', { name: tr('invMarkRepaired') }).click();
		const said = await dialogReply(zPage, true);
		t.includes(said, tr('invStatusChangeConfirm', { code: CODE, status: tr('invStatusAvailable') }), 'the confirmation dialog states the status');
		await t.waitFor(async () => (await item())?.status === 'available');
		t.eq((await item())?.status, 'available', 'the repaired item is available');

		await detail.getByRole('button', { name: tr('invLendForMember') }).click();
		const lend = sheet(zPage, tr('invLendForMember'));
		await lend.waitFor();
		await lend.getByRole('combobox').selectOption({ label: t.fx.users.ege.nameSurname });
		await lend.getByRole('button', { name: tr('invLendForMember') }).click();
		await lend.waitFor({ state: 'detached' });
		await t.waitFor(async () => (await item())?.holderUserId === t.fx.users.ege.id);
		t.eq((await item())?.holderUserId, t.fx.users.ege.id, 'the item was lent on Ege\'s behalf');

		await card(win).getByRole('button', { name: tr('invDetailsBtn') }).click();
		await detail.waitFor();
		t.eq(await detail.getByRole('button', { name: tr('delete') }).isDisabled(), true, 'the delete button is disabled for an item on loan');
		t.eq((await zeynep.post('/api/inventory', { action: 'delete', inventoryId: id })).status, 409, 'an item on loan cannot be deleted through the API either (409)');
		await detail.getByRole('button', { name: tr('invMarkLost') }).click();
		const lost = await dialogReply(zPage, true);
		t.includes(lost, tr('invStatusLostLoanNotice').split('{name}')[0], 'the loss confirmation says the custody record will be closed');
		await t.waitFor(async () => (await item())?.status === 'lost');
		t.eq((await item())?.status, 'lost', 'item is lost');
		t.eq((await item())?.holderUserId, null, 'custody was closed on loss');
		await t.shot(zPage, 'lost');

		await detail.getByRole('button', { name: tr('invMarkRepaired') }).click();
		await dialogReply(zPage, true);
		await t.waitFor(async () => (await item())?.status === 'available');
		t.eq((await item())?.status, 'available', 'the found item is available');
		const hist = (await zeynep.get(`/api/inventory?history=${encodeURIComponent(id)}`)).json.movements.map((h) => h.type);
		for (const itemType of ['return', 'status']) t.includes(hist, itemType, `history contains a "${itemType}" entry`);

		const second = await zeynep.post('/api/inventory', { action: 'create', code: CODE_2, name: `${NAME} B`, category: tr('invCatSensor'), location: LOCATION });
		if (second.json?.item?.id) ids.push(second.json.item.id);
		await zPage.reload();
		const win2 = await openApp(zPage, 'inventory');
		await card(win2, CODE_2).getByRole('button', { name: tr('invDetailsBtn') }).click();
		const detail2 = sheet(zPage, detailLabel(CODE_2));
		await detail2.waitFor();
		await detail2.getByRole('button', { name: tr('invMarkBroken') }).click();
		await dialogReply(zPage, true);
		await t.waitFor(async () => (await item(CODE_2))?.status === 'faulty');
		t.eq((await item(CODE_2))?.status, 'faulty', 'the mark-as-faulty action set the item to faulty');
		await detail2.getByRole('button', { name: tr('delete') }).click();
		const del = await dialogReply(zPage, true);
		t.includes(del, tr('invDeleteConfirm', { code: CODE_2, name: `${NAME} B` }), 'a delete confirmation is prompted');
		await t.waitFor(async () => !(await item(CODE_2)));
		t.check(!(await item(CODE_2)), 'item was deleted');
	});

	await t.step('Member (use only): cannot add, edit, or change status', async () => {
		const canPage = (await t.open('can')).page;
		const win = await openApp(canPage, 'inventory');
		await card(win).waitFor();
		t.eq(await win.getByRole('button', { name: tr('invNewEquipment') }).count(), 0, 'member: no new-equipment button');
		await card(win).getByRole('button', { name: tr('invDetailsBtn') }).click();
		const detail = sheet(canPage, detailLabel());
		await detail.waitFor();
		t.eq(await detail.locator(`[aria-label="${tr('invManageSection').replace(':', '')}"]`).count(), 0, 'member: no management section');
		t.eq(await detail.getByRole('button', { name: tr('invLendForMember') }).count(), 0, 'member: no lend-on-behalf action');
		const f = { code: 'E2E-UYE', name: 'Member cannot add', category: tr('invCatSensor'), location: 'Shelf' };
		t.eq((await can.post('/api/inventory', { action: 'create', ...f })).status, 403, 'a member cannot add items (403)');
		t.eq((await can.post('/api/inventory', { action: 'update', inventoryId: id, ...f })).status, 403, 'a member cannot edit items (403)');
		t.eq((await can.post('/api/inventory', { action: 'updateStatus', inventoryId: id, status: 'lost' })).status, 403, 'a member cannot change the status (403)');
		t.eq((await can.post('/api/inventory', { action: 'delete', inventoryId: id })).status, 403, 'a member cannot delete items (403)');
		// The lend-on-behalf field is ignored outside management: the loan is recorded in the member's own name.
		const o = await can.post('/api/inventory', { action: 'borrow', inventoryId: id, userId: t.fx.users.ege.id });
		t.eq(o.status, 200, 'a member can borrow');
		t.eq((await item())?.holderUserId, t.fx.users.can.id, 'a loan requested for someone else was recorded under the member\'s own name');
		await can.post('/api/inventory', { action: 'return', inventoryId: id });
	});

	await t.step('News-only user: Inventory is never visible and the API is closed', async () => {
		const { page } = await t.open('reader');
		t.excludes(await dockApps(page), 'inventory', 'no Inventory app in the dock');
		t.eq((await reader.get('/api/inventory')).status, 403, 'list request returns 403');
		t.eq((await reader.post('/api/inventory', { action: 'borrow', inventoryId: id })).status, 403, 'borrow request returns 403');
		t.eq((await client(t.base).get('/api/inventory')).status, 401, 'unauthenticated request returns 401');
	});
}
