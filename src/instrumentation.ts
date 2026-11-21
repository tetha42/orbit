import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Next.js Instrumentation Hook.
 *
 * Runs automatically on server boot:
 * 1. Generates one-time setup token if setup is incomplete.
 * 2. Hooks Node.js http.Server request lifecycle to record zero-blindspot HTTP telemetry
 *    (status codes 200, 201, 304, 400, 401, 403, 404, 500 and execution latency in ms).
 * 3. Pre-warms active dynamic security rules into memory.
 */
export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		const http = (await import('node:http')).default;
		const { ensureSetupToken } = await import('@/lib/setup');
		const { telemetryBuffer } = await import('@/server/telemetryBuffer');
		const { getActiveSecurityRules } = await import('@/db/repositories/securityRules.repo');

		ensureSetupToken({ announce: true });
		void getActiveSecurityRules().catch(() => {});

		const g = globalThis as unknown as { __httpTelemetryHooked?: boolean };
		if (g.__httpTelemetryHooked) return;
		g.__httpTelemetryHooked = true;

		const originalEmit = http.Server.prototype.emit;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		http.Server.prototype.emit = function (event: string, ...args: any[]) {
			if (event === 'request') {
				const req = args[0] as IncomingMessage | undefined;
				const res = args[1] as ServerResponse | undefined;

				if (req && res) {
					const startTime = Date.now();

					if (req.socket && req.socket.remoteAddress) {
						req.headers['x-orbit-connecting-ip'] = req.socket.remoteAddress;
					}

					res.once('finish', () => {
						try {
							const rawUrl = req.url || '/';
							const pathname = rawUrl.split('?')[0];

							if (
								pathname.startsWith('/_next/static') ||
								pathname.startsWith('/_next/webpack-hmr') ||
								pathname === '/favicon.ico'
							) {
								return;
							}

							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							if ((res as any).__orbitLogged || res.getHeader?.('x-orbit-logged') === '1' || req.headers['x-orbit-logged'] === '1') {
								return;
							}

							const latencyMs = Math.max(1, Date.now() - startTime);
							const method = req.method || 'GET';
							const statusCode = res.statusCode || 200;
							const clientIp =
								(typeof req.headers['x-orbit-client-ip'] === 'string' && req.headers['x-orbit-client-ip']) ||
								(typeof req.headers['cf-connecting-ip'] === 'string' && req.headers['cf-connecting-ip']) ||
								(typeof req.headers['x-real-ip'] === 'string' && req.headers['x-real-ip']) ||
								req.socket?.remoteAddress ||
								'127.0.0.1';
							const userAgent =
								typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;
							const riskScore = req.headers['x-orbit-risk-score']
								? Number(req.headers['x-orbit-risk-score'])
								: 0;
							const requestId =
								typeof req.headers['x-orbit-request-id'] === 'string'
									? req.headers['x-orbit-request-id']
									: undefined;

							telemetryBuffer.enqueue({
								timestamp: Date.now(),
								method,
								path: pathname,
								statusCode,
								latencyMs,
								ip: clientIp,
								userAgent,
								riskScore,
								requestId,
							});
						} catch {
							// Non-fatal telemetry hook
						}
					});
				}
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return originalEmit.apply(this, [event, ...args] as any);
		};
	}
}
