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
export const rastgeleSifre = () => `E2e-${crypto.randomBytes(9).toString('base64url')}-9!`;

/**
 * @param t        the suite context
 * @param options  `izinler` (role matrix; a role is made for it) or `rolId` (an existing role);
 *                 `ad` is the first name (shown in lists)
 * @returns { id, eposta, sifre, ad, soyad, rolId, api, open }  `api` is signed in; `open()` is a browser page signed in as it
 */
export async function geciciUye(t, { izinler, rolId, ad = 'Geçici' } = {}) {
	const admin = await t.api('admin');
	const tag = uniq();
	let role = rolId;
	if (!role) {
		role = await createRole(admin, { ad: `E2E Rol ${tag}`, renk: '#64d2ff', aciklama: 'Geçici test rolü', ikiAdimZorunlu: false, izinler });
		t.cleanup(async () => {
			await admin.del('/api/roller', { id: role, tasi: t.fx.roles.uye });
		});
	}
	const soyad = `Test${tag}`;
	const eposta = `e2e-${tag}@kulup.test`;
	const m = await createMember(admin, t.base, { ad, soyad, eposta, rolId: role });
	t.cleanup(async () => {
		await admin.del(`/api/uyeler?id=${encodeURIComponent(m.id)}`);
	});
	const api = await loginApi(t.base, eposta, m.sifre);
	return {
		id: m.id,
		eposta,
		sifre: m.sifre,
		ad,
		soyad,
		rolId: role,
		api,
		async open({ mobile = false } = {}) {
			const opened = await openSession(t.browser, t.base, api.token, mobile ? { viewport: t.viewport.MOBILE } : {});
			t.track(opened.context);
			return opened;
		},
	};
}
