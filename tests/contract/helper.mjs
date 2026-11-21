import { registerTsAliasHooks } from '../../scripts/ts-loader.mjs';

registerTsAliasHooks();

export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

let nextServerPromise = null;

async function getNextServer() {
	if (!nextServerPromise) {
		nextServerPromise = import('next/server');
	}
	return nextServerPromise;
}

export async function createMockRequest(path, options = {}) {
	const { NextRequest } = await getNextServer();
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const url = `${BASE_URL}${normalizedPath}`;
	const method = (options.method || 'GET').toUpperCase();

	const hasBody = options.body !== undefined && options.body !== null && method !== 'GET' && method !== 'HEAD';
	const headers = new Headers({
		'cf-connecting-ip': '127.0.0.1',
		'user-agent': 'Orbit-Contract-Test/1.0',
		...(hasBody && typeof options.body !== 'string' && !(options.body instanceof FormData)
			? { 'content-type': 'application/json' }
			: {}),
		...(options.headers || {}),
	});

	let body;
	if (hasBody) {
		if (typeof options.body === 'string' || options.body instanceof FormData || options.body instanceof Uint8Array) {
			body = options.body;
		} else {
			body = JSON.stringify(options.body);
		}
	}

	return new NextRequest(url, {
		method,
		headers,
		...(body !== undefined ? { body } : {}),
	});
}

export async function invokeRoute(handler, path, options = {}) {
	const req = await createMockRequest(path, options);
	const res = await handler(req, options.context);

	if (options.rawResponse) {
		return {
			status: res.status,
			headers: res.headers,
			data: null,
			response: res,
		};
	}

	const text = await res.text();
	let data = text;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}

	return {
		status: res.status,
		headers: res.headers,
		data,
		response: res,
	};
}

export async function requestLive(path, options = {}) {
	const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
	const method = (options.method || 'GET').toUpperCase();
	const headers = {
		...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
		'cf-connecting-ip': '127.0.0.1',
		...options.headers,
	};

	const res = await fetch(url, {
		method,
		headers,
		body: options.body !== undefined
			? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
			: undefined,
	});

	const text = await res.text();
	let data = text;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}

	return { status: res.status, headers: res.headers, data };
}

export async function teardownContractTestResources() {
	const g = globalThis;

	if (g.__telemetryBatchBuffer) {
		const tb = g.__telemetryBatchBuffer;
		if (tb.timer) {
			clearTimeout(tb.timer);
			tb.timer = null;
		}
		if (Array.isArray(tb.queue)) {
			tb.queue.length = 0;
		}
	}

	if (
		g.__securityRulesListenerInitialized
		|| g.__securityRulesClient
		|| g.__securityRulesConnectPromise
		|| g.__securityRulesRefreshPromise
	) {
		try {
			const mod = await import('../../src/db/repositories/securityRulesCache.ts');
			await mod.closeSecurityRulesListener();
		} catch {
			/* ignore */
		}
	}

	for (const clientKey of ['__socPgClient', '__chatPgClient']) {
		if (g[clientKey]) {
			const client = g[clientKey];
			g[clientKey] = undefined;
			try {
				client.removeAllListeners?.();
				await client.end?.().catch(() => {});
			} catch {
				/* ignore */
			}
		}
	}

	if (g.__terminalInterval) {
		clearInterval(g.__terminalInterval);
		g.__terminalInterval = undefined;
	}

	const busState = g.__orbit_event_bus_v1__;
	if (busState) {
		if (busState.connecting) {
			try {
				await busState.connecting;
			} catch {
				/* ignore */
			}
		}
		if (busState.retryTimer) {
			clearTimeout(busState.retryTimer);
			busState.retryTimer = null;
		}
		if (busState.client) {
			try {
				busState.client.removeAllListeners?.();
				await busState.client.end?.().catch(() => {});
			} catch {
				/* ignore */
			}
			busState.client = null;
		}
	}

	if (g.__pgPool) {
		const pool = g.__pgPool;
		g.__pgPool = undefined;
		try {
			await pool.end();
		} catch {
			/* ignore */
		}
	}
}
