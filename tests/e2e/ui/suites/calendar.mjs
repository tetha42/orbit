// Clock in the menu bar (#15): clicking it opens a calendar panel that drops from above. Dates are always computed
// relative to "now" (no fixed dates); events are only read for users with the `events: use` permission, and no request is made without it.
import { makeEvent, removeEvent, sweepEvents } from '../lib/event.mjs';

export const meta = { title: 'Calendar: month panel on clock click (open/close, month navigation, keyboard, event marker, reduced motion)' };

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthName = (d, locale) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);

const clock = (page) => page.locator('[data-clock-toggle]');
const panel = (page) => page.locator('[data-calendar-panel]');
const title = async (page) => ((await page.locator('[data-calendar-title]').textContent()) ?? '').trim().toLowerCase();
const dayCell = (page, key) => page.locator(`[data-calendar-day="${key}"]`);
const gridKeys = (page) => page.locator('[data-calendar-day]').evaluateAll((e) => e.map((x) => x.getAttribute('data-calendar-day')));
const focused = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-calendar-day') ?? null);
const open = async (page) => {
	await clock(page).click();
	await panel(page).waitFor();
};
const waitClosed = (page) => panel(page).waitFor({ state: 'detached', timeout: 3000 });

export default async function suite(t) {
	const admin = await t.api('admin');
	await sweepEvents(admin);

	const now = new Date();
	const todayKey = keyOf(now);

	await t.step('clicking the clock opens the panel: correct month, today highlighted, Monday-first; drop-down animation', async () => {
		const { page } = await t.open('can', { reducedMotion: 'no-preference' });
		t.eq(await clock(page).getAttribute('aria-expanded'), 'false', 'aria-expanded=false while closed');
		t.eq(await panel(page).count(), 0, 'no panel while closed');
		await open(page);
		t.eq(await clock(page).getAttribute('aria-expanded'), 'true', 'aria-expanded=true while open');
		t.eq(await title(page), monthName(now, 'tr-TR').toLowerCase(), 'the title shows the current month and year');
		const today = page.locator('[data-calendar-day][data-today]');
		t.eq(await today.count(), 1, 'exactly one today cell');
		t.eq(await today.getAttribute('data-calendar-day'), todayKey, 'the highlighted day is today');
		t.eq(await today.getAttribute('aria-current'), 'date', 'today has aria-current=date');
		const keys = await gridKeys(page);
		t.eq(keys.length, 42, '6 weeks (fixed height)');
		const [y, m, d] = keys[0].split('-').map(Number);
		t.eq(new Date(y, m - 1, d).getDay(), 1, 'tr: first column is Monday');
		const names = await page.locator('[data-calendar-panel] [data-calendar-weekday]').allTextContents();
		const monday = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(new Date(2023, 0, 2));
		t.eq(names[0], monday, 'the weekday header starts with Monday', JSON.stringify(names));
		t.check((await page.locator('[data-calendar-day]:not([data-outside])').count()) === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), 'the number of days in the month is correct');
		// Animation: from top to bottom, transform + opacity.
		const anim = await panel(page).evaluate((el) => {
			const cs = getComputedStyle(el);
			const rules = [...document.styleSheets].flatMap((sh) => [...sh.cssRules]).filter((r) => r.type === CSSRule.KEYFRAMES_RULE && r.name === cs.animationName);
			const frames = rules[0] ? [...rules[0].cssRules] : [];
			const props = [...new Set(frames.flatMap((f) => [...f.style]))];
			return { name: cs.animationName, ms: parseFloat(cs.animationDuration) * 1000, props, from: frames[0]?.style.getPropertyValue('transform') };
		});
		t.check(/calendarDrop/.test(anim.name) && anim.ms >= 100, 'the opening animation is defined (calendarDrop)', JSON.stringify(anim));
		t.sameSet(anim.props, ['opacity', 'transform'], 'only transform and opacity are animated', JSON.stringify(anim));
		t.check(/-\d/.test(anim.from ?? ''), 'top to bottom: the initial Y offset is negative', anim.from);
		// If the position is measured before the opening animation ends, the panel is still above (this used to fail intermittently under load).
		await panel(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
		const box = await panel(page).boundingBox();
		const bar = await page.locator('[data-topbar]').boundingBox();
		t.check(box.y >= bar.y + bar.height - 2, 'the panel opens below the menu bar', JSON.stringify({ box, bar }));
		t.check(box.x >= 0 && box.x + box.width <= 1440, 'does not overflow the screen');
		await t.shot(page, 'open-desktop');
	});

	await t.step('close paths: Esc, clicking the clock again, clicking outside', async () => {
		const { page } = await t.open('can');
		await open(page);
		await page.keyboard.press('Escape');
		await waitClosed(page);
		t.eq(await clock(page).getAttribute('aria-expanded'), 'false', 'Esc: closed, aria-expanded=false');
		await open(page);
		await clock(page).click();
		await waitClosed(page);
		t.check(true, 'clicking the clock again: closed');
		await open(page);
		await page.mouse.click(400, 500);
		await waitClosed(page);
		t.check(true, 'clicking outside: closed');
		await open(page);
		await panel(page).click({ position: { x: 30, y: 6 } });
		t.eq(await panel(page).count(), 1, 'clicking inside the panel does not close it');
	});

	await t.step('month navigation: previous/next arrow, Today', async () => {
		const { page } = await t.open('can');
		await open(page);
		const here = await title(page);
		await page.locator('[data-calendar-next]').click();
		t.eq(await title(page), monthName(new Date(now.getFullYear(), now.getMonth() + 1, 1), 'tr-TR').toLowerCase(), 'next month');
		await page.locator('[data-calendar-prev]').click();
		await page.locator('[data-calendar-prev]').click();
		t.eq(await title(page), monthName(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'tr-TR').toLowerCase(), 'previous month');
		await page.locator('[data-calendar-prev]').click();
		t.eq(await page.locator('[data-calendar-day][data-today]').count(), 0, 'no today cell when two months back');
		await page.locator('[data-calendar-today]').click();
		t.eq(await title(page), here, 'Today: returned to the current month');
		t.eq(await page.locator('[data-calendar-day][data-today]').getAttribute('data-calendar-day'), todayKey, 'Today: today is highlighted again');
		// Year boundary: 12 months forward = the same month next year.
		for (let i = 0; i < 12; i++) await page.locator('[data-calendar-next]').click();
		t.eq(await title(page), monthName(new Date(now.getFullYear() + 1, now.getMonth(), 1), 'tr-TR').toLowerCase(), '12 months later: next year');
	});

	await t.step('keyboard: arrow keys move between days, PageDown/PageUp change months, Esc returns to the clock', async () => {
		const { page } = await t.open('can');
		await open(page);
		await dayCell(page, todayKey).focus();
		const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		await page.keyboard.press('ArrowRight');
		t.eq(await focused(page), keyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)), 'Right arrow: focus on the next day');
		await page.keyboard.press('ArrowDown');
		t.eq(await focused(page), keyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 8)), 'Down arrow: +7 days');
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowUp');
		t.eq(await focused(page), keyOf(new Date(base.getFullYear(), base.getMonth(), base.getDate() + 0)), 'Left + Up arrows: back to today');
		for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
		const far = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 40);
		t.eq(await focused(page), keyOf(far), '40 days later: focus stays on the day even when the month changes');
		t.eq(await title(page), monthName(far, 'tr-TR').toLowerCase(), 'the month title changed along with the focused day');
		await page.keyboard.press('PageUp');
		t.eq(await title(page), monthName(new Date(far.getFullYear(), far.getMonth() - 1, 1), 'tr-TR').toLowerCase(), 'PageUp: previous month');
		t.eq(await page.locator('[data-calendar-day][tabindex="0"]').count(), 1, 'a single tab stop (roving tabindex)');
		await page.keyboard.press('Escape');
		await waitClosed(page);
		t.check(await clock(page).evaluate((el) => el === document.activeElement), 'Esc: focus returned to the clock button');
		// Opening with the keyboard (Enter).
		await page.keyboard.press('Enter');
		await panel(page).waitFor();
		t.check(true, 'Enter: the clock button opens it with the keyboard');
	});

	await t.step('opening another panel closes the calendar and vice versa (one panel at a time); locale: en starts on Sunday', async () => {
		const { page } = await t.open('can');
		await open(page);
		await page.locator('button[title="Denetim Merkezi"]').click();
		await waitClosed(page);
		t.check(true, 'the calendar closed when Control Center opened');
		await page.locator('[data-clock-toggle]').click();
		await panel(page).waitFor();
		t.eq(await page.locator('input[type=range]').count(), 0, 'Control Center closed when the calendar opened');
		await page.locator('[data-notification-toggle]').click();
		await waitClosed(page);
		t.check(await page.locator('[data-notification-panel]').count() === 1, 'the calendar closed when the notification panel opened, and the notification panel is open');
		await clock(page).click();
		await panel(page).waitFor();
		t.eq(await page.locator('[data-notification-panel]').count(), 0, 'the notification panel closed when the calendar opened');
		// Esc closes everything, not just the calendar; English: Sunday-first, English month name.
		await page.keyboard.press('Escape');
		await waitClosed(page);
		const canApi = await t.api('can');
		await canApi.patch('/api/profile', { preferredLanguage: 'en' });
		try {
			await page.reload();
			await page.locator('[data-dock-app]').first().waitFor();
			await open(page);
			t.eq(await title(page), monthName(now, 'en-US').toLowerCase(), 'en: English month name');
			const keys = await gridKeys(page);
			const [y, m, d] = keys[0].split('-').map(Number);
			t.eq(new Date(y, m - 1, d).getDay(), 0, 'en: first column is Sunday');
			const names = await page.locator('[data-calendar-panel] [data-calendar-weekday]').allTextContents();
			t.eq(names[0], new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(2023, 0, 1)), 'en: the weekday header starts with Sun', JSON.stringify(names));
			t.eq(await page.locator('[data-calendar-today]').textContent(), 'Today', 'en: the "Today" button');
			await t.shot(page, 'open-en');
		} finally {
			await canApi.patch('/api/profile', { preferredLanguage: 'tr' });
		}
	});

	await t.step('event marker: with the events=use permission the day is marked and listed; without it no request is made', async () => {
		const ev = await makeEvent(t, admin, { label: 'calendar', startMin: 2 * 24 * 60 + 5 });
		const start = new Date(Date.now() + (2 * 24 * 60 + 5) * 60_000);
		const key = keyOf(start);
		const { page } = await t.open('can');
		const reqs = [];
		page.on('request', (r) => r.url().includes('/api/events') && reqs.push(r.url()));
		await open(page);
		await dayCell(page, key).waitFor();
		await page.waitForFunction((k) => document.querySelector(`[data-calendar-day="${k}"]`)?.hasAttribute('data-has-event'), key, { timeout: 5000 });
		t.eq(await dayCell(page, key).getAttribute('data-has-event'), '', 'the event day is marked');
		t.check(reqs.length >= 1, 'the permitted role read /api/events on open', String(reqs.length));
		await dayCell(page, key).click();
		t.check((await page.locator(`[data-calendar-event="${ev.id}"]`).count()) === 1, 'clicking the day lists the event', ev.title);
		t.check((await page.locator(`[data-calendar-event="${ev.id}"]`).textContent()).includes(ev.title), 'the event title is visible');
		// Expected: the days in the grid touched by a (non-draft/non-cancelled) event, including the fixture events.
		const all = (await admin.get('/api/events')).json.events.filter((e) => e.status !== 'draft' && e.status !== 'cancelled');
		const touched = new Set();
		for (const e of all) for (let d = new Date(new Date(e.start).setHours(0, 0, 0, 0)); d.getTime() <= (e.endTime ?? e.end); d.setDate(d.getDate() + 1)) touched.add(keyOf(d));
		const shown = await gridKeys(page);
		const expected = shown.filter((k) => touched.has(k)).sort();
		const marked = await page.locator('[data-calendar-day][data-has-event]').evaluateAll((e) => e.map((x) => x.getAttribute('data-calendar-day')).sort());
		t.eq(marked, expected, 'marked days = days touched by events (no extra or missing marks)');
		await t.shot(page, 'event-marker');
		await page.keyboard.press('Escape');

		// Not permitted (news only): no request to /api/events before opening the tab or while the panel is open; there is no list box either.
		const { page: reader } = await t.open('reader');
		const readerReqs = [];
		reader.on('request', (r) => r.url().includes('/api/events') && readerReqs.push(r.url()));
		await open(reader);
		await reader.locator('[data-calendar-next]').click();
		await reader.waitForTimeout(800);
		t.eq(readerReqs, [], 'role without the events permission: no request was made to /api/events');
		t.eq(await reader.locator('[data-calendar-day][data-has-event]').count(), 0, 'no marks');
		t.eq(await reader.locator('[data-calendar-agenda]').count(), 0, 'no event list box');
		t.eq(await reader.locator('[data-calendar-day]').count(), 42, 'the calendar still opens');
		await removeEvent(admin, ev.id);
	});

	await t.step('reduce motion: no animation when on (1 ms), animation when off', async () => {
		const read = (page) => panel(page).evaluate((el) => ({ ms: parseFloat(getComputedStyle(el).animationDuration) * 1000, motion: document.documentElement.getAttribute('data-motion') }));
		const { page: calm } = await t.open('can', { prefs: { reduceMotion: true } });
		await open(calm);
		const a = await read(calm);
		t.eq(a.motion, 'reduce', 'data-motion=reduce');
		t.check(a.ms <= 1, 'reduce motion on: animation duration ≤ 1 ms', JSON.stringify(a));
		t.eq(await panel(calm).evaluate((el) => document.getAnimations().filter((x) => x.effect?.target === el && x.playState === 'running' && x.effect.getComputedTiming().duration > 5).length), 0, 'no real animation is running');
		const { page: full } = await t.open('can', { prefs: { reduceMotion: false } });
		await open(full);
		const b = await read(full);
		t.eq(b.motion, 'full', 'data-motion=full');
		t.check(b.ms >= 100, 'reduce motion off: there is an animation', JSON.stringify(b));
	});

	await t.step('dark theme + accent color: tokens are followed; no overflow on a narrow desktop (768); no overflow on mobile 390×844', async () => {
		const { page } = await t.open('can', { prefs: { theme: 'dark', accent: 'purple' } });
		await open(page);
		const css = await page.evaluate(() => {
			const probe = (v) => {
				const i = document.createElement('i');
				i.style.background = v;
				document.body.append(i);
				const c = getComputedStyle(i).backgroundColor;
				i.remove();
				return c;
			};
			const today = getComputedStyle(document.querySelector('[data-calendar-day][data-today]')).backgroundColor;
			const bg = getComputedStyle(document.querySelector('[data-calendar-panel]')).backgroundColor;
			return { today, accent: probe('var(--accent)'), bg, menuBg: probe('var(--menu-bg)') };
		});
		t.eq(css.today, css.accent, 'the today cell follows the --accent color (purple)');
		t.eq(css.bg, css.menuBg, 'panel background is --menu-bg');
		await t.shot(page, 'open-dark');
		await page.setViewportSize({ width: 768, height: 800 });
		await page.waitForTimeout(200);
		const box = await panel(page).boundingBox();
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		t.check(box.x >= 0 && box.x + box.width <= 768 && overflow <= 0, 'at 768 width the panel stays on screen and the page does not overflow', JSON.stringify({ box, overflow }));
		await t.shot(page, 'open-768');
		const { page: mobile } = await t.open('can', { mobile: true });
		await mobile.locator('[data-mobile-nav]').waitFor();
		const mo = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
		t.check(mo <= 0, '390×844: no horizontal overflow', `${mo}px`);
		t.eq(await mobile.locator('[data-clock-toggle]').count(), 0, 'the mobile launcher has no menu bar (and no clock); the calendar is desktop-only');
		await t.shot(mobile, 'mobile-390');
	});
}
