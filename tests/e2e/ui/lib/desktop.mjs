// Desktop behaviour helpers: where a window is, dragging and resizing it with the pointer,
// the right-click menus, and watching a page for errors. Everything works from what is on
// screen (boxes, `data-` attributes), never from the app's own state, so it keeps working
// when the window manager, menus or dock are rebuilt inside.
import { SESSION_COOKIE } from './api.mjs';
import { waitDesktop } from './browser.mjs';

const round = (n) => Math.round(n);

/** The window's box, and whether it (or its positioned wrapper) is still in a transition or animation. */
const readBox = (page, appId) =>
	page.evaluate((id) => {
		const el = document.querySelector(`[data-window-frame=${id}]`);
		if (!el) return null;
		const r = el.getBoundingClientRect();
		if (r.width === 0) return null;
		const moving = [el, el.parentElement].some((e) => e && e.getAnimations().some((a) => a.playState === 'running' || a.playState === 'pending'));
		return { box: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }, moving };
	}, appId);

/**
 * The window's box on screen ({ x, y, width, height }), or null when it is not shown.
 * Windows glide to a new place or size (a 200 ms transition after a snap, the opening
 * animation). On a busy machine a transition can stall, and a stalled one reads the same
 * twice; so this waits until no transition is running on the window and two reads agree.
 */
export async function frameBox(page, appId) {
	let last;
	for (let i = 0; i < 100; i++) {
		const next = await readBox(page, appId);
		if (next && !next.moving && last && JSON.stringify(next.box) === JSON.stringify(last.box)) return next.box;
		if (next === null && last === null) return null;
		last = next;
		await page.waitForTimeout(60);
	}
	return last?.box ?? null;
}

/** What is on top at a screen point: the app id of the window there, or '' when none. */
export const windowAt = (page, x, y) =>
	page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('[data-window-frame]')?.getAttribute('data-window-frame') ?? '', [x, y]);

/** Two animation frames: whatever the pointer just did has been painted. */
export const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

/** A point on the title bar that is neither a window button nor a text field (its middle). */
export const titlePoint = (box) => ({ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + 19) });

/**
 * The point that grabs a window's edge or corner for resizing: just outside the
 * visible frame, where the resize handles sit. `dir` is n, s, e, w, ne, nw, se or sw.
 */
export function edgePoint(box, dir) {
	const left = box.x;
	const right = box.x + box.width;
	const top = box.y;
	const bottom = box.y + box.height;
	const x = dir.includes('e') ? right + 1 : dir.includes('w') ? left - 1 : Math.round(box.x + box.width / 2);
	const y = dir.includes('s') ? bottom + 1 : dir.includes('n') ? top - 1 : Math.round(box.y + box.height / 2);
	return { x, y };
}

/**
 * Presses the pointer at `from`, moves it to `to` in `steps` small moves and, unless `hold`
 * is set, lets go there. With `hold` the button stays down: call `page.mouse.up()` yourself.
 */
export async function pointerDrag(page, from, to, { steps = 14, hold = false } = {}) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps });
	await settle(page);
	if (!hold) {
		await page.mouse.up();
		await settle(page);
	}
}

/** Drags a window by its title bar by (dx, dy). */
export async function dragWindow(page, appId, dx, dy, options) {
	const box = await frameBox(page, appId);
	const from = titlePoint(box);
	await pointerDrag(page, from, { x: from.x + dx, y: from.y + dy }, options);
	return frameBox(page, appId);
}

/** Resizes a window by grabbing the `dir` edge or corner and moving the pointer by (dx, dy). */
export async function resizeWindow(page, appId, dir, dx, dy) {
	const box = await frameBox(page, appId);
	const from = edgePoint(box, dir);
	await pointerDrag(page, from, { x: from.x + dx, y: from.y + dy });
	return frameBox(page, appId);
}

