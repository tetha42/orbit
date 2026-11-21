// Settings → Roles and Permissions (admin): list, New Role, color picker, 2FA hint (#2),
// role creation, Member Directory badges/select, deleting an assigned role and moving members.
import { openApp, openSettingsTab } from '../lib/browser.mjs';
import { tr, trf } from '../lib/locale.mjs';

export const meta = { title: 'Roles tab, role creation/deletion, Member Directory (admin)' };

const GREEN = '#30d158';

export default async function suite(t) {
	const { fx } = t;
	const admin = await t.api('admin');
	const rolesApi = async (c = admin) => (await c.get('/api/roles')).json;
	const roleName = `E2E Events Team ${Date.now().toString(36)}`;
	const roleNameLocked = `E2E Notes Management ${Date.now().toString(36)}`;
	let createdId = null;
	let lockedId = null;

	// Whatever this suite leaves behind goes: members back to their fixture roles, test roles deleted.
	t.cleanup(async () => {
		for (const [key, roleKey] of [['ege', 'member'], ['can', 'member']]) {
			await admin.patch('/api/members', { id: t.fx.users[key].id, roleId: t.fx.roles[roleKey] });
		}
		for (const id of [createdId, lockedId]) {
			if (id) await admin.del('/api/roles', { id, move: fx.roles.member });
		}
	});

	const { page } = await t.open('admin');
	const settings = await openSettingsTab(page, 'roles');
	await settings.locator('[data-role-id]').first().waitFor();

	await t.step('4 built-in/fixture roles are listed', async () => {
		const api = (await rolesApi()).roles;
		const names = await settings.locator('[data-role-id]').evaluateAll((els) => els.map((e) => e.querySelector('div > div')?.firstChild?.textContent?.trim()));
		for (const name of ['Admin', fx.roleNames.management, fx.roleNames.member, fx.roleNames.news]) {
			t.includes(names, name, `the Roles tab includes "${name}"`);
			t.check(api.some((r) => r.name === name), `the API includes "${name}"`);
		}
		t.eq(names.length, api.length, 'the number of roles in the list matches the API');
		await t.shot(page, 'roles-list');
	});

	await t.step('#2: the 2FA box enforces management permissions and allows manual control otherwise', async () => {
		await settings.getByRole('button', { name: tr('rolesCreateBtn') }).click();
		const sheet = page.getByRole('dialog', { name: tr('rolesNewTitle') });
		await sheet.waitFor();
		const box = sheet.locator('label', { hasText: tr('roles2faRequired') }).locator('input[type=checkbox]');
		// Acceptance 1: a new role starts without the second factor and is editable.
		t.check(!(await box.isChecked()), '#2 new role: the 2FA box is unchecked');
		t.check(!(await box.isDisabled()), '#2 new role: the 2FA box is enabled');
		// Acceptance 2: once an app is set to Manage, the box is checked and locked automatically with notice.
		await sheet.locator('[data-app=events]').getByRole('radio', { name: tr('auditValue_manage') }).click();
		t.check(await box.isChecked(), '#2 Events=Manage: the box was checked automatically');
		t.check(await box.isDisabled(), '#2 Events=Manage: the box is locked as mandatory');
		t.check((await sheet.innerText()).includes(tr('roles2faAdminAutoNotice')), '#2 Events=Manage: mandatory notice is visible');
		await t.shot(page, '2fa-hint-visible');
		// Acceptance 3: dropping back to non-management restores manual control; re-enabling Manage re-enforces 2FA.
		await sheet.locator('[data-app=events]').getByRole('radio', { name: tr('auditValue_use') }).click();
		t.check(!(await box.isDisabled()), '#2 Events=Use: manual toggle is enabled again');
		await box.click();
		t.check(await box.isChecked(), '#2 manual check works for non-management role');
		await box.click();
		t.check(!(await box.isChecked()), '#2 manual uncheck works for non-management role');
		await sheet.locator('[data-app=teams]').getByRole('radio', { name: tr('auditValue_manage') }).click();
		t.check(await box.isChecked(), '#2 Teams=Manage: enforces 2FA again');
		await sheet.getByRole('button', { name: tr('cancel') }).click();
		await sheet.waitFor({ state: 'detached' });
	});

	await t.step('create a role through the UI: name, color, matrix, 2FA', async () => {
		await settings.getByRole('button', { name: tr('rolesCreateBtn') }).click();
		const sheet = page.getByRole('dialog', { name: tr('rolesNewTitle') });
		await sheet.waitFor();
		await sheet.getByPlaceholder(tr('rolesNamePh')).fill(roleName);

		// Whether the color button is really clickable: inside the modal and the viewport, nothing on top of it, a mouse click works.
		const swatch = sheet.getByRole('radio', { name: GREEN });
		const vp = page.viewportSize();
		const sheetBox = await sheet.boundingBox();
		const sw = await swatch.boundingBox();
		t.check(sw.x >= sheetBox.x && sw.y >= sheetBox.y && sw.x + sw.width <= sheetBox.x + sheetBox.width && sw.y + sw.height <= sheetBox.y + sheetBox.height, 'the color button is inside the role modal', JSON.stringify({ sw, sheetBox }));
		t.check(sheetBox.y >= 28 && sheetBox.y + sheetBox.height <= vp.height, 'the role modal does not overflow the top or bottom of the desktop viewport', JSON.stringify({ sheetBox, vp }));
		const cx = sw.x + sw.width / 2;
		const cy = sw.y + sw.height / 2;
		t.check(await page.evaluate(([x, y, c]) => document.elementFromPoint(x, y)?.getAttribute('aria-label') === c, [cx, cy, GREEN]), 'nothing covers the color button (elementFromPoint)');
		await page.mouse.click(cx, cy);
		t.eq(await swatch.getAttribute('aria-checked'), 'true', 'an actual mouse click selected the color');

		await sheet.locator('[data-app=events]').getByRole('radio', { name: tr('auditValue_manage') }).click();
		await sheet.locator('[data-app=news]').getByRole('radio', { name: tr('auditValue_use') }).click();
		await t.shot(page, 'new-role-filled');
		await sheet.getByRole('button', { name: tr('save') }).click();
		await sheet.waitFor({ state: 'detached' });
		await settings.locator('[data-role-id]', { hasText: roleName }).waitFor();

		const r = (await rolesApi()).roles.find((x) => x.name === roleName);
		createdId = r?.id ?? null;
		t.check(r, 'GET /api/roles returns the new role');
		t.eq(r?.color, GREEN, 'color #30d158 saved');
		t.eq(r?.permissions?.events, 'manage', 'Events = manage saved');
		t.eq(r?.permissions?.news, 'use', 'News = use saved');
		t.eq(r?.twoStepRequired, true, 'twoStepRequired: true (automatic for a role with admin permission)');
		const row = settings.locator(`[data-role-id="${createdId}"]`);
		t.check((await row.innerText()).includes(tr('twofactorRequiredBadge')), 'the role row has the "2FA required" badge');
		await t.shot(page, 'role-in-list');
	});

	// A role containing a permission its admin (zeynep) does not have: zeynep cannot assign it, admin can.
	await t.step('locked role is prepared (zeynep cannot assign it)', async () => {
		const res = await admin.post('/api/roles', { name: roleNameLocked, color: '#ff375f', description: '', twoStepRequired: true, permissions: { notes: 'manage', news: 'use', settings: 'use' } });
		lockedId = res.json?.id ?? null;
		t.check(res.status === 200 || res.status === 201, 'the notes=manage role was created through the API', JSON.stringify(res));
	});

	const openRoleMenu = async (p, win, userId) => {
		const btn = win.locator(`[data-member-menu="${userId}"]`);
		await btn.waitFor();
		await btn.click();
		const sub = p.locator(`[data-menu-item="change-role-${userId}"]`);
		await sub.waitFor();
		await sub.click();
		await p.locator(`[data-menu-item="role-none-${userId}"]`).waitFor();
		return p.locator(`[data-menu-item^="role-"]:not([data-menu-item="role-none-${userId}"])`);
	};

	await t.step('Member Directory: badges, role list, role assignment', async () => {
		const rolesRes = page.waitForResponse((r) => r.url().includes('/api/roles') && r.request().method() === 'GET').catch(() => null);
		const win = await openApp(page, 'members');
		await rolesRes;
		await win.locator('[data-role-badge]').first().waitFor();
		const api = (await rolesApi()).roles;
		const assignableIds = api.filter((r) => r.assignable).map((r) => r.id);

		// Give the new role to two members through the UI context menu.
		for (const key of ['ege', 'can']) {
			const userId = fx.users[key].id;
			const items = await openRoleMenu(page, win, userId);
			if (key === 'ege') {
				const menuIds = await items.evaluateAll((els, uid) => els.map((e) => e.getAttribute('data-menu-item').slice(5, -(uid.length + 1))), userId);
				const labels = await items.allInnerTexts();
				t.sameSet(menuIds, assignableIds, 'the role list for admin = assignable roles (API)');
				t.includes(labels.map((s) => s.trim()), roleName, 'the role list includes the new role');
			}
			await page.locator(`[data-menu-item="role-${createdId}-${userId}"]`).click();
		}
		await t.waitFor(async () => (await rolesApi()).roles.find((r) => r.id === createdId)?.userCount === 2);
		t.eq((await rolesApi()).roles.find((r) => r.id === createdId)?.userCount, 2, 'two members moved to the new role (userCount=2)');

		// Badge: name and color (#30d158 = rgb(48, 209, 88)).
		const badges = win.locator(`[data-role-badge="${roleName}"]`);
		await badges.first().waitFor();
		await t.waitFor(async () => (await badges.count()) === 2);
		t.eq(await badges.count(), 2, 'the Member Directory has two badges for the new role');
		t.eq(await badges.first().evaluate((e) => getComputedStyle(e).color), 'rgb(48, 209, 88)', 'the badge color matches the role color');
		const allBadges = await win.locator('[data-role-badge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-role-badge')));
		t.includes(allBadges, fx.roleNames.management, 'other roles also appear as badges');
		t.includes(allBadges, fx.roleNames.news, 'other roles also appear as badges (news-only)');
		await t.shot(page, 'member-directory-badges');
	});

	await t.step('Member Directory: an admin without enough permission sees only assignable roles (zeynep)', async () => {
		const zeynep = await t.open('zeynep');
		const win = await openApp(zeynep.page, 'members');
		await win.locator('[data-role-badge]').first().waitFor();
		const api = (await rolesApi(await t.api('zeynep'))).roles;
		const assignable = api.filter((r) => r.assignable);
		t.includes(assignable.map((r) => r.name), roleName, 'the events role is assignable for zeynep (API)');
		t.excludes(assignable.map((r) => r.name), roleNameLocked, 'the notes=manage role is not assignable for zeynep (API)');
		const userId = fx.users.ege.id;
		const items = await openRoleMenu(zeynep.page, win, userId);
		const menuIds = await items.evaluateAll((els, uid) => els.map((e) => e.getAttribute('data-menu-item').slice(5, -(uid.length + 1))), userId);
		const labels = (await items.allInnerTexts()).map((s) => s.trim());
		t.sameSet(menuIds, assignable.map((r) => r.id), 'zeynep\'s role list = assignable roles');
		t.excludes(labels, roleNameLocked, 'a role containing a permission she does not have is absent from the list');
		t.excludes(labels, 'Admin', 'zeynep cannot assign the Admin role');
		await t.shot(zeynep.page, 'member-directory-zeynep');
		await zeynep.page.keyboard.press('Escape');
	});

	await t.step('delete an assigned role: move-members dialog', async () => {
		// The settings panel loaded before members were assigned: the on-screen count is stale. Deletion must still ask for the real count.
		await openSettingsTab(page, 'roles');
		const row = settings.locator(`[data-role-id="${createdId}"]`);
		await row.getByRole('button', { name: trf('rolesDeleteAria', { name: roleName }) }).click();
		const sheet = page.getByRole('dialog', { name: trf('rolesDeleteTitle', { name: roleName }) });
		await sheet.waitFor();
		t.check((await sheet.innerText()).includes(trf('rolesMembersInRole', { n: 2 })), 'the dialog says "2 people"');
		await sheet.getByRole('combobox', { name: tr('rolesTargetRoleAria') }).selectOption(fx.roles.member);
		await t.shot(page, 'delete-role-move-members');
		await sheet.getByRole('button', { name: tr('rolesMigrateAndDel') }).click();
		await sheet.waitFor({ state: 'detached' });
		await settings.locator(`[data-role-id="${createdId}"]`).waitFor({ state: 'detached' });

		const after = (await rolesApi()).roles;
		t.check(!after.some((r) => r.id === createdId), 'the role was removed from the API list');
		const memberCount = after.find((r) => r.id === fx.roles.member)?.userCount;
		const members = (await admin.get('/api/members')).json.members;
		for (const key of ['ege', 'can']) {
			t.eq(members.find((m) => m.id === fx.users[key].id)?.roleId, fx.roles.member, `${key} was moved to the member role`);
		}
		t.check(memberCount >= 2, 'the member role user count increased', String(memberCount));
		createdId = null;
		await t.shot(page, 'role-deleted');
	});
}
