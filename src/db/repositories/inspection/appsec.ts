import { logSystemEvent } from '../logs.repo';
import type { AppSecSummary, RouteSecurityReport } from './types';
import { AUDIT_ENDPOINTS, type AuditEndpointDef } from './endpoints';

let appSecCache: { timestamp: number; data: AppSecSummary } | null = null;
const CACHE_TTL_MS = 15_000;
let loopbackProbeSeq = 0;

function nextLoopbackProbeIp(targetBase: string): string | undefined {
	try {
		const host = new URL(targetBase).hostname.toLowerCase();
		if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') return undefined;
		loopbackProbeSeq = (loopbackProbeSeq + 1) % 240;
		return `192.0.2.${10 + loopbackProbeSeq}`;
	} catch {
		return undefined;
	}
}

export { AUDIT_ENDPOINTS, type AuditEndpointDef };

export async function resolveWorkingAuditBase(
	baseUrl: string
): Promise<{ targetBase: string; hostHeader?: string }> {
	let hostPort = process.env.PORT || '3000';
	let originalHost = '';
	try {
		const parsed = new URL(baseUrl);
		originalHost = parsed.host;
		if (parsed.port) hostPort = parsed.port;
	} catch {
		// Fall back to default hostPort when baseUrl is relative or unparseable.
	}

	const candidates = [
		`http://127.0.0.1:${hostPort}`,
		`http://localhost:${hostPort}`,
		baseUrl.replace(/\/+$/, ''),
	];

	for (const candidate of Array.from(new Set(candidates))) {
		try {
			const res = await fetch(`${candidate}/api/setup`, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
					...(originalHost ? { 'Host': originalHost } : {}),
				},
				signal: AbortSignal.timeout(1000),
			});
			if (res.status > 0) {
				return { targetBase: candidate, hostHeader: originalHost || undefined };
			}
		} catch {
			// Candidate base URL unreachable; continue probing remaining candidates.
		}
	}

	return { targetBase: `http://127.0.0.1:${hostPort}`, hostHeader: originalHost || undefined };
}

export async function testSingleEndpoint(
	targetBase: string,
	hostHeader: string | undefined,
	def: AuditEndpointDef,
	probeIp?: string
): Promise<RouteSecurityReport> {
	const t0 = Date.now();
	let unauthStatus = 0;
	let wafStatus = 0;
	let authGuarded = false;
	let wafIntercepted = false;
	const headersCheck = { xContentTypeOptions: false, xFrameOptions: false, csp: false };
	const method = def.method || 'GET';

	const requestHeaders: Record<string, string> = {
		'Accept': 'application/json',
		...(hostHeader ? { 'Host': hostHeader } : {}),
		...(probeIp ? { 'CF-Connecting-IP': probeIp } : {}),
	};

	try {
		const unauthUrl = `${targetBase}${def.endpoint}`;
		const unauthRes = await fetch(unauthUrl, {
			method,
			headers: {
				...requestHeaders,
				'X-AppSec-Probe': 'auth-check',
				...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
			},
			body: method === 'POST' ? JSON.stringify({}) : undefined,
			signal: AbortSignal.timeout(4000),
		});

		unauthStatus = unauthRes.status;
		headersCheck.xContentTypeOptions = !!unauthRes.headers.get('x-content-type-options');
		headersCheck.xFrameOptions = !!(
			unauthRes.headers.get('x-frame-options') ||
			unauthRes.headers.get('content-security-policy')?.includes('frame-ancestors')
		);
		headersCheck.csp = !!unauthRes.headers.get('content-security-policy');

		if (def.isPublic) {
			authGuarded = true;
		} else if (def.expectHoneypot) {
			authGuarded = unauthStatus === 403 || unauthStatus === 404;
		} else if (def.expectedUnauthStatus) {
			const expected = Array.isArray(def.expectedUnauthStatus)
				? def.expectedUnauthStatus
				: [def.expectedUnauthStatus];
			authGuarded = expected.includes(unauthStatus) || unauthStatus === 401 || unauthStatus === 403 || unauthStatus === 404;
		} else {
			authGuarded = unauthStatus === 401 || unauthStatus === 403 || unauthStatus === 404;
		}

		const wafUrl = `${targetBase}${def.endpoint}${def.endpoint.includes('?') ? '&' : '?'}probe=%3Cscript%3Ealert(1)%3C/script%3E`;
		const wafRes = await fetch(wafUrl, {
			method,
			headers: {
				...requestHeaders,
				'X-AppSec-Probe': 'waf-check',
				...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
			},
			body: method === 'POST' ? JSON.stringify({ probe: '<script>alert(1)</script>' }) : undefined,
			signal: AbortSignal.timeout(4000),
		});
		wafStatus = wafRes.status;
		wafIntercepted = wafStatus === 403;
	} catch {
		// Timeout or connection failure leaves unauthStatus=0 so caller reports WARN.
	}

	const latencyMs = Date.now() - t0;
	let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
	let message = 'Security checks passed.';

	if (unauthStatus === 0) {
		status = 'WARN';
		message = 'Cannot connect to endpoint (HTTP 0).';
	} else if (!def.isPublic && unauthStatus === 200 && !authGuarded) {
		status = 'FAIL';
		message = 'Critical Authorization Leak: Protected route returned 200 OK unauthenticated!';
	} else if (unauthStatus >= 500 || wafStatus >= 500) {
		status = 'WARN';
		message = `Server error triggered (HTTP ${unauthStatus || wafStatus}).`;
	} else if (!authGuarded) {
		status = 'WARN';
		message = `Unexpected status code: HTTP ${unauthStatus}.`;
	} else if (wafIntercepted) {
		message = 'Successfully guarded by WAF shield (HTTP 403).';
	}

	return {
		endpoint: def.endpoint,
		category: def.category,
		isPublicExpected: def.isPublic,
		unauthStatus,
		authGuarded,
		wafIntercepted,
		wafStatus,
		hasSecurityHeaders: headersCheck.xContentTypeOptions || headersCheck.xFrameOptions || headersCheck.csp,
		headers: headersCheck,
		status,
		latencyMs,
		message,
	};
}

