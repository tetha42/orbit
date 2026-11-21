// Window manager: dragging, blur turning off while dragging, resizing,
// edge snapping, bringing to front, traffic lights and persistence. Measures only what is on screen
// (boxes, `data-` attributes); it does not depend on the app's internal state.
import { openApp, openWindows, waitDesktop } from '../lib/browser.mjs';
import { SAVE_MS, dragWindow, frameBox, movingState, pointerDrag, reloadDesktop, resizeWindow, settle, swapSession, titlePoint, windowAt, windowControl } from '../lib/desktop.mjs';

export const meta = { title: 'Window manager: dragging, blur, size, snapping, persistence' };

const VW = 1440;

export default async function suite(t) {
	await t.step('dragging: the window moves with the cursor, its size does not change', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const before = await frameBox(page, 'news');
		const after = await dragWindow(page, 'news', 160, 90);
		t.eq({ x: after.x, y: after.y }, { x: before.x + 160, y: before.y + 90 }, 'the window moved exactly by the cursor delta');
		t.eq({ w: after.width, h: after.height }, { w: before.width, h: before.height }, 'dragging did not change the size');
		const back = await dragWindow(page, 'news', -160, -90);
		t.eq({ x: back.x, y: back.y }, { x: before.x, y: before.y }, 'returned to its original place when dragged back');
		await t.shot(page, 'surukleme');
	});

	await t.step('blur turns off while dragging and returns on release', async () => {
		// Transparency is off by default; frosted glass exists only when it is on (the theme suite tests the off state).
		const { page } = await t.open('can', { prefs: { transparency: true } });
		await openApp(page, 'teams');
		await openApp(page, 'news');
		const idle = await movingState(page, 'news');
		t.check(!idle.moving, 'no [data-window-moving] while not dragging');
		t.check(idle.blur !== 'none' && idle.blur.includes('blur'), 'window background is frosted while not dragging', idle.blur);

		const box = await frameBox(page, 'news');
		const from = titlePoint(box);
		await pointerDrag(page, from, { x: from.x + 120, y: from.y + 70 }, { hold: true });
		const during = await movingState(page, 'news');
		t.check(during.moving, '[data-window-moving] is set while dragging');
		t.eq(during.blur, 'none', 'window blur is off while dragging');
		const other = await movingState(page, 'teams');
		t.eq(other.blur, 'none', 'the other open window is blur-free while dragging too');
		await t.shot(page, 'surukleme-sirasinda');
		await page.mouse.up();
		await settle(page);
		const after = await movingState(page, 'news');
		t.check(!after.moving, '[data-window-moving] is cleared on release');
		t.check(after.blur.includes('blur'), 'blur returned on release', after.blur);

		// The state does not get stuck even when the release happens outside the window (the cursor went to the corner).
		const box2 = await frameBox(page, 'news');
		const p2 = titlePoint(box2);
		await pointerDrag(page, p2, { x: VW - 60, y: 600 }, { hold: true });
		t.check((await movingState(page, 'news')).moving, 'the marker is set on the second drag too');
		await page.mouse.up();
		await settle(page);
		t.check(!(await movingState(page, 'news')).moving, 'the marker is cleared even when releasing outside the window');
	});

	await t.step('resizing: corners and edges, minimum size', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const b0 = await frameBox(page, 'news');

		const se = await resizeWindow(page, 'news', 'se', 100, 60);
		t.eq({ x: se.x, y: se.y, w: se.width, h: se.height }, { x: b0.x, y: b0.y, w: b0.width + 100, h: b0.height + 60 }, 'bottom-right corner: size grew, position stayed');

		const nw = await resizeWindow(page, 'news', 'nw', -50, -30);
		t.eq({ x: nw.x, y: nw.y, w: nw.width, h: nw.height }, { x: se.x - 50, y: se.y - 30, w: se.width + 50, h: se.height + 30 }, 'top-left corner: position and size changed together');

		const e = await resizeWindow(page, 'news', 'e', 40, 0);
		t.eq({ w: e.width, h: e.height }, { w: nw.width + 40, h: nw.height }, 'east edge changed only the width');
		const s = await resizeWindow(page, 'news', 's', 0, -40);
		t.eq({ w: s.width, h: s.height }, { w: e.width, h: e.height - 40 }, 'south edge changed only the height');
		const w = await resizeWindow(page, 'news', 'w', 30, 0);
		t.eq({ x: w.x, w: w.width }, { x: s.x + 30, w: s.width - 30 }, 'west edge shrank from the left');

		const tiny = await resizeWindow(page, 'news', 'e', -2000, 0);
		t.check(tiny.width >= 300 && tiny.width < w.width, 'the window stopped at the minimum size when shrunk hard and did not disappear', `width ${tiny.width}`);
		const again = await resizeWindow(page, 'news', 'e', -300, 0);
		t.eq(again.width, tiny.width, 'did not go past the minimum size');
		await t.shot(page, 'boyutlandirma');
	});

	await t.step('edge snapping: left, right, top (maximize) and corners; double-click to restore', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const free = await frameBox(page, 'news');

		// Top edge: maximizes.
		await pointerDrag(page, titlePoint(free), { x: 700, y: 10 });
		const max = await frameBox(page, 'news');
		t.eq({ x: max.x, w: max.width }, { x: 0, w: VW }, 'the window took the full width when dropped on the top edge');

		// A single click on the title bar does not break a maximized window; a double-click restores it.
		await page.mouse.click(titlePoint(max).x, titlePoint(max).y);
		t.eq((await frameBox(page, 'news')).width, VW, 'a single click on the maximized window title did not change the size');
		await page.mouse.dblclick(titlePoint(max).x, titlePoint(max).y);
		const restored = await frameBox(page, 'news');
		t.check(restored.width < VW, 'double-clicking the title restored from maximize', `width ${restored.width}`);

		// Left edge: half the screen.
		await pointerDrag(page, titlePoint(restored), { x: 5, y: 450 });
		const left = await frameBox(page, 'news');
		t.eq({ x: left.x, w: left.width }, { x: 0, w: VW / 2 }, 'snapped to the left half when dropped on the left edge');
		t.eq(left.height, max.height, 'the left half has the height of the maximized window');
		await t.shot(page, 'sola-yapisti');

		await page.mouse.click(titlePoint(left).x, titlePoint(left).y);
		t.eq(await frameBox(page, 'news'), left, 'a single click on the snapped window title did not break the snap');

		// Dragging a snapped window away returns it to its floating size.
		await pointerDrag(page, titlePoint(left), { x: 700, y: 300 });
		const floating = await frameBox(page, 'news');
		t.check(floating.width !== VW / 2 && floating.width < VW, 'the snapped window left the half-size when dragged', `width ${floating.width}`);

		// Right edge.
		await pointerDrag(page, titlePoint(floating), { x: VW - 5, y: 450 });
		const right = await frameBox(page, 'news');
		t.check(Math.abs(right.x - VW / 2) <= 1 && Math.abs(right.width - VW / 2) <= 1, 'snapped to the right half when dropped on the right edge', JSON.stringify(right));

		// Corners: quarter.
		await pointerDrag(page, titlePoint(right), { x: 700, y: 300 });
		const f2 = await frameBox(page, 'news');
		await pointerDrag(page, titlePoint(f2), { x: 30, y: 30 });
		const tl = await frameBox(page, 'news');
		t.check(tl.x === 0 && tl.width === VW / 2 && tl.height < max.height * 0.75 && tl.y === max.y, 'top-left corner: a quarter (at the top)', JSON.stringify(tl));

		await pointerDrag(page, titlePoint(tl), { x: 700, y: 300 });
		const f3 = await frameBox(page, 'news');
		await pointerDrag(page, titlePoint(f3), { x: VW - 30, y: 870 });
		const br = await frameBox(page, 'news');
		t.check(br.x === VW / 2 && br.width === VW / 2 && br.y > 100 && br.height < max.height * 0.75, 'bottom-right corner: a quarter (at the bottom)', JSON.stringify(br));

		// Keyboard: Ctrl+Alt+Left snaps left, the same chord restores it.
		await pointerDrag(page, titlePoint(br), { x: 700, y: 300 });
		const focused = await frameBox(page, 'news');
		await page.mouse.click(titlePoint(focused).x, titlePoint(focused).y);
		await page.keyboard.press('Control+Alt+ArrowLeft');
		await page.waitForTimeout(260);
		await settle(page);
		const key = await frameBox(page, 'news');
		t.eq({ x: key.x, w: key.width }, { x: 0, w: VW / 2 }, 'Ctrl+Alt+← snapped the window to the left half');
	});

	await t.step('fast release: the window lands where the cursor was released even if the last frame was not drawn', async () => {
		// One move and an immediate release: the move gets no chance to wait for a frame (rAF).
		const { page } = await t.open('can');
		await openApp(page, 'news');
		const before = await frameBox(page, 'news');
		const from = titlePoint(before);
		await page.mouse.move(from.x, from.y);
		await page.mouse.down();
		await page.mouse.move(from.x + 90, from.y + 60);
		await page.mouse.up();
		const moved = await frameBox(page, 'news');
		t.eq({ x: moved.x, y: moved.y }, { x: before.x + 90, y: before.y + 60 }, 'the window landed where it was released during a fast drag');

		const p2 = titlePoint(moved);
		await page.mouse.move(p2.x, p2.y);
		await page.mouse.down();
		await page.mouse.move(700, 10);
		await page.mouse.up();
		t.eq((await frameBox(page, 'news')).width, VW, 'a window quickly dropped on the top edge maximized');
	});

	await t.step('bringing to front and traffic lights', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'teams');
		await openApp(page, 'news');
		const news = await frameBox(page, 'news');
		const teams = await frameBox(page, 'teams');
		// A point where the two windows overlap.
		const px = Math.max(news.x, teams.x) + 40;
		const py = Math.max(news.y, teams.y) + 80;
		t.check(px < Math.min(news.x + news.width, teams.x + teams.width) && py < Math.min(news.y + news.height, teams.y + teams.height), 'the two windows overlap (test assumption)');
		t.eq(await windowAt(page, px, py), 'news', 'the most recently opened window is on top');
		await page.mouse.click(titlePoint(teams).x, titlePoint(teams).y);
		t.eq(await windowAt(page, px, py), 'teams', 'the window whose title was clicked came to the front');

		await windowControl(page, 'news', 'minimize');
		await page.waitForTimeout(250);
		t.excludes(await openWindows(page), 'news', 'minimize: the window is hidden');
		await page.locator('[data-dock-app=news]').click();
		await page.waitForTimeout(250);
		t.includes(await openWindows(page), 'news', 'clicking the Dock icon brought the minimized window back');

		await windowControl(page, 'news', 'maximize');
		t.eq((await frameBox(page, 'news')).width, VW, 'the green button maximized');
		await windowControl(page, 'news', 'maximize');
		t.check((await frameBox(page, 'news')).width < VW, 'the green button restored on the second click');

		await windowControl(page, 'news', 'close');
		await page.waitForTimeout(250);
		t.excludes(await openWindows(page), 'news', 'close: the window disappeared');
		t.includes(await openWindows(page), 'teams', 'the other window is still there');
	});

	await t.step('ephemeral windows: reload starts with a clean desktop instead of persisting window state', async () => {
		const { page } = await t.open('can');
		await openApp(page, 'teams');
		await openApp(page, 'news');
		await dragWindow(page, 'news', 120, 80);
		await resizeWindow(page, 'news', 'se', 70, 50);
		await page.waitForTimeout(SAVE_MS);
		await reloadDesktop(page);
		t.excludes(await openWindows(page), 'news', 'ephemeral windows: news window did not persist across reload');
		t.eq(await openWindows(page), ['teams'], 'ephemeral windows: reload restores default initial layout only');
		await openApp(page, 'news');
		t.includes(await openWindows(page), 'news', 'windows can be reopened cleanly after reload');
		await t.shot(page, 'kalicilik');
	});

	await t.step('role: saved window state does not restore an app the role cannot open', async () => {
		// A board member leaves the budget and teams windows open; when the same browser
		// signs in with the news-only role, those windows are not shown and the news window can open.
		const { page, context } = await t.open('zeynep');
		await openApp(page, 'budget');
		await page.waitForTimeout(SAVE_MS);
		t.includes(await openWindows(page), 'budget', 'the board member has the budget window open (setup)');

		const reader = await t.api('reader');
		await swapSession(context, t.base, reader.token);
		await reloadDesktop(page);
		await waitDesktop(page);
		const shown = await openWindows(page);
		t.sameSet(shown.filter((a) => a !== 'settings' && a !== 'news'), [], 'the news-only user sees no window they lack permission for', JSON.stringify(shown));
		t.sameSet(await page.locator('[data-dock-app]').evaluateAll((els) => els.map((e) => e.getAttribute('data-dock-app'))), ['chat', 'news', 'settings'], 'the Dock shows only permitted apps');
		await t.shot(page, 'rol-okur-kayitli-durum');
	});
}
