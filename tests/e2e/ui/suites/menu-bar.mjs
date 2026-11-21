// Top menu bar (src/components/shell/TopBar/MenuBar.tsx) never shows an unauthorized item.
import { openApp } from '../lib/browser.mjs';

export const meta = { title: 'Menu bar: unauthorized items are not visible' };

/** Opens a menu-bar category and returns the item ids in it. */
async function categoryItems(page, category) {
	await page.locator(`[data-menubar-category=${category}]`).click();
	const items = await page.locator('[data-menu-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-item')));
	return items;
}

/** Empties the menu state: clicking the bare desktop focuses the portal and closes menus. */
async function portalFocus(page) {
	await page.mouse.click(5, 450);
	await page.waitForTimeout(150);
}

const PORTAL_FILE = ['new-event', 'new-member', 'new-budget-entry', 'export-report'];

export default async function suite(t) {
	// Portal menu → File: New Event / New Member / Income-Expense / Activity Report
	for (const [key, expected] of [
		['reader', []],
		['can', []],
		['zeynep', PORTAL_FILE],
		['admin', PORTAL_FILE],
	]) {
		await t.step(`${key}: portal File menu`, async () => {
			const { page } = await t.open(key);
			await portalFocus(page);
			const items = await categoryItems(page, 'file');
			for (const id of PORTAL_FILE) {
				t.check(items.includes(id) === expected.includes(id), `${key}: "${id}" ${expected.includes(id) ? 'visible' : 'not visible'}`, JSON.stringify(items));
			}
			await t.shot(page, `${key}-file-menu`);
		});
	}

	// Decisions app → Actions: New Committee (manage) only for managers; hidden for regular members
	for (const [key, newCommittee] of [['can', false], ['zeynep', true]]) {
		await t.step(`${key}: Governance menu of the Decisions app`, async () => {
			const { page } = await t.open(key);
			await openApp(page, 'decisions');
			const items = await categoryItems(page, 'file');
			t.check(items.includes('new-committee') === newCommittee, `${key}: "New Committee" ${newCommittee ? 'visible' : 'not visible'}`, JSON.stringify(items));
			await t.shot(page, `${key}-decisions-menu`);
		});
	}

	// Member Directory → Records: New Member (manage) / Export List (use)
	for (const [key, newMember] of [['can', false], ['zeynep', true]]) {
		await t.step(`${key}: Member Directory menu`, async () => {
			const { page } = await t.open(key);
			await openApp(page, 'members');
			const items = await categoryItems(page, 'file');
			t.check(items.includes('add-member') === newMember, `${key}: "Add New Member" ${newMember ? 'visible' : 'not visible'}`, JSON.stringify(items));
			t.includes(items, 'export-roster', `${key}: "Export Member List" is visible`);
		});
	}
}
