// An HTTP client that keeps the session cookie, like a browser tab would.
import { totpCode } from './totp.mjs';

export const SESSION_COOKIE = 'kulup_session_token';

export function client(base, token = '') {
	let cookie = token ? `${SESSION_COOKIE}=${token}` : '';
	const call = async (method, path, body) => {
		let res;
		// A dev server answers late or drops a connection now and then (a compile, a reload).
		// Only a request that surely never ran is repeated: refused connections, or any dropped GET.
		// Signing in is repeatable too: a socket kept alive to a server that has since been replaced
		// on the same port (the runner swaps servers between suites) fails once, and a second sign-in is harmless.
		for (let attempt = 1; ; attempt++) {
			try {
				res = await fetch(base + path, {
					method,
					headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
					body: body ? JSON.stringify(body) : undefined,
				});
				break;
			} catch (e) {
				const code = e.cause?.code ?? '';
				const repeatable = method === 'GET' || path === '/api/auth/login';
				const safe = code === 'ECONNREFUSED' || (repeatable && ['ECONNRESET', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(code));
				if (!safe || attempt >= 5) throw new Error(`${method} ${path}: ${code || e.message}`);
				await new Promise((r) => setTimeout(r, 1000 * attempt));
			}
		}
		const set = res.headers.get('set-cookie');
		if (set && set.includes(`${SESSION_COOKIE}=`)) cookie = set.split(';')[0];
		return { status: res.status, json: await res.json().catch(() => null) };
	};
	return {
		call,
		get: (path) => call('GET', path),
		post: (path, body) => call('POST', path, body ?? {}),
		patch: (path, body) => call('PATCH', path, body ?? {}),
		del: (path, body) => call('DELETE', path, body ?? {}),
		/** The session token, for putting the same session into a browser context. */
		get token() {
			return cookie.split('=')[1] ?? '';
		},
		get signedIn() {
			return Boolean(cookie);
		},
	};
}

/**
 * Signs `eposta` in over the API (answering the 2FA step with `totp` when asked)
 * and returns the client. Throws with the server's answer when it does not work.
 */
export async function loginApi(base, eposta, sifre, totp) {
	const c = client(base);
	const r = await c.post('/api/auth/login', { eposta, sifre });
	if (r.json?.require2fa) {
		if (!totp) throw new Error(`${eposta} needs a second factor but no TOTP secret was given.`);
		let v = await c.post('/api/auth/2fa/challenge', { challengeToken: r.json.challengeToken, code: await totpCode(totp) });
		// Another script may have spent this window's code; totpCode now waits for the next one.
		if (v.status !== 200) {
			const again = await c.post('/api/auth/login', { eposta, sifre });
			v = await c.post('/api/auth/2fa/challenge', { challengeToken: again.json?.challengeToken, code: await totpCode(totp) });
		}
		if (v.status !== 200) throw new Error(`2FA for ${eposta}: ${v.status} ${JSON.stringify(v.json)}`);
	} else if (r.status !== 200) throw new Error(`login ${eposta}: ${r.status} ${JSON.stringify(r.json)}`);
	return c;
}
