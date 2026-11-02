import { existsSync, readFileSync } from 'node:fs';
import { parseIpCandidate, clientAddress } from '@/lib/http';

export interface IngressDiagnostics {
	clientIp: string;
	isDockerGateway: boolean;
	isContainer: boolean;
	detectedEdge: 'cloudflare' | 'traefik' | 'caddy' | 'nginx' | 'direct';
	forwardedChain: string[];
	trusted: boolean;
	isInfrastructureProtected: boolean;
}

let cachedIsContainer: boolean | null = null;

export function isRunningInContainer(): boolean {
	if (cachedIsContainer !== null) return cachedIsContainer;
	try {
		if (existsSync('/.dockerenv')) {
			cachedIsContainer = true;
			return true;
		}
		if (existsSync('/proc/1/cgroup')) {
			const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
			if (cgroup.includes('docker') || cgroup.includes('containerd') || cgroup.includes('kubepods')) {
				cachedIsContainer = true;
				return true;
			}
		}
	} catch {
		// Ignore filesystem errors in restricted environments
	}
	cachedIsContainer = false;
	return false;
}

/**
 * Checks if an IP is a private network or Docker infrastructure IP that
 * MUST NEVER be banned to avoid self-lockout of the entire cluster.
 */
export function isInfrastructureIp(ip: string): boolean {
	let clean = parseIpCandidate(ip) || ip.trim().toLowerCase();
	if (clean.startsWith('::ffff:') && clean.slice(7).includes('.')) {
		clean = clean.slice(7);
	}
	if (
		clean === '127.0.0.1' ||
		clean === '::1' ||
		clean === 'localhost' ||
		clean.startsWith('127.') ||
		clean === '0.0.0.0'
	) {
		return true;
	}

	// IPv4 Private Blocks (RFC 1918) & Docker bridge (172.16.0.0 - 172.31.255.255)
	const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(clean);
	if (ipv4Match) {
		const octet1 = Number(ipv4Match[1]);
		const octet2 = Number(ipv4Match[2]);
		if (octet1 === 10) return true; // 10.0.0.0/8
		if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true; // 172.16.0.0/12 (Docker default)
		if (octet1 === 192 && octet2 === 168) return true; // 192.168.0.0/16
		if (octet1 === 169 && octet2 === 254) return true; // Link-local
	}

	// IPv6 Unique Local (fc00::/7) or Link-Local (fe80::/10)
	if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80:')) {
		return true;
	}

	return false;
}

/**
 * Inspects incoming request headers and returns detailed Ingress & Proxy diagnostics.
 */
export function inspectIngress(request: Request): IngressDiagnostics {
	const clientIp = clientAddress(request);
	const headers = request.headers;

	const xff = headers.get('x-forwarded-for');
	const cfConnecting = headers.get('cf-connecting-ip');
	const cfRay = headers.get('cf-ray');
	const trueClientIp = headers.get('true-client-ip');
	const xRealIp = headers.get('x-real-ip');

	let detectedEdge: IngressDiagnostics['detectedEdge'] = 'direct';
	if (cfRay || cfConnecting) {
		detectedEdge = 'cloudflare';
	} else if (headers.has('x-traefik') || headers.get('server')?.toLowerCase().includes('traefik')) {
		detectedEdge = 'traefik';
	} else if (headers.has('x-caddy') || headers.get('server')?.toLowerCase().includes('caddy')) {
		detectedEdge = 'caddy';
	} else if (xRealIp || xff) {
		detectedEdge = 'nginx';
	}

	const forwardedChain: string[] = [];
	if (xff) {
		forwardedChain.push(...xff.split(',').map((s) => s.trim()).filter(Boolean));
	}
	if (cfConnecting && !forwardedChain.includes(cfConnecting)) {
		forwardedChain.unshift(cfConnecting.trim());
	} else if (trueClientIp && !forwardedChain.includes(trueClientIp)) {
		forwardedChain.unshift(trueClientIp.trim());
	} else if (xRealIp && !forwardedChain.includes(xRealIp)) {
		forwardedChain.push(xRealIp.trim());
	}

	const isDockerGateway = isInfrastructureIp(forwardedChain[forwardedChain.length - 1] || '');

	return {
		clientIp,
		isDockerGateway,
		isContainer: isRunningInContainer(),
		detectedEdge,
		forwardedChain,
		trusted: detectedEdge !== 'direct' || isInfrastructureIp(clientIp),
		isInfrastructureProtected: isInfrastructureIp(clientIp),
	};
}

export function getProxyAndIngressDiagnostics(request: Request) {
	const diag = inspectIngress(request);
	return {
		detectedClientIp: diag.clientIp,
		isDockerBridgeOrPrivate: diag.isInfrastructureProtected || diag.isDockerGateway,
		detectedEdge: diag.detectedEdge,
		isContainerEnvironment: diag.isContainer,
		recommendation: diag.isInfrastructureProtected
			? 'Docker bridge / RFC1918 network detected. Reverse proxy must forward X-Forwarded-For headers.'
			: undefined,
		...diag,
	};
}

