// Small pieces of the interface that Teams, Kanban, Projects, Events and Certificates share.
import { openApp } from './browser.mjs';

/** The app's own confirm dialog (not the browser's): accept or turn down, then wait for it to go. */
export async function answerDialog(page, accept = true) {
	const dialog = page.locator('[role=alertdialog]');
	await dialog.waitFor();
	await dialog.locator(accept ? '.dlg-btn--danger, .dlg-btn--primary' : '.dlg-btn:not(.dlg-btn--danger):not(.dlg-btn--primary)').first().click();
	await dialog.waitFor({ state: 'detached' });
}

/** Waits for a toast whose text matches `pattern` and returns the text. */
export async function toast(page, pattern) {
	const el = page.locator('[role=status] > div').filter({ hasText: pattern }).last();
	await el.waitFor({ timeout: 10_000 });
	return el.innerText();
}

/** Opens an app from the dock and maximises its window: the default one hides most of a board. */
export async function openWide(page, appId) {
	// After a reload the window comes back open and maximised, covering the dock.
	const open = page.locator(`[data-window-frame=${appId}]`);
	const win = (await open.isVisible()) ? open : await openApp(page, appId);
	const before = (await win.boundingBox()).width;
	if (before < 1200) {
		await win.dblclick({ position: { x: Math.min(300, before / 2), y: 19 } });
		await page.waitForFunction(
			([id, w]) => document.querySelector(`[data-window-frame=${id}]`)?.getBoundingClientRect().width > w,
			[appId, before]
		);
	}
	return win;
}

/**
 * Drags with a real pointer: HTML5 drag-and-drop needs intermediate moves, which
 * `locator.dragTo` does not make. `at` is the drop point inside `target` (centre by default).
 */
export async function drag(page, source, target, at) {
	await source.scrollIntoViewIfNeeded();
	const a = await source.boundingBox();
	const b = await target.boundingBox();
	await page.mouse.move(a.x + a.width / 2, a.y + Math.min(a.height / 2, 20));
	await page.mouse.down();
	await page.mouse.move(a.x + a.width / 2 + 12, a.y + 28, { steps: 4 });
	const x = b.x + (at?.x ?? b.width / 2);
	const y = b.y + (at?.y ?? Math.min(b.height / 2, 120));
	await page.mouse.move(x, y, { steps: 12 });
	// The drop only counts if a `dragover` over the target came first; Chrome sends them on a timer.
	await page.waitForTimeout(120);
	await page.mouse.move(x + 1, y, { steps: 2 });
	await page.waitForTimeout(120);
	await page.mouse.up();
}

/** Closes any open sheet (task, form…) so the next step starts from the board. */
export async function closeSheets(page) {
	for (let i = 0; i < 3 && (await page.locator('[role=dialog], [role=alertdialog]').count()) > 0; i++) {
		await page.keyboard.press('Escape');
		await page.waitForTimeout(150);
	}
}

/** Teams → the workspace of one team (by id); returns the Teams window. */
export async function openTeam(page, teamId) {
	const win = await openWide(page, 'teams');
	const card = win.locator(`[data-team-id="${teamId}"]`);
	await card.waitFor();
	await card.getByRole('button', { name: /Çalışma Alanı/ }).click();
	await win.getByRole('button', { name: /Tüm Takımlar/ }).waitFor();
	return win;
}

/** Menu bar → Görevler → one item (`new-task`, `kanban-refresh`) while the Teams window is the active one. */
export async function taskMenu(page, item) {
	await page.locator('[data-menubar-category=file]').click();
	await page.locator(`[data-menu-item=${item}]`).click();
}

/** Re-reads the board from the server (changes made through the API show up). */
export async function refreshBoard(page) {
	await taskMenu(page, 'kanban-refresh');
	await toast(page, /yenilendi/);
}

/** Back to the list of teams from a team's workspace. */
export async function backToTeams(win) {
	await win.getByRole('button', { name: /Tüm Takımlar/ }).click();
}

/** The tab of a team workspace ("Görev Panosu", "Üyeler", "Ayarlar", "Proje Kasası"). */
export async function teamTab(win, name) {
	await win.locator('nav button, nav a').filter({ hasText: name }).first().click();
}

/**
 * `t.step` that starts from a clean screen (no sheet left open by an earlier step)
 * and keeps the first lines of a Playwright error, which say which element was awaited.
 */
export function stepper(t, page) {
	return (name, fn) =>
		t.step(name, async () => {
			await closeSheets(page);
			try {
				await fn();
			} catch (e) {
				throw new Error(String(e.message).split('\n').filter(Boolean).slice(0, 4).join(' | '));
			}
		});
}

/** A date input value (YYYY-MM-DD) `days` from now in the browser's local time. */
export function dateInput(days) {
	const d = new Date(Date.now() + days * 86_400_000);
	const p = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
