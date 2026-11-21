// A throw-away member (and, when asked, a throw-away role) for a suite that needs an
// account the fixtures do not have: another permission level, or one whose password it may change.
// Everything is made through the admin API and removed again by `t.cleanup`; the fixture
// accounts are never touched.
import crypto from 'node:crypto';
import { loginApi } from './api.mjs';
import { openSession } from './browser.mjs';
import { createMember, createRole } from './seed.mjs';

/** A short unique suffix for names, e-mails and codes. */
export const uniq = () => `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

/** A password that satisfies the portal's rules and exists only in this run. */
export const randomPassword = () => `E2e-${crypto.randomBytes(9).toString('base64url')}-9!`;

/**
 * @param t        the suite context
 * @param options  `permissions` (role matrix; a role is made for it) or `roleId` (an existing role);
 *                 `name` is the first name (shown in lists)
 * @returns { id, email, password, name, surname, roleId, api, open }  `api` is signed in; `open()` is a browser page signed in as it
 */
export async function temporaryMember(t, { permissions, roleId, name = 'Temporary' } = {}) {
	const admin = await t.api('admin');
	const tag = uniq();
	let role = roleId;
	if (!role) {
		role = await createRole(admin, { name: `E2E Role ${tag}`, color: '#64d2ff', description: 'Temporary test role', twoStepRequired: false, permissions });
		t.cleanup(async () => {
			await admin.del('/api/roles', { id: role, move: t.fx.roles.member });
		});
	}
	const surname = `Test${tag}`;
	const email = `e2e-${tag}@club.test`;
	const m = await createMember(admin, t.base, { name, surname, email, roleId: role });
	t.cleanup(async () => {
		await admin.del(`/api/members?id=${encodeURIComponent(m.id)}`);
	});
	const api = await loginApi(t.base, email, m.password);
	return {
		id: m.id,
		email,
		password: m.password,
		name,
		surname,
		roleId: role,
		api,
		async open({ mobile = false } = {}) {
			const opened = await openSession(t.browser, t.base, api.token, mobile ? { viewport: t.viewport.MOBILE } : {});
			t.track(opened.context);
			return opened;
		},
	};
}
