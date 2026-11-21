// Deep links: booting to /?app=news&id=... and /?app=events&id=... opens the target window and
// selects the target item without losing the window to auth gate timing or workspace restore races.
import { SESSION_COOKIE } from '../lib/api.mjs';
import { DESKTOP, MOBILE, newContext, openWindows, waitDesktop } from '../lib/browser.mjs';
import { temporaryMember, uniq } from '../lib/temporary.mjs';

export const meta = { title: 'Deep links: /?app=news&id= and /?app=events&id= survive cold boot and workspace restore' };

export default async function suite(t) {
	const admin = await t.api('admin');
	const tag = uniq();
	const member = await temporaryMember(t, {
		permissions: { news: 'use', events: 'use', settings: 'use' },
		name: `DeepLink_${tag}`,
	});

	const newsTitle = `Deep Link News ${tag}`;
	const newsRes = await admin.post('/api/news', {
		title: newsTitle,
		content: 'Deep link target article body.',
		category: 'general',
		publishStatus: 'published',
	});
	const newsId = newsRes.json?.id;
	if (!newsId) throw new Error(`Failed to create news: ${newsRes.status}`);
	t.cleanup(() => admin.del(`/api/news?id=${encodeURIComponent(newsId)}`));

	const start = Date.now() + 4 * 3600_000;
	const eventTitle = `Deep Link Event ${tag}`;
	const eventRes = await admin.post('/api/events', {
		action: 'createEvent',
		title: eventTitle,
		description: 'Deep link target event description.',
		typeValue: 'seminar',
		location: 'Room D-204',
		start,
		end: start + 3600_000,
		capacity: 25,
		status: 'published',
	});
	const eventId = eventRes.json?.event?.id ?? eventRes.json?.id;
	if (!eventId) throw new Error(`Failed to create event: ${eventRes.status}`);
	t.cleanup(() => admin.post('/api/events', { action: 'deleteEvent', eventId }));

	async function openDeepLink(urlPath, viewport) {
		const context = await newContext(t.browser, { viewport });
		await context.addCookies([{ name: SESSION_COOKIE, value: member.api.token, url: t.base }]);
		const page = await context.newPage();
		await page.goto(`${t.base}${urlPath}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
		if (viewport === DESKTOP) await waitDesktop(page);
		return { context, page };
	}

	await t.step('desktop cold boot to /?app=news&id=... opens News and target article', async () => {
		const { context, page } = await openDeepLink(`/?app=news&id=${encodeURIComponent(newsId)}`, DESKTOP);
		try {
			const win = page.locator('[data-window-frame=news]');
			await win.waitFor({ timeout: 15_000 });
			const modal = page.getByRole('dialog').filter({ hasText: newsTitle });
			await modal.waitFor({ timeout: 15_000 });
			// Wait briefly to confirm delayed /api/profile/workspace restore does not close or hide News
			await page.waitForTimeout(800);
			t.includes(await openWindows(page), 'news', 'news window stays open after remote restore');
			t.check(await modal.isVisible(), 'news target article modal stays open');
			t.check(!page.url().includes('app=news'), 'deep-link URL params stripped after handling');
		} finally {
			await context.close();
		}
	});

	await t.step('desktop cold boot to /?app=events&id=... opens Events and selects target event', async () => {
		const { context, page } = await openDeepLink(`/?app=events&id=${encodeURIComponent(eventId)}`, DESKTOP);
		try {
			const win = page.locator('[data-window-frame=events]');
			await win.waitFor({ timeout: 15_000 });
			await win.getByRole('heading', { name: eventTitle }).waitFor({ timeout: 15_000 });
			await page.waitForTimeout(800);
			t.includes(await openWindows(page), 'events', 'events window stays open after remote restore');
			t.check(await win.getByRole('heading', { name: eventTitle }).isVisible(), 'event target detail stays visible');
			t.check(!page.url().includes('app=events'), 'events deep-link URL params stripped after handling');
		} finally {
			await context.close();
		}
	});

	await t.step('mobile cold boot to /?app=news&id=... opens News view and target article', async () => {
		const { context, page } = await openDeepLink(`/?app=news&id=${encodeURIComponent(newsId)}`, MOBILE);
		try {
			await page.getByText(newsTitle).first().waitFor({ timeout: 30_000 });
			t.check(await page.getByText(newsTitle).first().isVisible(), 'mobile deep-link renders target news article');
			t.check(!page.url().includes('app=news'), 'mobile deep-link URL params stripped after handling');
		} finally {
			await context.close();
		}
	});
}
