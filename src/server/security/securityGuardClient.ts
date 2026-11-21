/**
 * Dual-transport pooled BFF bridge to the Go Security Guard microservice (`services/security-guard`).
 * Prefers low-latency Linux Unix domain socket IPC when available, falls back to pooled
 * HTTP/TCP keep-alive connections, and finally falls back to deterministic local TS engines.
 */

import { existsSync } from 'node:fs';
import http from 'node:http';
import { URL } from 'node:url';

const GUARD_URL = (process.env.SECURITY_GUARD_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const DEFAULT_SOCKET = '/tmp/orbit-security-guard.sock';
const TIMEOUT_MS = 800;
const FIM_TIMEOUT_MS = 5000;
const NEGATIVE_CACHE_MS = 2000;

export type SecurityGuardTransportKind = 'unix' | 'tcp' | 'local-fallback';

export interface SecurityGuardHealth {
	available: boolean;
	uptime?: number;
	transport?: SecurityGuardTransportKind;
}

const unixAgent = new http.Agent({ keepAlive: true, maxSockets: 16, keepAliveMsecs: 10_000 });
const tcpAgent = new http.Agent({ keepAlive: true, maxSockets: 16, keepAliveMsecs: 10_000 });

let lastTransport: SecurityGuardTransportKind = 'local-fallback';
let guardUnavailableUntil = 0;

export function resolveGuardSocketPath(): string | null {
	const raw = (process.env.ORBIT_GUARD_SOCKET || process.env.SECURITY_GUARD_SOCKET || DEFAULT_SOCKET).trim();
	if (!raw || raw.toLowerCase() === 'none' || raw.toLowerCase() === 'off') {
		return null;
	}
	return existsSync(/*turbopackIgnore: true*/ raw) ? raw : null;
}

export function getSecurityGuardTransportInfo(): {
	transport: SecurityGuardTransportKind;
	socketPath: string | null;
	url: string;
} {
	return {
		transport: lastTransport,
		socketPath: resolveGuardSocketPath(),
		url: GUARD_URL,
	};
}

function requestViaHttpModule(
	opts: http.RequestOptions,
	body: string | undefined,
	timeoutMs: number
): Promise<{ ok: boolean; status: number; data: unknown } | null> {
	return new Promise((resolvePromise) => {
		const req = http.request(opts, (res) => {
			const chunks: Buffer[] = [];
			let totalLen = 0;
			res.on('data', (chunk: Buffer) => {
				totalLen += chunk.length;
				if (totalLen <= 4 * 1024 * 1024) chunks.push(chunk);
			});
			res.on('end', () => {
				const raw =
					chunks.length === 1
						? chunks[0].toString('utf-8')
						: Buffer.concat(chunks).toString('utf-8');
				try {
					const parsed = raw ? JSON.parse(raw) : null;
					const status = res.statusCode ?? 0;
					resolvePromise({ ok: status >= 200 && status < 300, status, data: parsed });
				} catch {
					resolvePromise(null);
				}
			});
		});

		req.setTimeout(timeoutMs, () => {
			req.destroy();
			resolvePromise(null);
		});
		req.on('error', () => {
			resolvePromise(null);
		});

		if (body) {
			req.write(body);
		}
		req.end();
	});
}

async function callGuardEndpoint(
	path: string,
	method: 'GET' | 'POST',
	payload?: unknown,
	timeoutMs = TIMEOUT_MS,
	bypassNegativeCache = false
): Promise<{ ok: boolean; status: number; data: unknown; transport: SecurityGuardTransportKind } | null> {
	if (!bypassNegativeCache && Date.now() < guardUnavailableUntil) {
		lastTransport = 'local-fallback';
		return null;
	}

	const body = payload !== undefined ? JSON.stringify(payload) : undefined;
	const headers: Record<string, string | number> = {
		Accept: 'application/json',
	};
	const guardToken = process.env.SECURITY_GUARD_TOKEN?.trim();
	if (guardToken) {
		headers.Authorization = `Bearer ${guardToken}`;
	}
	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
		headers['Content-Length'] = Buffer.byteLength(body);
	}

	// 1. Prefer Linux Unix domain socket IPC when present
	const socketPath = resolveGuardSocketPath();
	if (socketPath) {
		const res = await requestViaHttpModule(
			{
				socketPath,
				agent: unixAgent,
				path,
				method,
				headers: { ...headers, Host: 'unix', 'X-Orbit-Transport': 'unix' },
			},
			body,
			timeoutMs
		);
		if (res) {
			lastTransport = 'unix';
			guardUnavailableUntil = 0;
			return { ...res, transport: 'unix' };
		}
	}

	// 2. Fallback to pooled TCP HTTP/1.1 keep-alive
	try {
		const parsed = new URL(path, GUARD_URL);
		const tcpRes = await requestViaHttpModule(
			{
				protocol: parsed.protocol,
				hostname: parsed.hostname,
				port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
				path: `${parsed.pathname}${parsed.search}`,
				method,
				agent: tcpAgent,
				headers: { ...headers, 'X-Orbit-Transport': 'tcp' },
			},
			body,
			timeoutMs
		);
		if (tcpRes) {
			lastTransport = 'tcp';
			guardUnavailableUntil = 0;
			return { ...tcpRes, transport: 'tcp' };
		}
	} catch {
		// Invalid URL or network failure
	}

	lastTransport = 'local-fallback';
	guardUnavailableUntil = Date.now() + NEGATIVE_CACHE_MS;
	return null;
}

export function resetSecurityGuardClientState(): void {
	unixAgent.destroy();
	tcpAgent.destroy();
	guardUnavailableUntil = 0;
	lastTransport = 'local-fallback';
}

export async function checkSecurityGuardHealth(): Promise<SecurityGuardHealth> {
	const res = await callGuardEndpoint('/health', 'GET', undefined, TIMEOUT_MS, true);
	if (!res || !res.ok || !res.data || typeof res.data !== 'object') {
		return { available: false, transport: 'local-fallback' };
	}
	const data = res.data as Record<string, unknown>;
	if (data.status !== 'ok' || data.service !== 'security-guard') {
		return { available: false, transport: 'local-fallback' };
	}
	return {
		available: true,
		uptime: typeof data.uptime === 'number' ? data.uptime : undefined,
		transport: res.transport,
	};
}

export async function inspectWafWithGuard(payload: {
	pathname: string;
	search?: string;
	userAgent?: string | null;
	referer?: string | null;
	body?: string;
}): Promise<{
	matched: boolean;
	category?: string;
	points: number;
	signature?: string;
} | null> {
	const res = await callGuardEndpoint(
		'/api/waf/inspect',
		'POST',
		{
			pathname: payload.pathname,
			search: payload.search || '',
			userAgent: payload.userAgent || '',
			referer: payload.referer || '',
			body: payload.body || '',
		},
		TIMEOUT_MS
	);
	if (!res || !res.ok || !res.data || typeof res.data !== 'object') {
		return null;
	}
	return res.data as { matched: boolean; category?: string; points: number; signature?: string };
}

export async function runFimScanWithGuard(
	targetDir: string,
	saveBaseline = false
): Promise<Record<string, unknown> | null> {
	const res = await callGuardEndpoint(
		'/api/fim/scan',
		'POST',
		{ targetDir, saveBaseline },
		FIM_TIMEOUT_MS
	);
	if (!res || !res.ok || !res.data || typeof res.data !== 'object') {
		return null;
	}
	return res.data as Record<string, unknown>;
}
