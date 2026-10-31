/** Small helpers for route handlers that are not tied to one feature. */
import { isIP } from 'node:net';

/**
 * Normalizes and validates a single IP candidate from an HTTP header.
 * Strips surrounding quotes, IPv6 brackets, and port suffixes before checking `isIP`.
 */
export function parseIpCandidate(raw: string | null | undefined): string | null {
	if (!raw) return null;
	let candidate = raw.trim().replace(/^["']|["']$/g, '');
	if (!candidate || candidate.toLowerCase() === 'unknown') return null;

	// [2001:db8::1]:443 -> 2001:db8::1
	if (candidate.startsWith('[')) {
		const closeIdx = candidate.indexOf(']');
		if (closeIdx === -1) return null;
		candidate = candidate.slice(1, closeIdx);
	} else if (candidate.includes('.') && candidate.includes(':')) {
		// 1.2.3.4:54321 or ::ffff:1.2.3.4
		const lastColon = candidate.lastIndexOf(':');
		const maybePort = candidate.slice(lastColon + 1);
		const hostPart = candidate.slice(0, lastColon);
		if (/^\d+$/.test(maybePort) && isIP(hostPart) === 4) {
			candidate = hostPart;
		}
	}

	// Strip IPv6 zone index (%eth0) if present
	const zoneIdx = candidate.indexOf('%');
	if (zoneIdx !== -1) {
		candidate = candidate.slice(0, zoneIdx);
	}

	let normalized = candidate.toLowerCase();
	if (normalized.startsWith('::ffff:') && normalized.slice(7).includes('.')) {
		const unwrapped = normalized.slice(7);
		if (isIP(unwrapped) === 4) {
			normalized = unwrapped;
		}
	}

	return isIP(normalized) !== 0 ? normalized : (isIP(candidate) !== 0 ? candidate.toLowerCase() : null);
}

/**
 * Known internal proxy subnets and loopbacks.
 */
export function isTrustedProxyIp(ip: string): boolean {
	if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
	// 10.0.0.0/8, 192.168.0.0/16
	if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
	// 172.16.0.0/12 (Docker / internal container networks)
	if (ip.startsWith('172.')) {
		const second = parseInt(ip.split('.')[1] || '', 10);
		if (second >= 16 && second <= 31) return true;
	}
	// IPv6 ULA (fc00::/7)
	if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
	return false;
}

/**
 * The caller's real IP address, for rate limiting and security audit logs.
 *
 * Priority order:
 *  1. `cf-connecting-ip` — set by Cloudflare edge to the true connecting client IP.
 *  2. `true-client-ip`   — Cloudflare Enterprise / CDN fallback header.
 *  3. `x-real-ip`        — set by Caddy/Nginx (`{client_ip}`).
 *  4. `x-forwarded-for`  — right-to-left traversal skipping trusted internal proxy hops.
 */
export function clientAddress(request: Request): string {
	const directHeaders = ['cf-connecting-ip', 'true-client-ip', 'x-real-ip'];
	for (const header of directHeaders) {
		const parsed = parseIpCandidate(request.headers.get(header));
		if (parsed) return parsed;
	}

	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		const parts = forwarded
			.split(',')
			.map((p) => parseIpCandidate(p))
			.filter((p): p is string => p !== null);

		if (parts.length > 0) {
			// Walk backwards from rightmost hop to find the real client before trusted reverse proxies
			for (let i = parts.length - 1; i >= 0; i--) {
				const candidate = parts[i];
				if (!isTrustedProxyIp(candidate) || i === 0) {
					return candidate;
				}
			}
			return parts[0];
		}
	}

	return 'unknown';
}

