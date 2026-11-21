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
 * Known internal proxy subnets, loopbacks, and Cloudflare edge IP prefixes.
 */
export function isTrustedProxyIp(ip: string): boolean {
	if (!ip) return false;
	const clean = ip.toLowerCase();
	if (clean === '127.0.0.1' || clean === '::1' || clean === '::ffff:127.0.0.1') return true;
	// 10.0.0.0/8, 192.168.0.0/16
	if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
	// 172.16.0.0/12 (Docker / internal container networks: 172.16.x - 172.31.x)
	if (clean.startsWith('172.')) {
		const second = parseInt(clean.split('.')[1] || '', 10);
		if (second >= 16 && second <= 31) return true;
		// Cloudflare 172.64.0.0/13 (172.64.0.0 - 172.71.255.255)
		if (second >= 64 && second <= 71) return true;
	}
	// Cloudflare 104.16.0.0/12 (104.16.0.0 - 104.31.255.255)
	if (clean.startsWith('104.')) {
		const second = parseInt(clean.split('.')[1] || '', 10);
		if (second >= 16 && second <= 31) return true;
	}
	// Cloudflare 162.158.0.0/15 (162.158.0.0 - 162.159.255.255)
	if (clean.startsWith('162.158.') || clean.startsWith('162.159.')) return true;
	// Cloudflare 198.41.128.0/17
	if (clean.startsWith('198.41.')) {
		const third = parseInt(clean.split('.')[2] || '', 10);
		if (third >= 128 && third <= 255) return true;
	}
	// Cloudflare other IPv4
	if (
		clean.startsWith('173.245.') ||
		clean.startsWith('103.21.') ||
		clean.startsWith('103.22.') ||
		clean.startsWith('103.31.') ||
		clean.startsWith('141.101.') ||
		clean.startsWith('108.162.') ||
		clean.startsWith('190.93.') ||
		clean.startsWith('188.114.') ||
		clean.startsWith('197.234.') ||
		clean.startsWith('131.0.72.')
	) return true;

	// IPv6 ULA (fc00::/7)
	if (clean.startsWith('fc') || clean.startsWith('fd')) return true;
	// Cloudflare IPv6
	if (
		clean.startsWith('2400:cb00:') ||
		clean.startsWith('2606:4700:') ||
		clean.startsWith('2803:f800:') ||
		clean.startsWith('2405:b500:') ||
		clean.startsWith('2405:8100:') ||
		clean.startsWith('2a06:98c0:') ||
		clean.startsWith('2c0f:f248:')
	) return true;

	return false;
}

/**
 * The caller's real IP address, for rate limiting and security audit logs.
 *
 * Only trusts ingress forwarding headers (`cf-connecting-ip`, `true-client-ip`,
 * `x-forwarded-for`) if the immediate connecting remote IP is verified via `isTrustedProxyIp`.
 */
export function clientAddress(request: Request): string {
	const req = request as unknown as {
		socket?: { remoteAddress?: string };
		connection?: { remoteAddress?: string };
		ip?: string;
	};
	const connectingIp = parseIpCandidate(
		req.socket?.remoteAddress ||
		req.connection?.remoteAddress ||
		req.ip
	);

	const proxyMode = (process.env.TRUSTED_PROXY_MODE || '').trim().toLowerCase();
	if (proxyMode === 'none') {
		return connectingIp || '127.0.0.1';
	}

	// If the connecting peer is known and is NOT a trusted proxy, do NOT trust any forwarding headers
	if (connectingIp && !isTrustedProxyIp(connectingIp)) {
		return connectingIp;
	}

	const directHeaders =
		proxyMode === 'cloudflare'
			? ['cf-connecting-ip', 'true-client-ip']
			: ['cf-connecting-ip', 'true-client-ip', 'x-real-ip'];
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

	if (connectingIp) return connectingIp;
	try {
		const urlHost = new URL(request.url).hostname.toLowerCase();
		if (urlHost === 'localhost' || urlHost === '127.0.0.1' || urlHost === '[::1]') {
			return '127.0.0.1';
		}
	} catch {
		// ignore malformed request.url
	}
	return 'unknown';
}

