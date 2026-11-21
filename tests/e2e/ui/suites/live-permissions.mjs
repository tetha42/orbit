// Live permission change: admin changes a member's role and the member's open session is
// updated without a page reload within seconds via the SSE stream (/api/stream). The fallback to
// the 15 s polling when the stream is absent is exercised in the `sse` suite.
import { dockApps, openApp, openWindows } from '../lib/browser.mjs';

export const meta = { title: 'Changing a role updates the open session within seconds via SSE' };

const MEMBER_DOCK = ['teams', 'events', 'projects', 'decisions', 'news', 'certificates', 'inventory', 'members', 'notes', 'settings', 'chat', 'mail'];
const NEWS_DOCK = ['chat', 'news', 'settings'];
// SSE event + /api/auth/me + render; far from the 15 s polling (a poll would exceed this limit).
const LIMIT_MS = 4_000;

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const canId = fx.users.can.id;
	const setRole = (roleId) => admin.patch('/api/members', { id: canId, roleId });
	t.cleanup(() => setRole(fx.roles.member));

	// "can" (Member) keeps Events open in their own browser context; admin is a separate client.
	const { page } = await t.open('can');
	await t.step('start: the Member role can open apps', async () => {
		await openApp(page, 'events');
		t.sameSet(await dockApps(page), MEMBER_DOCK, 'dock: apps available to the Member role');
		t.includes(await openWindows(page), 'events', 'events window is open');
		await t.shot(page, 'once-uye-etkinlikler-acik');
		await t.sleep(1000); // brief pause so the live stream can connect
	});

	await t.step('admin switches the role to news-only → dock and windows update within ≤4 s', async () => {
		const res = await setRole(fx.roles.news);
		t.eq(res.status, 200, 'PATCH /api/members assigning the news-only role returns 200');
		const ms = await t.waitFor(async () => {
			const dock = await dockApps(page);
			return !dock.includes('events') && !dock.includes('teams');
		}, { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= LIMIT_MS, `Events and Teams disappeared from the dock without a page reload (${ms} ms ≤ ${LIMIT_MS})`);
		t.sameSet(await dockApps(page), NEWS_DOCK, 'dock only has News and Settings');
		t.excludes(await openWindows(page), 'events', 'the open events window closed');
		t.excludes(await openWindows(page), 'teams', 'the default open teams window closed');
		await t.shot(page, 'sonra-sadece-haberler');
	});

	await t.step('admin restores the role → apps return to the dock', async () => {
		await setRole(fx.roles.member);
		const ms = await t.waitFor(async () => (await dockApps(page)).includes('events'), { timeout: 25_000, every: 100 });
		t.check(ms >= 0 && ms <= LIMIT_MS, `dock updated after the Member role was restored (${ms} ms)`);
		t.sameSet(await dockApps(page), MEMBER_DOCK, 'dock again shows the Member role\'s apps');
	});
}