/** Whether the page is in the "a window is being moved" state, and what its windows' blur is. */
export const movingState = (page, appId) =>
	page.evaluate((id) => {
		const frame = document.querySelector(`[data-window-frame=${id}]`);
		const style = frame ? getComputedStyle(frame) : null;
		return {
			moving: document.documentElement.hasAttribute('data-window-moving'),
			blur: style ? (style.backdropFilter || style.webkitBackdropFilter || 'none') : '',
		};
	}, appId);

/**
 * Reloads the page and waits for the desktop and (when given) the window of `appId`.
 * The window state is saved with a short delay; callers wait `SAVE_MS` first.
 */
export const SAVE_MS = 900;
export async function reloadDesktop(page, appId) {
	await page.reload({ waitUntil: 'domcontentloaded' });
	await waitDesktop(page);
	if (appId) await page.locator(`[data-window-frame=${appId}]`).waitFor({ timeout: 15_000 });
}

/** The menu items on screen, by id (`data-menu-item`), submenus included once they are open. */
export const menuItems = (page) => page.locator('[data-menu-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu-item')));

/**
 * Raises a window (a click on a part of its title bar that is not covered by another window,
 * at least 90 px from the traffic lights) and presses one of its traffic lights: `close`, `minimize` or `maximize`.
 */
export async function windowControl(page, appId, control) {
	const box = await frameBox(page, appId);
	const y = box.y + 19;
	for (let x = box.x + 100; x < box.x + box.width - 10; x += 20) {
		if ((await windowAt(page, x, y)) === appId) {
			await page.mouse.click(x, y);
			await page.locator(`[data-window-frame=${appId}] [data-window-control=${control}]`).click();
			return;
		}
	}
	throw new Error(`${appId}: no uncovered part of the title bar to raise the window by`);
}

/** The box of the open context menu's panel (the first `[data-menu]`), or null. */
export async function menuBox(page) {
	const loc = page.locator('[data-menu]').first();
	if ((await loc.count()) === 0) return null;
	const box = await loc.boundingBox();
	return box ? { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) } : null;
}

/** Right-clicks a point on the bare desktop. */
export const rightClickDesktop = (page, x = 5, y = 450) => page.mouse.click(x, y, { button: 'right' });

/** Switches a signed-in context to another account's session (same browser storage) without a form sign-in. */
export async function swapSession(context, base, token) {
	await context.addCookies([{ name: SESSION_COOKIE, value: token, url: base }]);
}

/**
 * Collects what a page reports as broken: uncaught exceptions, console errors and
 * responses of scripts/pages that failed. Returns `{ problems, stop }`; `problems` fills as it happens.
 * `ignore` filters out known, unrelated noise by substring.
 */
export function watchPage(page, { ignore = [] } = {}) {
	const problems = [];
	const keep = (text) => !ignore.some((s) => text.includes(s));
	const onError = (e) => keep(String(e.message)) && problems.push(`exception: ${String(e.message).split('\n')[0]}`);
	const onConsole = (m) => {
		if (m.type() !== 'error') return;
		const text = m.text();
		if (keep(text)) problems.push(`console: ${text.split('\n')[0].slice(0, 200)}`);
	};
	const onResponse = (r) => {
		const url = r.url();
		if (r.status() >= 400 && /\/_next\/|\.js(\?|$)/.test(url) && keep(url)) problems.push(`${r.status()} ${url.split('?')[0]}`);
	};
	const onFailed = (r) => {
		const url = r.url();
		if (/\/_next\//.test(url) && keep(url) && !/net::ERR_ABORTED/.test(r.failure()?.errorText ?? '')) problems.push(`request failed: ${url.split('?')[0]}`);
	};
	page.on('pageerror', onError);
	page.on('console', onConsole);
	page.on('response', onResponse);
	page.on('requestfailed', onFailed);
	return {
		problems,
		stop() {
			page.off('pageerror', onError);
			page.off('console', onConsole);
			page.off('response', onResponse);
			page.off('requestfailed', onFailed);
		},
	};
}
