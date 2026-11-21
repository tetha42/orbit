// What a suite receives: `export default async function suite(t) { … }`.
//
//   t.base            address of the server under test
//   t.fx              the fixtures (null for suites that start from an empty database)
//   t.bootstrap       { email, password } of the .env admin (isolated suites only)
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
import { totpCode, sleep } from './totp.mjs';

/**
 * Signed-in API clients live for the whole run: a second sign-in would end the first
 * (one session per account). The tokens are also kept in memory and cached on disk
 * (ignored by version control) so subsequent runs skip TOTP window waits.
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
let savedTokens = readSaved();
const saveToken = (slot, token) => {
	savedTokens[slot] = token;
	fs.mkdirSync(TMP, { recursive: true });
	fs.writeFileSync(SESSION_FILE, JSON.stringify(savedTokens));
};

/** Pre-seeds `sessions` for `base` from cloned DB `session_token` rows to avoid extra logins. */
export function seedSessionTokens(base, fx, emailToToken) {
	if (!fx || !emailToToken?.size) return 0;
	let seeded = 0;
	const assign = (key, email) => {
		const token = emailToToken.get(String(email || '').toLowerCase());
		if (!token) return;
		const slot = `${base}|${key}`;
		sessions.set(slot, client(base, token));
		savedTokens[slot] = token;
		seeded++;
	};
	assign('admin', fx.admin?.email);
	for (const [key, user] of Object.entries(fx.users ?? {})) assign(key, user?.email);
	if (seeded > 0) {
		fs.mkdirSync(TMP, { recursive: true });
		fs.writeFileSync(SESSION_FILE, JSON.stringify(savedTokens));
	}
	return seeded;
}

const slug = (s) =>
	String(s)
		.toLowerCase()
		.replace(/[^a-z0-9]+/gi, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 70);

