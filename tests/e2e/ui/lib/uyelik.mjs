// Members a suite makes for itself, so it never has to touch the fixture accounts' state.
//
// Each member gets an address nobody else uses (the run's own tag), a known password
// (never written down: it comes from `createMember`) and is deleted again when the
// suite ends. The API client and browser pages are made on demand.
import crypto from 'node:crypto';
import { loginApi } from './api.mjs';
import { openSession, DESKTOP, MOBILE } from './browser.mjs';
import { createMember } from './seed.mjs';

/** A short unique string for names and e-mail addresses of this run. */
export const runTag = () => `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;

/**
 * Creates an active member with the role of `rolId` and arranges for them to be
 * deleted when the suite ends. `label` shows up in the name so a leftover is easy to trace.
 */
export async function newMember(t, admin, { label, rolId, ad = 'Test', soyad: soyadOnEki, bolum, ogrenciNo }) {
	const tag = runTag();
	const soyad = `${soyadOnEki ?? label}-${tag}`;
	const eposta = `${label}.${tag}@e2e.test`.toLowerCase();
	const made = await createMember(admin, t.base, { ad, soyad, eposta, rolId, bolum, ogrenciNo });
	t.cleanup(async () => {
		await admin.del(`/api/members?id=${encodeURIComponent(made.id)}`);
	});
	let api = null;
	const member = {
		id: made.id,
		eposta,
		ad,
		soyad,
		adSoyad: `${ad} ${soyad}`,
		/** Signed-in API client (one sign-in, kept). */
		async api() {
			api ??= await loginApi(t.base, eposta, made.sifre);
			return api;
		},
		/** A Chrome page signed in as this member. */
		async open({ mobile = false } = {}) {
			const c = await member.api();
			const opened = await openSession(t.browser, t.base, c.token, { viewport: mobile ? MOBILE : DESKTOP });
			t.track(opened.context);
			return opened;
		},
	};
	return member;
}
