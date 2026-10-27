import { parseIpCandidate } from '@/lib/http';

export interface ThreatIntelligence {
	ip: string;
	provider: string;
	isDatacenter: boolean;
	isTor: boolean;
	riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
	classification: string;
	countryCode?: string;
	asn?: string;
}

// Regional & Turkish ISP Prefixes
const REGIONAL_ISPS: Array<{ prefix: string; provider: string; countryCode: string; asn: string }> = [
	{ prefix: '213.74.', provider: 'Turkcell Iletisim', countryCode: 'TR', asn: 'AS5323' },
	{ prefix: '212.252.', provider: 'Turkcell Iletisim', countryCode: 'TR', asn: 'AS5323' },
	{ prefix: '176.88.', provider: 'Turkcell Iletisim', countryCode: 'TR', asn: 'AS5323' },
	{ prefix: '176.89.', provider: 'Turkcell Iletisim', countryCode: 'TR', asn: 'AS5323' },
	{ prefix: '88.240.', provider: 'Turk Telekom', countryCode: 'TR', asn: 'AS9121' },
	{ prefix: '88.241.', provider: 'Turk Telekom', countryCode: 'TR', asn: 'AS9121' },
	{ prefix: '85.96.', provider: 'Turk Telekom', countryCode: 'TR', asn: 'AS9121' },
	{ prefix: '85.97.', provider: 'Turk Telekom', countryCode: 'TR', asn: 'AS9121' },
	{ prefix: '78.160.', provider: 'Turk Telekom', countryCode: 'TR', asn: 'AS9121' },
	{ prefix: '212.68.', provider: 'Vodafone Turkey', countryCode: 'TR', asn: 'AS24499' },
	{ prefix: '212.69.', provider: 'Vodafone Turkey', countryCode: 'TR', asn: 'AS24499' },
	{ prefix: '85.105.', provider: 'Vodafone Turkey', countryCode: 'TR', asn: 'AS24499' },
	{ prefix: '176.40.', provider: 'Turkcell Superonline', countryCode: 'TR', asn: 'AS34984' },
	{ prefix: '176.41.', provider: 'Turkcell Superonline', countryCode: 'TR', asn: 'AS34984' },
	{ prefix: '212.156.', provider: 'Turkcell Superonline', countryCode: 'TR', asn: 'AS34984' },
	// M247 / Commercial VPN
	{ prefix: '185.156.', provider: 'M247 Ltd (VPN/Hosting)', countryCode: 'GB', asn: 'AS9009' },
	{ prefix: '185.228.', provider: 'M247 Ltd (VPN/Hosting)', countryCode: 'GB', asn: 'AS9009' },
];