export function createContext({ suite, base, fx, bootstrap, browser, report, log, trackServer, untrackServer }) {
	const cleanups = [];
	const contexts = [];
	/** The live page per fixture account; a new t.open(key) replaces (and closes) the old one. */
	const openByKey = new Map();
	// Last run's pictures would be mistaken for this run's.
	fs.rmSync(path.join(SHOTS, suite), { recursive: true, force: true });
	let shotNo = 0;
	let lastPage = null;
	let stepContexts = null;

	const registerContext = (context) => {
		contexts.push(context);
		if (stepContexts && !stepContexts.includes(context)) stepContexts.push(context);
	};

	const releaseContext = async (context) => {
		const idx = contexts.indexOf(context);
		if (idx >= 0) contexts.splice(idx, 1);
		for (const [k, ctx] of openByKey.entries()) {
			if (ctx === context) openByKey.delete(k);
		}
		if (lastPage) {
			try {
				if (lastPage.context() === context) lastPage = null;
			} catch {
				lastPage = null;
			}
		}
		await context.close().catch(() => {});
	};

	const check = (cond, name, extra = '') => report(Boolean(cond), name, extra);

	const t = {
		suite,
		base,
		fx,
		bootstrap,
		browser,
		sleep,
		log,
		totpCode: (secret) => totpCode(secret, base),
		trackServer,
		untrackServer,
		viewport: { DESKTOP, MOBILE },
		check,
		eq: (actual, expected, name) => check(JSON.stringify(actual) === JSON.stringify(expected), name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
		/** Same members, any order. */
		sameSet: (actual, expected, name) => {
			const a = [...actual].sort();
			const e = [...expected].sort();
			check(JSON.stringify(a) === JSON.stringify(e), name, `expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
		},
		includes: (haystack, needle, name) => check(haystack.includes(needle), name, `${JSON.stringify(needle)} missing from: ${JSON.stringify(haystack)}`),
		excludes: (haystack, needle, name) => check(!haystack.includes(needle), name, `did not expect ${JSON.stringify(needle)} in: ${JSON.stringify(haystack)}`),

		async step(name, fn) {
			const prevStep = stepContexts;
			const owned = [];
			stepContexts = owned;
			try {
				await fn();
			} catch (e) {
				report(false, name, `error: ${String(e.message).split('\n').slice(0, 3).join(' | ')}`);
				if (lastPage) await t.shot(lastPage, `ERROR-${name}`).catch(() => {});
			} finally {
				stepContexts = prevStep;
				for (const c of owned.reverse()) await releaseContext(c);
			}
		},

		/** Waits until `fn` returns truthy; returns the milliseconds it took, or -1 on timeout. */
		async waitFor(fn, { timeout = 10_000, every = 250 } = {}) {
			const start = Date.now();
			while (Date.now() - start < timeout) {
				if (await fn()) return Date.now() - start;
				await sleep(every);
			}
			return -1;
		},

		async shot(page, name) {
			lastPage = page;
			if (!name.startsWith('ERROR-') && process.env.E2E_SHOTS !== '1') return null;
			const dir = path.join(SHOTS, suite);
			fs.mkdirSync(dir, { recursive: true });
			const file = path.join(dir, `${String(++shotNo).padStart(2, '0')}-${slug(name)}.png`);
			await page.screenshot({ path: file, animations: 'disabled' });
			return file;
		},

		cleanup: (fn) => cleanups.push(fn),

		/** The fixture file as a signed-in API client; `fresh` forces a new sign-in (ending any other session of that account). */
		async api(key, { fresh = false } = {}) {
			const acc = account(fx, key);
			const slot = `${base}|${key}`;
			if (!fresh) {
				const saved = savedTokens[slot];
				for (const c of [sessions.get(slot), saved && client(base, saved)]) {
					if (!c) continue;
					const me = await c.get('/api/auth/me');
					if (me.status === 200 && me.json?.user?.email === acc.email) {
						sessions.set(slot, c);
						return c;
					}
				}
			}
			const c = await loginApi(base, acc.email, acc.password, acc.totp);
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
		async open(key, { mobile = false, prefs, colorScheme, reducedMotion } = {}) {
			const c = await t.api(key);
			const motion = reducedMotion ?? (suite === 'theme' ? 'no-preference' : 'reduce');
			// Old pages of the same account are normally dead weight: each is a full renderer
			// with a stream and timers. A suite that needs two tabs of one account does not
			// call t.open twice for it.
			const previous = openByKey.get(key);
			if (previous) await releaseContext(previous);
			const opened = await openSession(browser, base, c.token, {
				viewport: mobile ? MOBILE : DESKTOP,
				prefs,
				colorScheme,
				reducedMotion: motion,
				stubWallpapers: true,
			});
			opened.context.setDefaultTimeout(10_000);
			registerContext(opened.context);
			openByKey.set(key, opened.context);
			lastPage = opened.page;
			return opened;
		},

		async anonymous({ mobile = false, prefs, colorScheme, reducedMotion } = {}) {
			const motion = reducedMotion ?? (suite === 'theme' ? 'no-preference' : 'reduce');
			const opened = await openAnonymous(browser, base, {
				viewport: mobile ? MOBILE : DESKTOP,
				prefs,
				colorScheme,
				reducedMotion: motion,
				stubWallpapers: true,
			});
			opened.context.setDefaultTimeout(10_000);
			registerContext(opened.context);
			lastPage = opened.page;
			return opened;
		},

		/** Releases a tracked context early so multi-step suites don't accumulate extra desktops. */
		async close(context) {
			if (context) await releaseContext(context);
		},

		/** A browser context of your own (a second user, a virtual authenticator…); closed when the step or suite ends. */
		track(context) {
			context.setDefaultTimeout(10_000);
			registerContext(context);
			return context;
		},
	};

	const finish = async () => {
		for (const fn of cleanups.reverse()) {
			try {
				await fn();
			} catch (e) {
				report(false, 'cleanup', `error: ${String(e.message).split('\n')[0]}`);
			}
		}
		for (const c of contexts) await c.close().catch(() => {});
	};

	return { t, finish };
}
