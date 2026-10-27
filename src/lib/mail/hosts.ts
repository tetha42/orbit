/**
 * Host checks for the SMTP connection test. Kept free of `@/` imports so
 * `scripts/check-pure.mjs` can run it.
 */

const PRIVATE_HOST_PATTERN =
	/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|::ffff:(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)|fe80:|fc00:|fd00:|::1$|0x7f\.|0177\.)/i;

const LOCAL_TLD_PATTERN = /(\.localhost|\.local|\.internal|\.lan|metadata\.google\.internal)$/i;

/**
 * True for hosts that point back inside the network. The host is admin-supplied,
 * but without this the connection test is a port scanner and an SSRF pivot.
 * Blocks private IPv4/IPv6, IPv4-mapped IPv6, cloud metadata, and internal TLDs.
 */
export function isPrivateHost(host: string): boolean {
	const bare = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
	if (!bare) return true;
	if (bare === '::1' || bare === '::') return true;
	if (PRIVATE_HOST_PATTERN.test(bare)) return true;
	if (LOCAL_TLD_PATTERN.test(bare)) return true;
	return false;
}