// Well-known Cloud / Datacenter IPv4 Prefixes
const CLOUD_PREFIXES: Array<{ prefix: string; provider: string }> = [
	// AWS / Amazon
	{ prefix: '3.', provider: 'Amazon AWS' },
	{ prefix: '18.', provider: 'Amazon AWS' },
	{ prefix: '34.', provider: 'Google Cloud' },
	{ prefix: '35.', provider: 'Google Cloud' },
	{ prefix: '52.', provider: 'Amazon AWS' },
	{ prefix: '54.', provider: 'Amazon AWS' },
	{ prefix: '13.', provider: 'Amazon AWS' },
	// Microsoft Azure
	{ prefix: '20.', provider: 'Microsoft Azure' },
	{ prefix: '40.', provider: 'Microsoft Azure' },
	{ prefix: '51.', provider: 'Microsoft Azure' },
	{ prefix: '104.40.', provider: 'Microsoft Azure' },
	// DigitalOcean
	{ prefix: '134.209.', provider: 'DigitalOcean' },
	{ prefix: '138.68.', provider: 'DigitalOcean' },
	{ prefix: '142.93.', provider: 'DigitalOcean' },
	{ prefix: '143.198.', provider: 'DigitalOcean' },
	{ prefix: '157.230.', provider: 'DigitalOcean' },
	{ prefix: '159.65.', provider: 'DigitalOcean' },
	{ prefix: '159.89.', provider: 'DigitalOcean' },
	{ prefix: '165.22.', provider: 'DigitalOcean' },
	{ prefix: '167.99.', provider: 'DigitalOcean' },
	{ prefix: '178.62.', provider: 'DigitalOcean' },
	{ prefix: '188.166.', provider: 'DigitalOcean' },
	{ prefix: '206.189.', provider: 'DigitalOcean' },
	// Hetzner
	{ prefix: '49.12.', provider: 'Hetzner Online' },
	{ prefix: '78.46.', provider: 'Hetzner Online' },
	{ prefix: '78.47.', provider: 'Hetzner Online' },
	{ prefix: '88.198.', provider: 'Hetzner Online' },
	{ prefix: '94.130.', provider: 'Hetzner Online' },
	{ prefix: '95.216.', provider: 'Hetzner Online' },
	{ prefix: '95.217.', provider: 'Hetzner Online' },
	{ prefix: '116.202.', provider: 'Hetzner Online' },
	{ prefix: '116.203.', provider: 'Hetzner Online' },
	{ prefix: '128.140.', provider: 'Hetzner Online' },
	{ prefix: '136.243.', provider: 'Hetzner Online' },
	{ prefix: '144.76.', provider: 'Hetzner Online' },
	{ prefix: '159.69.', provider: 'Hetzner Online' },
	{ prefix: '168.119.', provider: 'Hetzner Online' },
	// OVH
	{ prefix: '51.254.', provider: 'OVHcloud' },
	{ prefix: '51.255.', provider: 'OVHcloud' },
	{ prefix: '141.94.', provider: 'OVHcloud' },
	{ prefix: '141.95.', provider: 'OVHcloud' },
	{ prefix: '147.135.', provider: 'OVHcloud' },
	{ prefix: '152.228.', provider: 'OVHcloud' },
	// Linode / Akamai
	{ prefix: '45.79.', provider: 'Linode / Akamai' },
	{ prefix: '139.162.', provider: 'Linode / Akamai' },
	{ prefix: '172.104.', provider: 'Linode / Akamai' },
	{ prefix: '172.105.', provider: 'Linode / Akamai' },
];

// Well-known Tor exit node ranges
const TOR_PREFIXES: string[] = [
	'185.220.100.',
	'185.220.101.',
	'185.220.102.',
	'185.220.103.',
	'171.25.193.',
	'198.51.100.13',
];

/**
 * Classifies an IP address into provider, datacenter status, and threat risk.
 */
export function classifyThreatIntel(rawIp: string): ThreatIntelligence {
	const ip = parseIpCandidate(rawIp) || rawIp.trim();

	// Check Tor
	for (const torPrefix of TOR_PREFIXES) {
		if (ip.startsWith(torPrefix)) {
			return {
				ip,
				provider: 'Tor Anonymity Network',
				isDatacenter: true,
				isTor: true,
				riskLevel: 'HIGH',
				classification: 'Tor Exit Node',
			};
		}
	}

	// Check Cloud / Datacenter
	for (const { prefix, provider } of CLOUD_PREFIXES) {
		if (ip.startsWith(prefix)) {
			return {
				ip,
				provider,
				isDatacenter: true,
				isTor: false,
				riskLevel: 'MEDIUM',
				classification: `${provider} Cloud Hosting`,
			};
		}
	}

	// Check Regional / Turkish ISPs
	for (const { prefix, provider, countryCode, asn } of REGIONAL_ISPS) {
		if (ip.startsWith(prefix)) {
			return {
				ip,
				provider,
				isDatacenter: false,
				isTor: false,
				riskLevel: 'LOW',
				classification: `${provider} (${asn})`,
				countryCode,
				asn,
			};
		}
	}

	// Localhost or internal
	if (
		ip === '127.0.0.1' ||
		ip === '::1' ||
		ip.startsWith('10.') ||
		ip.startsWith('192.168.') ||
		(ip.startsWith('172.') && Number(ip.split('.')[1] || 0) >= 16 && Number(ip.split('.')[1] || 0) <= 31)
	) {
		return {
			ip,
			provider: 'Local / Docker Network',
			isDatacenter: false,
			isTor: false,
			riskLevel: 'LOW',
			classification: 'Internal Network',
			countryCode: 'LOCAL',
		};
	}

	return {
		ip,
		provider: 'Standard ISP / Residential',
		isDatacenter: false,
		isTor: false,
		riskLevel: 'LOW',
		classification: 'Public Client',
	};
}
