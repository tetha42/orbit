// What a suite receives: `export default async function suite(t) { … }`.
//
//   t.base            address of the server under test
//   t.fx              the fixtures (null for suites that start from an empty database)
//   t.bootstrap       { eposta, sifre } of the .env admin (isolated suites only)
//   t.check(cond, name, extra)      one assertion; the rest still runs when it fails
//   t.eq / t.sameSet / t.includes   typed assertions with a readable failure
//   t.step(name, fn)                a group of assertions; a throw in it fails the step only
//   t.api(key)                      cookie-keeping API client signed in as a fixture account
//   t.open(key, opts)               a Chrome page signed in as that account (desktop or mobile; opts.prefs seeds the appearance, opts.colorScheme the OS scheme)
//   t.adopt(key, context)           make the browser's own (form) sign-in the session t.api(key) uses
//   t.anonymous(opts)               a Chrome page at the sign-in screen
//   t.shot(page, name)              screenshot into tests/e2e/shots/<suite>/
//   t.cleanup(fn)                   runs when the suite ends, even after a failure (last in, first out)
import fs from 'node:fs';
import path from 'node:path';
import { SHOTS, TMP } from './env.mjs';
import { account } from './fixtures.mjs';
import { client, loginApi } from './api.mjs';
import { DESKTOP, MOBILE, openAnonymous, openSession, sessionToken } from './browser.mjs';
import { sleep } from './totp.mjs';

/**
 * Signed-in API clients live for the whole run: a second sign-in would end the first
 * (one session per account). The tokens are also kept in the temp folder (ignored by
 * version control), so the next run does not wait out another 30-second code window
 * for the 2FA accounts. A token that no longer works is replaced by a fresh sign-in.
 */
const sessions = new Map();
const SESSION_FILE = path.join(TMP, 'sessions.json');
const readSaved = () => {
	try {
		return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
	} catch {
		return {};
	}
};
const saveToken = (slot, token) => {
	fs.mkdirSync(TMP, { recursive: true });
	fs.writeFileSync(SESSION_FILE, JSON.stringify({ ...readSaved(), [slot]: token }));
};

const slug = (s) =>
	String(s)
		.toLowerCase()
		.replace(/[^a-z0-9ğüşıöç]+/gi, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 70);

export function createContext({ suite, base, fx, bootstrap, browser, report }) {
	const cleanups = [];
	const contexts = [];
	// Last run's pictures would be mistaken for this run's.
	fs.rmSync(path.join(SHOTS, suite), { recursive: true, force: true });
	let shotNo = 0;
	let lastPage = null;

	const check = (cond, name, extra = '') => report(Boolean(cond), name, extra);

	const t = {
		suite,
		base,
		fx,
		bootstrap,
		browser,
		sleep,
		viewport: { DESKTOP, MOBILE },
		check,
		eq: (actual, expected, name) => check(JSON.stringify(actual) === JSON.stringify(expected), name, `beklenen ${JSON.stringify(expected)}, gelen ${JSON.stringify(actual)}`),
		/** Same members, any order. */
		sameSet: (actual, expected, name) => {
			const a = [...actual].sort();
			const e = [...expected].sort();
			check(JSON.stringify(a) === JSON.stringify(e), name, `beklenen ${JSON.stringify(e)}, gelen ${JSON.stringify(a)}`);
		},
		includes: (haystack, needle, name) => check(haystack.includes(needle), name, `${JSON.stringify(needle)} yok: ${JSON.stringify(haystack)}`),
		excludes: (haystack, needle, name) => check(!haystack.includes(needle), name, `${JSON.stringify(needle)} olmamalıydı: ${JSON.stringify(haystack)}`),

		async step(name, fn) {
			try {
				await fn();
			} catch (e) {
				report(false, name, `hata: ${String(e.message).split('\n')[0]}`);
				if (lastPage) await t.shot(lastPage, `HATA-${name}`).catch(() => {});
			}
		},

		/** Waits until `fn` returns truthy; returns the milliseconds it took, or -1 on timeout. */
		async waitFor(fn, { timeout = 15_000, every = 250 } = {}) {
			const start = Date.now();
			while (Date.now() - start < timeout) {
				if (await fn()) return Date.now() - start;
				await sleep(every);
			}
			return -1;
		},

		async shot(page, name) {
			lastPage = page;
			const dir = path.join(SHOTS, suite);
			fs.mkdirSync(dir, { recursive: true });
			const file = path.join(dir, `${String(++shotNo).padStart(2, '0')}-${slug(name)}.png`);
			await page.screenshot({ path: file });
			return file;
		},

		cleanup: (fn) => cleanups.push(fn),

		/** The fixture file as a signed-in API client; `fresh` forces a new sign-in (ending any other session of that account). */
		async api(key, { fresh = false } = {}) {
			const acc = account(fx, key);
			const slot = `${base}|${key}`;
			if (!fresh) {
				const saved = readSaved()[slot];
				for (const c of [sessions.get(slot), saved && client(base, saved)]) {
					if (!c) continue;
					const me = await c.get('/api/auth/me');
					if (me.status === 200 && me.json?.user?.eposta === acc.eposta) {
						sessions.set(slot, c);
						return c;
					}
				}
			}
			const c = await loginApi(base, acc.eposta, acc.sifre, acc.totp);
			sessions.set(slot, c);
			saveToken(slot, c.token);
			return c;
		},

		/**
		 * After signing in through the form (which ends the account's earlier session), hand the
		 * browser's new session to `t.api(key)` so it does not sign in again (and wait for a 2FA window).
		 */
		async adopt(key, context) {
			const slot = `${base}|${key}`;
			const token = await sessionToken(context, base);
			sessions.set(slot, client(base, token));
			saveToken(slot, token);
		},

		/** A page signed in as that account, reusing its API session. Closed when the suite ends. */
		async open(key, { mobile = false, prefs, colorScheme } = {}) {
			const c = await t.api(key);
			const opened = await openSession(browser, base, c.token, { viewport: mobile ? MOBILE : DESKTOP, prefs, colorScheme });
			opened.context.setDefaultTimeout(15_000);
			contexts.push(opened.context);
			lastPage = opened.page;
			return opened;
		},

		async anonymous({ mobile = false, prefs, colorScheme } = {}) {
			const opened = await openAnonymous(browser, base, { viewport: mobile ? MOBILE : DESKTOP, prefs, colorScheme });
			opened.context.setDefaultTimeout(15_000);
			contexts.push(opened.context);
			lastPage = opened.page;
			return opened;
		},

		/** A browser context of your own (a second user, a virtual authenticator…); closed when the suite ends. */
		track(context) {
			context.setDefaultTimeout(15_000);
			contexts.push(context);
			return context;
		},
	};

	const finish = async () => {
		for (const fn of cleanups.reverse()) {
			try {
				await fn();
			} catch (e) {
				report(false, 'temizlik', `hata: ${String(e.message).split('\n')[0]}`);
			}
		}
		for (const c of contexts) await c.close().catch(() => {});
	};

	return { t, finish };
}
