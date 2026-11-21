/**
 * Pure IP & CIDR utility functions for security rules evaluation.
 * Zero-dependency pure module.
 */

export function ipv4ToNumber(rawIp: string): number | null {
	const ip = rawIp.trim();
	const parts = ip.split('.');
	if (parts.length !== 4) return null;
	let num = 0;
	for (let i = 0; i < 4; i++) {
		const part = Number(parts[i]);
		if (!Number.isInteger(part) || part < 0 || part > 255 || parts[i].trim() === '') {
			return null;
		}
		num = (num << 8) | part;
	}
	return num >>> 0;
}

export function ipv6ToBigInt(rawIp: string): bigint | null {
	let ip = rawIp.trim().toLowerCase();
	if (ip.startsWith('[')) {
		const closeIdx = ip.indexOf(']');
		if (closeIdx !== -1) ip = ip.slice(1, closeIdx);
	}
	const zoneIdx = ip.indexOf('%');
	if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);

	// Handle IPv4-mapped IPv6 (::ffff:192.0.2.1)
	if (ip.startsWith('::ffff:') && ip.includes('.')) {
		const v4 = ipv4ToNumber(ip.slice(7));
		if (v4 === null) return null;
		return (0xffffn << 32n) | BigInt(v4);
	}

	const doubleColonParts = ip.split('::');
	if (doubleColonParts.length > 2) return null;

	let hextets: string[];
	if (doubleColonParts.length === 2) {
		const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
		const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
		const missing = 8 - (left.length + right.length);
		if (missing < 1) return null;
		hextets = [...left, ...Array(missing).fill('0'), ...right];
	} else {
		hextets = ip.split(':');
		if (hextets.length !== 8) return null;
	}

	let result = 0n;
	for (const h of hextets) {
		if (!/^[0-9a-f]{1,4}$/i.test(h)) return null;
		const val = BigInt(parseInt(h, 16));
		result = (result << 16n) | val;
	}
	return result;
}

export function isIpInCidr(ip: string, cidr: string): boolean {
	if (!ip || !cidr) return false;
	const cleanIp = ip.trim().toLowerCase();
	const cleanCidr = cidr.trim().toLowerCase();

	if (!cleanCidr.includes('/')) {
		const ipNum = ipv4ToNumber(cleanIp);
		const cidrNum = ipv4ToNumber(cleanCidr);
		if (ipNum !== null && cidrNum !== null) {
			return ipNum === cidrNum;
		}
		const ip6 = ipv6ToBigInt(cleanIp);
		const cidr6 = ipv6ToBigInt(cleanCidr);
		if (ip6 !== null && cidr6 !== null) {
			return ip6 === cidr6;
		}
		return cleanIp === cleanCidr;
	}

	const slashParts = cleanCidr.split('/');
	if (slashParts.length !== 2) return false;

	const [rangeIp, prefixStr] = slashParts;
	if (!prefixStr || !/^\d+$/.test(prefixStr.trim())) return false;

	const prefix = parseInt(prefixStr.trim(), 10);
	if (!Number.isInteger(prefix) || prefix < 0) return false;

	const ip4 = ipv4ToNumber(cleanIp);
	const range4 = ipv4ToNumber(rangeIp);

	if (ip4 !== null && range4 !== null) {
		if (prefix > 32) return false;
		if (prefix === 0) return true;
		const mask = ((0xffffffff << (32 - prefix)) >>> 0);
		return (ip4 & mask) === (range4 & mask);
	}

	const ip6 = ipv6ToBigInt(cleanIp);
	const range6 = ipv6ToBigInt(rangeIp);

	if (ip6 !== null && range6 !== null) {
		if (prefix > 128) return false;
		if (prefix === 0) return true;
		const shift = 128n - BigInt(prefix);
		return (ip6 >> shift) === (range6 >> shift);
	}

	return false;
}
