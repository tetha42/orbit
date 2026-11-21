/**
 * Host and IP SSRF guards for SMTP and outbound webhooks. Kept free of `@/` imports
 * so `scripts/check-pure.mjs` can run it directly.
 */
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const PRIVATE_BLOCK_LIST = new BlockList();
PRIVATE_BLOCK_LIST.addSubnet('0.0.0.0', 8, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('10.0.0.0', 8, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('100.64.0.0', 10, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('127.0.0.0', 8, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('169.254.0.0', 16, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('172.16.0.0', 12, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('192.0.0.0', 24, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('192.168.0.0', 16, 'ipv4');
PRIVATE_BLOCK_LIST.addSubnet('198.18.0.0', 15, 'ipv4');
PRIVATE_BLOCK_LIST.addAddress('::1', 'ipv6');
PRIVATE_BLOCK_LIST.addAddress('::', 'ipv6');
PRIVATE_BLOCK_LIST.addSubnet('fc00::', 7, 'ipv6');
PRIVATE_BLOCK_LIST.addSubnet('fe80::', 10, 'ipv6');

const PRIVATE_HOST_PATTERN = new RegExp(
	'^(localhost|127\\.|0\\.0\\.0\\.0|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2\\d|3[01])\\.|100\\.(6[4-9]|[7-9]\\d|1[01]\\d|12[0-7])\\.|' +
		'\\[?::1\\]?|::ffff:(127\\.|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2\\d|3[01])\\.|' +
		'0\\.0\\.0\\.0)|fe80:|fc00:|fd00:|::1$|0x7f|0177|\\d+$)',
	'i'
);

const LOCAL_TLD_PATTERN = /(\.localhost|\.local|\.internal|\.lan|metadata\.google\.internal)$/i;

export function isPrivateIpAddress(rawIp: string): boolean {
	let ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, '');
	const zoneIdx = ip.indexOf('%');
	if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);
	if (!ip) return true;
	if (ip.startsWith('::ffff:')) {
		const v4 = ip.slice(7);
		if (isIP(v4) === 4) {
			return PRIVATE_BLOCK_LIST.check(v4, 'ipv4');
		}
	}
	const family = isIP(ip);
	if (family === 4) return PRIVATE_BLOCK_LIST.check(ip, 'ipv4');
	if (family === 6) return PRIVATE_BLOCK_LIST.check(ip, 'ipv6');
	return false;
}

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
	if (isIP(bare) !== 0 && isPrivateIpAddress(bare)) return true;
	return false;
}

/**
 * Resolves DNS A/AAAA records and verifies that every resolved IP is public.
 */
export async function resolveAndValidatePublicHost(
	host: string
): Promise<{ ok: boolean; address?: string; error?: string }> {
	if (isPrivateHost(host)) {
		return { ok: false, error: 'Connections to local, private, or internal addresses are forbidden.' };
	}
	const bare = host.trim().replace(/^\[|\]$/g, '');
	if (isIP(bare) !== 0) {
		if (isPrivateIpAddress(bare)) {
			return { ok: false, error: 'Resolved IP address is in a reserved or private range.' };
		}
		return { ok: true, address: bare };
	}
	try {
		const records = await lookup(bare, { all: true, verbatim: true });
		if (!records || records.length === 0) {
			return { ok: false, error: 'Host could not be resolved via DNS.' };
		}
		for (const rec of records) {
			if (isPrivateIpAddress(rec.address)) {
				return {
					ok: false,
					error: 'Host resolves to a local or private network IP address (SSRF blocked).',
				};
			}
		}
		return { ok: true, address: records[0].address };
	} catch {
		return { ok: false, error: 'Host DNS resolution failed.' };
	}
}

export async function validateWebhookTargetUrl(
	rawUrl: string
): Promise<{ ok: boolean; error?: string }> {
	const trimmed = String(rawUrl || '').trim();
	if (!trimmed) return { ok: false, error: 'Webhook URL is required.' };
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { ok: false, error: 'Invalid webhook URL format.' };
	}
	if (parsed.protocol !== 'https:') {
		return { ok: false, error: 'Webhook URL must use HTTPS (https://).' };
	}
	return resolveAndValidatePublicHost(parsed.hostname);
}
