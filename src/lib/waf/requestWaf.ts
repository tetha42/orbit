import {
	AI_RECON_CANARY_PATHS_RE,
	CMD_INJECTION_RE,
	OFFENSIVE_SCANNER_UA_RE,
	PATH_TRAVERSAL_RE,
	PROTOTYPE_POLLUTION_RE,
	SQLI_QUERY_RE,
	SSTI_QUERY_RE,
	XSS_QUERY_RE,
	type WafInspectionResult,
} from './rules.ts';

function decodeOnce(raw: string): string {
	if (!raw.includes('+') && !raw.includes('%')) return raw;
	const plusNormalized = raw.includes('+') ? raw.replace(/\+/g, ' ') : raw;
	if (!plusNormalized.includes('%')) return plusNormalized;
	try {
		return decodeURIComponent(plusNormalized);
	} catch {
		return plusNormalized.replace(/(?:%[0-9a-fA-F]{2})+/g, (chunk) => {
			try {
				return decodeURIComponent(chunk);
			} catch {
				return chunk;
			}
		});
	}
}

function safeDecode(raw: string): string {
	if (!raw) return '';
	const first = decodeOnce(raw);
	const second = first.includes('%') ? decodeOnce(first) : first;
	return second.includes('/*') ? second.replace(/\/\*[\s\S]*?\*\//g, ' ') : second;
}

export function inspectRequestComponents(input: {
	pathname: string;
	search?: string;
	userAgent?: string | null;
	referer?: string | null;
}): WafInspectionResult {
	const pathname = input.pathname || '';
	const canaryMatch = AI_RECON_CANARY_PATHS_RE.exec(pathname);
	if (canaryMatch) {
		return {
			matched: true,
			category: 'scanner',
			points: 100,
			signature: `AI & Recon Canary: ${canaryMatch[0]}`,
		};
	}

	const ua = input.userAgent ? String(input.userAgent) : '';
	const uaMatch = ua ? OFFENSIVE_SCANNER_UA_RE.exec(ua) : null;
	if (uaMatch) {
		return {
			matched: true,
			category: 'scanner',
			points: 80,
			signature: `Scanner UA: ${uaMatch[0]}`,
		};
	}

	const rawSearch = input.search || '';
	const rawTarget = rawSearch ? `${pathname}${rawSearch}` : pathname;
	const decodedPath = safeDecode(pathname);
	const decodedSearch = rawSearch ? safeDecode(rawSearch) : '';
	const decodedTarget =
		decodedPath === pathname && decodedSearch === rawSearch
			? rawTarget
			: decodedSearch
				? `${decodedPath} ${decodedSearch}`
				: decodedPath;
	const ref = input.referer ? String(input.referer) : '';

	if (
		CMD_INJECTION_RE.test(decodedTarget) ||
		(ua && CMD_INJECTION_RE.test(ua)) ||
		(ref && CMD_INJECTION_RE.test(ref))
	) {
		return {
			matched: true,
			category: 'cmd_injection',
			points: 80,
			signature: 'Command Injection / JNDI probe',
		};
	}

	if (
		SSTI_QUERY_RE.test(decodedTarget) ||
		(decodedTarget !== rawTarget && SSTI_QUERY_RE.test(rawTarget))
	) {
		return {
			matched: true,
			category: 'cmd_injection',
			points: 80,
			signature: 'Server-Side Template Injection (SSTI) probe',
		};
	}

	if (
		PROTOTYPE_POLLUTION_RE.test(rawTarget) ||
		(decodedTarget !== rawTarget && PROTOTYPE_POLLUTION_RE.test(decodedTarget))
	) {
		return {
			matched: true,
			category: 'cmd_injection',
			points: 75,
			signature: 'Prototype Pollution probe',
		};
	}

	if (
		PATH_TRAVERSAL_RE.test(rawTarget) ||
		(decodedTarget !== rawTarget && PATH_TRAVERSAL_RE.test(decodedTarget))
	) {
		return {
			matched: true,
			category: 'path_traversal',
			points: 70,
			signature: 'Path Traversal / LFI probe',
		};
	}

	if (SQLI_QUERY_RE.test(decodedTarget)) {
		return {
			matched: true,
			category: 'sqli',
			points: 65,
			signature: 'SQL Injection query signature',
		};
	}

	if (XSS_QUERY_RE.test(decodedTarget)) {
		return {
			matched: true,
			category: 'xss',
			points: 55,
			signature: 'Reflected XSS query signature',
		};
	}

	return { matched: false, points: 0 };
}

export function inspectRequestPayload(request: Request, bodyText?: string): WafInspectionResult {
	try {
		const url = new URL(request.url);
		return inspectRequestComponents({
			pathname: url.pathname,
			search: `${url.search} ${bodyText || ''}`,
			userAgent: request.headers.get('user-agent'),
			referer: request.headers.get('referer'),
		});
	} catch {
		return { matched: false, points: 0 };
	}
}

function extractStringsFromJson(value: unknown, depth = 0, maxDepth = 5): string[] {
	if (depth > maxDepth || value === null || value === undefined) return [];
	if (typeof value === 'string') return [value];
	if (typeof value === 'number' || typeof value === 'boolean') return [];
	if (Array.isArray(value)) {
		const out: string[] = [];
		for (const item of value) {
			out.push(...extractStringsFromJson(item, depth + 1, maxDepth));
			if (out.length > 50) break;
		}
		return out;
	}
	if (typeof value === 'object') {
		const out: string[] = [];
		const keys = Object.getOwnPropertyNames(value);
		for (const k of keys) {
			out.push(k);
			out.push(...extractStringsFromJson((value as Record<string, unknown>)[k], depth + 1, maxDepth));
			if (out.length > 50) break;
		}
		return out;
	}
	return [];
}

/** Recursively scans parsed JSON request bodies for exploit payloads. */
export function inspectJsonPayload(json: unknown): WafInspectionResult {
	try {
		const strings = extractStringsFromJson(json);
		for (const text of strings) {
			const res = inspectRequestComponents({
				pathname: '/',
				search: `?data=${encodeURIComponent(text.slice(0, 500))}`,
			});
			if (res.matched) return res;
		}
		return { matched: false, points: 0 };
	} catch {
		return { matched: false, points: 0 };
	}
}