export async function runApiSecurityScan(
	baseUrl: string,
	options: { force?: boolean } = {}
): Promise<AppSecSummary> {
	if (!options.force && appSecCache && Date.now() - appSecCache.timestamp < CACHE_TTL_MS) {
		return appSecCache.data;
	}

	const startTime = Date.now();
	const { targetBase, hostHeader } = await resolveWorkingAuditBase(baseUrl);

	const reports: RouteSecurityReport[] = [];
	for (let i = 0; i < AUDIT_ENDPOINTS.length; i += 6) {
		const batch = AUDIT_ENDPOINTS.slice(i, i + 6);
		const batchResults = await Promise.all(
			batch.map((def) => testSingleEndpoint(targetBase, hostHeader, def, nextLoopbackProbeIp(targetBase)))
		);
		reports.push(...batchResults);
	}

	const passed = reports.filter((r) => r.status === 'PASS').length;
	const warned = reports.filter((r) => r.status === 'WARN').length;
	const failed = reports.filter((r) => r.status === 'FAIL').length;
	const totalTested = reports.length;
	const wafActiveCount = reports.filter((r) => r.wafIntercepted).length;

	let score = 100 - failed * 30 - warned * 6;
	if (score < 0) score = 0;

	let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'A+';
	if (score >= 95) grade = 'A+';
	else if (score >= 85) grade = 'A';
	else if (score >= 70) grade = 'B';
	else if (score >= 50) grade = 'C';
	else grade = 'F';

	const summary: AppSecSummary = {
		totalTested,
		passed,
		warned,
		failed,
		score,
		grade,
		wafActiveCount,
		durationMs: Date.now() - startTime,
		timestamp: Date.now(),
		routes: reports,
	};

	if (failed > 0) {
		void logSystemEvent({
			service: 'security',
			level: 'ERROR',
			message: `[AppSec Alert] API scan detected ${failed} critical authorization leaks!`,
			detail: { failedRoutes: reports.filter((r) => r.status === 'FAIL').map((r) => r.endpoint) },
		});
	}

	appSecCache = { timestamp: Date.now(), data: summary };
	return summary;
}

export async function probeSingleRoute(
	baseUrl: string,
	endpoint: string
): Promise<RouteSecurityReport> {
	const { targetBase, hostHeader } = await resolveWorkingAuditBase(baseUrl);
	const found = AUDIT_ENDPOINTS.find((e) => e.endpoint === endpoint) || {
		endpoint,
		category: 'core' as const,
		isPublic: false,
		method: 'GET' as const,
	};
	return testSingleEndpoint(targetBase, hostHeader, found, nextLoopbackProbeIp(targetBase));
}
